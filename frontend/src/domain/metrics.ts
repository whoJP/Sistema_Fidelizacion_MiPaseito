// Business metrics for the admin. Pure functions over the snapshot; nothing here is stored.
import type { Business, Database, Promotion, Transaction } from '../types/domain'
import { floorLabel } from '../lib/format'
import { businessCategoryClosure } from './loyalty'
import { addDaysKey, daysBetweenKeys, endOfLocalDay, localDateKey, localHour, localWeekday, startOfLocalDay } from './time'

export interface Period {
  /** `YYYY-MM-DD`, Bolivian calendar days, both included. */
  from: string
  to: string
}

export function previousPeriod(p: Period): Period {
  const days = daysBetweenKeys(p.from, p.to)
  return { from: addDaysKey(p.from, -days), to: addDaysKey(p.from, -1) }
}

function inPeriod(iso: string, p: Period): boolean {
  return iso >= startOfLocalDay(p.from) && iso <= endOfLocalDay(p.to)
}

export function periodTransactions(db: Database, p: Period): Transaction[] {
  return db.transactions.filter((t) => t.status === 'COMPLETED' && inPeriod(t.createdAt, p))
}

const sum = (values: number[]) => values.reduce((s, v) => s + v, 0)
const ratio = (a: number, b: number) => (b > 0 ? a / b : 0)
const round2 = (n: number) => Math.round(n * 100) / 100

// ---------- Sales & customers ----------

export interface SalesSummary {
  sales: number
  purchases: number
  averageTicket: number
  activeCustomers: number
  /** Purchases per active customer in the period. */
  frequency: number
  /** Share of active customers with 2 or more purchases in the period. */
  recurrence: number
  /** Active customers whose first purchase ever falls in the period. */
  newCustomers: number
  /** Share of the previous period's active customers who bought again in this one. */
  retention: number
}

function salesSummary(db: Database, txs: Transaction[], p: Period): SalesSummary {
  const perCustomer = new Map<number, number>()
  for (const t of txs) perCustomer.set(t.customerId, (perCustomer.get(t.customerId) ?? 0) + 1)
  const previous = new Set(periodTransactions(db, previousPeriod(p)).map((t) => t.customerId))
  const start = startOfLocalDay(p.from)
  const newCustomers = [...perCustomer.keys()].filter(
    (id) => !db.transactions.some((t) => t.customerId === id && t.status === 'COMPLETED' && t.createdAt < start),
  ).length
  const sales = round2(sum(txs.map((t) => t.amount)))
  return {
    sales,
    purchases: txs.length,
    averageTicket: ratio(sales, txs.length),
    activeCustomers: perCustomer.size,
    frequency: ratio(txs.length, perCustomer.size),
    recurrence: ratio([...perCustomer.values()].filter((n) => n >= 2).length, perCustomer.size),
    newCustomers,
    retention: ratio([...previous].filter((id) => perCustomer.has(id)).length, previous.size),
  }
}

export interface DailyPoint {
  date: string
  sales: number
  purchases: number
}

function dailySeries(txs: Transaction[], p: Period): DailyPoint[] {
  const days = daysBetweenKeys(p.from, p.to)
  const byDay = new Map<string, DailyPoint>()
  for (let i = 0; i < days; i++) {
    const date = addDaysKey(p.from, i)
    byDay.set(date, { date, sales: 0, purchases: 0 })
  }
  for (const t of txs) {
    const point = byDay.get(localDateKey(t.createdAt))
    if (!point) continue
    point.sales = round2(point.sales + t.amount)
    point.purchases += 1
  }
  return [...byDay.values()]
}

// ---------- Businesses, floors, categories ----------

export interface Breakdown {
  key: string
  label: string
  purchases: number
  sales: number
  customers: number
  averageTicket: number
}

