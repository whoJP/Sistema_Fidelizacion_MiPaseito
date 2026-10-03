import {
  anniversaryLabel,
  birthdayRewardClaimed,
  birthdayRewardOptions,
  consumptionProfile,
  currentAnniversary,
  eligiblePrizes,
  hasActiveMembership,
  isBirthdayToday,
  localYear,
  pointsExpiry,
  prizeTitle,
  spinAvailability,
  visitCard,
} from '../domain/engagement'
import {
  earnedBadges,
  getSetting,
  isEventOpen,
  liveMissions,
  evaluateMission,
  pointsBalance,
  quotePurchase,
  rewardBlocker,
  rewardRedeemedCount,
  rewardTitle,
  scopeBusinesses,
  SETTING_DEFAULTS,
  statusTotal,
  visibleRewards,
  weekKey,
  weeklyStreak,
  type SettingKey,
} from '../domain/loyalty'
import { windowError, type Window } from '../domain/schedule'
import { addDaysKey, endOfLocalDay, localDateKey, startOfLocalDay, todayKey } from '../domain/time'
import { createRedemptionToken } from '../domain/tokens'
import {
  LIMITS,
  MAX_GOAL,
  MAX_MONEY,
  MAX_MULTIPLIER,
  MAX_POINTS,
  MAX_REWARD_POINTS,
  MAX_SORT_ORDER,
  MAX_STOCK,
  MAX_TIER_STATUS,
  MIN_AGE,
  birthDateRange,
  emailError,
  floorError,
  intError,
  isCalendarDate,
  localNumberError,
  moneyError,
  multiplierError,
  personNameError,
  phoneError,
  rangeError,
  singleLine,
  textError,
  urlError,
} from '../domain/validation'
import { DAY_LABELS, formatDate, formatInt, formatLongDayKey, formatMoney, normalizeText } from '../lib/format'
import type {
  Badge,
  BirthdayPerk,
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
  PromotionOrigin,
  Redemption,
  Reward,
  RewardType,
  Space,
  SpinPrize,
  SpinSource,
  Tier,
  Transaction,
  User,
} from '../types/domain'
import { nextId } from './ids'

export class DomainError extends Error {}

const iso = (d: Date) => d.toISOString()

const check = (error: string | null) => {
  if (error) throw new DomainError(error)
}

/** Trimmed text, or null when empty. Throws when longer than `max`. */
const optionalText = (value: string | null | undefined, label: string, max: number) => {
  check(textError(value, label, max))
  return value?.trim() || null
}

/** Required one-line name with repeated spaces collapsed. */
const requiredName = (value: string, label: string, max: number) => {
  check(textError(value, label, max, { required: true }))
  return singleLine(value)
}

/** Names compared ignoring case, accents and extra spaces. */
const sameName = (a: string, b: string) => normalizeText(singleLine(a)) === normalizeText(singleLine(b))

function audit(db: Database, userId: number, action: string, entityType: string, entityId: number, at: Date) {
  db.auditLogs.push({ id: nextId(db, 'auditLogs'), userId, action, entityType, entityId, createdAt: iso(at) })
}

