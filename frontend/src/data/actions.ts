import {
  earnedBadges,
  getSetting,
  isEventOpen,
  liveMissions,
  evaluateMission,
  quotePurchase,
  rewardBlocker,
  visibleRewards,
  weekKey,
  weeklyStreak,
} from '../domain/loyalty'
import { createRedemptionToken } from '../domain/tokens'
import type {
  Badge,
  Business,
  BusinessMemberRole,
  BusinessSchedule,
  CatalogItem,
  Category,
  Database,
  FraudAlertType,
  Mission,
  PaseoEvent,
  Promotion,
  Reward,
  Tier,
  Transaction,
  User,
} from '../types/domain'
import { nextId } from './ids'

export class DomainError extends Error {}

const iso = (d: Date) => d.toISOString()

function audit(db: Database, userId: number, action: string, entityType: string, entityId: number, at: Date) {
  db.auditLogs.push({ id: nextId(db, 'auditLogs'), userId, action, entityType, entityId, createdAt: iso(at) })
}

function raiseAlert(
  db: Database,
  type: FraudAlertType,
  riskScore: number,
  ref: { transactionId?: number; redemptionId?: number },
  at: Date,
) {
  db.fraudAlerts.push({
    id: nextId(db, 'fraudAlerts'),
    transactionId: ref.transactionId ?? null,
    redemptionId: ref.redemptionId ?? null,
    type,
    riskScore,
    status: 'OPEN',
    createdAt: iso(at),
  })
}

function addPoints(
  db: Database,
  userId: number,
  type: Database['pointMovements'][number]['type'],
  amount: number,
  refs: { transactionId?: number; redemptionId?: number; missionId?: number; promotionId?: number; eventId?: number },
  at: Date,
) {
  if (amount === 0) return
  db.pointMovements.push({
    id: nextId(db, 'pointMovements'),
    userId,
    transactionId: refs.transactionId ?? null,
    redemptionId: refs.redemptionId ?? null,
    missionId: refs.missionId ?? null,
    promotionId: refs.promotionId ?? null,
    eventId: refs.eventId ?? null,
    type,
    amount,
    createdAt: iso(at),
  })
}

function addStatus(
  db: Database,
  userId: number,
  type: Database['statusMovements'][number]['type'],
  amount: number,
  refs: { transactionId?: number; missionId?: number },
  at: Date,
) {
  if (amount === 0) return
  db.statusMovements.push({
    id: nextId(db, 'statusMovements'),
    userId,
    transactionId: refs.transactionId ?? null,
    missionId: refs.missionId ?? null,
    type,
    amount,
    createdAt: iso(at),
  })
}

export function activeMembership(db: Database, userId: number, businessId: number) {
  return db.businessMembers.find(
    (m) => m.userId === userId && m.businessId === businessId && m.status === 'ACTIVE',
  )
}

function requireAdmin(db: Database, userId: number) {
  const user = db.users.find((u) => u.id === userId)
  if (!user || user.role !== 'ADMIN') throw new DomainError('Solo un administrador puede hacer esto')
}

function requireManager(db: Database, userId: number, businessId: number) {
  const user = db.users.find((u) => u.id === userId)
  if (user?.role === 'ADMIN') return
  if (activeMembership(db, userId, businessId)?.role !== 'MANAGER') {
    throw new DomainError('Solo el encargado del establecimiento puede hacer esto')
  }
}

/** Rewards are owned by the business: only its manager edits them (the Paseo admin only reads). */
function requireBusinessManager(db: Database, userId: number, businessId: number) {
  if (activeMembership(db, userId, businessId)?.role !== 'MANAGER') {
    throw new DomainError('Solo el encargado del establecimiento puede gestionar sus recompensas')
  }
}

const earnedKeys = (db: Database, userId: number) => new Set(earnedBadges(db, userId).map((b) => b.key))

function badgesEarnedSince(db: Database, userId: number, before: Set<string>): string[] {
  return earnedBadges(db, userId)
    .filter((b) => !before.has(b.key))
    .map((b) => b.name)
}

// ==================================================
// Purchases
// ==================================================

export interface PurchaseResult {
  transaction: Transaction
  pointsEarned: number
  statusEarned: number
  discovered: boolean
  completedMissions: Mission[]
  newBadges: string[]
  flagged: boolean
}