function breakdown(txs: Transaction[], groupsOf: (t: Transaction) => { key: string; label: string }[]): Breakdown[] {
  const groups = new Map<string, { label: string; txs: Transaction[] }>()
  for (const t of txs) {
    for (const g of groupsOf(t)) {
      const entry = groups.get(g.key) ?? { label: g.label, txs: [] }
      entry.txs.push(t)
      groups.set(g.key, entry)
    }
  }
  return [...groups.entries()]
    .map(([key, { label, txs: rows }]) => {
      const sales = round2(sum(rows.map((t) => t.amount)))
      return {
        key,
        label,
        purchases: rows.length,
        sales,
        customers: new Set(rows.map((t) => t.customerId)).size,
        averageTicket: ratio(sales, rows.length),
      }
    })
    .sort((a, b) => b.sales - a.sales)
}

export function floorLabelOf(b: Business | undefined): string {
  return b?.floor ? floorLabel(b.floor) : 'Sin piso'
}

// ---------- Redemptions ----------

export interface RedemptionSummary {
  pointsIssued: number
  pointsRedeemed: number
  /** Points spent on delivered rewards / points issued, in the period. */
  rate: number
  created: number
  redeemed: number
  pending: number
  expired: number
  cancelled: number
  topRewards: { rewardId: number; businessId: number; count: number; points: number }[]
}

function redemptionSummary(db: Database, p: Period): RedemptionSummary {
  const issued = sum(
    db.pointMovements.filter((m) => m.amount > 0 && m.type !== 'REVERSAL' && inPeriod(m.createdAt, p)).map((m) => m.amount),
  )
  const created = db.redemptions.filter((r) => inPeriod(r.createdAt, p))
  const delivered = created.filter((r) => r.status === 'REDEEMED')
  const pointsRedeemed = sum(delivered.map((r) => r.pointsSpent))
  const byReward = new Map<number, { count: number; points: number }>()
  for (const r of delivered) {
    const entry = byReward.get(r.rewardId) ?? { count: 0, points: 0 }
    entry.count += 1
    entry.points += r.pointsSpent
    byReward.set(r.rewardId, entry)
  }
  return {
    pointsIssued: issued,
    pointsRedeemed,
    rate: ratio(pointsRedeemed, issued),
    created: created.length,
    redeemed: delivered.length,
    pending: created.filter((r) => r.status === 'PENDING').length,
    expired: created.filter((r) => r.status === 'EXPIRED').length,
    cancelled: created.filter((r) => r.status === 'CANCELLED').length,
    topRewards: [...byReward.entries()]
      .map(([rewardId, v]) => ({ rewardId, businessId: db.rewards.find((x) => x.id === rewardId)?.businessId ?? 0, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
  }
}

// ---------- Promotions ----------

export interface PromotionResult {
  promotion: Promotion
  purchases: number
  sales: number
  bonusPoints: number
  customers: number
  averageTicket: number
  /** Average ticket with this promotion vs purchases without any promotion, e.g. 0.18 = +18 %. */
  ticketLift: number | null
}

function promotionResults(db: Database, txs: Transaction[]): PromotionResult[] {
  const txById = new Map(txs.map((t) => [t.id, t]))
  const promoTxIds = new Set(
    db.pointMovements.filter((m) => m.type === 'PROMOTION' && m.transactionId !== null && txById.has(m.transactionId)).map((m) => m.transactionId!),
  )
  const plain = txs.filter((t) => !promoTxIds.has(t.id))
  const baseline = ratio(sum(plain.map((t) => t.amount)), plain.length)

  return db.promotions
    .filter((promo) => promo.deletedAt === null)
    .map((promotion) => {
      const movements = db.pointMovements.filter(
        (m) => m.type === 'PROMOTION' && m.promotionId === promotion.id && m.transactionId !== null && txById.has(m.transactionId),
      )
      const rows = [...new Set(movements.map((m) => m.transactionId!))].map((id) => txById.get(id)!)
      const sales = round2(sum(rows.map((t) => t.amount)))
      const averageTicket = ratio(sales, rows.length)
      return {
        promotion,
        purchases: rows.length,
        sales,
        bonusPoints: sum(movements.map((m) => m.amount)),
        customers: new Set(rows.map((t) => t.customerId)).size,
        averageTicket,
        ticketLift: rows.length > 0 && baseline > 0 ? averageTicket / baseline - 1 : null,
      }
    })
    .filter((r) => r.purchases > 0)
    .sort((a, b) => b.sales - a.sales)
}

// ---------- Cross-shopping ----------

export interface CrossShopping {
  /** Share of active customers who bought in 2 or more businesses. */
  multiStoreShare: number
  averageBusinessesPerCustomer: number
  topPairs: { a: number; b: number; customers: number }[]
}

function crossShopping(txs: Transaction[]): CrossShopping {
  const perCustomer = new Map<number, Set<number>>()
  for (const t of txs) {
    const set = perCustomer.get(t.customerId) ?? new Set<number>()
    set.add(t.businessId)
    perCustomer.set(t.customerId, set)
  }
  const pairs = new Map<string, number>()
  for (const set of perCustomer.values()) {
    const ids = [...set].sort((x, y) => x - y)
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = `${ids[i]}-${ids[j]}`
        pairs.set(key, (pairs.get(key) ?? 0) + 1)
      }
    }
  }
  const sizes = [...perCustomer.values()].map((s) => s.size)
  return {
    multiStoreShare: ratio(sizes.filter((n) => n >= 2).length, sizes.length),
    averageBusinessesPerCustomer: ratio(sum(sizes), sizes.length),
    topPairs: [...pairs.entries()]
      .map(([key, customers]) => {
        const [a, b] = key.split('-').map(Number)
        return { a, b, customers }
      })
      .sort((x, y) => y.customers - x.customers)
      .slice(0, 6),
  }
}

// ---------- Peak hours & events ----------

/** `grid[weekday][hour]` = purchases; weekday 0 = Monday. */
function peakHours(txs: Transaction[]): number[][] {
  const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0))
  for (const t of txs) grid[localWeekday(t.createdAt)][localHour(t.createdAt)] += 1
  return grid
}

