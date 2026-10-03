import { createHash, timingSafeEqual } from 'node:crypto'
import { Router, type NextFunction, type Request, type Response } from 'express'
import {
  activePromotions,
  activeTiers,
  businessCategoryClosure,
  businessCategoryIds,
  earnedBadges,
  evaluateMission,
  isGlobalScope,
  liveMissions,
  nextTier,
  pointsBalance,
  promotionScope,
  promotionsForBusiness,
  rewardBlocker,
  rewardConditions,
  rewardRemainingStock,
  rewardTitle,
  scopeBusinesses,
  statusTotal,
  tierForStatus,
  upcomingEvents,
  visibleRewards,
} from '../../frontend/src/domain/loyalty.ts'
import { localHour, localWeekday } from '../../frontend/src/domain/time.ts'
import {
  DAYS_IN_ORDER,
  DAY_LABELS,
  POINT_MOVEMENT_LABELS,
  floorLabel,
  formatMoney,
  normalizeText,
} from '../../frontend/src/lib/format.ts'
import type { Business, CatalogItem, Database, Promotion, Reward, User } from '../../frontend/src/types/domain.ts'
import { HttpError, checkCustomerToken } from './auth.ts'
import { config } from './config.ts'
import { currentSnapshot } from './engine.ts'
import { openApiSpec } from './openapi.ts'

/**
 * Read-only API for Jarvis Paseo (Reto 2). Server-to-server, authenticated with the `X-API-Key` header.
 * Never returns password hashes, phones, birth dates or redemption tokens.
 */
export const integrationRouter = Router()

const param = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
const numberParam = (value: unknown): number | null => {
  const raw = param(value)
  const n = Number(raw)
  return raw !== '' && Number.isFinite(n) ? n : null
}
const limitParam = (value: unknown, fallback: number, max: number) =>
  Math.min(max, Math.max(1, Math.floor(numberParam(value) ?? fallback)))
const idParam = (value: unknown) => {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(422, 'Identificador inválido')
  return id
}
const matches = (query: string, ...fields: (string | null)[]) =>
  !query || fields.some((f) => f !== null && normalizeText(f).includes(normalizeText(query)))

const digest = (value: string) => createHash('sha256').update(value).digest()

function requireApiKey(req: Request, _res: Response, next: NextFunction) {
  if (!config.integrationApiKey) {
    next(new HttpError(503, 'La integración está deshabilitada (falta INTEGRATION_API_KEY en el servidor)'))
    return
  }
  const given = param(req.headers['x-api-key'])
  if (!given || !timingSafeEqual(digest(given), digest(config.integrationApiKey))) {
    next(new HttpError(401, 'API key inválida'))
    return
  }
  next()
}

// ---------- Views ----------

const pad = (n: number) => String(n).padStart(2, '0')

function isOpenNow(db: Database, businessId: number, now: Date): boolean {
  const iso = now.toISOString()
  const day = DAYS_IN_ORDER[localWeekday(iso)]
  const s = db.businessSchedules.find((x) => x.businessId === businessId && x.dayOfWeek === day)
  if (!s || s.isClosed || !s.openTime || !s.closeTime) return false
  const time = `${pad(localHour(iso))}:${pad(now.getUTCMinutes())}`
  return s.closeTime > s.openTime
    ? time >= s.openTime && time < s.closeTime
    : time >= s.openTime || time < s.closeTime
}

const isLiveBusiness = (b: Business | undefined): b is Business => !!b && b.deletedAt === null && b.status === 'ACTIVE'

const businessRef = (b: Business) => ({
  id: b.id,
  name: b.name,
  floor: b.floor,
  floorLabel: b.floor ? floorLabel(b.floor) : null,
  localNumber: b.localNumber,
})