export function registerPurchase(
  db: Database,
  input: { customerId: number; businessId: number; performedById: number; amount: number },
  at = new Date(),
): PurchaseResult {
  const amount = Math.round(input.amount * 100) / 100
  if (!(amount > 0)) throw new DomainError('El monto debe ser mayor a 0')
  if (amount > 99_999_999.99) throw new DomainError('Monto fuera de rango')

  const customer = db.users.find((u) => u.id === input.customerId && u.deletedAt === null)
  if (!customer) throw new DomainError('Cliente no encontrado')
  if (customer.status !== 'ACTIVE') throw new DomainError('La cuenta del cliente está suspendida')
  const business = db.businesses.find((b) => b.id === input.businessId && b.deletedAt === null)
  if (!business || business.status !== 'ACTIVE') throw new DomainError('Establecimiento inactivo')
  if (!activeMembership(db, input.performedById, input.businessId)) {
    throw new DomainError('No perteneces a este establecimiento')
  }
  if (input.customerId === input.performedById) {
    throw new DomainError('No puedes registrar compras a tu propio nombre')
  }
  const badgesBefore = earnedKeys(db, input.customerId)

  const tenMinutesAgo = at.getTime() - 10 * 60 * 1000
  const oneHourAgo = at.getTime() - 60 * 60 * 1000
  const customerTxs = db.transactions.filter((t) => t.customerId === input.customerId)
  const duplicate = customerTxs.some(
    (t) =>
      t.businessId === input.businessId &&
      t.amount === amount &&
      t.status !== 'CANCELLED' &&
      new Date(t.createdAt).getTime() >= tenMinutesAgo,
  )
  const lastHour = customerTxs.filter((t) => new Date(t.createdAt).getTime() >= oneHourAgo).length
  const abnormal = amount >= getSetting(db, 'ABNORMAL_AMOUNT_THRESHOLD')
  const flagged = duplicate || abnormal

  const transaction: Transaction = {
    id: nextId(db, 'transactions'),
    customerId: input.customerId,
    businessId: input.businessId,
    performedById: input.performedById,
    amount,
    status: flagged ? 'FLAGGED' : 'COMPLETED',
    createdAt: iso(at),
  }
  db.transactions.push(transaction)

  if (duplicate) raiseAlert(db, 'DUPLICATE_TRANSACTION', 85, { transactionId: transaction.id }, at)
  if (abnormal) raiseAlert(db, 'ABNORMAL_AMOUNT', 60, { transactionId: transaction.id }, at)
  if (lastHour >= 5) raiseAlert(db, 'HIGH_FREQUENCY', 50, { transactionId: transaction.id }, at)

  if (flagged) {
    return { transaction, pointsEarned: 0, statusEarned: 0, discovered: false, completedMissions: [], newBadges: [], flagged }
  }
  const award = awardPurchase(db, transaction, at)
  return { ...award, newBadges: badgesEarnedSince(db, input.customerId, badgesBefore), flagged: false }
}

function awardPurchase(db: Database, tx: Transaction, at: Date): Omit<PurchaseResult, 'flagged' | 'newBadges'> {
  const pointsBefore = db.pointMovements.length
  const statusBefore = db.statusMovements.length
  const quote = quotePurchase(db, tx.customerId, tx.businessId, tx.amount, at)

  addPoints(db, tx.customerId, 'PURCHASE', quote.basePoints, { transactionId: tx.id }, at)
  for (const bonus of quote.promotionBonuses) {
    addPoints(db, tx.customerId, 'PROMOTION', bonus.points, { transactionId: tx.id, promotionId: bonus.promotion.id }, at)
  }
  addStatus(db, tx.customerId, 'PURCHASE', quote.statusPoints, { transactionId: tx.id }, at)

  const discovered = !db.businessDiscoveries.some(
    (d) => d.userId === tx.customerId && d.businessId === tx.businessId,
  )
  if (discovered) {
    db.businessDiscoveries.push({ userId: tx.customerId, businessId: tx.businessId, discoveredAt: iso(at) })
    addStatus(db, tx.customerId, 'DISCOVERY', getSetting(db, 'DISCOVERY_STATUS_BONUS'), { transactionId: tx.id }, at)
  }

  const firstOfWeek =
    db.transactions.filter(
      (t) =>
        t.customerId === tx.customerId &&
        t.status === 'COMPLETED' &&
        weekKey(new Date(t.createdAt)) === weekKey(at),
    ).length === 1
  if (firstOfWeek) {
    const streak = weeklyStreak(db, tx.customerId, at).current
    if (streak >= 2) {
      addStatus(db, tx.customerId, 'STREAK', Math.min(streak, 10) * getSetting(db, 'STREAK_STATUS_BONUS'), { transactionId: tx.id }, at)
    }
  }

  const completedMissions = syncMissionProgress(db, tx.customerId, at)

  const sum = <T extends { amount: number }>(rows: T[]) => rows.reduce((s, r) => s + r.amount, 0)
  return {
    transaction: tx,
    pointsEarned: sum(db.pointMovements.slice(pointsBefore)),
    statusEarned: sum(db.statusMovements.slice(statusBefore)),
    discovered,
    completedMissions,
  }
}