export interface EventResult {
  eventId: number
  name: string
  attendees: number
  newToProgram: number
  pointsGiven: number
}

function eventResults(db: Database, p: Period): EventResult[] {
  return db.events
    .filter((e) => e.deletedAt === null)
    .map((e) => {
      const rows = db.eventAttendances.filter((a) => a.eventId === e.id && inPeriod(a.checkedInAt, p))
      const newToProgram = rows.filter(
        (a) => !db.transactions.some((t) => t.customerId === a.userId && t.status === 'COMPLETED' && t.createdAt < a.checkedInAt),
      ).length
      return { eventId: e.id, name: e.name, attendees: rows.length, newToProgram, pointsGiven: rows.length * e.pointsReward }
    })
    .filter((r) => r.attendees > 0)
    .sort((a, b) => b.attendees - a.attendees)
}

// ---------- Everything ----------

export interface Metrics {
  period: Period
  current: SalesSummary
  previous: SalesSummary
  daily: DailyPoint[]
  byBusiness: Breakdown[]
  byFloor: Breakdown[]
  byCategory: Breakdown[]
  redemptions: RedemptionSummary
  promotions: PromotionResult[]
  cross: CrossShopping
  peak: number[][]
  events: EventResult[]
}

export function computeMetrics(db: Database, period: Period): Metrics {
  const txs = periodTransactions(db, period)
  const prev = previousPeriod(period)
  const business = new Map(db.businesses.map((b) => [b.id, b]))
  const rootOf = (categoryId: number): number => {
    let c = db.categories.find((x) => x.id === categoryId)
    while (c?.parentId) c = db.categories.find((x) => x.id === c!.parentId)
    return c?.id ?? categoryId
  }

  return {
    period,
    current: salesSummary(db, txs, period),
    previous: salesSummary(db, periodTransactions(db, prev), prev),
    daily: dailySeries(txs, period),
    byBusiness: breakdown(txs, (t) => [{ key: String(t.businessId), label: business.get(t.businessId)?.name ?? '?' }]),
    byFloor: breakdown(txs, (t) => {
      const label = floorLabelOf(business.get(t.businessId))
      return [{ key: label, label }]
    }),
    byCategory: breakdown(txs, (t) => {
      const roots = new Set([...businessCategoryClosure(db, t.businessId)].map(rootOf))
      return [...roots].map((id) => ({ key: String(id), label: db.categories.find((c) => c.id === id)?.name ?? '?' }))
    }),
    redemptions: redemptionSummary(db, period),
    promotions: promotionResults(db, txs),
    cross: crossShopping(txs),
    peak: peakHours(txs),
    events: eventResults(db, period),
  }
}