function businessView(db: Database, b: Business, now: Date) {
  return {
    ...businessRef(b),
    description: b.description,
    logoUrl: b.logoUrl,
    phone: b.phone,
    sector: b.sector,
    categories: businessCategoryIds(db, b.id).flatMap((id) => {
      const c = db.categories.find((x) => x.id === id && x.deletedAt === null)
      return c ? [{ id: c.id, name: c.name }] : []
    }),
    openNow: isOpenNow(db, b.id, now),
    schedule: DAYS_IN_ORDER.map((day) => {
      const s = db.businessSchedules.find((x) => x.businessId === b.id && x.dayOfWeek === day)
      const closed = !s || s.isClosed || !s.openTime || !s.closeTime
      return {
        day,
        label: DAY_LABELS[day],
        isClosed: closed,
        openTime: closed ? null : s.openTime,
        closeTime: closed ? null : s.closeTime,
      }
    }),
    activePromotions: promotionsForBusiness(db, b.id, now).map((p) => ({ id: p.id, name: p.name, summary: promotionSummary(p) })),
  }
}

function catalogView(db: Database, item: CatalogItem) {
  const business = db.businesses.find((b) => b.id === item.businessId)!
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    price: item.price,
    priceLabel: formatMoney(item.price),
    isAvailable: item.isAvailable,
    business: businessRef(business),
  }
}

const promotionSummary = (p: Promotion) =>
  p.type === 'POINTS_MULTIPLIER' ? `Puntos ×${p.value} en cada compra` : `+${p.value} puntos por compra`

function promotionView(db: Database, p: Promotion) {
  const scope = promotionScope(db, p.id)
  return {
    id: p.id,
    name: p.name,
    type: p.type,
    value: p.value,
    summary: promotionSummary(p),
    startsAt: p.startsAt,
    endsAt: p.endsAt,
    appliesToAll: isGlobalScope(scope),
    businesses: isGlobalScope(scope) ? [] : scopeBusinesses(db, scope).map(businessRef),
  }
}

function rewardView(db: Database, r: Reward) {
  const business = db.businesses.find((b) => b.id === r.businessId)!
  return {
    id: r.id,
    title: rewardTitle(db, r),
    conditions: rewardConditions(db, r),
    description: r.description,
    type: r.type,
    pointsCost: r.pointsCost,
    minimumTier: r.minimumTierId ? (db.tiers.find((t) => t.id === r.minimumTierId)?.name ?? null) : null,
    remainingStock: rewardRemainingStock(db, r),
    endsAt: r.endsAt,
    business: businessRef(business),
  }
}

function findCustomer(db: Database, predicate: (u: User) => boolean): User {
  const customer = db.users.find((u) => u.role === 'CUSTOMER' && u.deletedAt === null && predicate(u))
  if (!customer) throw new HttpError(404, 'Cliente no encontrado')
  return customer
}

function customerSummary(db: Database, customer: User, now: Date) {
  const points = pointsBalance(db, customer.id)
  const status = statusTotal(db, customer.id)
  const tier = tierForStatus(db, status)
  const next = nextTier(db, status)
  const rewards = visibleRewards(db, now).map((r) => ({ reward: r, blocker: rewardBlocker(db, r, customer.id) }))

  return {
    customer: {
      id: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      accountStatus: customer.status,
      memberSince: customer.createdAt,
    },
    points,
    status,
    tier: tier ? { name: tier.name, pointsMultiplier: tier.pointsMultiplier } : null,
    nextTier: next ? { name: next.name, statusMissing: next.minimumStatus - status } : null,
    redeemableRewards: rewards.filter((x) => x.blocker === null).map((x) => rewardView(db, x.reward)),
    almostRedeemable: rewards
      .filter((x) => x.blocker === 'POINTS')
      .sort((a, b) => a.reward.pointsCost - b.reward.pointsCost)
      .slice(0, 5)
      .map((x) => ({ ...rewardView(db, x.reward), pointsMissing: x.reward.pointsCost - points })),
    activeMissions: liveMissions(db, now).map((m) => {
      const completedAt = db.missionProgress.find((p) => p.missionId === m.id && p.userId === customer.id)?.completedAt ?? null
      return {
        id: m.id,
        name: m.name,
        description: m.description,
        progress: Math.min(m.goal, evaluateMission(db, m, customer.id)),
        goal: m.goal,
        completed: completedAt !== null,
        rewardPoints: m.rewardPoints,
        endsAt: m.endsAt,
      }
    }),
    badges: earnedBadges(db, customer.id).map((b) => ({ name: b.name, description: b.description, earnedAt: b.earnedAt })),
    pendingRedemptions: db.redemptions
      .filter((r) => r.userId === customer.id && r.status === 'PENDING')
      .flatMap((r) => {
        const reward = db.rewards.find((x) => x.id === r.rewardId)
        return reward ? [{ id: r.id, title: rewardTitle(db, reward), pointsSpent: r.pointsSpent, createdAt: r.createdAt }] : []
      }),
    recentPurchases: db.transactions
      .filter((t) => t.customerId === customer.id && t.status === 'COMPLETED')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5)
      .map((t) => {
        const business = db.businesses.find((b) => b.id === t.businessId)!
        return { id: t.id, amount: t.amount, amountLabel: formatMoney(t.amount), createdAt: t.createdAt, business: businessRef(business) }
      }),
  }
}

