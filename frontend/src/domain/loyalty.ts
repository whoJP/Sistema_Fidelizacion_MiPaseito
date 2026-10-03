import type {
  Badge,
  Business,
  Category,
  Database,
  Mission,
  PaseoEvent,
  Promotion,
  Reward,
  Tier,
  Transaction,
} from '../types/domain'
import { formatDateKey, formatInt, formatMoney } from '../lib/format'
import { localDateKey, todayKey } from './time'

export const SETTING_DEFAULTS = {
  POINTS_BASE_RATE: '1',
  STATUS_BASE_RATE: '1',
  DISCOVERY_STATUS_BONUS: '50',
  STREAK_STATUS_BONUS: '10',
  REDEMPTION_EXPIRATION_MINUTES: '15',
  ABNORMAL_AMOUNT_THRESHOLD: '5000',
  WELCOME_STATUS_BONUS: '225',
  VISIT_CARD_SIZE: '10',
  VISIT_CARD_GIFT_STAMPS: '2',
  VISIT_CARD_MULTIPLIER: '2',
  VISIT_CARD_VALID_DAYS: '7',
  SPIN_COST: '50',
  SPIN_EXTRA_MIN_PURCHASE: '100',
  SPIN_EXTRA_DAILY_MAX: '3',
  SPIN_MILESTONE_STATUS: '1000',
  BIRTHDAY_BONUS_POINTS: '200',
  BIRTHDAY_REWARD_MAX_POINTS: '1000',
  POINTS_EXPIRATION_MONTHS: '12',
  POINTS_EXPIRATION_NOTICE_DAYS: '15',
  REACTIVATION_DAYS: '30',
  AUTO_PROMO_MULTIPLIER: '2',
  AUTO_PROMO_DAYS: '7',
} as const

export type SettingKey = keyof typeof SETTING_DEFAULTS

export function getSetting(db: Database, key: SettingKey): number {
  const row = db.systemSettings.find((s) => s.key === key)
  const value = Number(row?.value ?? SETTING_DEFAULTS[key])
  return Number.isFinite(value) ? value : Number(SETTING_DEFAULTS[key])
}

const isLive = <T extends { deletedAt: string | null }>(row: T) => row.deletedAt === null

// ---------- Balances (never stored) ----------

export function pointsBalance(db: Database, userId: number): number {
  return db.pointMovements.reduce((sum, m) => (m.userId === userId ? sum + m.amount : sum), 0)
}

export function statusTotal(db: Database, userId: number): number {
  return db.statusMovements.reduce((sum, m) => (m.userId === userId ? sum + m.amount : sum), 0)
}

export function activeTiers(db: Database): Tier[] {
  return db.tiers.filter((t) => t.isActive).sort((a, b) => a.minimumStatus - b.minimumStatus)
}

export function tierForStatus(db: Database, status: number): Tier | null {
  let current: Tier | null = null
  for (const tier of activeTiers(db)) {
    if (tier.minimumStatus <= status) current = tier
  }
  return current
}

export function nextTier(db: Database, status: number): Tier | null {
  return activeTiers(db).find((t) => t.minimumStatus > status) ?? null
}

export function currentTier(db: Database, userId: number): Tier | null {
  return tierForStatus(db, statusTotal(db, userId))
}

// ---------- Categories ----------

export function businessCategoryIds(db: Database, businessId: number): number[] {
  return db.businessCategories.filter((bc) => bc.businessId === businessId).map((bc) => bc.categoryId)
}

/** A business belongs to a category if linked to it or to any of its subcategories. */
export function categoryWithAncestors(db: Database, categoryId: number): number[] {
  const ids: number[] = []
  let current = db.categories.find((c) => c.id === categoryId)
  while (current && !ids.includes(current.id)) {
    ids.push(current.id)
    current = current.parentId ? db.categories.find((c) => c.id === current!.parentId) : undefined
  }
  return ids
}

export function businessCategoryClosure(db: Database, businessId: number): Set<number> {
  const ids = new Set<number>()
  for (const id of businessCategoryIds(db, businessId)) {
    for (const ancestor of categoryWithAncestors(db, id)) ids.add(ancestor)
  }
  return ids
}

export function rootCategories(db: Database): Category[] {
  return db.categories.filter((c) => c.parentId === null && isLive(c))
}

// ---------- Scope (Mission / Promotion) ----------

interface Scope {
  businessIds: number[]
  categoryIds: number[]
}

function inScope(db: Database, scope: Scope, businessId: number): boolean {
  if (scope.businessIds.length === 0 && scope.categoryIds.length === 0) return true
  if (scope.businessIds.includes(businessId)) return true
  const closure = businessCategoryClosure(db, businessId)
  return scope.categoryIds.some((id) => closure.has(id))
}

