import type { Business, Category, Database, KycRequest, Promotion, Reward, SpinPrize, Transaction, User } from '../types/domain'
import {
  businessCategoryIds,
  categoryWithAncestors,
  completedTransactions,
  getSetting,
  nextTier,
  pointsBalance,
  rewardRemainingStock,
  rewardTitle,
  statusTotal,
  visibleRewards,
} from './loyalty'
import { birthdayPerkCondition, birthdayPerkTitle, birthdayPerksOf } from './checkout'
import { addDaysKey, addMonthsKey, daysBetweenKeys, endOfLocalDay, localDateKey, localHour, localWeekday, todayKey } from './time'

const isLive = <T extends { deletedAt: string | null }>(row: T) => row.deletedAt === null

// ---------- Levels ----------

export interface TierGap {
  tierName: string
  missingStatus: number
  /** Approximate spend at the base rate; null when purchases give no status. */
  missingBs: number | null
}

/** What separates the customer from the next level, or null at the top. */
export function tierGap(db: Database, userId: number): TierGap | null {
  const status = statusTotal(db, userId)
  const next = nextTier(db, status)
  if (!next) return null
  const missingStatus = next.minimumStatus - status
  const rate = getSetting(db, 'STATUS_BASE_RATE')
  return { tierName: next.name, missingStatus, missingBs: rate > 0 ? Math.ceil(missingStatus / rate) : null }
}

// ---------- Ranking ----------

export interface RankingRow {
  user: User
  /** Ties share a position (1, 2, 2, 4). */
  position: number
  status: number
}

/** Active customers by puntos de nivel earned in the last `days` days, best first. Redeeming never lowers them. */
export function statusRanking(db: Database, now = new Date(), days = 30): RankingRow[] {
  const since = now.getTime() - days * 24 * 3600_000
  const earned = new Map<number, number>()
  for (const m of db.statusMovements) {
    if (Date.parse(m.createdAt) >= since) earned.set(m.userId, (earned.get(m.userId) ?? 0) + m.amount)
  }
  const rows = db.users
    .filter((u) => u.role === 'CUSTOMER' && u.status === 'ACTIVE' && isLive(u) && (earned.get(u.id) ?? 0) > 0)
    .map((user) => ({ user, status: earned.get(user.id) ?? 0 }))
    .sort((a, b) => b.status - a.status || a.user.id - b.user.id)
  return rows.map((row) => ({ ...row, position: rows.findIndex((r) => r.status === row.status) + 1 }))
}

// ---------- Visits ----------

/** Bolivian days the customer came to the Paseo: a completed purchase or a space check-in. Oldest first. */
export function visitDays(db: Database, userId: number): string[] {
  const days = new Set<string>()
  for (const t of completedTransactions(db, userId)) days.add(localDateKey(t.createdAt))
  for (const c of db.spaceCheckIns) if (c.userId === userId) days.add(c.day)
  return [...days].sort()
}

export interface VisitCard {
  size: number
  /** Courtesy stamps every card starts with (endowed progress). */
  giftStamps: number
  /** Stamps shown on the current card, courtesy ones included. */
  stamps: number
  /** Real visits that fill one card. */
  visitsPerCard: number
  completedCards: number
  totalVisits: number
  /** Day the last card was completed. */
  lastCompletedDay: string | null
}

export function visitCard(db: Database, userId: number): VisitCard {
  const size = Math.max(2, Math.floor(getSetting(db, 'VISIT_CARD_SIZE')))
  const giftStamps = Math.min(size - 1, Math.max(0, Math.floor(getSetting(db, 'VISIT_CARD_GIFT_STAMPS'))))
  const visitsPerCard = size - giftStamps
  const days = visitDays(db, userId)
  const completedCards = Math.floor(days.length / visitsPerCard)
  return {
    size,
    giftStamps,
    stamps: giftStamps + (days.length % visitsPerCard),
    visitsPerCard,
    completedCards,
    totalVisits: days.length,
    lastCompletedDay: completedCards > 0 ? days[completedCards * visitsPerCard - 1] : null,
  }
}