// ---------- CSV export ----------

/** Semicolon-separated with comma decimals and a BOM, so Excel in Spanish opens it correctly. */
export function toCsv(rows: (string | number)[][]): string {
  const cell = (v: string | number) => {
    const text = typeof v === 'number' ? String(v).replace('.', ',') : v
    return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  return '\uFEFF' + rows.map((r) => r.map(cell).join(';')).join('\r\n')
}

export function transactionsCsv(db: Database, p: Period): string {
  const header = ['Fecha', 'Hora', 'Establecimiento', 'Piso', 'Cliente', 'Correo', 'Monto (Bs)', 'Puntos', 'Estado']
  const STATUS = { COMPLETED: 'Completada', CANCELLED: 'Anulada', FLAGGED: 'En revisión' } as const
  const rows = db.transactions
    .filter((t) => inPeriod(t.createdAt, p))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((t) => {
      const b = db.businesses.find((x) => x.id === t.businessId)
      const u = db.users.find((x) => x.id === t.customerId)
      const points = sum(db.pointMovements.filter((m) => m.transactionId === t.id && m.type !== 'REVERSAL').map((m) => m.amount))
      return [
        localDateKey(t.createdAt),
        `${String(localHour(t.createdAt)).padStart(2, '0')}:${t.createdAt.slice(14, 16)}`,
        b?.name ?? '?',
        floorLabelOf(b),
        u ? `${u.firstName} ${u.lastName}` : '?',
        u?.email ?? '',
        t.amount,
        points,
        STATUS[t.status],
      ]
    })
  return toCsv([header, ...rows])
}

export function summaryCsv(m: Metrics): string {
  const pct = (n: number) => `${(n * 100).toFixed(1).replace('.', ',')} %`
  const c = m.current
  return toCsv([
    ['Métricas Paseo Points', `${m.period.from} a ${m.period.to}`],
    [],
    ['Indicador', 'Valor'],
    ['Ventas registradas (Bs)', c.sales],
    ['Compras', c.purchases],
    ['Ticket promedio (Bs)', round2(c.averageTicket)],
    ['Clientes activos', c.activeCustomers],
    ['Clientes nuevos', c.newCustomers],
    ['Compras por cliente', round2(c.frequency)],
    ['Recurrencia (2+ compras)', pct(c.recurrence)],
    ['Retención vs período anterior', pct(c.retention)],
    ['Puntos entregados', m.redemptions.pointsIssued],
    ['Puntos canjeados', m.redemptions.pointsRedeemed],
    ['Tasa de canje', pct(m.redemptions.rate)],
    ['Clientes en 2+ establecimientos', pct(m.cross.multiStoreShare)],
    [],
    ['Establecimiento', 'Compras', 'Ventas (Bs)', 'Clientes', 'Ticket promedio (Bs)'],
    ...m.byBusiness.map((b) => [b.label, b.purchases, b.sales, b.customers, round2(b.averageTicket)]),
    [],
    ['Piso', 'Compras', 'Ventas (Bs)', 'Clientes'],
    ...m.byFloor.map((b) => [b.label, b.purchases, b.sales, b.customers]),
    [],
    ['Categoría', 'Compras', 'Ventas (Bs)', 'Clientes'],
    ...m.byCategory.map((b) => [b.label, b.purchases, b.sales, b.customers]),
    [],
    ['Promoción', 'Compras', 'Ventas (Bs)', 'Puntos extra', 'Clientes'],
    ...m.promotions.map((r) => [r.promotion.name, r.purchases, r.sales, r.bonusPoints, r.customers]),
  ])
}