/** Recomputes MissionProgress and grants mission rewards automatically on completion. */
export function syncMissionProgress(db: Database, userId: number, at = new Date()): Mission[] {
  const completed: Mission[] = []
  for (const mission of liveMissions(db, at)) {
    const value = Math.min(evaluateMission(db, mission, userId), mission.goal)
    let row = db.missionProgress.find((p) => p.missionId === mission.id && p.userId === userId)
    if (!row) {
      if (value === 0) continue
      row = { missionId: mission.id, userId, progress: 0, completedAt: null }
      db.missionProgress.push(row)
    }
    if (row.completedAt) continue
    row.progress = value
    if (value >= mission.goal) {
      row.completedAt = iso(at)
      addPoints(db, userId, 'MISSION', mission.rewardPoints, { missionId: mission.id }, at)
      addStatus(db, userId, 'MISSION', mission.rewardStatus, { missionId: mission.id }, at)
      completed.push(mission)
    }
  }
  return completed
}

/** After a purchase is cancelled, takes back mission rewards whose goal is no longer met. */
function revokeUnmetMissions(db: Database, userId: number, at: Date) {
  for (const row of db.missionProgress.filter((p) => p.userId === userId && p.completedAt)) {
    const mission = db.missions.find((m) => m.id === row.missionId)
    if (!mission) continue
    const value = Math.min(evaluateMission(db, mission, userId), mission.goal)
    if (value >= mission.goal) continue
    row.completedAt = null
    row.progress = value
    addPoints(db, userId, 'REVERSAL', -mission.rewardPoints, { missionId: mission.id }, at)
    addStatus(db, userId, 'ADJUSTMENT', -mission.rewardStatus, { missionId: mission.id }, at)
  }
}

function reverseTransactionMovements(db: Database, tx: Transaction, at: Date) {
  const points = db.pointMovements
    .filter((m) => m.transactionId === tx.id)
    .reduce((s, m) => s + m.amount, 0)
  const status = db.statusMovements
    .filter((m) => m.transactionId === tx.id)
    .reduce((s, m) => s + m.amount, 0)
  addPoints(db, tx.customerId, 'REVERSAL', -points, { transactionId: tx.id }, at)
  addStatus(db, tx.customerId, 'ADJUSTMENT', -status, { transactionId: tx.id }, at)
}

export function cancelTransaction(db: Database, transactionId: number, actorId: number, at = new Date()) {
  const tx = db.transactions.find((t) => t.id === transactionId)
  if (!tx) throw new DomainError('Transacción no encontrada')
  const actor = db.users.find((u) => u.id === actorId)
  if (actor?.role !== 'ADMIN') requireManager(db, actorId, tx.businessId)
  if (tx.status === 'CANCELLED') throw new DomainError('La transacción ya está anulada')
  const wasCompleted = tx.status === 'COMPLETED'
  if (wasCompleted) reverseTransactionMovements(db, tx, at)
  tx.status = 'CANCELLED'
  if (wasCompleted) revokeUnmetMissions(db, tx.customerId, at)
  audit(db, actorId, 'TRANSACTION_CANCELLED', 'Transaction', tx.id, at)
}

// ==================================================
// Redemptions
// ==================================================

export function createRedemption(db: Database, userId: number, rewardId: number, at = new Date()) {
  const reward = visibleRewards(db, at).find((r) => r.id === rewardId)
  if (!reward) throw new DomainError('Recompensa no disponible')
  const user = db.users.find((u) => u.id === userId)
  if (user?.status !== 'ACTIVE') throw new DomainError('Tu cuenta está suspendida')
  const blocker = rewardBlocker(db, reward, userId)
  if (blocker === 'STOCK') throw new DomainError('Recompensa agotada')
  if (blocker === 'TIER') throw new DomainError('Tu nivel aún no permite este canje')
  if (blocker === 'POINTS') throw new DomainError('No tienes puntos suficientes')

  let token = createRedemptionToken()
  while (db.redemptions.some((r) => r.verificationToken === token)) token = createRedemptionToken()

  const redemption = {
    id: nextId(db, 'redemptions'),
    userId,
    rewardId,
    businessId: null,
    validatedById: null,
    pointsSpent: reward.pointsCost,
    verificationToken: token,
    status: 'PENDING' as const,
    createdAt: iso(at),
    redeemedAt: null,
  }
  db.redemptions.push(redemption)
  addPoints(db, userId, 'REDEMPTION', -reward.pointsCost, { redemptionId: redemption.id }, at)
  return redemption
}

export function cancelRedemption(db: Database, redemptionId: number, userId: number, at = new Date()) {
  const r = db.redemptions.find((x) => x.id === redemptionId && x.userId === userId)
  if (!r || r.status !== 'PENDING') throw new DomainError('Solo se pueden cancelar canjes pendientes')
  r.status = 'CANCELLED'
  addPoints(db, r.userId, 'REVERSAL', r.pointsSpent, { redemptionId: r.id }, at)
}

