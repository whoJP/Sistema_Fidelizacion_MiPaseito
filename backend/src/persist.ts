import type { Prisma } from '@prisma/client'
import type { Database } from '../../frontend/src/types/domain.ts'
import { TABLES, delegate, rowKey, rowWhere, type Row, type TableMeta } from './tables.ts'

export interface PersistOptions {
  /** bcrypt hash stored for every user row being inserted. */
  newUserPasswordHash?: string
}

function toDb(meta: TableMeta, row: Row): Row {
  const out: Row = { ...row }
  for (const field of [...(meta.dateTimes ?? []), ...(meta.dates ?? [])]) {
    if (typeof out[field] === 'string') out[field] = new Date(out[field] as string)
  }
  for (const field of meta.times ?? []) {
    if (typeof out[field] === 'string') out[field] = new Date(`1970-01-01T${out[field]}:00.000Z`)
  }
  return out
}

function changedFields(before: Row, after: Row): Row | null {
  const diff: Row = {}
  for (const [field, value] of Object.entries(after)) {
    if (JSON.stringify(value) !== JSON.stringify(before[field])) diff[field] = value
  }
  return Object.keys(diff).length > 0 ? diff : null
}

export interface PersistStats {
  created: number
  updated: number
  deleted: number
}

/**
 * Writes the difference between two snapshots inside the given transaction client.
 * Rows are matched by primary key; ids assigned by the domain layer are inserted as-is.
 */
export async function persistDiff(
  tx: Prisma.TransactionClient,
  before: Database,
  after: Database,
  options: PersistOptions = {},
): Promise<PersistStats> {
  const stats: PersistStats = { created: 0, updated: 0, deleted: 0 }
  const deletions: { meta: TableMeta; rows: Row[] }[] = []

  for (const meta of TABLES) {
    const previous = new Map((before[meta.key] as unknown as Row[]).map((r) => [rowKey(meta, r), r]))
    const next = after[meta.key] as unknown as Row[]
    const nextKeys = new Set(next.map((r) => rowKey(meta, r)))
    const table = delegate(tx, meta.model)

    const created = next.filter((r) => !previous.has(rowKey(meta, r))).map((r) => toDb(meta, r))
    if (meta.key === 'users' && created.length > 0) {
      if (!options.newUserPasswordHash) throw new Error('Users can only be created with a password hash')
      for (const row of created) row.passwordHash = options.newUserPasswordHash
    }
    if (created.length > 0) await table.createMany({ data: created })
    stats.created += created.length

    for (const row of next) {
      const old = previous.get(rowKey(meta, row))
      const diff = old && changedFields(old, row)
      if (!diff) continue
      await table.updateMany({ where: rowWhere(meta, row), data: toDb(meta, diff) })
      stats.updated += 1
    }

    const removed = [...previous.values()].filter((r) => !nextKeys.has(rowKey(meta, r)))
    if (removed.length > 0) deletions.push({ meta, rows: removed })
  }

  for (const { meta, rows } of deletions.reverse()) {
    for (const row of rows) await delegate(tx, meta.model).deleteMany({ where: rowWhere(meta, row) })
    stats.deleted += rows.length
  }
  return stats
}
