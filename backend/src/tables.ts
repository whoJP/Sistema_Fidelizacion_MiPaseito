import type { Database } from '../../frontend/src/types/domain.ts'

export interface TableMeta {
  key: keyof Database
  /** Prisma Client delegate name (`prisma.<model>`). */
  model: string
  primaryKey: string[]
  /** DATETIME columns, exchanged as ISO strings. */
  dateTimes?: string[]
  /** DATE columns, exchanged as `YYYY-MM-DD`. */
  dates?: string[]
  /** TIME columns, exchanged as `HH:MM`. */
  times?: string[]
}

/** Every persisted table, parents before children so inserts satisfy foreign keys (deletes run in reverse). */
export const TABLES: TableMeta[] = [
  { key: 'users', model: 'user', primaryKey: ['id'], dateTimes: ['createdAt', 'updatedAt', 'deletedAt'], dates: ['birthDate'] },
  { key: 'businesses', model: 'business', primaryKey: ['id'], dateTimes: ['createdAt', 'updatedAt', 'deletedAt'] },
  { key: 'businessSchedules', model: 'businessSchedule', primaryKey: ['id'], times: ['openTime', 'closeTime'] },
  { key: 'businessMembers', model: 'businessMember', primaryKey: ['id'] },
  { key: 'categories', model: 'category', primaryKey: ['id'], dateTimes: ['deletedAt'] },
  { key: 'businessCategories', model: 'businessCategory', primaryKey: ['businessId', 'categoryId'] },
  { key: 'catalogItems', model: 'catalogItem', primaryKey: ['id'], dateTimes: ['deletedAt'] },
  { key: 'tiers', model: 'tier', primaryKey: ['id'] },
  { key: 'transactions', model: 'transaction', primaryKey: ['id'], dateTimes: ['createdAt'] },
  { key: 'transactionItems', model: 'transactionItem', primaryKey: ['id'] },
  { key: 'cancellationRequests', model: 'cancellationRequest', primaryKey: ['id'], dateTimes: ['createdAt', 'reviewedAt'] },
  { key: 'notifications', model: 'notification', primaryKey: ['id'], dateTimes: ['createdAt', 'readAt'] },
  { key: 'rewards', model: 'reward', primaryKey: ['id'], dateTimes: ['startsAt', 'endsAt', 'deletedAt'] },
  { key: 'redemptions', model: 'redemption', primaryKey: ['id'], dateTimes: ['createdAt', 'redeemedAt'] },
  { key: 'missions', model: 'mission', primaryKey: ['id'], dateTimes: ['startsAt', 'endsAt', 'deletedAt'] },
  { key: 'missionBusinesses', model: 'missionBusiness', primaryKey: ['missionId', 'businessId'] },
  { key: 'missionCategories', model: 'missionCategory', primaryKey: ['missionId', 'categoryId'] },
  { key: 'missionProgress', model: 'missionProgress', primaryKey: ['missionId', 'userId'], dateTimes: ['completedAt'] },
  { key: 'businessDiscoveries', model: 'businessDiscovery', primaryKey: ['userId', 'businessId'], dateTimes: ['discoveredAt'] },
  { key: 'promotions', model: 'promotion', primaryKey: ['id'], dateTimes: ['startsAt', 'endsAt', 'deletedAt'] },
  { key: 'promotionBusinesses', model: 'promotionBusiness', primaryKey: ['promotionId', 'businessId'] },
  { key: 'promotionCategories', model: 'promotionCategory', primaryKey: ['promotionId', 'categoryId'] },
  { key: 'events', model: 'event', primaryKey: ['id'], dateTimes: ['startsAt', 'endsAt', 'deletedAt'] },
  { key: 'eventAttendances', model: 'eventAttendance', primaryKey: ['eventId', 'userId'], dateTimes: ['checkedInAt'] },
  { key: 'badges', model: 'badge', primaryKey: ['id'], dateTimes: ['deletedAt'], dates: ['date'] },
  { key: 'pointMovements', model: 'pointMovement', primaryKey: ['id'], dateTimes: ['createdAt'] },
  { key: 'statusMovements', model: 'statusMovement', primaryKey: ['id'], dateTimes: ['createdAt'] },
  { key: 'fraudAlerts', model: 'fraudAlert', primaryKey: ['id'], dateTimes: ['createdAt'] },
  { key: 'auditLogs', model: 'auditLog', primaryKey: ['id'], dateTimes: ['createdAt'] },
  { key: 'systemSettings', model: 'systemSetting', primaryKey: ['key'], dateTimes: ['updatedAt'] },
]

export type Row = Record<string, unknown>

export interface Delegate {
  findMany(args?: object): Promise<Row[]>
  createMany(args: { data: Row[] }): Promise<unknown>
  updateMany(args: { where: Row; data: Row }): Promise<unknown>
  deleteMany(args?: { where?: Row }): Promise<unknown>
}

export function delegate(client: unknown, model: string): Delegate {
  return (client as Record<string, Delegate>)[model]
}

export function emptyDatabase(): Database {
  return Object.fromEntries(TABLES.map((t) => [t.key, []])) as unknown as Database
}

export const rowKey = (meta: TableMeta, row: Row) => meta.primaryKey.map((k) => String(row[k])).join('|')
export const rowWhere = (meta: TableMeta, row: Row) => Object.fromEntries(meta.primaryKey.map((k) => [k, row[k]]))