export function expireRedemptions(db: Database, at = new Date()) {
  const ttl = getSetting(db, 'REDEMPTION_EXPIRATION_HOURS') * 3600_000
  for (const r of db.redemptions) {
    if (r.status === 'PENDING' && new Date(r.createdAt).getTime() + ttl < at.getTime()) {
      r.status = 'EXPIRED'
      addPoints(db, r.userId, 'REVERSAL', r.pointsSpent, { redemptionId: r.id }, at)
    }
  }
}

export function redemptionExpiresAt(db: Database, createdAt: string): Date {
  return new Date(new Date(createdAt).getTime() + getSetting(db, 'REDEMPTION_EXPIRATION_HOURS') * 3600_000)
}

export function validateRedemption(
  db: Database,
  input: { token: string; businessId: number; staffId: number },
  at = new Date(),
) {
  if (!activeMembership(db, input.staffId, input.businessId)) {
    throw new DomainError('No perteneces a este establecimiento')
  }
  expireRedemptions(db, at)
  const token = input.token.trim().toUpperCase()
  const r = db.redemptions.find((x) => x.verificationToken === token)
  if (!r) throw new DomainError('Código de canje no encontrado')
  if (r.status === 'REDEEMED') {
    raiseAlert(db, 'REUSED_REDEMPTION', 90, { redemptionId: r.id }, at)
    return { redemption: r, reused: true }
  }
  if (r.status === 'EXPIRED') throw new DomainError('El canje expiró')
  if (r.status === 'CANCELLED') throw new DomainError('El canje fue cancelado')

  const reward = db.rewards.find((x) => x.id === r.rewardId)
  if (reward?.businessId !== input.businessId) {
    const owner = db.businesses.find((b) => b.id === reward?.businessId)
    throw new DomainError(`Esta recompensa es de ${owner?.name ?? 'otro establecimiento'} y solo se canjea allí`)
  }

  r.status = 'REDEEMED'
  r.businessId = input.businessId
  r.validatedById = input.staffId
  r.redeemedAt = iso(at)
  return { redemption: r, reused: false }
}

// ==================================================
// Fraud review
// ==================================================

export function reviewFraudAlert(
  db: Database,
  alertId: number,
  decision: 'RESOLVED' | 'DISMISSED',
  actorId: number,
  at = new Date(),
) {
  requireAdmin(db, actorId)
  const alert = db.fraudAlerts.find((a) => a.id === alertId)
  if (!alert || alert.status !== 'OPEN') throw new DomainError('La alerta ya fue revisada')
  alert.status = decision

  const tx = alert.transactionId ? db.transactions.find((t) => t.id === alert.transactionId) : undefined
  const stillOpen = db.fraudAlerts.some(
    (a) => a.transactionId === tx?.id && a.status === 'OPEN' && a.id !== alert.id,
  )
  if (tx && tx.status === 'FLAGGED' && !stillOpen) {
    if (decision === 'DISMISSED') {
      tx.status = 'COMPLETED'
      awardPurchase(db, tx, at)
    } else {
      tx.status = 'CANCELLED'
    }
  }
  audit(db, actorId, `FRAUD_ALERT_${decision}`, 'FraudAlert', alert.id, at)
}

export function adjustBalance(
  db: Database,
  input: { userId: number; ledger: 'POINTS' | 'STATUS'; amount: number },
  actorId: number,
  at = new Date(),
) {
  requireAdmin(db, actorId)
  if (!Number.isInteger(input.amount) || input.amount === 0) throw new DomainError('Ajuste inválido')
  if (input.ledger === 'POINTS') addPoints(db, input.userId, 'ADJUSTMENT', input.amount, {}, at)
  else addStatus(db, input.userId, 'ADJUSTMENT', input.amount, {}, at)
  audit(db, actorId, `${input.ledger}_ADJUSTMENT`, 'User', input.userId, at)
}

// ==================================================
// Admin configuration
// ==================================================

type Editable<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'createdById'>

function upsert<T extends { id: number }>(
  db: Database,
  table: 'businesses' | 'categories' | 'tiers' | 'rewards' | 'missions' | 'promotions' | 'catalogItems' | 'events' | 'badges',
  id: number | null,
  data: Partial<T>,
  create: (id: number) => T,
): T {
  const rows = db[table] as unknown as T[]
  if (id !== null) {
    const row = rows.find((r) => r.id === id)
    if (!row) throw new DomainError('Registro no encontrado')
    Object.assign(row, data)
    return row
  }
  const row = create(nextId(db, table))
  rows.push(row)
  return row
}

