import { Prisma } from '@prisma/client'
import type { Database } from '../../frontend/src/types/domain.ts'
import { prisma } from './prisma.ts'
import { TABLES, delegate, type Row, type TableMeta } from './tables.ts'

const pad = (n: number) => String(n).padStart(2, '0')

function fromDb(meta: TableMeta, row: Row): Row {
  const out: Row = {}
  for (const [field, value] of Object.entries(row)) {
    if (field === 'passwordHash') continue
    if (value instanceof Date) {
      if (meta.times?.includes(field)) out[field] = `${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}`
      else if (meta.dates?.includes(field)) out[field] = value.toISOString().slice(0, 10)
      else out[field] = value.toISOString()
    } else if (Prisma.Decimal.isDecimal(value)) {
      out[field] = (value as Prisma.Decimal).toNumber()
    } else {
      out[field] = value
    }
  }
  return out
}

/** Loads every table into the same in-memory shape the domain functions operate on. */
export async function loadSnapshot(client: unknown = prisma): Promise<Database> {
  const entries = await Promise.all(
    TABLES.map(async (meta) => {
      const rows = await delegate(client, meta.model).findMany({
        orderBy: meta.primaryKey.map((k) => ({ [k]: 'asc' })),
      })
      return [meta.key, rows.map((r) => fromDb(meta, r))] as const
    }),
  )
  return Object.fromEntries(entries) as unknown as Database
}

/** Snapshot as seen by `viewerId`: admins see everything, others don't get personal data of other users. */
export function viewFor(db: Database, viewerId: number): Database {
  const viewer = db.users.find((u) => u.id === viewerId)
  if (viewer?.role === 'ADMIN') return db
  const businessId = db.businessMembers.find((m) => m.userId === viewerId && m.status === 'ACTIVE')?.businessId
  const businessTx = businessId === undefined ? [] : db.transactions.filter((t) => t.businessId === businessId)
  const visibleTx = new Set([...db.transactions.filter((t) => t.customerId === viewerId), ...businessTx].map((t) => t.id))
  // Staff search their purchase history by customer email, so they see it for customers who bought there.
  const clients = new Set(businessTx.map((t) => t.customerId))
  return {
    ...db,
    users: db.users.map((u) =>
      u.id === viewerId ? u : { ...u, email: clients.has(u.id) ? u.email : '', phone: null, birthDate: null },
    ),
    transactions: db.transactions.filter((t) => visibleTx.has(t.id)),
    transactionItems: db.transactionItems.filter((i) => visibleTx.has(i.transactionId)),
    pointMovements: db.pointMovements.filter((m) => m.userId === viewerId || (m.transactionId !== null && visibleTx.has(m.transactionId))),
    // The ranking needs everyone's status, but not what earned it.
    statusMovements: db.statusMovements.map((m) =>
      m.userId === viewerId || (m.transactionId !== null && visibleTx.has(m.transactionId))
        ? m
        : { ...m, transactionId: null, missionId: null, checkInId: null },
    ),
    missionProgress: db.missionProgress.filter((p) => p.userId === viewerId),
    businessDiscoveries: db.businessDiscoveries.filter((d) => d.userId === viewerId),
    cancellationRequests: viewer?.role === 'MERCHANT' ? db.cancellationRequests.filter((r) => visibleTx.has(r.transactionId)) : [],
    notifications: db.notifications.filter((n) => n.userId === viewerId),
    // The cancellation reason written by staff is for the admin only.
    redemptions: db.redemptions.map((r) => ({
      ...r,
      verificationToken: r.status === 'PENDING' && r.userId !== viewerId ? '' : r.verificationToken,
      cancelReason: null,
    })),
    eventAttendances: db.eventAttendances.filter((a) => a.userId === viewerId),
    promotions: db.promotions.filter((p) => p.userId === null || p.userId === viewerId),
    // The QR code of a space is what proves the visit: only the admin (who prints it) sees it.
    spaces: db.spaces.map((s) => ({ ...s, code: '' })),
    spaceCheckIns: db.spaceCheckIns.filter((c) => c.userId === viewerId),
    spins: db.spins.filter((s) => s.userId === viewerId),
    kycRequests: db.kycRequests.filter((r) => r.userId === viewerId),
    birthdayClaims: db.birthdayClaims.filter((c) => c.userId === viewerId || (businessId !== undefined && c.businessId === businessId)),
    fraudAlerts: [],
    auditLogs: [],
  }
}