// ---------- Routes ----------

integrationRouter.get('/openapi.json', (_req, res) => {
  res.json(openApiSpec)
})

integrationRouter.use(requireApiKey)

integrationRouter.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'paseo-points', version: 'v1' })
})

integrationRouter.get('/categories', async (_req, res) => {
  const { db } = await currentSnapshot()
  const live = db.categories.filter((c) => c.deletedAt === null && c.status === 'ACTIVE')
  const node = (id: number | null): unknown[] =>
    live.filter((c) => c.parentId === id).map((c) => ({ id: c.id, name: c.name, children: node(c.id) }))
  res.json({ data: node(null) })
})

integrationRouter.get('/businesses', async (req, res) => {
  const { db } = await currentSnapshot()
  const now = new Date()
  const q = param(req.query.q)
  const floor = param(req.query.floor).toUpperCase()
  const categoryId = numberParam(req.query.categoryId)
  const openNow = param(req.query.openNow) === 'true'
  const data = db.businesses
    .filter(isLiveBusiness)
    .filter((b) => matches(q, b.name, b.description, b.sector))
    .filter((b) => !floor || (b.floor ?? '').toUpperCase() === floor)
    .filter((b) => categoryId === null || businessCategoryClosure(db, b.id).has(categoryId))
    .filter((b) => !openNow || isOpenNow(db, b.id, now))
    .map((b) => businessView(db, b, now))
  res.json({ data })
})

integrationRouter.get('/businesses/:id', async (req, res) => {
  const { db } = await currentSnapshot()
  const now = new Date()
  const id = idParam(req.params.id)
  const business = db.businesses.find((b) => b.id === id)
  if (!isLiveBusiness(business)) throw new HttpError(404, 'Establecimiento no encontrado')
  res.json({
    data: {
      ...businessView(db, business, now),
      catalog: db.catalogItems.filter((i) => i.businessId === id && i.deletedAt === null).map((i) => catalogView(db, i)),
      rewards: visibleRewards(db, now).filter((r) => r.businessId === id).map((r) => rewardView(db, r)),
    },
  })
})

integrationRouter.get('/catalog', async (req, res) => {
  const { db } = await currentSnapshot()
  const q = param(req.query.q)
  const businessId = numberParam(req.query.businessId)
  const categoryId = numberParam(req.query.categoryId)
  const maxPrice = numberParam(req.query.maxPrice)
  const onlyAvailable = param(req.query.available) !== 'false'
  const limit = limitParam(req.query.limit, 50, 200)
  const data = db.catalogItems
    .filter((i) => i.deletedAt === null && isLiveBusiness(db.businesses.find((b) => b.id === i.businessId)))
    .filter((i) => !onlyAvailable || i.isAvailable)
    .filter((i) => businessId === null || i.businessId === businessId)
    .filter((i) => categoryId === null || businessCategoryClosure(db, i.businessId).has(categoryId))
    .filter((i) => maxPrice === null || i.price <= maxPrice)
    .filter((i) => matches(q, i.name, i.description))
    .slice(0, limit)
    .map((i) => catalogView(db, i))
  res.json({ data })
})