function replaceLinks<K extends 'missionBusinesses' | 'missionCategories' | 'promotionBusinesses' | 'promotionCategories' | 'businessCategories'>(
  db: Database,
  table: K,
  ownerKey: keyof Database[K][number],
  ownerId: number,
  targetKey: keyof Database[K][number],
  targetIds: number[],
) {
  const rows = db[table] as unknown as Record<string, number>[]
  const kept = rows.filter((r) => r[ownerKey as string] !== ownerId)
  const unique = [...new Set(targetIds)]
  rows.splice(
    0,
    rows.length,
    ...kept,
    ...unique.map((t) => ({ [ownerKey as string]: ownerId, [targetKey as string]: t })),
  )
}

const required = (value: string, label: string) => {
  if (!value.trim()) throw new DomainError(`${label} es obligatorio`)
  return value.trim()
}

function checkWindow(startsAt: string | null, endsAt: string | null) {
  if (startsAt && endsAt && new Date(startsAt) > new Date(endsAt)) {
    throw new DomainError('La fecha de inicio debe ser anterior a la de fin')
  }
}

export function saveBusiness(
  db: Database,
  id: number | null,
  data: Editable<Business>,
  categoryIds: number[],
  schedules: Omit<BusinessSchedule, 'id' | 'businessId'>[],
  actorId: number,
  at = new Date(),
) {
  requireAdmin(db, actorId)
  const clean = { ...data, name: required(data.name, 'El nombre'), description: data.description.trim() }
  const business = upsert<Business>(db, 'businesses', id, { ...clean, updatedAt: iso(at) }, (newId) => ({
    ...clean,
    id: newId,
    createdAt: iso(at),
    updatedAt: iso(at),
    deletedAt: null,
  }))
  replaceLinks(db, 'businessCategories', 'businessId', business.id, 'categoryId', categoryIds)

  for (const s of schedules) {
    if (!s.isClosed && s.openTime && s.closeTime && s.openTime >= s.closeTime) {
      throw new DomainError('La hora de apertura debe ser anterior al cierre')
    }
    const existing = db.businessSchedules.find((x) => x.businessId === business.id && x.dayOfWeek === s.dayOfWeek)
    if (existing) Object.assign(existing, s)
    else db.businessSchedules.push({ ...s, id: nextId(db, 'businessSchedules'), businessId: business.id })
  }
  audit(db, actorId, id ? 'BUSINESS_UPDATED' : 'BUSINESS_CREATED', 'Business', business.id, at)
  return business
}

export function saveCategory(db: Database, id: number | null, data: Editable<Category>, actorId: number, at = new Date()) {
  requireAdmin(db, actorId)
  const clean = { ...data, name: required(data.name, 'El nombre') }
  if (id !== null && clean.parentId !== null) {
    let cursor: number | null = clean.parentId
    while (cursor !== null) {
      if (cursor === id) throw new DomainError('Una categoría no puede ser su propia subcategoría')
      cursor = db.categories.find((c) => c.id === cursor)?.parentId ?? null
    }
  }
  const category = upsert<Category>(db, 'categories', id, clean, (newId) => ({ ...clean, id: newId, deletedAt: null }))
  audit(db, actorId, id ? 'CATEGORY_UPDATED' : 'CATEGORY_CREATED', 'Category', category.id, at)
  return category
}

export function saveTier(db: Database, id: number | null, data: Omit<Tier, 'id'>, actorId: number, at = new Date()) {
  requireAdmin(db, actorId)
  const clean = { ...data, name: required(data.name, 'El nombre') }
  if (db.tiers.some((t) => t.id !== id && t.name.toLowerCase() === clean.name.toLowerCase())) {
    throw new DomainError('Ya existe un tier con ese nombre')
  }
  if (db.tiers.some((t) => t.id !== id && t.minimumStatus === clean.minimumStatus)) {
    throw new DomainError('Ya existe un nivel con esos puntos de nivel mínimos')
  }
  if (clean.pointsMultiplier <= 0) throw new DomainError('El multiplicador debe ser mayor a 0')
  const tier = upsert<Tier>(db, 'tiers', id, clean, (newId) => ({ ...clean, id: newId }))
  audit(db, actorId, id ? 'TIER_UPDATED' : 'TIER_CREATED', 'Tier', tier.id, at)
  return tier
}