export function missionScope(db: Database, missionId: number): Scope {
  return {
    businessIds: db.missionBusinesses.filter((r) => r.missionId === missionId).map((r) => r.businessId),
    categoryIds: db.missionCategories.filter((r) => r.missionId === missionId).map((r) => r.categoryId),
  }
}

export function promotionScope(db: Database, promotionId: number): Scope {
  return {
    businessIds: db.promotionBusinesses
      .filter((r) => r.promotionId === promotionId)
      .map((r) => r.businessId),
    categoryIds: db.promotionCategories
      .filter((r) => r.promotionId === promotionId)
      .map((r) => r.categoryId),
  }
}

export function isGlobalScope(scope: Scope): boolean {
  return scope.businessIds.length === 0 && scope.categoryIds.length === 0
}

export function scopeBusinesses(db: Database, scope: Scope): Business[] {
  return db.businesses.filter((b) => isLive(b) && b.status === 'ACTIVE' && inScope(db, scope, b.id))
}

/** Products of a purchase with their name, for receipts and history. */
export function purchaseLines(db: Database, transactionId: number) {
  return db.transactionItems
    .filter((i) => i.transactionId === transactionId)
    .map((i) => ({ ...i, name: db.catalogItems.find((c) => c.id === i.catalogItemId)?.name ?? 'Producto' }))
}

const withinWindow = (now: Date, startsAt: string | null, endsAt: string | null) =>
  (!startsAt || new Date(startsAt) <= now) && (!endsAt || new Date(endsAt) >= now)

// ---------- Rewards ----------

export function rewardRedeemedCount(db: Database, rewardId: number): number {
  return db.redemptions.filter((r) => r.rewardId === rewardId && r.status !== 'CANCELLED' && r.status !== 'EXPIRED')
    .length
}

export function rewardRemainingStock(db: Database, reward: Reward): number | null {
  return reward.stock === null ? null : Math.max(0, reward.stock - rewardRedeemedCount(db, reward.id))
}

/** Active rewards whose business is open for the program. */
export function visibleRewards(db: Database, now = new Date()): Reward[] {
  return db.rewards.filter((r) => {
    const business = db.businesses.find((b) => b.id === r.businessId)
    return (
      isLive(r) &&
      r.status === 'ACTIVE' &&
      withinWindow(now, r.startsAt, r.endsAt) &&
      !!business &&
      isLive(business) &&
      business.status === 'ACTIVE'
    )
  })
}

/** Fields shared by a Reward and a BirthdayPerk, enough to describe what the customer receives. */
export type RewardLike = Pick<Reward, 'type' | 'discountPercent' | 'discountAmount' | 'catalogItemId' | 'quantity' | 'description'>

/** Human title built from the structured fields, so every business presents rewards the same way. */
export function rewardTitle(db: Database, reward: RewardLike): string {
  switch (reward.type) {
    case 'PERCENT_DISCOUNT':
      return reward.discountPercent ? `${reward.discountPercent}% de descuento` : 'Descuento'
    case 'AMOUNT_DISCOUNT':
      return reward.discountAmount ? `${formatMoney(reward.discountAmount)} de descuento` : 'Descuento'
    case 'FREE_PRODUCT': {
      const item = db.catalogItems.find((i) => i.id === reward.catalogItemId)
      if (!item) return reward.description ?? 'Producto de regalo'
      return reward.quantity > 1 ? `${reward.quantity} × ${item.name} de regalo` : `${item.name} de regalo`
    }
  }
}

/** Short conditions shown under the title (minimum purchase, product value). */
export function rewardConditions(db: Database, reward: Reward): string[] {
  const out: string[] = []
  if (reward.type !== 'FREE_PRODUCT' && reward.minimumPurchase) {
    out.push(`En compras desde ${formatMoney(reward.minimumPurchase)}`)
  }
  if (reward.type === 'FREE_PRODUCT') {
    const item = db.catalogItems.find((i) => i.id === reward.catalogItemId)
    if (item?.price) out.push(`Valor ${formatMoney(item.price * reward.quantity)}`)
  }
  return out
}

export type RewardBlocker = 'TIER' | 'POINTS' | 'STOCK' | null

export function rewardBlocker(db: Database, reward: Reward, userId: number): RewardBlocker {
  const remaining = rewardRemainingStock(db, reward)
  if (remaining !== null && remaining <= 0) return 'STOCK'
  if (reward.minimumTierId) {
    const required = db.tiers.find((t) => t.id === reward.minimumTierId)
    if (required && statusTotal(db, userId) < required.minimumStatus) return 'TIER'
  }
  if (pointsBalance(db, userId) < reward.pointsCost) return 'POINTS'
  return null
}