function raiseAlert(
  db: Database,
  type: FraudAlertType,
  riskScore: number,
  ref: { transactionId?: number; redemptionId?: number; checkInId?: number },
  at: Date,
) {
  db.fraudAlerts.push({
    id: nextId(db, 'fraudAlerts'),
    transactionId: ref.transactionId ?? null,
    redemptionId: ref.redemptionId ?? null,
    checkInId: ref.checkInId ?? null,
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
  refs: {
    transactionId?: number
    redemptionId?: number
    missionId?: number
    promotionId?: number
    eventId?: number
    checkInId?: number
    spinId?: number
  },
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
    checkInId: refs.checkInId ?? null,
    spinId: refs.spinId ?? null,
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
  refs: { transactionId?: number; missionId?: number; checkInId?: number },
  at: Date,
) {
  if (amount === 0) return
  db.statusMovements.push({
    id: nextId(db, 'statusMovements'),
    userId,
    transactionId: refs.transactionId ?? null,
    missionId: refs.missionId ?? null,
    checkInId: refs.checkInId ?? null,
    type,
    amount,
    createdAt: iso(at),
  })
}

function notifyUser(db: Database, userId: number, title: string, message: string, at: Date) {
  db.notifications.push({ id: nextId(db, 'notifications'), userId, title, message, createdAt: iso(at), readAt: null })
}

/** Author of rows the program creates by itself (automatic promotions): the first active admin. */
function systemActorId(db: Database, fallback: number): number {
  return db.users.find((u) => u.role === 'ADMIN' && u.status === 'ACTIVE' && u.deletedAt === null)?.id ?? fallback
}

function activeCustomer(db: Database, userId: number, self = true): User {
  const user = db.users.find((u) => u.id === userId && u.deletedAt === null && u.role === 'CUSTOMER')
  if (!user) throw new DomainError(self ? 'Esta opción es solo para clientes' : 'Cliente no encontrado')
  if (user.status !== 'ACTIVE') throw new DomainError(self ? 'Tu cuenta está suspendida' : 'La cuenta del cliente está suspendida')
  return user
}

/** Personal promotion created by the program for one customer (visit card, ruleta, reactivation, anniversary). */
function createPersonalPromotion(
  db: Database,
  input: {
    userId: number
    origin: PromotionOrigin
    name: string
    multiplier: number
    days: number
    singleUse: boolean
    categoryIds?: number[]
    businessIds?: number[]
  },
  at: Date,
): Promotion {
  const promotion: Promotion = {
    id: nextId(db, 'promotions'),
    name: input.name,
    type: 'POINTS_MULTIPLIER',
    value: input.multiplier,
    startsAt: iso(at),
    endsAt: endOfLocalDay(addDaysKey(todayKey(at), Math.max(1, input.days) - 1)),
    status: 'ACTIVE',
    userId: input.userId,
    origin: input.origin,
    singleUse: input.singleUse,
    createdById: systemActorId(db, input.userId),
    deletedAt: null,
  }
  db.promotions.push(promotion)
  for (const categoryId of input.categoryIds ?? []) db.promotionCategories.push({ promotionId: promotion.id, categoryId })
  for (const businessId of input.businessIds ?? []) db.promotionBusinesses.push({ promotionId: promotion.id, businessId })
  return promotion
}

/** Every completed visit card leaves a "cupón de regreso" (the free spin is derived from the card itself). */
function syncVisitCard(db: Database, userId: number, at: Date): boolean {
  const card = visitCard(db, userId)
  const multiplier = getSetting(db, 'VISIT_CARD_MULTIPLIER')
  let created = false
  let issued = db.promotions.filter((p) => p.userId === userId && p.origin === 'VISIT_CARD').length
  while (issued < card.completedCards && multiplier > 1) {
    const days = Math.floor(getSetting(db, 'VISIT_CARD_VALID_DAYS'))
    createPersonalPromotion(
      db,
      { userId, origin: 'VISIT_CARD', name: `Cupón de regreso: puntos ×${multiplier}`, multiplier, days, singleUse: true },
      at,
    )
    notifyUser(
      db,
      userId,
      '¡Tarjeta de visitas completa!',
      `Tu próxima compra suma puntos ×${multiplier} (${days} días) y tienes un giro gratis.`,
      at,
    )
    issued += 1
    created = true
  }
  return created
}

export function activeMembership(db: Database, userId: number, businessId: number) {
  if (db.users.find((u) => u.id === userId)?.role !== 'MERCHANT') return undefined
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
  visitCardCompleted: boolean
}

export interface PurchaseLine {
  catalogItemId: number
  quantity: number
}

/** Time the cashier has to undo a purchase right after registering it. */
export const PURCHASE_UNDO_MS = 2 * 60_000

/** Validates the products of a purchase (same business, available) and merges repeated lines. */
function purchaseLines(db: Database, businessId: number, lines: PurchaseLine[]) {
  if (lines.length === 0) throw new DomainError('Agrega al menos un producto')
  const merged = new Map<number, number>()
  for (const line of lines) merged.set(line.catalogItemId, (merged.get(line.catalogItemId) ?? 0) + line.quantity)
  if (merged.size > 50) throw new DomainError('Demasiados productos en una sola compra')
  return [...merged].map(([catalogItemId, quantity]) => {
    const item = db.catalogItems.find((i) => i.id === catalogItemId && i.businessId === businessId && i.deletedAt === null)
    if (!item) throw new DomainError('Producto no encontrado en el catálogo')
    if (!item.isAvailable) throw new DomainError(`"${item.name}" no está disponible`)
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) throw new DomainError(`Cantidad inválida para "${item.name}"`)
    return { item, quantity }
  })
}

export function registerPurchase(
  db: Database,
  input: { customerId: number; businessId: number; performedById: number; items: PurchaseLine[] },
  at = new Date(),
): PurchaseResult {
  const customer = db.users.find((u) => u.id === input.customerId && u.deletedAt === null && u.role === 'CUSTOMER')
  if (!customer) throw new DomainError('Cliente no encontrado')
  if (customer.status !== 'ACTIVE') throw new DomainError('La cuenta del cliente está suspendida')
  const business = db.businesses.find((b) => b.id === input.businessId && b.deletedAt === null)
  if (!business || business.status !== 'ACTIVE') throw new DomainError('Establecimiento inactivo')
  if (!activeMembership(db, input.performedById, input.businessId)) {
    throw new DomainError('No perteneces a este establecimiento')
  }
  const lines = purchaseLines(db, input.businessId, input.items)
  const amount = Math.round(lines.reduce((s, l) => s + l.item.price * l.quantity, 0) * 100) / 100
  if (!(amount > 0)) throw new DomainError('El total de la compra debe ser mayor a 0')
  if (amount > MAX_MONEY) throw new DomainError(`El total no puede superar ${formatMoney(MAX_MONEY)}`)
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
  for (const { item, quantity } of lines) {
    db.transactionItems.push({
      id: nextId(db, 'transactionItems'),
      transactionId: transaction.id,
      catalogItemId: item.id,
      quantity,
      unitPrice: item.price,
    })
  }

  if (duplicate) raiseAlert(db, 'DUPLICATE_TRANSACTION', 85, { transactionId: transaction.id }, at)
  if (abnormal) raiseAlert(db, 'ABNORMAL_AMOUNT', 60, { transactionId: transaction.id }, at)
  if (lastHour >= 5) raiseAlert(db, 'HIGH_FREQUENCY', 50, { transactionId: transaction.id }, at)

  if (flagged) {
    return {
      transaction,
      pointsEarned: 0,
      statusEarned: 0,
      discovered: false,
      completedMissions: [],
      newBadges: [],
      flagged,
      visitCardCompleted: false,
    }
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
  const visitCardCompleted = syncVisitCard(db, tx.customerId, at)

  const sum = <T extends { amount: number }>(rows: T[]) => rows.reduce((s, r) => s + r.amount, 0)
  return {
    transaction: tx,
    pointsEarned: sum(db.pointMovements.slice(pointsBefore)),
    statusEarned: sum(db.statusMovements.slice(statusBefore)),
    discovered,
    completedMissions,
    visitCardCompleted,
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

/** Cancels a purchase and takes back everything it granted. Returns the points and Status removed. */
function voidTransaction(db: Database, tx: Transaction, at: Date): { points: number; status: number } {
  if (tx.status === 'CANCELLED') throw new DomainError('La compra ya está anulada')
  const pointsBefore = db.pointMovements.length
  const statusBefore = db.statusMovements.length
  const wasCompleted = tx.status === 'COMPLETED'
  if (wasCompleted) reverseTransactionMovements(db, tx, at)
  tx.status = 'CANCELLED'
  if (wasCompleted) revokeUnmetMissions(db, tx.customerId, at)
  for (const alert of db.fraudAlerts) {
    if (alert.transactionId === tx.id && alert.status === 'OPEN') alert.status = 'DISMISSED'
  }
  const sum = <T extends { amount: number }>(rows: T[]) => rows.reduce((s, r) => s + r.amount, 0)
  return { points: -sum(db.pointMovements.slice(pointsBefore)), status: -sum(db.statusMovements.slice(statusBefore)) }
}

/** Direct cancellation by the Paseo admin. */
export function cancelTransaction(db: Database, transactionId: number, actorId: number, at = new Date()) {
  requireAdmin(db, actorId)
  const tx = db.transactions.find((t) => t.id === transactionId)
  if (!tx) throw new DomainError('Compra no encontrada')
  voidTransaction(db, tx, at)
  audit(db, actorId, 'TRANSACTION_CANCELLED', 'Transaction', tx.id, at)
}

export function undoDeadline(tx: Transaction): number {
  return new Date(tx.createdAt).getTime() + PURCHASE_UNDO_MS
}

/** The cashier undoes a purchase within a few minutes of registering it (wrong customer or products). */
export function undoPurchase(db: Database, transactionId: number, actorId: number, at = new Date()) {
  const tx = db.transactions.find((t) => t.id === transactionId)
  if (!tx) throw new DomainError('Compra no encontrada')
  const membership = activeMembership(db, actorId, tx.businessId)
  if (!membership || (tx.performedById !== actorId && membership.role !== 'MANAGER')) {
    throw new DomainError('Solo quien registró la compra puede deshacerla')
  }
  if (tx.status === 'CANCELLED') return
  if (at.getTime() > undoDeadline(tx) + 5_000) {
    throw new DomainError('Pasó el tiempo para deshacer. Solicita la anulación desde Movimientos')
  }
  voidTransaction(db, tx, at)
  audit(db, actorId, 'TRANSACTION_UNDONE', 'Transaction', tx.id, at)
}

export function requestCancellation(
  db: Database,
  input: { transactionId: number; reason: string },
  actorId: number,
  at = new Date(),
) {
  const tx = db.transactions.find((t) => t.id === input.transactionId)
  if (!tx) throw new DomainError('Compra no encontrada')
  if (activeMembership(db, actorId, tx.businessId)?.role !== 'MANAGER') {
    throw new DomainError('Solo el encargado del establecimiento puede solicitar anulaciones')
  }
  if (tx.status === 'CANCELLED') throw new DomainError('La compra ya está anulada')
  if (tx.status === 'FLAGGED') throw new DomainError('La administración ya está revisando esta compra')
  const existing = db.cancellationRequests.find((r) => r.transactionId === tx.id)
  if (existing?.status === 'PENDING') throw new DomainError('Ya enviaste una solicitud para esta compra')
  if (existing) throw new DomainError('La administración ya respondió una solicitud para esta compra')
  const reason = input.reason.trim()
  if (reason.length < LIMITS.reasonMin) throw new DomainError(`Explica el motivo con al menos ${LIMITS.reasonMin} caracteres`)
  if (reason.length > LIMITS.reason) throw new DomainError(`El motivo no puede superar los ${LIMITS.reason} caracteres`)
  const request = {
    id: nextId(db, 'cancellationRequests'),
    transactionId: tx.id,
    requestedById: actorId,
    reason,
    status: 'PENDING' as const,
    reviewedById: null,
    reviewNote: null,
    createdAt: iso(at),
    reviewedAt: null,
  }
  db.cancellationRequests.push(request)
  audit(db, actorId, 'CANCELLATION_REQUESTED', 'Transaction', tx.id, at)
  return request
}

/** What approving a cancellation would take from the customer, computed on a copy of the data. */
export function cancellationImpact(db: Database, transactionId: number, at = new Date()) {
  const copy = structuredClone(db)
  const tx = copy.transactions.find((t) => t.id === transactionId)
  if (!tx || tx.status === 'CANCELLED') return { points: 0, status: 0 }
  return voidTransaction(copy, tx, at)
}

const sentence = (text: string) => {
  const t = text.trim().replace(/\s+/g, ' ')
  const capitalized = t.charAt(0).toUpperCase() + t.slice(1)
  return /[.!?…]$/.test(capitalized) ? capitalized : `${capitalized}.`
}

/** Message the customer receives when a cancellation is approved. The admin only writes `note`. */
export function cancellationNotice(db: Database, tx: Transaction, points: number, note: string) {
  const business = db.businesses.find((b) => b.id === tx.businessId)?.name ?? 'el Paseo'
  const purchase = `tu compra del ${formatDate(tx.createdAt)} en ${business} (${formatMoney(tx.amount)})`
  const what =
    points > 0
      ? `Se te descontaron ${formatInt(points)} ${points === 1 ? 'punto' : 'puntos'} porque se anuló ${purchase}.`
      : `Se anuló ${purchase}.`
  return { title: `Ajuste de puntos en ${business}`, message: `${what} Motivo: ${sentence(note || 'sin detalle')}` }
}

export function reviewCancellation(
  db: Database,
  input: { requestId: number; decision: 'APPROVED' | 'REJECTED'; note: string },
  actorId: number,
  at = new Date(),
) {
  requireAdmin(db, actorId)
  const request = db.cancellationRequests.find((r) => r.id === input.requestId)
  if (!request) throw new DomainError('Solicitud no encontrada')
  if (request.status === input.decision) return
  if (request.status !== 'PENDING') throw new DomainError('La solicitud ya fue respondida con otra decisión')
  const note = input.note.trim()
  if (note.length > LIMITS.note) throw new DomainError(`La explicación no puede superar los ${LIMITS.note} caracteres`)
  if (input.decision === 'APPROVED' && note.length < 5) throw new DomainError('Escribe el motivo que verá el cliente')

  request.status = input.decision
  request.reviewedById = actorId
  request.reviewNote = note ? sentence(note) : null
  request.reviewedAt = iso(at)

  const tx = db.transactions.find((t) => t.id === request.transactionId)
  if (input.decision === 'APPROVED' && tx && tx.status !== 'CANCELLED') {
    const { points } = voidTransaction(db, tx, at)
    const notice = cancellationNotice(db, tx, points, note)
    db.notifications.push({ id: nextId(db, 'notifications'), userId: tx.customerId, ...notice, createdAt: iso(at), readAt: null })
  }
  audit(db, actorId, `CANCELLATION_${input.decision}`, 'Transaction', request.transactionId, at)
}

export function dismissNotification(db: Database, notificationId: number, userId: number, at = new Date()) {
  const notification = db.notifications.find((n) => n.id === notificationId && n.userId === userId)
  if (!notification) throw new DomainError('Aviso no encontrado')
  notification.readAt ??= iso(at)
}

// ==================================================
// Redemptions
// ==================================================

export function createRedemption(db: Database, userId: number, rewardId: number, at = new Date()) {
  const reward = visibleRewards(db, at).find((r) => r.id === rewardId)
  if (!reward) throw new DomainError('Recompensa no disponible')
  const user = db.users.find((u) => u.id === userId)
  if (user?.role !== 'CUSTOMER') throw new DomainError('Solo los clientes pueden canjear recompensas')
  if (user.status !== 'ACTIVE') throw new DomainError('Tu cuenta está suspendida')
  const blocker = rewardBlocker(db, reward, userId)
  if (blocker === 'STOCK') throw new DomainError('Recompensa agotada')
  if (blocker === 'TIER') throw new DomainError('Tu nivel aún no permite este canje')
  if (blocker === 'POINTS') throw new DomainError('No tienes puntos suficientes')

  const redemption = issueRedemption(db, { userId, rewardId, pointsSpent: reward.pointsCost, origin: 'POINTS', expiresAt: null }, at)
  addPoints(db, userId, 'REDEMPTION', -reward.pointsCost, { redemptionId: redemption.id }, at)
  return redemption
}

function issueRedemption(
  db: Database,
  input: Pick<Redemption, 'userId' | 'rewardId' | 'pointsSpent' | 'origin' | 'expiresAt'>,
  at: Date,
): Redemption {
  let token = createRedemptionToken()
  while (db.redemptions.some((r) => r.verificationToken === token)) token = createRedemptionToken()
  const redemption: Redemption = {
    id: nextId(db, 'redemptions'),
    ...input,
    businessId: null,
    validatedById: null,
    verificationToken: token,
    status: 'PENDING',
    createdAt: iso(at),
    redeemedAt: null,
  }
  db.redemptions.push(redemption)
  return redemption
}

export function cancelRedemption(db: Database, redemptionId: number, userId: number, at = new Date()) {
  const r = db.redemptions.find((x) => x.id === redemptionId && x.userId === userId)
  if (r?.status === 'CANCELLED') return
  if (!r || r.status !== 'PENDING') throw new DomainError('Solo se pueden cancelar canjes pendientes')
  if (r.origin !== 'POINTS') throw new DomainError('Los regalos no se cancelan: si no lo usas, vence solo')
  r.status = 'CANCELLED'
  addPoints(db, r.userId, 'REVERSAL', r.pointsSpent, { redemptionId: r.id }, at)
}

export function expireRedemptions(db: Database, at = new Date()) {
  for (const r of db.redemptions) {
    if (r.status === 'PENDING' && redemptionExpiresAt(db, r.createdAt, r.expiresAt).getTime() < at.getTime()) {
      r.status = 'EXPIRED'
      addPoints(db, r.userId, 'REVERSAL', r.pointsSpent, { redemptionId: r.id }, at)
    }
  }
}

/** Point redemptions last a few minutes; free gifts (ruleta, birthday) carry their own `expiresAt`. */
export function redemptionExpiresAt(db: Database, createdAt: string, expiresAt: string | null = null): Date {
  if (expiresAt) return new Date(expiresAt)
  return new Date(new Date(createdAt).getTime() + getSetting(db, 'REDEMPTION_EXPIRATION_MINUTES') * 60_000)
}

/** A second scan of a just-validated code by the same cashier within this time is treated as a repeat. */
const REDEMPTION_REPEAT_MS = 2 * 60_000

export function validateRedemption(
  db: Database,
  input: { token: string; businessId: number; staffId: number },
  at = new Date(),
) {
  if (!activeMembership(db, input.staffId, input.businessId)) {
    throw new DomainError('No perteneces a este establecimiento')
  }
  expireRedemptions(db, at)
  const compact = input.token.toUpperCase().replace(/[\s-]/g, '')
  if (!/^[A-Z0-9]{10}$/.test(compact)) throw new DomainError('Código de canje inválido: son 10 letras y números, como ABCDE-23456')
  const token = `${compact.slice(0, 5)}-${compact.slice(5)}`
  const r = db.redemptions.find((x) => x.verificationToken === token)
  if (!r) throw new DomainError('Código de canje no encontrado')
  if (r.status === 'REDEEMED') {
    // The same cashier scanning twice in a row is a repeat, not someone reusing the code.
    const repeated =
      r.businessId === input.businessId &&
      r.validatedById === input.staffId &&
      !!r.redeemedAt &&
      at.getTime() - Date.parse(r.redeemedAt) <= REDEMPTION_REPEAT_MS
    if (repeated) return { redemption: r, reused: false, repeated: true }
    raiseAlert(db, 'REUSED_REDEMPTION', 90, { redemptionId: r.id }, at)
    return { redemption: r, reused: true, repeated: false }
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
  return { redemption: r, reused: false, repeated: false }
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
  if (!alert) throw new DomainError('Alerta no encontrada')
  if (alert.status === decision) return
  if (alert.status !== 'OPEN') throw new DomainError('La alerta ya fue revisada con otra decisión')
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
  const user = db.users.find((u) => u.id === input.userId && u.deletedAt === null)
  if (user?.role !== 'CUSTOMER') throw new DomainError('Solo se ajustan puntos de clientes')
  if (input.amount === 0) throw new DomainError('El ajuste no puede ser 0')
  check(intError(input.amount, 'El ajuste', -MAX_POINTS, MAX_POINTS))
  const balance = input.ledger === 'POINTS' ? pointsBalance(db, user.id) : statusTotal(db, user.id)
  if (balance + input.amount < 0) {
    const unit = input.ledger === 'POINTS' ? 'puntos' : 'puntos de nivel'
    throw new DomainError(`El ajuste dejaría el saldo en negativo: tiene ${formatInt(balance)} ${unit}`)
  }
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
  table:
    | 'businesses'
    | 'categories'
    | 'tiers'
    | 'rewards'
    | 'missions'
    | 'promotions'
    | 'catalogItems'
    | 'events'
    | 'badges'
    | 'spaces'
    | 'spinPrizes',
  id: number | null,
  data: Partial<T>,
  create: (id: number) => T,
): T {
  const rows = db[table] as unknown as T[]
  if (id !== null) {
    const row = rows.find((r) => r.id === id)
    if (!row || (row as { deletedAt?: string | null }).deletedAt) throw new DomainError('Registro no encontrado')
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

/** Businesses and categories of a mission or promotion scope must exist and not be deleted. */
function checkScope(db: Database, scope: { businessIds: number[]; categoryIds: number[] }) {
  if (scope.businessIds.some((id) => !db.businesses.some((b) => b.id === id && b.deletedAt === null))) {
    throw new DomainError('Uno de los establecimientos elegidos ya no existe')
  }
  if (scope.categoryIds.some((id) => !db.categories.some((c) => c.id === id && c.deletedAt === null))) {
    throw new DomainError('Una de las categorías elegidas ya no existe')
  }
}

function liveBusiness(db: Database, businessId: number): Business {
  const business = db.businesses.find((b) => b.id === businessId && b.deletedAt === null)
  if (!business) throw new DomainError('Establecimiento no encontrado')
  return business
}

function checkWindow(next: Window, previous: Window | undefined, required: boolean, at: Date) {
  const error = windowError(next, previous ?? null, required, at)
  if (error) throw new DomainError(error)
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
  check(urlError(data.logoUrl))
  check(phoneError(data.phone))
  check(floorError(data.floor))
  check(localNumberError(data.localNumber))
  const clean = {
    ...data,
    name: requiredName(data.name, 'El nombre', LIMITS.name),
    description: optionalText(data.description, 'La descripción', LIMITS.description) ?? '',
    logoUrl: data.logoUrl?.trim() || null,
    phone: data.phone?.trim() || null,
    floor: data.floor?.trim().toUpperCase() || null,
    sector: optionalText(data.sector, 'El sector', LIMITS.sector),
    localNumber: data.localNumber?.trim().toUpperCase() || null,
  }
  const others = db.businesses.filter((b) => b.id !== id && b.deletedAt === null)
  if (others.some((b) => sameName(b.name, clean.name))) throw new DomainError('Ya existe un establecimiento con ese nombre')
  if (clean.localNumber && others.some((b) => b.localNumber?.toUpperCase() === clean.localNumber && (b.floor ?? '').toUpperCase() === (clean.floor ?? ''))) {
    throw new DomainError('Ese número de local ya está asignado a otro establecimiento en el mismo piso')
  }
  if (categoryIds.length === 0) throw new DomainError('Elige al menos una categoría')
  if (categoryIds.some((c) => !db.categories.some((x) => x.id === c && x.deletedAt === null))) {
    throw new DomainError('Una de las categorías elegidas ya no existe')
  }
  const days = new Set<string>()
  for (const s of schedules) {
    if (days.has(s.dayOfWeek)) throw new DomainError(`El horario del ${DAY_LABELS[s.dayOfWeek].toLowerCase()} está repetido`)
    days.add(s.dayOfWeek)
    if (s.isClosed) continue
    if (!s.openTime || !s.closeTime) throw new DomainError(`Indica la hora de apertura y de cierre del ${DAY_LABELS[s.dayOfWeek].toLowerCase()}`)
    if (s.openTime >= s.closeTime) throw new DomainError(`El ${DAY_LABELS[s.dayOfWeek].toLowerCase()}, la apertura debe ser anterior al cierre`)
  }

  const business = upsert<Business>(db, 'businesses', id, { ...clean, updatedAt: iso(at) }, (newId) => ({
    ...clean,
    id: newId,
    createdAt: iso(at),
    updatedAt: iso(at),
    deletedAt: null,
  }))
  replaceLinks(db, 'businessCategories', 'businessId', business.id, 'categoryId', categoryIds)

  for (const s of schedules) {
    const existing = db.businessSchedules.find((x) => x.businessId === business.id && x.dayOfWeek === s.dayOfWeek)
    if (existing) Object.assign(existing, s)
    else db.businessSchedules.push({ ...s, id: nextId(db, 'businessSchedules'), businessId: business.id })
  }
  audit(db, actorId, id ? 'BUSINESS_UPDATED' : 'BUSINESS_CREATED', 'Business', business.id, at)
  return business
}

export function saveCategory(db: Database, id: number | null, data: Editable<Category>, actorId: number, at = new Date()) {
  requireAdmin(db, actorId)
  const clean = { ...data, name: requiredName(data.name, 'El nombre', LIMITS.categoryName) }
  if (clean.parentId !== null && !db.categories.some((c) => c.id === clean.parentId && c.deletedAt === null)) {
    throw new DomainError('La categoría principal elegida ya no existe')
  }
  if (db.categories.some((c) => c.id !== id && c.deletedAt === null && c.parentId === clean.parentId && sameName(c.name, clean.name))) {
    throw new DomainError(clean.parentId === null ? 'Ya existe una categoría con ese nombre' : 'Ya existe una subcategoría con ese nombre en esa categoría')
  }
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
  const clean = { ...data, name: requiredName(data.name, 'El nombre', LIMITS.tierName) }
  if (db.tiers.some((t) => t.id !== id && sameName(t.name, clean.name))) {
    throw new DomainError('Ya existe un nivel con ese nombre')
  }
  check(intError(clean.minimumStatus, 'Los puntos de nivel mínimos', 0, MAX_TIER_STATUS))
  if (db.tiers.some((t) => t.id !== id && t.minimumStatus === clean.minimumStatus)) {
    throw new DomainError('Ya existe un nivel con esos puntos de nivel mínimos')
  }
  check(multiplierError(clean.pointsMultiplier, 'El multiplicador', 0, MAX_MULTIPLIER))
  check(intError(clean.sortOrder, 'El orden', 0, MAX_SORT_ORDER))
  if (db.tiers.some((t) => t.id !== id && t.sortOrder === clean.sortOrder)) throw new DomainError('Ya existe un nivel con ese orden')
  const after = [...db.tiers.filter((t) => t.id !== id), clean]
  if (!after.some((t) => t.isActive && t.minimumStatus === 0)) {
    throw new DomainError('Debe quedar un nivel activo desde 0 puntos de nivel: es el nivel con el que empieza cada cliente')
  }
  const tier = upsert<Tier>(db, 'tiers', id, clean, (newId) => ({ ...clean, id: newId }))
  audit(db, actorId, id ? 'TIER_UPDATED' : 'TIER_CREATED', 'Tier', tier.id, at)
  return tier
}

export function saveReward(db: Database, id: number | null, data: Editable<Reward>, actorId: number, at = new Date()) {
  const existing = id !== null ? db.rewards.find((r) => r.id === id && r.deletedAt === null) : undefined
  if (id !== null && !existing) throw new DomainError('Recompensa no encontrada')
  const businessId = existing?.businessId ?? data.businessId
  requireBusinessManager(db, actorId, businessId)
  liveBusiness(db, businessId)

  const clean: Editable<Reward> = {
    ...data,
    businessId,
    description: optionalText(data.description, 'Las condiciones', LIMITS.description),
    discountPercent: null,
    discountAmount: null,
    catalogItemId: null,
    quantity: 1,
    minimumPurchase: null,
  }
  const minimumPurchase = data.minimumPurchase
  if (minimumPurchase !== null) check(moneyError(minimumPurchase, 'La compra mínima'))

  switch (data.type) {
    case 'PERCENT_DISCOUNT':
      if (!Number.isInteger(data.discountPercent) || data.discountPercent! < 1 || data.discountPercent! > 100) {
        throw new DomainError('El porcentaje de descuento debe estar entre 1 y 100')
      }
      clean.discountPercent = data.discountPercent
      clean.minimumPurchase = minimumPurchase || null
      break
    case 'AMOUNT_DISCOUNT':
      if (data.discountAmount === null) throw new DomainError('Indica el descuento en Bs')
      check(moneyError(data.discountAmount, 'El descuento en Bs', { minExclusive: true }))
      clean.discountAmount = Math.round(data.discountAmount * 100) / 100
      clean.minimumPurchase = minimumPurchase || null
      if (clean.minimumPurchase !== null && clean.discountAmount >= clean.minimumPurchase) {
        throw new DomainError('El descuento debe ser menor que la compra mínima')
      }
      break
    case 'FREE_PRODUCT': {
      const item = db.catalogItems.find((i) => i.id === data.catalogItemId && i.businessId === businessId && i.deletedAt === null)
      if (!item) throw new DomainError('Elige un producto del catálogo de tu establecimiento')
      if (data.status === 'ACTIVE' && !item.isAvailable) throw new DomainError(`"${item.name}" no está disponible en tu catálogo: actívalo antes de publicar la recompensa`)
      if (!Number.isInteger(data.quantity) || data.quantity < 1 || data.quantity > 20) {
        throw new DomainError('La cantidad debe estar entre 1 y 20')
      }
      clean.catalogItemId = item.id
      clean.quantity = data.quantity
      break
    }
  }
  check(intError(clean.pointsCost, 'El costo en puntos', 1, MAX_POINTS))
  if (clean.stock !== null) {
    check(intError(clean.stock, 'La cantidad disponible', 0, MAX_STOCK))
    const used = existing ? rewardRedeemedCount(db, existing.id) : 0
    if (clean.stock < used) throw new DomainError(`La cantidad disponible no puede ser menor a los canjes ya hechos (${formatInt(used)})`)
  }
  if (clean.minimumTierId !== null && !db.tiers.some((t) => t.id === clean.minimumTierId && t.isActive)) throw new DomainError('Elige un nivel activo')
  checkWindow(clean, existing, false, at)

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
  const clean = {
    ...data,
    name: requiredName(data.name, 'El nombre', LIMITS.name),
    description: optionalText(data.description, 'La descripción', LIMITS.description),
  }
  check(intError(clean.goal, 'El objetivo', 1, MAX_GOAL))
  check(intError(clean.rewardPoints, 'Los puntos de premio', 0, MAX_REWARD_POINTS))
  check(intError(clean.rewardStatus, 'Los puntos de nivel de premio', 0, MAX_REWARD_POINTS))
  if (!Number.isInteger(clean.rewardSpins) || clean.rewardSpins < 0 || clean.rewardSpins > 5) {
    throw new DomainError('Los giros de premio van de 0 a 5')
  }
  if (clean.rewardPoints === 0 && clean.rewardStatus === 0 && clean.rewardSpins === 0) {
    throw new DomainError('La misión debe dar puntos, puntos de nivel o giros de ruleta')
  }
  checkWindow(clean, db.missions.find((m) => m.id === id), true, at)
  checkScope(db, scope)
  switch (clean.type) {
    case 'BUY_CATEGORY':
      if (scope.categoryIds.length === 0) throw new DomainError('Elige en Alcance la categoría donde hay que comprar')
      break
    case 'BUY_DISTINCT_BUSINESSES':
    case 'DISCOVER_BUSINESS': {
      const available = scopeBusinesses(db, scope).length
      if (clean.goal > available) {
        throw new DomainError(`El objetivo no puede superar los establecimientos activos del alcance (${formatInt(available)})`)
      }
      break
    }
    case 'BUY_DISTINCT_CATEGORIES': {
      const available = db.categories.filter((c) => c.deletedAt === null && c.status === 'ACTIVE').length
      if (clean.goal > available) throw new DomainError(`El objetivo no puede superar las categorías activas (${formatInt(available)})`)
      break
    }
    case 'WEEKLY_PURCHASE': {
      const weeks = Math.ceil((Date.parse(clean.endsAt) - Date.parse(clean.startsAt)) / (7 * 86_400_000)) + 1
      if (clean.goal > weeks) throw new DomainError(`El objetivo no puede superar las semanas que dura la misión (${formatInt(weeks)})`)
      break
    }
  }
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
  data: Omit<Editable<Promotion>, 'userId' | 'origin' | 'singleUse'>,
  scope: { businessIds: number[]; categoryIds: number[] },
  actorId: number,
  at = new Date(),
) {
  requireAdmin(db, actorId)
  if (id !== null && db.promotions.find((p) => p.id === id)?.userId != null) {
    throw new DomainError('Las promociones personales las crea el programa y no se editan')
  }
  const clean = { ...data, name: requiredName(data.name, 'El nombre', LIMITS.name), userId: null, origin: 'MANUAL' as const, singleUse: false }
  if (clean.type === 'POINTS_MULTIPLIER') check(multiplierError(clean.value, 'El multiplicador'))
  if (clean.type === 'FIXED_POINTS') check(intError(clean.value, 'Los puntos extra', 1, MAX_REWARD_POINTS))
  checkWindow(clean, db.promotions.find((p) => p.id === id), true, at)
  checkScope(db, scope)
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
  const existing = id !== null ? db.catalogItems.find((i) => i.id === id && i.deletedAt === null) : undefined
  if (id !== null && !existing) throw new DomainError('Producto no encontrado')
  const businessId = existing?.businessId ?? data.businessId
  requireManager(db, actorId, businessId)
  liveBusiness(db, businessId)
  check(moneyError(data.price, 'El precio', { minExclusive: true }))
  const clean = {
    ...data,
    businessId,
    name: requiredName(data.name, 'El nombre', LIMITS.name),
    description: optionalText(data.description, 'La descripción', LIMITS.description),
    price: Math.round(data.price * 100) / 100,
  }
  if (db.catalogItems.some((i) => i.id !== id && i.businessId === businessId && i.deletedAt === null && sameName(i.name, clean.name))) {
    throw new DomainError('Ya tienes un producto con ese nombre')
  }
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
    name: requiredName(data.name, 'El nombre', LIMITS.name),
    description: optionalText(data.description, 'La descripción', LIMITS.description),
    location: optionalText(data.location, 'El lugar', LIMITS.location),
  }
  check(intError(clean.pointsReward, 'Los puntos por asistir', 0, MAX_REWARD_POINTS))
  checkWindow(clean, db.events.find((e) => e.id === id), true, at)
  if (db.events.some((e) => e.id !== id && e.deletedAt === null && sameName(e.name, clean.name) && e.startsAt === clean.startsAt)) {
    throw new DomainError('Ya existe un evento con ese nombre y la misma fecha de inicio')
  }
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

export function saveBadge(db: Database, id: number | null, data: Editable<Badge>, actorId: number, at = new Date()) {
  requireAdmin(db, actorId)
  const clean: Editable<Badge> = {
    ...data,
    name: requiredName(data.name, 'El nombre', LIMITS.badgeName),
    description: optionalText(data.description, 'La descripción', LIMITS.description),
    goal: null,
    tierId: null,
    categoryId: null,
    date: null,
  }
  if (db.badges.some((b) => b.id !== id && b.deletedAt === null && sameName(b.name, clean.name))) {
    throw new DomainError('Ya existe una insignia con ese nombre')
  }
  const needGoal = () => {
    if (data.goal === null) throw new DomainError('Indica la cantidad')
    check(intError(data.goal, 'La cantidad', 1, MAX_GOAL))
    clean.goal = data.goal
  }
  switch (data.type) {
    case 'TIER_REACHED':
      if (!db.tiers.some((t) => t.id === data.tierId && t.isActive)) throw new DomainError('Elige un nivel activo')
      clean.tierId = data.tierId
      break
    case 'CATEGORY_PURCHASES':
      if (!db.categories.some((c) => c.id === data.categoryId && c.deletedAt === null)) throw new DomainError('Elige la categoría')
      clean.categoryId = data.categoryId
      needGoal()
      break
    case 'SPECIAL_DATE':
      if (!data.date || !isCalendarDate(data.date)) throw new DomainError('Elige una fecha válida')
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
  | 'spaces'
  | 'spinPrizes'

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
  spaces: 'Space',
  spinPrizes: 'SpinPrize',
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
  if (row.deletedAt) return
  if (table === 'users' && id === actorId) throw new DomainError('No puedes eliminar tu propia cuenta')
  if (table === 'categories' && db.categories.some((c) => c.parentId === id && c.deletedAt === null)) {
    throw new DomainError('Esta categoría tiene subcategorías. Elimínalas o muévelas primero')
  }
  row.deletedAt = iso(at)
  audit(db, actorId, 'SOFT_DELETED', ENTITY_NAMES[table], id, at)
}

export function setUserStatus(db: Database, userId: number, status: User['status'], actorId: number, at = new Date()) {
  requireAdmin(db, actorId)
  if (userId === actorId) throw new DomainError('No puedes suspender tu propia cuenta')
  const user = db.users.find((u) => u.id === userId && u.deletedAt === null)
  if (!user) throw new DomainError('Usuario no encontrado')
  if (user.status === status) return
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
  check(emailError(input.email))
  const user = db.users.find((u) => u.email.toLowerCase() === input.email.trim().toLowerCase() && u.deletedAt === null)
  if (!user) throw new DomainError('No existe una cuenta con ese correo. Crea una cuenta de personal nueva.')
  if (user.role !== 'MERCHANT') {
    throw new DomainError('Esa cuenta no es de personal de tienda. El personal usa una cuenta propia, distinta a la de cliente.')
  }
  const current = db.businessMembers.find((m) => m.userId === user.id)
  if (current?.status === 'ACTIVE' && current.businessId === input.businessId && current.role === input.role) return
  assignMembership(db, user.id, input.businessId, input.role)
  audit(db, actorId, 'MEMBER_SAVED', 'Business', input.businessId, at)
}

/** Store staff belong to exactly one business (one BusinessMember row per user). */
function assignMembership(db: Database, userId: number, businessId: number, role: BusinessMemberRole) {
  if (!db.businesses.some((b) => b.id === businessId && b.deletedAt === null)) throw new DomainError('Establecimiento no encontrado')
  const existing = db.businessMembers.find((m) => m.userId === userId)
  const current = existing && db.businesses.find((b) => b.id === existing.businessId && b.deletedAt === null)
  if (existing?.status === 'ACTIVE' && existing.businessId !== businessId && current) {
    throw new DomainError(`Ya trabaja en ${current.name}. Quítalo de ese equipo primero.`)
  }
  if (existing) {
    existing.businessId = businessId
    existing.role = role
    existing.status = 'ACTIVE'
  } else {
    db.businessMembers.push({ id: nextId(db, 'businessMembers'), userId, businessId, role, status: 'ACTIVE' })
  }
}

export function createMerchant(
  db: Database,
  input: { email: string; firstName: string; lastName: string; phone: string | null; businessId: number; role: BusinessMemberRole },
  actorId: number,
  at = new Date(),
): User {
  requireAdmin(db, actorId)
  const user = newUser(db, input, 'MERCHANT', at)
  assignMembership(db, user.id, input.businessId, input.role)
  audit(db, actorId, 'MEMBER_SAVED', 'Business', input.businessId, at)
  return user
}

export function deactivateMembership(db: Database, memberId: number, actorId: number, at = new Date()) {
  requireAdmin(db, actorId)
  const m = db.businessMembers.find((x) => x.id === memberId)
  if (!m) throw new DomainError('Miembro no encontrado')
  if (m.status === 'INACTIVE') return
  m.status = 'INACTIVE'
  audit(db, actorId, 'MEMBER_DEACTIVATED', 'Business', m.businessId, at)
}

export const SETTING_RANGES: Record<SettingKey, [min: number, max: number, integer: boolean]> = {
  POINTS_BASE_RATE: [0, 100, false],
  STATUS_BASE_RATE: [0, 100, false],
  DISCOVERY_STATUS_BONUS: [0, 10_000, true],
  STREAK_STATUS_BONUS: [0, 10_000, true],
  REDEMPTION_EXPIRATION_MINUTES: [1, 1440, true],
  ABNORMAL_AMOUNT_THRESHOLD: [1, MAX_MONEY, false],
  WELCOME_STATUS_BONUS: [0, 5000, true],
  VISIT_CARD_SIZE: [4, 20, true],
  VISIT_CARD_GIFT_STAMPS: [0, 5, true],
  VISIT_CARD_MULTIPLIER: [1, 5, false],
  VISIT_CARD_VALID_DAYS: [1, 60, true],
  SPIN_COST: [0, 10_000, true],
  SPIN_EXTRA_MIN_PURCHASE: [0, 100_000, false],
  SPIN_EXTRA_DAILY_MAX: [0, 10, true],
  SPIN_MILESTONE_STATUS: [0, 100_000, true],
  BIRTHDAY_BONUS_POINTS: [1, 10_000, true],
  BIRTHDAY_REWARD_MAX_POINTS: [0, 100_000, true],
  POINTS_EXPIRATION_MONTHS: [1, 60, true],
  POINTS_EXPIRATION_NOTICE_DAYS: [1, 90, true],
  REACTIVATION_DAYS: [7, 365, true],
  AUTO_PROMO_MULTIPLIER: [1, 5, false],
  AUTO_PROMO_DAYS: [1, 60, true],
}

export function saveSetting(db: Database, key: string, value: string, actorId: number, at = new Date()) {
  requireAdmin(db, actorId)
  if (value.length > LIMITS.settingValue) throw new DomainError(`El valor admite hasta ${LIMITS.settingValue} caracteres`)
  if (key in SETTING_DEFAULTS) {
    const n = value.trim() === '' ? NaN : Number(value)
    const [min, max, integer] = SETTING_RANGES[key as SettingKey]
    check(rangeError(n, 'El valor', min, max, integer))
    if (key === 'VISIT_CARD_GIFT_STAMPS' && n >= getSetting(db, 'VISIT_CARD_SIZE') - 1) {
      throw new DomainError('Los sellos de cortesía deben ser menos que los casilleros de la tarjeta')
    }
    if (key === 'VISIT_CARD_SIZE' && getSetting(db, 'VISIT_CARD_GIFT_STAMPS') >= n - 1) {
      throw new DomainError('La tarjeta debe tener más casilleros que sellos de cortesía')
    }
    if (key === 'SPIN_COST') {
      const cheap = db.spinPrizes.find((p) => p.deletedAt === null && p.status === 'ACTIVE' && p.type === 'POINTS' && (p.points ?? 0) < n)
      if (cheap) throw new DomainError(`Hay un premio de ${cheap.points} puntos en la ruleta: ningún premio de puntos puede valer menos que el giro`)
    }
  }
  const row = db.systemSettings.find((s) => s.key === key)
  if (row?.value === value) return
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
  const user = newUser(db, input, 'CUSTOMER', at)
  addStatus(db, user.id, 'WELCOME', Math.floor(getSetting(db, 'WELCOME_STATUS_BONUS')), {}, at)
  return user
}

function validEmail(db: Database, value: string, ownId: number | null): string {
  check(emailError(value))
  const email = value.trim().toLowerCase()
  if (db.users.some((u) => u.id !== ownId && u.email.toLowerCase() === email)) throw new DomainError('Ese correo ya está registrado')
  return email
}

function personalData(input: { firstName: string; lastName: string; phone: string | null }) {
  check(personNameError(input.firstName, 'El nombre'))
  check(personNameError(input.lastName, 'El apellido'))
  check(phoneError(input.phone))
  return { firstName: singleLine(input.firstName), lastName: singleLine(input.lastName), phone: input.phone?.trim() || null }
}

/** Each user edits their own personal data; role, status and memberships stay with the admin. */
export function updateProfile(
  db: Database,
  userId: number,
  input: { firstName: string; lastName: string; email: string; phone: string | null },
  at = new Date(),
): User {
  const user = db.users.find((u) => u.id === userId && u.deletedAt === null)
  if (!user) throw new DomainError('Usuario no encontrado')
  const next = { ...personalData(input), email: validEmail(db, input.email, user.id) }
  if (next.firstName === user.firstName && next.lastName === user.lastName && next.email === user.email && next.phone === user.phone) return user
  Object.assign(user, { ...next, updatedAt: iso(at) })
  audit(db, userId, 'PROFILE_UPDATED', 'User', userId, at)
  return user
}

function newUser(
  db: Database,
  input: { email: string; firstName: string; lastName: string; phone: string | null },
  role: User['role'],
  at: Date,
): User {
  const email = validEmail(db, input.email, null)
  const user: User = {
    id: nextId(db, 'users'),
    email,
    ...personalData(input),
    birthDate: null,
    role,
    status: 'ACTIVE',
    createdAt: iso(at),
    updatedAt: iso(at),
    deletedAt: null,
  }
  db.users.push(user)
  return user
}

const secureRandom = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32

// ==================================================
// Spaces (fixed QR check-ins)
// ==================================================

export const SPACE_QR_PREFIX = 'PASEO-ESPACIO:'
const SPACE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function newSpaceCode(db: Database): string {
  for (;;) {
    const code = Array.from(crypto.getRandomValues(new Uint32Array(8)), (n) => SPACE_CODE_ALPHABET[n % SPACE_CODE_ALPHABET.length]).join('')
    if (!db.spaces.some((s) => s.code === code)) return code
  }
}

export function saveSpace(
  db: Database,
  id: number | null,
  data: Pick<Space, 'name' | 'description' | 'location' | 'pointsReward' | 'statusReward' | 'status'>,
  actorId: number,
  at = new Date(),
) {
  requireAdmin(db, actorId)
  const clean = {
    ...data,
    name: requiredName(data.name, 'El nombre', LIMITS.name),
    description: optionalText(data.description, 'La descripción', LIMITS.description),
    location: optionalText(data.location, 'La ubicación', LIMITS.location),
  }
  if (db.spaces.some((s) => s.id !== id && s.deletedAt === null && sameName(s.name, clean.name))) {
    throw new DomainError('Ya existe un espacio con ese nombre')
  }
  for (const value of [clean.pointsReward, clean.statusReward]) {
    if (!Number.isInteger(value) || value < 0 || value > 1000) throw new DomainError('Los puntos por visita van de 0 a 1.000')
  }
  if (clean.pointsReward === 0 && clean.statusReward === 0) throw new DomainError('La visita debe dar puntos o puntos de nivel')
  const space = upsert<Space>(db, 'spaces', id, clean, (newId) => ({
    ...clean,
    id: newId,
    code: newSpaceCode(db),
    createdById: actorId,
    createdAt: iso(at),
    deletedAt: null,
  }))
  audit(db, actorId, id ? 'SPACE_UPDATED' : 'SPACE_CREATED', 'Space', space.id, at)
  return space
}

/** Invalidates the printed QR (e.g. someone photographed it and shares it). */
export function regenerateSpaceCode(db: Database, spaceId: number, actorId: number, at = new Date()) {
  requireAdmin(db, actorId)
  const space = db.spaces.find((s) => s.id === spaceId && s.deletedAt === null)
  if (!space) throw new DomainError('Espacio no encontrado')
  space.code = newSpaceCode(db)
  audit(db, actorId, 'SPACE_CODE_REGENERATED', 'Space', space.id, at)
  return space
}

export function checkInSpace(db: Database, userId: number, rawCode: string, at = new Date()) {
  const customer = activeCustomer(db, userId)
  const code = rawCode.trim().toUpperCase().replace(SPACE_QR_PREFIX, '').trim()
  if (!/^[A-Z0-9]{4,20}$/.test(code)) throw new DomainError('Este código no corresponde a ningún espacio del Paseo')
  const space = db.spaces.find((s) => s.code === code && s.deletedAt === null)
  if (!space) throw new DomainError('Este código no corresponde a ningún espacio del Paseo')
  if (space.status !== 'ACTIVE') throw new DomainError(`${space.name} no está recibiendo visitas por ahora`)
  const day = todayKey(at)
  if (db.spaceCheckIns.some((c) => c.spaceId === space.id && c.userId === customer.id && c.day === day)) {
    throw new DomainError(`Ya registraste tu visita a ${space.name} hoy. Vuelve mañana`)
  }
  const cardBefore = visitCard(db, customer.id).completedCards
  const badgesBefore = earnedKeys(db, customer.id)
  const checkIn = { id: nextId(db, 'spaceCheckIns'), spaceId: space.id, userId: customer.id, day, createdAt: iso(at) }
  db.spaceCheckIns.push(checkIn)
  addPoints(db, customer.id, 'CHECK_IN', space.pointsReward, { checkInId: checkIn.id }, at)
  addStatus(db, customer.id, 'CHECK_IN', space.statusReward, { checkInId: checkIn.id }, at)

  const checkIns = db.spaceCheckIns.filter((c) => c.userId === customer.id).length
  const purchases = db.transactions.filter((t) => t.customerId === customer.id && t.status === 'COMPLETED').length
  const alreadyFlagged = db.fraudAlerts.some(
    (a) =>
      a.type === 'CHECK_IN_ONLY' &&
      a.status === 'OPEN' &&
      db.spaceCheckIns.find((c) => c.id === a.checkInId)?.userId === customer.id,
  )
  if (checkIns >= 5 && purchases === 0 && !alreadyFlagged) raiseAlert(db, 'CHECK_IN_ONLY', 55, { checkInId: checkIn.id }, at)

  syncVisitCard(db, customer.id, at)
  return {
    space: { id: space.id, name: space.name },
    pointsEarned: space.pointsReward,
    statusEarned: space.statusReward,
    visitCardCompleted: visitCard(db, customer.id).completedCards > cardBefore,
    newBadges: badgesEarnedSince(db, customer.id, badgesBefore),
  }
}

// ==================================================
// Ruleta
// ==================================================

export function savePrize(db: Database, id: number | null, data: Omit<SpinPrize, 'id' | 'createdById' | 'deletedAt'>, actorId: number, at = new Date()) {
  requireAdmin(db, actorId)
  const clean: Omit<SpinPrize, 'id' | 'createdById' | 'deletedAt'> = {
    ...data,
    points: null,
    multiplier: null,
    rewardId: null,
    validDays: 7,
  }
  switch (data.type) {
    case 'POINTS': {
      const min = Math.max(1, getSetting(db, 'SPIN_COST'))
      if (!Number.isInteger(data.points) || data.points! < min || data.points! > 100_000) {
        throw new DomainError(`Un premio de puntos debe valer al menos ${formatInt(min)} (lo que cuesta el giro)`)
      }
      clean.points = data.points
      break
    }
    case 'MULTIPLIER':
      if (!(data.multiplier !== null && data.multiplier > 1 && data.multiplier <= 10)) {
        throw new DomainError('El multiplicador debe ser mayor a 1 y hasta 10')
      }
      clean.multiplier = Math.round(data.multiplier * 100) / 100
      break
    case 'REWARD': {
      const reward = db.rewards.find((r) => r.id === data.rewardId && r.deletedAt === null && r.status === 'ACTIVE')
      if (!reward) throw new DomainError('Elige una recompensa activa de algún local')
      clean.rewardId = reward.id
      break
    }
    case 'EXTRA_SPIN':
      break
  }
  if (data.type === 'MULTIPLIER' || data.type === 'REWARD') {
    if (!Number.isInteger(data.validDays) || data.validDays < 1 || data.validDays > 60) {
      throw new DomainError('La vigencia del premio va de 1 a 60 días')
    }
    clean.validDays = data.validDays
  }
  if (!Number.isInteger(clean.weight) || clean.weight < 1 || clean.weight > 1000) throw new DomainError('El peso va de 1 a 1.000')
  if (clean.stock !== null) check(intError(clean.stock, 'La cantidad disponible', 0, MAX_STOCK))
  const prize = upsert<SpinPrize>(db, 'spinPrizes', id, clean, (newId) => ({ ...clean, id: newId, createdById: actorId, deletedAt: null }))
  audit(db, actorId, id ? 'SPIN_PRIZE_UPDATED' : 'SPIN_PRIZE_CREATED', 'SpinPrize', prize.id, at)
  return prize
}

/** Spins the ruleta. The draw happens here (server side), weighted by each prize's `weight`. */
export function spinWheel(db: Database, userId: number, source: SpinSource, at = new Date(), random = secureRandom) {
  const customer = activeCustomer(db, userId)
  const avail = spinAvailability(db, customer.id, at)
  let unlockTransactionId: number | null = null
  let cost = 0
  switch (source) {
    case 'DAILY':
      if (avail.dailyUsed) throw new DomainError('Ya usaste tu giro de hoy. Vuelve mañana')
      if (!avail.canAffordDaily) throw new DomainError(`Necesitas ${formatInt(avail.dailyCost)} puntos para girar`)
      cost = avail.dailyCost
      break
    case 'EXTRA':
      if (!avail.dailyUsed) throw new DomainError('Primero usa tu giro del día')
      if (avail.extraUsedToday >= avail.extraMax) throw new DomainError('Ya usaste todos los giros extra de hoy')
      if (!avail.extraUnlock) {
        throw new DomainError(`Haz una compra desde ${formatMoney(avail.extraMinPurchase)} para desbloquear otro giro`)
      }
      unlockTransactionId = avail.extraUnlock.id
      break
    case 'FREE':
      if (avail.freeAvailable <= 0) throw new DomainError('No tienes giros gratis disponibles')
      break
  }

  const prizes = eligiblePrizes(db, at)
  const total = prizes.reduce((s, p) => s + p.weight, 0)
  if (total <= 0) throw new DomainError('La ruleta no tiene premios disponibles en este momento')
  let ticket = random() * total
  const prize = prizes.find((p) => (ticket -= p.weight) < 0) ?? prizes[prizes.length - 1]

  const spin = {
    id: nextId(db, 'spins'),
    userId: customer.id,
    source,
    cost,
    prizeId: prize.id,
    prizeType: prize.type,
    points: prize.type === 'POINTS' ? (prize.points ?? 0) : 0,
    promotionId: null as number | null,
    redemptionId: null as number | null,
    unlockTransactionId,
    createdAt: iso(at),
  }
  db.spins.push(spin)
  addPoints(db, customer.id, 'SPIN', -cost, { spinId: spin.id }, at)

  switch (prize.type) {
    case 'POINTS':
      addPoints(db, customer.id, 'SPIN', spin.points, { spinId: spin.id }, at)
      break
    case 'MULTIPLIER': {
      const multiplier = prize.multiplier ?? 2
      spin.promotionId = createPersonalPromotion(
        db,
        { userId: customer.id, origin: 'PRIZE', name: `Premio de la ruleta: puntos ×${multiplier}`, multiplier, days: prize.validDays, singleUse: true },
        at,
      ).id
      break
    }
    case 'REWARD': {
      const reward = db.rewards.find((r) => r.id === prize.rewardId)!
      spin.redemptionId = issueRedemption(
        db,
        {
          userId: customer.id,
          rewardId: reward.id,
          pointsSpent: 0,
          origin: 'PRIZE',
          expiresAt: endOfLocalDay(addDaysKey(todayKey(at), prize.validDays - 1)),
        },
        at,
      ).id
      break
    }
    case 'EXTRA_SPIN':
      break
  }
  return { spinId: spin.id, prizeId: prize.id, title: prizeTitle(db, prize) }
}

// ==================================================
// Identity verification (birthday)
// ==================================================

function validBirthDate(value: string, at: Date): string {
  if (!isCalendarDate(value)) throw new DomainError('Fecha de nacimiento inválida')
  const today = todayKey(at)
  if (value > today) throw new DomainError('La fecha de nacimiento no puede ser futura')
  const range = birthDateRange(today)
  if (value > range.max) throw new DomainError(`Debes tener al menos ${MIN_AGE} años`)
  if (value < range.min) throw new DomainError('Fecha de nacimiento inválida: revisa el año')
  return value
}

/** The customer asks to verify their birthday. The ID photo is stored by the API next to this row. */
export function submitKyc(db: Database, userId: number, birthDate: string, at = new Date()) {
  const customer = activeCustomer(db, userId)
  if (customer.birthDate) throw new DomainError('Tu cumpleaños ya está verificado')
  if (db.kycRequests.some((r) => r.userId === customer.id && r.status === 'PENDING')) {
    throw new DomainError('Ya enviaste tu verificación. Te avisaremos cuando la revisemos')
  }
  const request = {
    id: nextId(db, 'kycRequests'),
    userId: customer.id,
    birthDate: validBirthDate(birthDate, at),
    status: 'PENDING' as const,
    reviewedById: null,
    reviewNote: null,
    createdAt: iso(at),
    reviewedAt: null,
  }
  db.kycRequests.push(request)
  audit(db, customer.id, 'KYC_SUBMITTED', 'KycRequest', request.id, at)
  return request
}

export function reviewKyc(
  db: Database,
  input: { requestId: number; decision: 'APPROVED' | 'REJECTED'; note: string },
  actorId: number,
  at = new Date(),
) {
  requireAdmin(db, actorId)
  const request = db.kycRequests.find((r) => r.id === input.requestId)
  if (!request) throw new DomainError('Solicitud no encontrada')
  if (request.status === input.decision) return request
  if (request.status !== 'PENDING') throw new DomainError('La solicitud ya fue revisada con otra decisión')
  const user = db.users.find((u) => u.id === request.userId)
  if (!user) throw new DomainError('Cliente no encontrado')
  const note = input.note.trim()
  if (note.length > LIMITS.note) throw new DomainError(`La explicación no puede superar los ${LIMITS.note} caracteres`)
  if (input.decision === 'REJECTED' && note.length < 5) throw new DomainError('Explica al cliente por qué no se aprobó')

  request.status = input.decision
  request.reviewedById = actorId
  request.reviewNote = note ? sentence(note) : null
  request.reviewedAt = iso(at)
  if (input.decision === 'APPROVED') {
    user.birthDate = request.birthDate
    user.updatedAt = iso(at)
    notifyUser(
      db,
      user.id,
      'Cumpleaños verificado',
      `El ${formatLongDayKey(request.birthDate)} te esperan regalos.`,
      at,
    )
    grantBirthdayBonus(db, user, at)
  } else {
    notifyUser(db, user.id, 'No pudimos verificar tu cumpleaños', `${request.reviewNote} Reintenta desde Mi perfil.`, at)
  }
  audit(db, actorId, `KYC_${input.decision}`, 'KycRequest', request.id, at)
  return request
}

// ==================================================
// Birthday
// ==================================================

/** Credits the yearly birthday bonus (and with it, a free spin) on the customer's birthday. */
export function grantBirthdayBonus(db: Database, user: User, at = new Date()): boolean {
  if (user.role !== 'CUSTOMER' || user.status !== 'ACTIVE' || !isBirthdayToday(user, at)) return false
  const year = String(localYear(at))
  const already = db.pointMovements.some((m) => m.userId === user.id && m.type === 'BIRTHDAY' && localDateKey(m.createdAt).startsWith(`${year}-`))
  if (already) return false
  const bonus = Math.max(1, Math.floor(getSetting(db, 'BIRTHDAY_BONUS_POINTS')))
  addPoints(db, user.id, 'BIRTHDAY', bonus, {}, at)
  const gifts = db.birthdayPerks.filter((p) => p.isActive).length
  notifyUser(
    db,
    user.id,
    `¡Feliz cumpleaños, ${user.firstName}!`,
    `Te regalamos ${formatInt(bonus)} puntos, un giro y una recompensa a elección.${
      gifts ? ` Y ${gifts} ${gifts === 1 ? 'local tiene' : 'locales tienen'} un regalo con tu compra de hoy.` : ''
    }`,
    at,
  )
  return true
}

/** Free reward of the customer's choice, once a year, valid until the end of the birthday. */
export function claimBirthdayReward(db: Database, userId: number, rewardId: number, at = new Date()) {
  const customer = activeCustomer(db, userId)
  if (!customer.birthDate) throw new DomainError('Verifica tu cumpleaños en Mi perfil para recibir tus regalos')
  if (!isBirthdayToday(customer, at)) throw new DomainError('Tu recompensa de cumpleaños se elige el día de tu cumpleaños')
  if (birthdayRewardClaimed(db, customer.id, localYear(at))) throw new DomainError('Ya elegiste tu recompensa de cumpleaños este año')
  const reward = birthdayRewardOptions(db, at).find((r) => r.id === rewardId)
  if (!reward) throw new DomainError('Esa recompensa no está disponible como regalo de cumpleaños')
  return issueRedemption(
    db,
    { userId: customer.id, rewardId: reward.id, pointsSpent: 0, origin: 'BIRTHDAY', expiresAt: endOfLocalDay(todayKey(at)) },
    at,
  )
}

export function saveBirthdayPerk(
  db: Database,
  businessId: number,
  data: Pick<BirthdayPerk, 'type' | 'discountPercent' | 'discountAmount' | 'catalogItemId' | 'quantity' | 'description' | 'isActive'>,
  actorId: number,
  at = new Date(),
) {
  if (activeMembership(db, actorId, businessId)?.role !== 'MANAGER') {
    throw new DomainError('Solo el encargado del establecimiento puede configurar el regalo de cumpleaños')
  }
  liveBusiness(db, businessId)
  const clean: Omit<BirthdayPerk, 'businessId' | 'updatedAt'> = {
    type: data.type,
    discountPercent: null,
    discountAmount: null,
    catalogItemId: null,
    quantity: 1,
    description: data.description?.trim() || null,
    isActive: data.isActive,
  }
  check(textError(clean.description, 'Las condiciones', LIMITS.note))
  const type: RewardType = data.type
  switch (type) {
    case 'PERCENT_DISCOUNT':
      if (!Number.isInteger(data.discountPercent) || data.discountPercent! < 1 || data.discountPercent! > 100) {
        throw new DomainError('El porcentaje de descuento debe estar entre 1 y 100')
      }
      clean.discountPercent = data.discountPercent
      break
    case 'AMOUNT_DISCOUNT':
      if (data.discountAmount === null) throw new DomainError('Indica el descuento en Bs')
      check(moneyError(data.discountAmount, 'El descuento en Bs', { minExclusive: true }))
      clean.discountAmount = Math.round(data.discountAmount * 100) / 100
      break
    case 'FREE_PRODUCT': {
      const item = db.catalogItems.find((i) => i.id === data.catalogItemId && i.businessId === businessId && i.deletedAt === null)
      if (!item) throw new DomainError('Elige un producto del catálogo de tu establecimiento')
      if (!Number.isInteger(data.quantity) || data.quantity < 1 || data.quantity > 5) throw new DomainError('La cantidad debe estar entre 1 y 5')
      clean.catalogItemId = item.id
      clean.quantity = data.quantity
      break
    }
  }
  const existing = db.birthdayPerks.find((p) => p.businessId === businessId)
  if (existing) Object.assign(existing, clean, { updatedAt: iso(at) })
  else db.birthdayPerks.push({ ...clean, businessId, updatedAt: iso(at) })
  audit(db, actorId, 'BIRTHDAY_PERK_SAVED', 'Business', businessId, at)
}

/** Staff hands the business birthday gift: verified birthday today, once a year, with a purchase here today. */
export function claimBirthdayPerk(db: Database, input: { customerId: number; businessId: number; staffId: number }, at = new Date()) {
  if (!activeMembership(db, input.staffId, input.businessId)) throw new DomainError('No perteneces a este establecimiento')
  const perk = db.birthdayPerks.find((p) => p.businessId === input.businessId && p.isActive)
  if (!perk) throw new DomainError('Tu local no tiene un regalo de cumpleaños activo. El encargado lo configura aquí mismo')
  const customer = activeCustomer(db, input.customerId, false)
  if (!customer.birthDate) throw new DomainError(`${customer.firstName} no tiene su cumpleaños verificado. Lo hace desde Mi perfil en la app`)
  if (!isBirthdayToday(customer, at)) {
    throw new DomainError(`Hoy no es el cumpleaños de ${customer.firstName} (es el ${formatLongDayKey(customer.birthDate)})`)
  }
  const year = localYear(at)
  if (db.birthdayClaims.some((c) => c.userId === customer.id && c.businessId === input.businessId && c.year === year)) {
    throw new DomainError(`${customer.firstName} ya recibió su regalo de cumpleaños aquí este año`)
  }
  const today = todayKey(at)
  const purchase = db.transactions
    .filter((t) => t.customerId === customer.id && t.businessId === input.businessId && t.status === 'COMPLETED' && localDateKey(t.createdAt) === today)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  if (!purchase) throw new DomainError(`Registra primero la compra de hoy de ${customer.firstName} en Registrar compra`)
  const claim = {
    id: nextId(db, 'birthdayClaims'),
    userId: customer.id,
    businessId: input.businessId,
    year,
    transactionId: purchase.id,
    validatedById: input.staffId,
    perkTitle: rewardTitle(db, perk).slice(0, 255),
    createdAt: iso(at),
  }
  db.birthdayClaims.push(claim)
  audit(db, input.staffId, 'BIRTHDAY_PERK_CLAIMED', 'BirthdayClaim', claim.id, at)
  return { claimId: claim.id, title: claim.perkTitle, customerName: customer.firstName }
}

// ==================================================
// Daily process (expiration, reactivation, anniversaries, birthdays)
// ==================================================

const favoriteCategory = (db: Database, userId: number, at: Date) => consumptionProfile(db, userId, at, 180).categories[0]?.category

/** Idempotent: safe to run every few minutes, each step checks what was already done. */
export function runDailyJobs(db: Database, at = new Date()) {
  const summary = { birthdays: 0, expired: 0, expiryNotices: 0, reactivations: 0, anniversaries: 0 }
  const multiplier = getSetting(db, 'AUTO_PROMO_MULTIPLIER')
  const promoDays = Math.floor(getSetting(db, 'AUTO_PROMO_DAYS'))
  const reactivationDays = getSetting(db, 'REACTIVATION_DAYS')

  for (const user of db.users.filter((u) => u.role === 'CUSTOMER' && u.status === 'ACTIVE' && u.deletedAt === null)) {
    if (grantBirthdayBonus(db, user, at)) summary.birthdays += 1

    const expiry = pointsExpiry(db, user, at)
    if (expiry.balance > 0 && new Date(expiry.expiresAt) < at) {
      addPoints(db, user.id, 'EXPIRATION', -expiry.balance, {}, at)
      notifyUser(
        db,
        user.id,
        'Tus puntos vencieron',
        `Vencieron ${formatInt(expiry.balance)} puntos por inactividad. Tu nivel se mantiene.`,
        at,
      )
      summary.expired += 1
    } else if (expiry.balance > 0 && expiry.soon) {
      const since = db.pointMovements
        .filter((m) => m.userId === user.id && m.type !== 'EXPIRATION')
        .reduce((max, m) => (m.createdAt > max ? m.createdAt : max), user.createdAt)
      const noticed = db.notifications.some((n) => n.userId === user.id && n.title === 'Tus puntos vencen pronto' && n.createdAt >= since)
      if (!noticed) {
        notifyUser(
          db,
          user.id,
          'Tus puntos vencen pronto',
          `Tus ${formatInt(expiry.balance)} puntos vencen el ${formatLongDayKey(expiry.expiresOn)}. Una compra los renueva.`,
          at,
        )
        summary.expiryNotices += 1
      }
    }

    if (multiplier <= 1) continue
    const profile = consumptionProfile(db, user.id, at, 180)
    const lastVisit = profile.lastPurchaseAt ?? user.createdAt
    const idleDays = (at.getTime() - new Date(lastVisit).getTime()) / 86_400_000
    const reactivated = db.promotions.some((p) => p.userId === user.id && p.origin === 'REACTIVATION' && p.startsAt > lastVisit)
    if (idleDays >= reactivationDays && !reactivated) {
      const category = favoriteCategory(db, user.id, at)
      const promo = createPersonalPromotion(
        db,
        {
          userId: user.id,
          origin: 'REACTIVATION',
          name: category ? `Te extrañamos: ${category.name} ×${multiplier}` : `Tu primera compra ×${multiplier}`,
          multiplier,
          days: promoDays,
          singleUse: true,
          categoryIds: category ? [category.id] : [],
        },
        at,
      )
      notifyUser(
        db,
        user.id,
        profile.lastPurchaseAt ? `Te extrañamos, ${user.firstName}` : `Tu primera compra suma doble, ${user.firstName}`,
        `Tu próxima compra${category ? ` en ${category.name}` : ''} suma puntos ×${multiplier}, hasta el ${formatLongDayKey(localDateKey(promo.endsAt))}.`,
        at,
      )
      summary.reactivations += 1
    }

    const anniversary = currentAnniversary(user, at)
    if (anniversary && hasActiveMembership(db, user.id, at)) {
      const from = startOfLocalDay(anniversary.startDay)
      const done = db.promotions.some((p) => p.userId === user.id && p.origin === 'ANNIVERSARY' && p.startsAt >= from)
      if (!done) {
        const category = favoriteCategory(db, user.id, at)
        const label = anniversaryLabel(anniversary.months)
        const days = Math.round((Date.parse(endOfLocalDay(anniversary.endDay)) - Date.parse(startOfLocalDay(todayKey(at)))) / 86_400_000)
        const promo = createPersonalPromotion(
          db,
          {
            userId: user.id,
            origin: 'ANNIVERSARY',
            name: `Aniversario ${label}: ${category ? category.name : 'todo el Paseo'} ×${multiplier}`,
            multiplier,
            days,
            singleUse: false,
            categoryIds: category ? [category.id] : [],
          },
          at,
        )
        notifyUser(
          db,
          user.id,
          `¡Cumples ${label} en Paseo Club!`,
          `Tus compras${category ? ` en ${category.name}` : ''} suman puntos ×${multiplier} hasta el ${formatLongDayKey(localDateKey(promo.endsAt))}.`,
          at,
        )
        summary.anniversaries += 1
      }
    }
  }
  return summary
}