export function saveReward(db: Database, id: number | null, data: Editable<Reward>, actorId: number, at = new Date()) {
  const existing = id !== null ? db.rewards.find((r) => r.id === id && r.deletedAt === null) : undefined
  if (id !== null && !existing) throw new DomainError('Recompensa no encontrada')
  const businessId = existing?.businessId ?? data.businessId
  requireBusinessManager(db, actorId, businessId)

  const clean: Editable<Reward> = {
    ...data,
    businessId,
    description: data.description?.trim() || null,
    discountPercent: null,
    discountAmount: null,
    catalogItemId: null,
    quantity: 1,
    minimumPurchase: null,
  }
  const minimumPurchase = data.minimumPurchase
  if (minimumPurchase !== null && !(minimumPurchase >= 0)) throw new DomainError('La compra mínima no puede ser negativa')

  switch (data.type) {
    case 'PERCENT_DISCOUNT':
      if (!Number.isInteger(data.discountPercent) || data.discountPercent! < 1 || data.discountPercent! > 100) {
        throw new DomainError('El porcentaje de descuento debe estar entre 1 y 100')
      }
      clean.discountPercent = data.discountPercent
      clean.minimumPurchase = minimumPurchase || null
      break
    case 'AMOUNT_DISCOUNT':
      if (!(data.discountAmount !== null && data.discountAmount > 0)) throw new DomainError('El descuento en Bs debe ser mayor a 0')
      clean.discountAmount = Math.round(data.discountAmount * 100) / 100
      clean.minimumPurchase = minimumPurchase || null
      break
    case 'FREE_PRODUCT': {
      const item = db.catalogItems.find((i) => i.id === data.catalogItemId && i.businessId === businessId && i.deletedAt === null)
      if (!item) throw new DomainError('Elige un producto del catálogo de tu establecimiento')
      if (!Number.isInteger(data.quantity) || data.quantity < 1 || data.quantity > 20) {
        throw new DomainError('La cantidad debe estar entre 1 y 20')
      }
      clean.catalogItemId = item.id
      clean.quantity = data.quantity
      break
    }
  }
  if (!Number.isInteger(clean.pointsCost) || clean.pointsCost <= 0) throw new DomainError('El costo en puntos debe ser mayor a 0')
  if (clean.stock !== null && clean.stock < 0) throw new DomainError('La cantidad disponible no puede ser negativa')
  if (clean.minimumTierId !== null && !db.tiers.some((t) => t.id === clean.minimumTierId)) throw new DomainError('Nivel inválido')
  checkWindow(clean.startsAt, clean.endsAt)

  const reward = upsert<Reward>(db, 'rewards', id, clean, (newId) => ({
    ...clean,
    id: newId,
    createdById: actorId,
    deletedAt: null,
  }))
  audit(db, actorId, id ? 'REWARD_UPDATED' : 'REWARD_CREATED', 'Reward', reward.id, at)
  return reward
}

export function saveMission(
  db: Database,
  id: number | null,
  data: Editable<Mission>,
  scope: { businessIds: number[]; categoryIds: number[] },
  actorId: number,
  at = new Date(),
) {
  requireAdmin(db, actorId)
  const clean = { ...data, name: required(data.name, 'El nombre') }
  if (!(clean.goal > 0)) throw new DomainError('El objetivo debe ser mayor a 0')
  checkWindow(clean.startsAt, clean.endsAt)
  const mission = upsert<Mission>(db, 'missions', id, clean, (newId) => ({
    ...clean,
    id: newId,
    createdById: actorId,
    deletedAt: null,
  }))
  replaceLinks(db, 'missionBusinesses', 'missionId', mission.id, 'businessId', scope.businessIds)
  replaceLinks(db, 'missionCategories', 'missionId', mission.id, 'categoryId', scope.categoryIds)
  // Customers whose past purchases already meet the goal get the reward now, not on their next purchase.
  for (const customer of db.users.filter((u) => u.role === 'CUSTOMER' && u.deletedAt === null && u.status === 'ACTIVE')) {
    syncMissionProgress(db, customer.id, at)
  }
  audit(db, actorId, id ? 'MISSION_UPDATED' : 'MISSION_CREATED', 'Mission', mission.id, at)
  return mission
}

export function savePromotion(
  db: Database,
  id: number | null,
  data: Editable<Promotion>,
  scope: { businessIds: number[]; categoryIds: number[] },
  actorId: number,
  at = new Date(),
) {
  requireAdmin(db, actorId)
  const clean = { ...data, name: required(data.name, 'El nombre') }
  if (clean.type === 'POINTS_MULTIPLIER' && !(clean.value > 1)) {
    throw new DomainError('El multiplicador debe ser mayor a 1')
  }
  if (clean.type === 'FIXED_POINTS' && !(clean.value > 0)) throw new DomainError('Los puntos extra deben ser mayores a 0')
  checkWindow(clean.startsAt, clean.endsAt)
  const promotion = upsert<Promotion>(db, 'promotions', id, clean, (newId) => ({
    ...clean,
    id: newId,
    createdById: actorId,
    deletedAt: null,
  }))
  replaceLinks(db, 'promotionBusinesses', 'promotionId', promotion.id, 'businessId', scope.businessIds)
  replaceLinks(db, 'promotionCategories', 'promotionId', promotion.id, 'categoryId', scope.categoryIds)
  audit(db, actorId, id ? 'PROMOTION_UPDATED' : 'PROMOTION_CREATED', 'Promotion', promotion.id, at)
  return promotion
}