// ---------- Ruleta ----------

export function prizeRemainingStock(db: Database, prize: SpinPrize): number | null {
  if (prize.stock === null) return null
  return Math.max(0, prize.stock - db.spins.filter((s) => s.prizeId === prize.id).length)
}

/** Prizes that can come out right now: active, with stock and, for rewards, a reward customers can see. */
export function eligiblePrizes(db: Database, now = new Date()): SpinPrize[] {
  const rewards = new Set(visibleRewards(db, now).map((r) => r.id))
  return db.spinPrizes.filter((p) => {
    if (!isLive(p) || p.status !== 'ACTIVE' || p.weight <= 0) return false
    const left = prizeRemainingStock(db, p)
    if (left !== null && left <= 0) return false
    if (p.type === 'REWARD') {
      const reward = db.rewards.find((r) => r.id === p.rewardId)
      if (!reward || !rewards.has(reward.id)) return false
      const rewardLeft = rewardRemainingStock(db, reward)
      if (rewardLeft !== null && rewardLeft <= 0) return false
    }
    return true
  })
}

/** Probability (0–1) of each prize among `prizes`. */
export function prizeOdds(prizes: SpinPrize[]): Map<number, number> {
  const total = prizes.reduce((s, p) => s + p.weight, 0)
  return new Map(prizes.map((p) => [p.id, total > 0 ? p.weight / total : 0]))
}

export function prizeTitle(db: Database, prize: Pick<SpinPrize, 'type' | 'points' | 'multiplier' | 'rewardId'>): string {
  switch (prize.type) {
    case 'POINTS':
      return `${prize.points ?? 0} puntos`
    case 'MULTIPLIER':
      return `Puntos ×${prize.multiplier ?? 2} en tu próxima compra`
    case 'EXTRA_SPIN':
      return 'Un giro extra'
    case 'REWARD': {
      const reward = db.rewards.find((r) => r.id === prize.rewardId)
      if (!reward) return 'Recompensa sorpresa'
      const business = db.businesses.find((b) => b.id === reward.businessId)
      return business ? `${rewardTitle(db, reward)} en ${business.name}` : rewardTitle(db, reward)
    }
  }
}

export interface FreeSpinSources {
  visitCards: number
  missions: number
  milestones: number
  prizes: number
  birthdays: number
}

export interface SpinAvailability {
  dailyCost: number
  dailyUsed: boolean
  canAffordDaily: boolean
  extraMax: number
  extraUsedToday: number
  extraMinPurchase: number
  /** Purchase that unlocks the next extra spin, if any. */
  extraUnlock: Transaction | null
  freeEarned: FreeSpinSources
  freeAvailable: number
  /** Status needed for the next milestone spin (0 when milestones are off). */
  nextMilestone: number
}