// ---------- Promotions ----------

const isRunning = (p: Promotion, now: Date) => isLive(p) && p.status === 'ACTIVE' && withinWindow(now, p.startsAt, p.endsAt)

/** A single-use promotion is spent once a purchase that is still valid received points from it. */
export function promotionUsed(db: Database, promotion: Promotion): boolean {
  if (!promotion.singleUse) return false
  return db.pointMovements.some(
    (m) =>
      m.promotionId === promotion.id &&
      m.amount > 0 &&
      db.transactions.find((t) => t.id === m.transactionId)?.status !== 'CANCELLED',
  )
}

/** Promotions for every customer (personal ones are excluded). */
export function activePromotions(db: Database, now = new Date()): Promotion[] {
  return db.promotions.filter((p) => p.userId === null && isRunning(p, now))
}

/** Running personal promotions of a customer that still have a use left. */
export function personalPromotions(db: Database, userId: number, now = new Date()): Promotion[] {
  return db.promotions.filter((p) => p.userId === userId && isRunning(p, now) && !promotionUsed(db, p))
}

/** Promotions that apply at a business: the public ones plus, when `userId` is given, that customer's personal ones. */
export function promotionsForBusiness(db: Database, businessId: number, now = new Date(), userId?: number): Promotion[] {
  const personal = userId === undefined ? [] : personalPromotions(db, userId, now)
  return [...activePromotions(db, now), ...personal].filter((p) => inScope(db, promotionScope(db, p.id), businessId))
}

export interface PurchaseQuote {
  basePoints: number
  tierMultiplier: number
  promotionBonuses: { promotion: Promotion; points: number }[]
  statusPoints: number
  totalPoints: number
}

/** Points/Status a purchase would generate. Result is written to the ledgers, never to Transaction. */
export function quotePurchase(
  db: Database,
  customerId: number,
  businessId: number,
  amount: number,
  now = new Date(),
): PurchaseQuote {
  const tier = currentTier(db, customerId)
  const tierMultiplier = tier?.pointsMultiplier ?? 1
  const raw = amount * getSetting(db, 'POINTS_BASE_RATE')
  const basePoints = Math.floor(raw * tierMultiplier)
  const promotionBonuses = promotionsForBusiness(db, businessId, now, customerId).map((promotion) => ({
    promotion,
    points:
      promotion.type === 'POINTS_MULTIPLIER'
        ? Math.floor(basePoints * (promotion.value - 1))
        : Math.floor(promotion.value),
  }))
  const statusPoints = Math.floor(amount * getSetting(db, 'STATUS_BASE_RATE'))
  const totalPoints = basePoints + promotionBonuses.reduce((s, b) => s + Math.max(0, b.points), 0)
  return { basePoints, tierMultiplier, promotionBonuses, statusPoints, totalPoints }
}

// ---------- Missions ----------

export function liveMissions(db: Database, now = new Date()): Mission[] {
  return db.missions.filter((m) => isLive(m) && m.status === 'ACTIVE' && withinWindow(now, m.startsAt, m.endsAt))
}

export function weekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - day)
  return d.toISOString().slice(0, 10)
}

export function completedTransactions(db: Database, userId: number): Transaction[] {
  return db.transactions.filter((t) => t.customerId === userId && t.status === 'COMPLETED')
}

export function evaluateMission(db: Database, mission: Mission, userId: number): number {
  const scope = missionScope(db, mission.id)
  const start = new Date(mission.startsAt)
  const end = new Date(mission.endsAt)
  const inWindow = (iso: string) => {
    const d = new Date(iso)
    return d >= start && d <= end
  }
  const txs = completedTransactions(db, userId).filter(
    (t) => inWindow(t.createdAt) && inScope(db, scope, t.businessId),
  )

  switch (mission.type) {
    case 'BUY_DISTINCT_BUSINESSES':
      return new Set(txs.map((t) => t.businessId)).size
    case 'BUY_CATEGORY':
    case 'TRANSACTION_COUNT':
      return txs.length
    case 'BUY_DISTINCT_CATEGORIES': {
      const cats = new Set<number>()
      for (const t of txs) for (const c of businessCategoryIds(db, t.businessId)) cats.add(c)
      return cats.size
    }
    case 'TOTAL_PURCHASE_AMOUNT':
      return Math.floor(txs.reduce((s, t) => s + t.amount, 0))
    case 'WEEKLY_PURCHASE':
      return new Set(txs.map((t) => weekKey(new Date(t.createdAt)))).size
    case 'DISCOVER_BUSINESS':
      return db.businessDiscoveries.filter(
        (d) => d.userId === userId && inWindow(d.discoveredAt) && inScope(db, scope, d.businessId),
      ).length
  }
}