export function saveCatalogItem(
  db: Database,
  id: number | null,
  data: Omit<CatalogItem, 'id' | 'deletedAt'>,
  actorId: number,
  at = new Date(),
) {
  requireManager(db, actorId, data.businessId)
  const clean = { ...data, name: required(data.name, 'El nombre') }
  if (clean.price !== null && clean.price < 0) throw new DomainError('El precio no puede ser negativo')
  const item = upsert<CatalogItem>(db, 'catalogItems', id, clean, (newId) => ({ ...clean, id: newId, deletedAt: null }))
  audit(db, actorId, id ? 'CATALOG_ITEM_UPDATED' : 'CATALOG_ITEM_CREATED', 'CatalogItem', item.id, at)
  return item
}

// ==================================================
// Events & badges
// ==================================================

export function saveEvent(db: Database, id: number | null, data: Editable<PaseoEvent>, actorId: number, at = new Date()) {
  requireAdmin(db, actorId)
  const clean = {
    ...data,
    name: required(data.name, 'El nombre'),
    description: data.description?.trim() || null,
    location: data.location?.trim() || null,
  }
  if (!Number.isInteger(clean.pointsReward) || clean.pointsReward < 0) throw new DomainError('Los puntos por asistir no pueden ser negativos')
  checkWindow(clean.startsAt, clean.endsAt)
  const event = upsert<PaseoEvent>(db, 'events', id, clean, (newId) => ({ ...clean, id: newId, createdById: actorId, deletedAt: null }))
  audit(db, actorId, id ? 'EVENT_UPDATED' : 'EVENT_CREATED', 'Event', event.id, at)
  return event
}