export function spinAvailability(db: Database, userId: number, now = new Date()): SpinAvailability {
  const today = todayKey(now)
  const mine = db.spins.filter((s) => s.userId === userId)
  const todays = mine.filter((s) => localDateKey(s.createdAt) === today)
  const dailyCost = Math.max(0, Math.floor(getSetting(db, 'SPIN_COST')))
  const dailyUsed = todays.some((s) => s.source === 'DAILY')
  const extraMax = Math.max(0, Math.floor(getSetting(db, 'SPIN_EXTRA_DAILY_MAX')))
  const extraUsedToday = todays.filter((s) => s.source === 'EXTRA').length
  const extraMinPurchase = Math.max(0, getSetting(db, 'SPIN_EXTRA_MIN_PURCHASE'))

  let extraUnlock: Transaction | null = null
  if (dailyUsed && extraUsedToday < extraMax) {
    const lastPaid = todays
      .filter((s) => s.source !== 'FREE')
      .reduce((max, s) => (s.createdAt > max ? s.createdAt : max), '')
    const used = new Set(db.spins.map((s) => s.unlockTransactionId).filter((id) => id !== null))
    extraUnlock =
      completedTransactions(db, userId)
        .filter(
          (t) =>
            localDateKey(t.createdAt) === today &&
            t.amount >= extraMinPurchase &&
            t.createdAt > lastPaid &&
            !used.has(t.id),
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0] ?? null
  }

  const milestone = Math.floor(getSetting(db, 'SPIN_MILESTONE_STATUS'))
  const status = statusTotal(db, userId)
  const freeEarned: FreeSpinSources = {
    visitCards: visitCard(db, userId).completedCards,
    missions: db.missionProgress
      .filter((p) => p.userId === userId && p.completedAt)
      .reduce((s, p) => s + (db.missions.find((m) => m.id === p.missionId)?.rewardSpins ?? 0), 0),
    milestones: milestone > 0 ? Math.floor(Math.max(0, status) / milestone) : 0,
    prizes: mine.filter((s) => s.prizeType === 'EXTRA_SPIN').length,
    birthdays: db.pointMovements.filter((m) => m.userId === userId && m.type === 'BIRTHDAY').length,
  }
  const earned = Object.values(freeEarned).reduce((s, n) => s + n, 0)
  const freeUsed = mine.filter((s) => s.source === 'FREE').length

  return {
    dailyCost,
    dailyUsed,
    canAffordDaily: pointsBalance(db, userId) >= dailyCost,
    extraMax,
    extraUsedToday,
    extraMinPurchase,
    extraUnlock,
    freeEarned,
    freeAvailable: Math.max(0, earned - freeUsed),
    nextMilestone: milestone > 0 ? (Math.floor(Math.max(0, status) / milestone) + 1) * milestone : 0,
  }
}

// ---------- Points expiration ----------

/** Last time the customer earned points by coming to the Paseo (purchase, space or event). */
export function lastEarnedAt(db: Database, userId: number): string | null {
  let last: string | null = null
  for (const m of db.pointMovements) {
    if (m.userId !== userId || m.amount <= 0) continue
    if (m.type === 'PURCHASE') {
      if (db.transactions.find((t) => t.id === m.transactionId)?.status !== 'COMPLETED') continue
    } else if (m.type !== 'CHECK_IN' && m.type !== 'EVENT') continue
    if (!last || m.createdAt > last) last = m.createdAt
  }
  return last
}

export interface PointsExpiry {
  balance: number
  /** Bolivian day after which the balance expires (end of that day). */
  expiresOn: string
  expiresAt: string
  daysLeft: number
  /** Inside the notice window configured by the admin. */
  soon: boolean
}

export function pointsExpiry(db: Database, user: Pick<User, 'id' | 'createdAt'>, now = new Date()): PointsExpiry {
  const months = Math.max(1, Math.floor(getSetting(db, 'POINTS_EXPIRATION_MONTHS')))
  const since = lastEarnedAt(db, user.id) ?? user.createdAt
  const expiresOn = addMonthsKey(localDateKey(since), months)
  const daysLeft = daysBetweenKeys(todayKey(now), expiresOn) - 1
  return {
    balance: pointsBalance(db, user.id),
    expiresOn,
    expiresAt: endOfLocalDay(expiresOn),
    daysLeft,
    soon: daysLeft <= Math.max(0, getSetting(db, 'POINTS_EXPIRATION_NOTICE_DAYS')),
  }
}

// ---------- Birthday & verification ----------

export type KycState =
  | { status: 'VERIFIED'; request: KycRequest | null }
  | { status: 'PENDING'; request: KycRequest }
  | { status: 'REJECTED'; request: KycRequest }
  | { status: 'NONE'; request: null }