// ---------- Events ----------

export function visibleEvents(db: Database): PaseoEvent[] {
  return db.events.filter((e) => isLive(e) && e.status === 'ACTIVE')
}

export function isEventOpen(event: PaseoEvent, now = new Date()): boolean {
  return withinWindow(now, event.startsAt, event.endsAt)
}

/** Events happening now or starting in the next `days` days, soonest first. */
export function upcomingEvents(db: Database, now = new Date(), days = 45): PaseoEvent[] {
  const limit = now.getTime() + days * 24 * 3600_000
  return visibleEvents(db)
    .filter((e) => new Date(e.endsAt) >= now && new Date(e.startsAt).getTime() <= limit)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
}

export function attendedEventIds(db: Database, userId: number): Set<number> {
  return new Set(db.eventAttendances.filter((a) => a.userId === userId).map((a) => a.eventId))
}

// ---------- Badges (derived from history, never stored per user) ----------

export interface BadgeProgress {
  current: number
  goal: number
  earnedAt: string | null
}

function nth(dates: string[], goal: number): BadgeProgress {
  const sorted = [...dates].sort()
  return { current: Math.min(sorted.length, goal), goal, earnedAt: sorted.length >= goal ? sorted[goal - 1] : null }
}

export function badgeProgress(db: Database, badge: Badge, userId: number): BadgeProgress {
  const txs = completedTransactions(db, userId)
  const goal = Math.max(1, badge.goal ?? 1)
  switch (badge.type) {
    case 'TIER_REACHED': {
      const tier = db.tiers.find((t) => t.id === badge.tierId)
      if (!tier) return { current: 0, goal: 1, earnedAt: null }
      const status = statusTotal(db, userId)
      const target = Math.max(1, tier.minimumStatus)
      if (status < tier.minimumStatus) return { current: status, goal: target, earnedAt: null }
      let sum = 0
      let earnedAt = db.users.find((u) => u.id === userId)?.createdAt ?? null
      if (tier.minimumStatus > 0) {
        const movements = db.statusMovements
          .filter((m) => m.userId === userId)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id)
        for (const m of movements) {
          sum += m.amount
          if (sum >= tier.minimumStatus) {
            earnedAt = m.createdAt
            break
          }
        }
      }
      return { current: target, goal: target, earnedAt }
    }
    case 'PURCHASE_COUNT':
      return nth(txs.map((t) => t.createdAt), goal)
    case 'CATEGORY_PURCHASES':
      return nth(
        txs.filter((t) => badge.categoryId !== null && businessCategoryClosure(db, t.businessId).has(badge.categoryId)).map((t) => t.createdAt),
        goal,
      )
    case 'DISTINCT_BUSINESSES': {
      const first = new Map<number, string>()
      for (const t of txs) {
        const prev = first.get(t.businessId)
        if (!prev || t.createdAt < prev) first.set(t.businessId, t.createdAt)
      }
      return nth([...first.values()], goal)
    }
    case 'MISSIONS_COMPLETED':
      return nth(
        db.missionProgress.filter((p) => p.userId === userId && p.completedAt).map((p) => p.completedAt!),
        goal,
      )
    case 'SPECIAL_DATE': {
      if (!badge.date) return { current: 0, goal: 1, earnedAt: null }
      const visits = [
        ...txs.map((t) => t.createdAt),
        ...db.eventAttendances.filter((a) => a.userId === userId).map((a) => a.checkedInAt),
        ...db.spaceCheckIns.filter((c) => c.userId === userId).map((c) => c.createdAt),
      ].filter((iso) => localDateKey(iso) === badge.date)
      return nth(visits, 1)
    }
  }
}

export function visibleBadges(db: Database): Badge[] {
  return db.badges.filter((b) => isLive(b) && b.status === 'ACTIVE')
}

export interface EarnedBadge {
  key: string
  name: string
  description: string | null
  kind: Badge['type'] | 'EVENT'
  earnedAt: string
}