/** Registers a customer's entrance to an event: grants its points once and, with it, the event badge. */
export function checkInEvent(db: Database, input: { eventId: number; customerId: number }, actorId: number, at = new Date()) {
  requireAdmin(db, actorId)
  const event = db.events.find((e) => e.id === input.eventId && e.deletedAt === null)
  if (!event || event.status !== 'ACTIVE') throw new DomainError('El evento no está publicado')
  if (!isEventOpen(event, at)) throw new DomainError('Solo se registran ingresos mientras el evento está en curso')
  const customer = db.users.find((u) => u.id === input.customerId && u.deletedAt === null && u.role === 'CUSTOMER')
  if (!customer) throw new DomainError('Cliente no encontrado')
  if (customer.status !== 'ACTIVE') throw new DomainError('La cuenta del cliente está suspendida')
  if (db.eventAttendances.some((a) => a.eventId === event.id && a.userId === customer.id)) {
    throw new DomainError(`${customer.firstName} ya registró su ingreso a este evento`)
  }
  const before = earnedKeys(db, customer.id)
  db.eventAttendances.push({ eventId: event.id, userId: customer.id, checkedInById: actorId, checkedInAt: iso(at) })
  addPoints(db, customer.id, 'EVENT', event.pointsReward, { eventId: event.id }, at)
  audit(db, actorId, 'EVENT_CHECK_IN', 'Event', event.id, at)
  return { pointsEarned: event.pointsReward, newBadges: badgesEarnedSince(db, customer.id, before) }
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

export function saveBadge(db: Database, id: number | null, data: Editable<Badge>, actorId: number, at = new Date()) {
  requireAdmin(db, actorId)
  const clean: Editable<Badge> = {
    ...data,
    name: required(data.name, 'El nombre'),
    description: data.description?.trim() || null,
    goal: null,
    tierId: null,
    categoryId: null,
    date: null,
  }
  const needGoal = () => {
    if (!Number.isInteger(data.goal) || data.goal! < 1) throw new DomainError('La cantidad debe ser mayor a 0')
    clean.goal = data.goal
  }
  switch (data.type) {
    case 'TIER_REACHED':
      if (!db.tiers.some((t) => t.id === data.tierId)) throw new DomainError('Elige el nivel')
      clean.tierId = data.tierId
      break
    case 'CATEGORY_PURCHASES':
      if (!db.categories.some((c) => c.id === data.categoryId && c.deletedAt === null)) throw new DomainError('Elige la categoría')
      clean.categoryId = data.categoryId
      needGoal()
      break
    case 'SPECIAL_DATE':
      if (!data.date || !DATE_KEY.test(data.date) || Number.isNaN(Date.parse(data.date))) throw new DomainError('Elige la fecha')
      clean.date = data.date
      break
    default:
      needGoal()
  }
  const badge = upsert<Badge>(db, 'badges', id, clean, (newId) => ({ ...clean, id: newId, createdById: actorId, deletedAt: null }))
  audit(db, actorId, id ? 'BADGE_UPDATED' : 'BADGE_CREATED', 'Badge', badge.id, at)
  return badge
}

export type SoftDeletable =
  | 'businesses'
  | 'categories'
  | 'rewards'
  | 'missions'
  | 'promotions'
  | 'catalogItems'
  | 'users'
  | 'events'
  | 'badges'

const ENTITY_NAMES: Record<SoftDeletable, string> = {
  businesses: 'Business',
  categories: 'Category',
  rewards: 'Reward',
  missions: 'Mission',
  promotions: 'Promotion',
  catalogItems: 'CatalogItem',
  users: 'User',
  events: 'Event',
  badges: 'Badge',
}

export function softDelete(db: Database, table: SoftDeletable, id: number, actorId: number, at = new Date()) {
  const row = (db[table] as { id: number; deletedAt: string | null }[]).find((r) => r.id === id)
  if (!row) throw new DomainError('Registro no encontrado')
  if (table === 'catalogItems') {
    requireManager(db, actorId, (row as unknown as CatalogItem).businessId)
    if (db.rewards.some((r) => r.catalogItemId === id && r.deletedAt === null && r.status !== 'INACTIVE')) {
      throw new DomainError('Este producto se usa en una recompensa. Desactívala o elimínala primero')
    }
  } else if (table === 'rewards') {
    requireBusinessManager(db, actorId, (row as unknown as Reward).businessId)
  } else {
    requireAdmin(db, actorId)
  }
  if (table === 'users' && id === actorId) throw new DomainError('No puedes eliminar tu propia cuenta')
  row.deletedAt = iso(at)
  audit(db, actorId, 'SOFT_DELETED', ENTITY_NAMES[table], id, at)
}

export function setUserStatus(db: Database, userId: number, status: User['status'], actorId: number, at = new Date()) {
  requireAdmin(db, actorId)
  if (userId === actorId) throw new DomainError('No puedes suspender tu propia cuenta')
  const user = db.users.find((u) => u.id === userId)
  if (!user) throw new DomainError('Usuario no encontrado')
  user.status = status
  user.updatedAt = iso(at)
  audit(db, actorId, status === 'SUSPENDED' ? 'USER_SUSPENDED' : 'USER_REACTIVATED', 'User', userId, at)
}

export function saveMembership(
  db: Database,
  input: { email: string; businessId: number; role: BusinessMemberRole },
  actorId: number,
  at = new Date(),
) {
  requireAdmin(db, actorId)
  const user = db.users.find((u) => u.email.toLowerCase() === input.email.trim().toLowerCase() && u.deletedAt === null)
  if (!user) throw new DomainError('No existe un usuario con ese correo. Primero debe crear su cuenta en la app.')
  const existing = db.businessMembers.find((m) => m.userId === user.id && m.businessId === input.businessId)
  if (existing) {
    existing.role = input.role
    existing.status = 'ACTIVE'
  } else {
    db.businessMembers.push({
      id: nextId(db, 'businessMembers'),
      userId: user.id,
      businessId: input.businessId,
      role: input.role,
      status: 'ACTIVE',
    })
  }
  audit(db, actorId, 'MEMBER_SAVED', 'Business', input.businessId, at)
}

export function deactivateMembership(db: Database, memberId: number, actorId: number, at = new Date()) {
  requireAdmin(db, actorId)
  const m = db.businessMembers.find((x) => x.id === memberId)
  if (!m) throw new DomainError('Miembro no encontrado')
  m.status = 'INACTIVE'
  audit(db, actorId, 'MEMBER_DEACTIVATED', 'Business', m.businessId, at)
}

export function saveSetting(db: Database, key: string, value: string, actorId: number, at = new Date()) {
  requireAdmin(db, actorId)
  const row = db.systemSettings.find((s) => s.key === key)
  if (row) {
    row.value = value
    row.updatedAt = iso(at)
  } else {
    db.systemSettings.push({ key, value, updatedAt: iso(at) })
  }
  audit(db, actorId, `SETTING_UPDATED:${key}`, 'SystemSetting', 0, at)
}

// ==================================================
// Accounts (demo auth; the API will own password hashing)
// ==================================================

export function registerCustomer(
  db: Database,
  input: { email: string; firstName: string; lastName: string; phone: string | null },
  at = new Date(),
): User {
  const email = required(input.email, 'El correo').toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new DomainError('Correo inválido')
  if (db.users.some((u) => u.email.toLowerCase() === email)) throw new DomainError('Ese correo ya está registrado')
  const user: User = {
    id: nextId(db, 'users'),
    email,
    firstName: required(input.firstName, 'El nombre'),
    lastName: required(input.lastName, 'El apellido'),
    phone: input.phone?.trim() || null,
    birthDate: null,
    role: 'CUSTOMER',
    status: 'ACTIVE',
    createdAt: iso(at),
    updatedAt: iso(at),
    deletedAt: null,
  }
  db.users.push(user)
  return user
}
