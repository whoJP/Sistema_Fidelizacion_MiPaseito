// Command registry shared with the backend. The server runs these against the MySQL snapshot with the
// authenticated user as `actor`; the frontend only imports the types and calls them through `run()`.
import * as A from './actions'
import { SETTING_DEFAULTS } from '../domain/loyalty'
import type { BadgeType, BusinessMemberRole, Database, DayOfWeek, FraudAlertStatus, UserStatus } from '../types/domain'

export interface Actor {
  id: number
}

const { DomainError } = A

const id = (value: unknown, label = 'Identificador'): number => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) throw new DomainError(`${label} inválido`)
  return value
}
const optionalId = (value: unknown) => (value === null || value === undefined ? null : id(value))
const num = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new DomainError(`${label} inválido`)
  return value
}
const int = (value: unknown, label: string) => Math.trunc(num(value, label))
const str = (value: unknown) => (typeof value === 'string' ? value : '')
const optionalStr = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null)
const optionalDate = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new DomainError('Fecha inválida')
  return new Date(value).toISOString()
}
const date = (value: unknown) => {
  const parsed = optionalDate(value)
  if (!parsed) throw new DomainError('Fecha obligatoria')
  return parsed
}
const oneOf = <T extends string>(value: unknown, allowed: readonly T[], label: string): T => {
  if (!allowed.includes(value as T)) throw new DomainError(`${label} inválido`)
  return value as T
}
const ids = (value: unknown) => (Array.isArray(value) ? value.map((v) => id(v)) : [])
const scope = (value: unknown) => {
  const s = (value ?? {}) as { businessIds?: unknown; categoryIds?: unknown }
  return { businessIds: ids(s.businessIds), categoryIds: ids(s.categoryIds) }
}
const time = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new DomainError('Hora inválida')
  return value
}

const optionalNum = (value: unknown, label: string) => (value === null || value === undefined || value === '' ? null : num(value, label))
const optionalInt = (value: unknown, label: string) => {
  const n = optionalNum(value, label)
  return n === null ? null : Math.trunc(n)
}
const dateKey = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new DomainError('Fecha inválida')
  return value
}

const DAYS: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']
const SOFT_DELETABLE: A.SoftDeletable[] = ['businesses', 'categories', 'rewards', 'missions', 'promotions', 'catalogItems', 'users', 'events', 'badges']
const BADGE_TYPES: BadgeType[] = ['TIER_REACHED', 'PURCHASE_COUNT', 'CATEGORY_PURCHASES', 'DISTINCT_BUSINESSES', 'MISSIONS_COMPLETED', 'SPECIAL_DATE']

type BusinessData = Parameters<typeof A.saveBusiness>[2]
type ScheduleData = Parameters<typeof A.saveBusiness>[4][number]
type CategoryData = Parameters<typeof A.saveCategory>[2]
type TierData = Parameters<typeof A.saveTier>[2]
type RewardData = Parameters<typeof A.saveReward>[2]
type MissionData = Parameters<typeof A.saveMission>[2]
type PromotionData = Parameters<typeof A.savePromotion>[2]
type CatalogItemData = Parameters<typeof A.saveCatalogItem>[2]
type EventData = Parameters<typeof A.saveEvent>[2]
type BadgeData = Parameters<typeof A.saveBadge>[2]
type Scope = { businessIds: number[]; categoryIds: number[] }