integrationRouter.get('/promotions', async (req, res) => {
  const { db } = await currentSnapshot()
  const businessId = numberParam(req.query.businessId)
  const now = new Date()
  const list = businessId === null ? activePromotions(db, now) : promotionsForBusiness(db, businessId, now)
  res.json({ data: list.map((p) => promotionView(db, p)) })
})

integrationRouter.get('/rewards', async (req, res) => {
  const { db } = await currentSnapshot()
  const businessId = numberParam(req.query.businessId)
  const maxPoints = numberParam(req.query.maxPoints)
  const data = visibleRewards(db)
    .filter((r) => businessId === null || r.businessId === businessId)
    .filter((r) => maxPoints === null || r.pointsCost <= maxPoints)
    .sort((a, b) => a.pointsCost - b.pointsCost)
    .map((r) => rewardView(db, r))
  res.json({ data })
})

integrationRouter.get('/events', async (req, res) => {
  const { db } = await currentSnapshot()
  const days = limitParam(req.query.days, 45, 365)
  const data = upcomingEvents(db, new Date(), days).map((e) => ({
    id: e.id,
    name: e.name,
    description: e.description,
    location: e.location,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    pointsReward: e.pointsReward,
  }))
  res.json({ data })
})

integrationRouter.get('/tiers', async (_req, res) => {
  const { db } = await currentSnapshot()
  res.json({
    data: activeTiers(db).map((t) => ({ name: t.name, minimumStatus: t.minimumStatus, pointsMultiplier: t.pointsMultiplier })),
  })
})

integrationRouter.get('/customers/lookup', async (req, res) => {
  const email = param(req.query.email).toLowerCase()
  if (!email) throw new HttpError(422, 'Falta el parámetro email')
  const { db } = await currentSnapshot()
  const customer = findCustomer(db, (u) => u.email.toLowerCase() === email)
  res.json({ data: customerSummary(db, customer, new Date()) })
})

integrationRouter.get('/customers/:id', async (req, res) => {
  const id = idParam(req.params.id)
  const { db } = await currentSnapshot()
  res.json({ data: customerSummary(db, findCustomer(db, (u) => u.id === id), new Date()) })
})

integrationRouter.get('/customers/:id/movements', async (req, res) => {
  const id = idParam(req.params.id)
  const limit = limitParam(req.query.limit, 20, 100)
  const { db } = await currentSnapshot()
  const customer = findCustomer(db, (u) => u.id === id)
  const data = db.pointMovements
    .filter((m) => m.userId === customer.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
    .slice(0, limit)
    .map((m) => {
      const tx = m.transactionId ? db.transactions.find((t) => t.id === m.transactionId) : undefined
      const business = tx ? db.businesses.find((b) => b.id === tx.businessId) : undefined
      return {
        id: m.id,
        type: m.type,
        label: POINT_MOVEMENT_LABELS[m.type],
        amount: m.amount,
        createdAt: m.createdAt,
        business: business ? businessRef(business) : null,
      }
    })
  res.json({ data })
})

/**
 * Lets the "Paseito" kiosk check a customer QR (PP1.…) without holding the signing secret. Read-only.
 * The token is never logged: errors only carry the reason.
 */
export const customerQrRouter = Router()

customerQrRouter.use(requireApiKey)

customerQrRouter.post('/verify', async (req, res) => {
  const token = req.body?.token
  if (typeof token !== 'string' || !token.trim() || token.length > 512) throw new HttpError(400, 'Falta el campo token')
  const check = checkCustomerToken(token)
  if (!check.ok) {
    if (check.reason === 'EXPIRED') throw new HttpError(410, 'El QR venció; pide al cliente que lo actualice')
    throw new HttpError(401, 'El QR no es válido')
  }
  const { db } = await currentSnapshot()
  const customer = db.users.find(
    (u) => u.id === check.userId && u.role === 'CUSTOMER' && u.deletedAt === null && u.status === 'ACTIVE',
  )
  if (!customer) throw new HttpError(404, 'Cliente no encontrado o inactivo')
  res.json({ userId: customer.id, firstName: customer.firstName, expiresAt: new Date(check.expiresAt).toISOString() })
})
