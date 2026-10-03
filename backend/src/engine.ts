import { DomainError, expireRedemptions } from '../../frontend/src/data/actions.ts'
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

/**
 * Runs `mutation` on a copy of the current snapshot and persists the resulting diff in one transaction.
 * If `mutation` throws, nothing is written.
 */
export function transact<T>(
  mutation: (draft: Database) => T,
  options: PersistOptions = {},
): Promise<{ result: T; version: number; db: Database }> {
  return exclusive(async () => {
    const before = await loadSnapshot()
    const draft = structuredClone(before)
    const result = mutation(draft)
    const stats = await prisma.$transaction((tx) => persistDiff(tx, before, draft, options), { timeout: 20_000 })
    if (stats.created + stats.updated + stats.deleted > 0) version += 1
    cache = { version, db: draft, loadedAt: Date.now() }
    return { result, version, db: draft }
  })
}

export function executeCommand(name: CommandName, actorId: number, input: unknown) {
  return transact((draft) => {
    const actor = draft.users.find((u) => u.id === actorId && u.deletedAt === null)
    if (!actor) throw new HttpError(401, 'Tu sesión expiró, vuelve a ingresar')
    if (actor.status !== 'ACTIVE') throw new HttpError(403, 'Tu cuenta está suspendida')
    expireRedemptions(draft)
    const command = commands[name] as (db: Database, a: { id: number }, i: unknown) => unknown
    return command(draft, { id: actor.id }, input ?? {})
  })
}

/** Releases Points of redemption codes that were never used. */
export function expirePendingRedemptions() {
  return transact((draft) => expireRedemptions(draft))
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
