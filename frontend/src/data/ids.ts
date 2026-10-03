import type { Database } from '../types/domain'

type TableWithId = {
  [K in keyof Database]: Database[K] extends { id: number }[] ? K : never
}[keyof Database]

export function nextId(draft: Database, table: TableWithId): number {
  const rows = draft[table] as { id: number }[]
  return rows.reduce((max, r) => Math.max(max, r.id), 0) + 1
}