export const commands = {
  // ---------- Merchant ----------
  registerPurchase: (db: Database, actor: Actor, input: { customerId: number; businessId: number; amount: number }) =>
    A.registerPurchase(db, {
      customerId: id(input.customerId, 'Cliente'),
      businessId: id(input.businessId, 'Establecimiento'),
      amount: num(input.amount, 'Monto'),
      performedById: actor.id,
    }),

  cancelTransaction: (db: Database, actor: Actor, input: { transactionId: number }) => {
    A.cancelTransaction(db, id(input.transactionId), actor.id)
    return true
  },

  validateRedemption: (db: Database, actor: Actor, input: { token: string; businessId: number }) =>
    A.validateRedemption(db, { token: str(input.token), businessId: id(input.businessId, 'Establecimiento'), staffId: actor.id }),

  saveCatalogItem: (db: Database, actor: Actor, input: { id: number | null; data: CatalogItemData }) =>
    A.saveCatalogItem(
      db,
      optionalId(input.id),
      {
        businessId: id(input.data.businessId, 'Establecimiento'),
        name: str(input.data.name),
        description: optionalStr(input.data.description),
        price: input.data.price === null ? null : num(input.data.price, 'Precio'),
        isAvailable: input.data.isAvailable !== false,
      },
      actor.id,
    ),

  saveReward: (db: Database, actor: Actor, input: { id: number | null; data: RewardData }) =>
    A.saveReward(
      db,
      optionalId(input.id),
      {
        businessId: id(input.data.businessId, 'Establecimiento'),
        type: oneOf(input.data.type, ['PERCENT_DISCOUNT', 'AMOUNT_DISCOUNT', 'FREE_PRODUCT'] as const, 'Tipo de recompensa'),
        discountPercent: optionalInt(input.data.discountPercent, 'Porcentaje'),
        discountAmount: optionalNum(input.data.discountAmount, 'Descuento'),
        catalogItemId: optionalId(input.data.catalogItemId),
        quantity: optionalInt(input.data.quantity, 'Cantidad') ?? 1,
        minimumPurchase: optionalNum(input.data.minimumPurchase, 'Compra mínima'),
        description: optionalStr(input.data.description),
        pointsCost: int(input.data.pointsCost, 'Costo'),
        minimumTierId: optionalId(input.data.minimumTierId),
        stock: optionalInt(input.data.stock, 'Cantidad disponible'),
        startsAt: optionalDate(input.data.startsAt),
        endsAt: optionalDate(input.data.endsAt),
        status: oneOf(input.data.status, ['DRAFT', 'ACTIVE', 'INACTIVE'] as const, 'Estado'),
      },
      actor.id,
    ),

  // ---------- Customer ----------
  createRedemption: (db: Database, actor: Actor, input: { rewardId: number }) =>
    A.createRedemption(db, actor.id, id(input.rewardId, 'Recompensa')),

  cancelRedemption: (db: Database, actor: Actor, input: { redemptionId: number }) => {
    A.cancelRedemption(db, id(input.redemptionId), actor.id)
    return true
  },

  // ---------- Admin ----------
  reviewFraudAlert: (db: Database, actor: Actor, input: { alertId: number; decision: Exclude<FraudAlertStatus, 'OPEN'> }) => {
    A.reviewFraudAlert(db, id(input.alertId), oneOf(input.decision, ['RESOLVED', 'DISMISSED'] as const, 'Decisión'), actor.id)
    return true
  },

  adjustBalance: (db: Database, actor: Actor, input: { userId: number; ledger: 'POINTS' | 'STATUS'; amount: number }) => {
    A.adjustBalance(
      db,
      { userId: id(input.userId), ledger: oneOf(input.ledger, ['POINTS', 'STATUS'] as const, 'Tipo de puntos'), amount: num(input.amount, 'Cantidad') },
      actor.id,
    )
    return true
  },

  setUserStatus: (db: Database, actor: Actor, input: { userId: number; status: UserStatus }) => {
    A.setUserStatus(db, id(input.userId), oneOf(input.status, ['ACTIVE', 'SUSPENDED'] as const, 'Estado'), actor.id)
    return true
  },

  softDelete: (db: Database, actor: Actor, input: { table: A.SoftDeletable; id: number }) => {
    A.softDelete(db, oneOf(input.table, SOFT_DELETABLE, 'Tabla'), id(input.id), actor.id)
    return true
  },

  saveBusiness: (
    db: Database,
    actor: Actor,
    input: { id: number | null; data: BusinessData; categoryIds: number[]; schedules: ScheduleData[] },
  ) =>
    A.saveBusiness(
      db,
      optionalId(input.id),
      {
        name: str(input.data.name),
        description: str(input.data.description),
        logoUrl: optionalStr(input.data.logoUrl),
        phone: optionalStr(input.data.phone),
        floor: optionalStr(input.data.floor),
        sector: optionalStr(input.data.sector),
        localNumber: optionalStr(input.data.localNumber),
        status: oneOf(input.data.status, ['ACTIVE', 'INACTIVE'] as const, 'Estado'),
      },
      ids(input.categoryIds),
      (Array.isArray(input.schedules) ? input.schedules : []).map((s) => ({
        dayOfWeek: oneOf(s.dayOfWeek, DAYS, 'Día'),
        isClosed: s.isClosed === true,
        openTime: s.isClosed ? null : time(s.openTime),
        closeTime: s.isClosed ? null : time(s.closeTime),
      })),
      actor.id,
    ),

  saveCategory: (db: Database, actor: Actor, input: { id: number | null; data: CategoryData }) =>
    A.saveCategory(
      db,
      optionalId(input.id),
      {
        name: str(input.data.name),
        parentId: optionalId(input.data.parentId),
        status: oneOf(input.data.status, ['ACTIVE', 'INACTIVE'] as const, 'Estado'),
      },
      actor.id,
    ),

  saveTier: (db: Database, actor: Actor, input: { id: number | null; data: TierData }) =>
    A.saveTier(
      db,
      optionalId(input.id),
      {
        name: str(input.data.name),
        minimumStatus: Math.max(0, int(input.data.minimumStatus, 'Puntos de nivel mínimos')),
        pointsMultiplier: Math.round(num(input.data.pointsMultiplier, 'Multiplicador') * 100) / 100,
        sortOrder: int(input.data.sortOrder, 'Orden'),
        isActive: input.data.isActive !== false,
      },
      actor.id,
    ),

  saveEvent: (db: Database, actor: Actor, input: { id: number | null; data: EventData }) =>
    A.saveEvent(
      db,
      optionalId(input.id),
      {
        name: str(input.data.name),
        description: optionalStr(input.data.description),
        location: optionalStr(input.data.location),
        startsAt: date(input.data.startsAt),
        endsAt: date(input.data.endsAt),
        pointsReward: Math.max(0, int(input.data.pointsReward, 'Puntos')),
        status: oneOf(input.data.status, ['DRAFT', 'ACTIVE', 'INACTIVE'] as const, 'Estado'),
      },
      actor.id,
    ),

  checkInEvent: (db: Database, actor: Actor, input: { eventId: number; customerId: number }) =>
    A.checkInEvent(db, { eventId: id(input.eventId, 'Evento'), customerId: id(input.customerId, 'Cliente') }, actor.id),

  saveBadge: (db: Database, actor: Actor, input: { id: number | null; data: BadgeData }) =>
    A.saveBadge(
      db,
      optionalId(input.id),
      {
        name: str(input.data.name),
        description: optionalStr(input.data.description),
        type: oneOf(input.data.type, BADGE_TYPES, 'Tipo de insignia'),
        goal: optionalInt(input.data.goal, 'Cantidad'),
        tierId: optionalId(input.data.tierId),
        categoryId: optionalId(input.data.categoryId),
        date: dateKey(input.data.date),
        status: oneOf(input.data.status, ['ACTIVE', 'INACTIVE'] as const, 'Estado'),
      },
      actor.id,
    ),

  saveMission: (db: Database, actor: Actor, input: { id: number | null; data: MissionData; scope: Scope }) =>
    A.saveMission(
      db,
      optionalId(input.id),
      {
        name: str(input.data.name),
        description: optionalStr(input.data.description),
        type: oneOf(
          input.data.type,
          ['BUY_DISTINCT_BUSINESSES', 'BUY_CATEGORY', 'BUY_DISTINCT_CATEGORIES', 'TOTAL_PURCHASE_AMOUNT', 'TRANSACTION_COUNT', 'WEEKLY_PURCHASE', 'DISCOVER_BUSINESS'] as const,
          'Tipo',
        ),
        goal: int(input.data.goal, 'Objetivo'),
        rewardPoints: Math.max(0, int(input.data.rewardPoints, 'Puntos de premio')),
        rewardStatus: Math.max(0, int(input.data.rewardStatus, 'Puntos de nivel de premio')),
        startsAt: date(input.data.startsAt),
        endsAt: date(input.data.endsAt),
        status: oneOf(input.data.status, ['DRAFT', 'ACTIVE', 'INACTIVE'] as const, 'Estado'),
      },
      scope(input.scope),
      actor.id,
    ),

  savePromotion: (db: Database, actor: Actor, input: { id: number | null; data: PromotionData; scope: Scope }) =>
    A.savePromotion(
      db,
      optionalId(input.id),
      {
        name: str(input.data.name),
        type: oneOf(input.data.type, ['POINTS_MULTIPLIER', 'FIXED_POINTS'] as const, 'Tipo'),
        value: Math.round(num(input.data.value, 'Valor') * 100) / 100,
        startsAt: date(input.data.startsAt),
        endsAt: date(input.data.endsAt),
        status: oneOf(input.data.status, ['DRAFT', 'ACTIVE', 'INACTIVE'] as const, 'Estado'),
      },
      scope(input.scope),
      actor.id,
    ),

  saveMembership: (db: Database, actor: Actor, input: { email: string; businessId: number; role: BusinessMemberRole }) => {
    A.saveMembership(
      db,
      { email: str(input.email), businessId: id(input.businessId), role: oneOf(input.role, ['STAFF', 'MANAGER'] as const, 'Rol') },
      actor.id,
    )
    return true
  },

  deactivateMembership: (db: Database, actor: Actor, input: { memberId: number }) => {
    A.deactivateMembership(db, id(input.memberId), actor.id)
    return true
  },

  saveSetting: (db: Database, actor: Actor, input: { key: keyof typeof SETTING_DEFAULTS; value: string }) => {
    const key = oneOf(input.key, Object.keys(SETTING_DEFAULTS) as (keyof typeof SETTING_DEFAULTS)[], 'Parámetro')
    const value = str(input.value).trim()
    if (!value || !Number.isFinite(Number(value)) || Number(value) < 0) throw new DomainError('Valor numérico inválido')
    A.saveSetting(db, key, value, actor.id)
    return true
  },
}

export type Commands = typeof commands
export type CommandName = keyof Commands
export type CommandInput<K extends CommandName> = Parameters<Commands[K]>[2]
export type CommandResult<K extends CommandName> = ReturnType<Commands[K]>

export function isCommandName(name: string): name is CommandName {
  return Object.hasOwn(commands, name)
}