export function kycState(db: Database, userId: number): KycState {
  const user = db.users.find((u) => u.id === userId)
  const requests = db.kycRequests.filter((r) => r.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const latest = requests[0] ?? null
  if (user?.birthDate) return { status: 'VERIFIED', request: requests.find((r) => r.status === 'APPROVED') ?? null }
  if (latest?.status === 'PENDING') return { status: 'PENDING', request: latest }
  if (latest?.status === 'REJECTED') return { status: 'REJECTED', request: latest }
  return { status: 'NONE', request: null }
}

const isLeap = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0

/** `YYYY-MM-DD` the birthday is celebrated in `year` (29-feb → 28-feb in common years). */
export function birthdayInYear(birthDate: string, year: number): string {
  const monthDay = birthDate.slice(5, 10)
  return `${year}-${monthDay === '02-29' && !isLeap(year) ? '02-28' : monthDay}`
}

export const localYear = (now = new Date()) => Number(todayKey(now).slice(0, 4))

export function isBirthdayToday(user: Pick<User, 'birthDate'> | undefined, now = new Date()): boolean {
  if (!user?.birthDate) return false
  return birthdayInYear(user.birthDate, localYear(now)) === todayKey(now)
}

/** Days until the next birthday (0 = today), null when not verified. */
export function daysToBirthday(user: Pick<User, 'birthDate'>, now = new Date()): number | null {
  if (!user.birthDate) return null
  const today = todayKey(now)
  let next = birthdayInYear(user.birthDate, localYear(now))
  if (next < today) next = birthdayInYear(user.birthDate, localYear(now) + 1)
  return daysBetweenKeys(today, next) - 1
}

export function birthdayRewardClaimed(db: Database, userId: number, year: number): boolean {
  return db.redemptions.some(
    (r) => r.userId === userId && r.origin === 'BIRTHDAY' && localDateKey(r.createdAt).startsWith(`${year}-`),
  )
}

/** Rewards the customer can pick for free on their birthday (tier requirement does not apply). */
export function birthdayRewardOptions(db: Database, now = new Date()): Reward[] {
  const max = getSetting(db, 'BIRTHDAY_REWARD_MAX_POINTS')
  return visibleRewards(db, now).filter((r) => {
    const left = rewardRemainingStock(db, r)
    return r.pointsCost <= max && (left === null || left > 0)
  })
}

/** Businesses with active birthday benefits, each with what it gives and on which condition. */
export function birthdayGifts(db: Database): { business: Business; perks: { id: number; title: string; condition: string | null; description: string | null }[] }[] {
  return db.businesses
    .filter((b) => isLive(b) && b.status === 'ACTIVE')
    .flatMap((business) => {
      const perks = birthdayPerksOf(db, business.id).map((perk) => ({
        id: perk.id,
        title: birthdayPerkTitle(db, perk),
        condition: birthdayPerkCondition(db, perk),
        description: perk.description,
      }))
      return perks.length ? [{ business, perks }] : []
    })
    .sort((a, b) => a.business.name.localeCompare(b.business.name, 'es'))
}

// ---------- Consumption profile ----------

export interface ConsumptionProfile {
  days: number
  purchases: number
  total: number
  averageTicket: number
  categories: { category: Category; amount: number; share: number }[]
  businesses: { business: Business; amount: number; purchases: number }[]
  /** Part of the day with most purchases. */
  usualMoment: 'mañana' | 'tarde' | 'noche' | null
  /** 0 = lunes … 6 = domingo. */
  usualWeekday: number | null
  lastPurchaseAt: string | null
  daysSinceLastPurchase: number | null
}

const rootOf = (db: Database, categoryId: number) => {
  const chain = categoryWithAncestors(db, categoryId)
  return db.categories.find((c) => c.id === chain[chain.length - 1])
}

/** What, where and when the customer buys during the last `days` days. */
export function consumptionProfile(db: Database, userId: number, now = new Date(), days = 90): ConsumptionProfile {
  const since = new Date(now.getTime() - days * 86_400_000).toISOString()
  const all = completedTransactions(db, userId)
  const txs = all.filter((t) => t.createdAt >= since)
  const total = txs.reduce((s, t) => s + t.amount, 0)

  const byCategory = new Map<number, number>()
  const byBusiness = new Map<number, { amount: number; purchases: number }>()
  const moments = { mañana: 0, tarde: 0, noche: 0 }
  const weekdays = Array<number>(7).fill(0)
  for (const t of txs) {
    const roots = [...new Set(businessCategoryIds(db, t.businessId).map((id) => rootOf(db, id)?.id).filter((id) => id !== undefined))]
    for (const id of roots) byCategory.set(id, (byCategory.get(id) ?? 0) + t.amount / roots.length)
    const b = byBusiness.get(t.businessId) ?? { amount: 0, purchases: 0 }
    byBusiness.set(t.businessId, { amount: b.amount + t.amount, purchases: b.purchases + 1 })
    const hour = localHour(t.createdAt)
    moments[hour < 12 ? 'mañana' : hour < 19 ? 'tarde' : 'noche'] += 1
    weekdays[localWeekday(t.createdAt)] += 1
  }

  const last = all.reduce<string | null>((max, t) => (!max || t.createdAt > max ? t.createdAt : max), null)
  const topMoment = (Object.entries(moments) as [ConsumptionProfile['usualMoment'] & string, number][]).sort(
    (a, b) => b[1] - a[1],
  )[0]
  const topDay = weekdays.indexOf(Math.max(...weekdays))

  return {
    days,
    purchases: txs.length,
    total,
    averageTicket: txs.length ? total / txs.length : 0,
    categories: [...byCategory.entries()]
      .flatMap(([id, amount]) => {
        const category = db.categories.find((c) => c.id === id)
        return category ? [{ category, amount, share: total ? amount / total : 0 }] : []
      })
      .sort((a, b) => b.amount - a.amount),
    businesses: [...byBusiness.entries()]
      .flatMap(([id, v]) => {
        const business = db.businesses.find((b) => b.id === id)
        return business ? [{ business, ...v }] : []
      })
      .sort((a, b) => b.amount - a.amount),
    usualMoment: txs.length ? topMoment[0] : null,
    usualWeekday: txs.length ? topDay : null,
    lastPurchaseAt: last,
    daysSinceLastPurchase: last ? daysBetweenKeys(localDateKey(last), todayKey(now)) - 1 : null,
  }
}

// ---------- Membership anniversaries ----------

/** Months of membership celebrated: 3, 6, 12 and then every year. */
export function anniversaryMonths(index: number): number {
  return index === 0 ? 3 : index === 1 ? 6 : (index - 1) * 12
}

export function anniversaryLabel(months: number): string {
  if (months < 12) return `${months} meses`
  const years = months / 12
  return years === 1 ? '1 año' : `${years} años`
}

/** The anniversary week the customer is in today, if any. */
export function currentAnniversary(
  user: Pick<User, 'createdAt'>,
  now = new Date(),
): { months: number; startDay: string; endDay: string } | null {
  const joined = localDateKey(user.createdAt)
  const today = todayKey(now)
  for (let i = 0; ; i++) {
    const months = anniversaryMonths(i)
    const day = addMonthsKey(joined, months)
    if (day > today) return null
    const endDay = addDaysKey(day, 6)
    if (today <= endDay) return { months, startDay: day, endDay }
  }
}

/** Purchased something in the last 90 days. */
export function hasActiveMembership(db: Database, userId: number, now = new Date()): boolean {
  const since = new Date(now.getTime() - 90 * 86_400_000).toISOString()
  return completedTransactions(db, userId).some((t) => t.createdAt >= since)
}

/** Personal promotions shown in "Para ti", newest first. */
export function promotionReason(promotion: Promotion): string {
  switch (promotion.origin) {
    case 'REACTIVATION':
      return 'Te extrañamos'
    case 'ANNIVERSARY':
      return 'Aniversario'
    case 'VISIT_CARD':
      return 'Cupón de regreso'
    case 'PRIZE':
      return 'Premio de la ruleta'
    default:
      return 'Promoción'
  }
}