/** Every badge the customer holds: configured badges whose condition is met plus one per attended event. */
export function earnedBadges(db: Database, userId: number): EarnedBadge[] {
  const fromBadges = visibleBadges(db).flatMap((badge) => {
    const { earnedAt } = badgeProgress(db, badge, userId)
    return earnedAt
      ? [{ key: `badge:${badge.id}`, name: badge.name, description: badge.description, kind: badge.type, earnedAt }]
      : []
  })
  const fromEvents = db.eventAttendances
    .filter((a) => a.userId === userId)
    .flatMap((a) => {
      const event = db.events.find((e) => e.id === a.eventId && isLive(e))
      return event
        ? [{ key: `event:${event.id}`, name: event.name, description: event.description, kind: 'EVENT' as const, earnedAt: a.checkedInAt }]
        : []
    })
  return [...fromBadges, ...fromEvents].sort((a, b) => b.earnedAt.localeCompare(a.earnedAt))
}

/** Badges still reachable (special dates already past are dropped), closest to completion first. */
export function pendingBadges(db: Database, userId: number, now = new Date()): ({ badge: Badge } & BadgeProgress)[] {
  const today = todayKey(now)
  return visibleBadges(db)
    .map((badge) => ({ badge, ...badgeProgress(db, badge, userId) }))
    .filter((b) => !b.earnedAt && !(b.badge.type === 'SPECIAL_DATE' && b.badge.date! < today))
    .sort((a, b) => b.current / b.goal - a.current / a.goal)
}

/** What is left to earn a badge, in the customer's words. */
export function badgeHint(db: Database, badge: Badge, current: number, goal: number): string {
  switch (badge.type) {
    case 'SPECIAL_DATE':
      return `Visita el Paseo el ${formatDateKey(badge.date!)}`
    case 'TIER_REACHED':
      return `Te faltan ${formatInt(goal - current)} puntos de nivel`
    case 'CATEGORY_PURCHASES':
      return `${formatInt(current)} de ${formatInt(goal)} compras en ${db.categories.find((c) => c.id === badge.categoryId)?.name ?? 'la categoría'}`
    case 'PURCHASE_COUNT':
      return `${formatInt(current)} de ${formatInt(goal)} compras`
    case 'DISTINCT_BUSINESSES':
      return `${formatInt(current)} de ${formatInt(goal)} establecimientos`
    case 'MISSIONS_COMPLETED':
      return `${formatInt(current)} de ${formatInt(goal)} misiones`
  }
}

// ---------- Passport ----------

export function discoveredBusinessIds(db: Database, userId: number): Set<number> {
  return new Set(db.businessDiscoveries.filter((d) => d.userId === userId).map((d) => d.businessId))
}

export interface PassportCategoryProgress {
  category: Category
  discovered: number
  total: number
}

export function passportProgress(db: Database, userId: number): PassportCategoryProgress[] {
  const discovered = discoveredBusinessIds(db, userId)
  const activeBusinesses = db.businesses.filter((b) => isLive(b) && b.status === 'ACTIVE')
  return rootCategories(db)
    .filter((c) => c.status === 'ACTIVE')
    .map((category) => {
      const members = activeBusinesses.filter((b) => businessCategoryClosure(db, b.id).has(category.id))
      return {
        category,
        total: members.length,
        discovered: members.filter((b) => discovered.has(b.id)).length,
      }
    })
    .filter((p) => p.total > 0)
}

// ---------- Streaks (derived from Transaction) ----------

export interface StreakInfo {
  current: number
  best: number
  activeThisWeek: boolean
}

export function weeklyStreak(db: Database, userId: number, now = new Date()): StreakInfo {
  const weeks = new Set(completedTransactions(db, userId).map((t) => weekKey(new Date(t.createdAt))))
  const sorted = [...weeks].sort()
  let best = 0
  let run = 0
  let prev: string | null = null
  for (const w of sorted) {
    run = prev && shiftWeek(prev, 1) === w ? run + 1 : 1
    best = Math.max(best, run)
    prev = w
  }

  const thisWeek = weekKey(now)
  const activeThisWeek = weeks.has(thisWeek)
  let cursor = activeThisWeek ? thisWeek : shiftWeek(thisWeek, -1)
  let current = 0
  while (weeks.has(cursor)) {
    current += 1
    cursor = shiftWeek(cursor, -1)
  }
  return { current, best, activeThisWeek }
}

/** Whether the customer bought in each of the last `count` weeks, oldest first; the last item is this week. */
export function recentWeeks(db: Database, userId: number, count: number, now = new Date()): { key: string; active: boolean }[] {
  const weeks = new Set(completedTransactions(db, userId).map((t) => weekKey(new Date(t.createdAt))))
  const thisWeek = weekKey(now)
  return Array.from({ length: count }, (_, i) => {
    const key = shiftWeek(thisWeek, i - count + 1)
    return { key, active: weeks.has(key) }
  })
}

function shiftWeek(key: string, delta: number): string {
  const d = new Date(`${key}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + delta * 7)
  return d.toISOString().slice(0, 10)
}
