import type { Prisma } from '@prisma/client'
import { DomainError, expireRedemptions, runDailyJobs } from '../../frontend/src/data/actions.ts'
import { commands, type CommandName } from '../../frontend/src/data/commands.ts'
import type { Database } from '../../frontend/src/types/domain.ts'
import { HttpError } from './auth.ts'
import { persistDiff, type PersistOptions } from './persist.ts'
import { prisma } from './prisma.ts'
import { loadSnapshot } from './snapshot.ts'
import { TABLES, delegate, emptyDatabase } from './tables.ts'

const CACHE_TTL_MS = 5_000

let queue: Promise<unknown> = Promise.resolve()
let version = 1
let cache: { version: number; db: Database; loadedAt: number } | null = null

/** Writes are serialized in-process so each command sees the result of the previous one. */
function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const result = queue.then(task, task)
  queue = result.catch(() => undefined)
  return result
}

/** Cached for a few seconds; rows changed outside the API (seed, manual SQL) still bump the version on reload. */
export async function currentSnapshot(): Promise<{ version: number; db: Database }> {
  if (cache && cache.version === version && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache
  const db = await loadSnapshot()
  if (cache && JSON.stringify(cache.db) !== JSON.stringify(db)) version += 1
  cache = { version, db, loadedAt: Date.now() }
  return cache
}

/** A write sent with an `Idempotency-Key` header. */
export interface Idempotency {
  userId: number
  key: string
  endpoint: string
  requestHash: string
}

export const IDEMPOTENCY_TTL_MS = 24 * 3600_000

/** Result stored for a key, or null when the key is new. Same key with another request → 422. */
async function storedResult(idempotency: Idempotency): Promise<{ value: unknown } | null> {
  const row = await prisma.idempotencyKey.findUnique({ where: { userId_key: { userId: idempotency.userId, key: idempotency.key } } })
  if (!row || row.createdAt.getTime() < Date.now() - IDEMPOTENCY_TTL_MS) return null
  if (row.endpoint !== idempotency.endpoint || row.requestHash !== idempotency.requestHash) {
    throw new HttpError(422, 'Esta clave de idempotencia ya se usó con otra solicitud')
  }
  return { value: row.response }
}

/**
 * Runs `mutation` on a copy of the current snapshot and persists the resulting diff in one transaction.
 * If `mutation` throws, nothing is written. With `idempotency`, a key already used returns its stored result
 * (`replayed: true`) without running `mutation` again.
 */
export function transact<T>(
  mutation: (draft: Database) => T,
  options: PersistOptions = {},
  /** Extra writes outside the snapshot (e.g. the KYC photo), committed or rolled back with the diff. */
  after?: (tx: Prisma.TransactionClient, result: T) => Promise<unknown>,
  idempotency?: Idempotency,
): Promise<{ result: T; version: number; db: Database; replayed: boolean }> {
  return exclusive(async () => {
    if (idempotency) {
      const stored = await storedResult(idempotency)
      if (stored) {
        const { version: current, db } = await currentSnapshot()
        return { result: stored.value as T, version: current, db, replayed: true }
      }
    }
    const before = await loadSnapshot()
    const draft = structuredClone(before)
    const result = mutation(draft)
    const stats = await prisma.$transaction(
      async (tx) => {
        const s = await persistDiff(tx, before, draft, options)
        if (after) await after(tx, result)
        if (idempotency) {
          const { userId, key, endpoint, requestHash } = idempotency
          const response = JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue
          await tx.idempotencyKey.deleteMany({ where: { userId, key } })
          await tx.idempotencyKey.create({ data: { userId, key, endpoint, requestHash, response } })
        }
        return s
      },
      { timeout: 20_000 },
    )
    if (stats.created + stats.updated + stats.deleted > 0) version += 1
    cache = { version, db: draft, loadedAt: Date.now() }
    return { result, version, db: draft, replayed: false }
  })
}

/** Keys older than a day can no longer be replayed. */
export function purgeIdempotencyKeys() {
  return prisma.idempotencyKey.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - IDEMPOTENCY_TTL_MS) } } })
}

/** ID photos are only kept while the request waits for review. */
const dropReviewedKycDocuments = (tx: Prisma.TransactionClient) =>
  tx.kycDocument.deleteMany({ where: { request: { status: { not: 'PENDING' } } } })

export function executeCommand(name: CommandName, actorId: number, input: unknown, idempotency?: Idempotency) {
  return transact(
    (draft) => {
      const actor = draft.users.find((u) => u.id === actorId && u.deletedAt === null)
      if (!actor) throw new HttpError(401, 'Tu sesión expiró, vuelve a ingresar')
      if (actor.status !== 'ACTIVE') throw new HttpError(403, 'Tu cuenta está suspendida')
      expireRedemptions(draft)
      const command = commands[name] as (db: Database, a: { id: number }, i: unknown) => unknown
      return command(draft, { id: actor.id }, input ?? {})
    },
    {},
    name === 'reviewKyc' ? dropReviewedKycDocuments : undefined,
    idempotency,
  )
}

/** Releases Points of redemption codes that were never used. */
export function expirePendingRedemptions() {
  return transact((draft) => expireRedemptions(draft))
}

/** Birthdays, points expiration and automatic personal promotions. Idempotent. */
export function runScheduledJobs() {
  return transact((draft) => runDailyJobs(draft))
}

/** Replaces every row with `db` (used by the seed and the demo reset). */
export function replaceAll(db: Database, options: PersistOptions) {
  return exclusive(async () => {
    await prisma.$transaction(
      async (tx) => {
        await tx.category.updateMany({ data: { parentId: null } })
        for (const meta of [...TABLES].reverse()) await delegate(tx, meta.model).deleteMany({})
        await persistDiff(tx, emptyDatabase(), db, options)
      },
      { timeout: 60_000 },
    )
    version += 1
    cache = null
  })
}

export { DomainError }
