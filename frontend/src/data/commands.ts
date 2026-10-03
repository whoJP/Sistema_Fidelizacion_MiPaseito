// Command registry shared with the backend. The server runs these against the MySQL snapshot with the
// authenticated user as `actor`; the frontend only imports the types and calls them through `run()`.
import * as A from './actions'
import { SETTING_DEFAULTS } from '../domain/loyalty'
import { MAX_SCOPE_ITEMS, isCalendarDate } from '../domain/validation'
import type {
  BadgeType,
  BusinessMemberRole,
  CancellationRequestStatus,
  Database,
  DayOfWeek,
  FraudAlertStatus,
  KycStatus,
  RewardType,
  SpinSource,
  UserStatus,
} from '../types/domain'

export interface Actor {
  id: number
}

const { DomainError } = A

/** Largest value of a MySQL INT primary key. */
const MAX_ID = 2_147_483_647
/** Hard cap for any text field; each field has its own, smaller limit in the domain rules. */
const MAX_TEXT = 5_000
const MAX_NUMBER = 1e12

const id = (value: unknown, label = 'Identificador'): number => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0 || value > MAX_ID) throw new DomainError(`${label} inválido`)
  return value
}
const optionalId = (value: unknown, label?: string) => (value === null || value === undefined ? null : id(value, label))
const num = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new DomainError(`${label} inválido`)
  if (Math.abs(value) > MAX_NUMBER) throw new DomainError(`${label} fuera de rango`)
  return value
}
const int = (value: unknown, label: string) => {
  const n = num(value, label)
  if (!Number.isInteger(n)) throw new DomainError(`${label} debe ser un número entero`)
  return n
}
const str = (value: unknown, label = 'Texto') => {
  if (value === null || value === undefined) return ''
  if (typeof value !== 'string') throw new DomainError(`${label} inválido`)
  if (value.length > MAX_TEXT) throw new DomainError(`${label} demasiado largo`)
  return value
}
const optionalStr = (value: unknown, label?: string) => str(value, label).trim() || null
/** Nested `data` object of save commands. */
const data = <T extends object>(input: { data: T }): T => {
  const value: unknown = input?.data
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DomainError('Datos inválidos')
  return value as T
}
const list = (value: unknown, label: string): unknown[] => {
  if (value === null || value === undefined) return []
  if (!Array.isArray(value)) throw new DomainError(`${label} inválida`)
  return value
}
const optionalDate = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string' || value.length > 40 || Number.isNaN(Date.parse(value))) throw new DomainError('Fecha inválida')
  const parsed = new Date(value)
  const year = parsed.getUTCFullYear()
  if (year < 2000 || year > 2100) throw new DomainError('Fecha fuera de rango')
  return parsed.toISOString()
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
const ids = (value: unknown, label = 'Lista') => {
  const values = list(value, label)
  if (values.length > MAX_SCOPE_ITEMS) throw new DomainError(`${label} demasiado larga`)
  return [...new Set(values.map((v) => id(v)))]
}
const scope = (value: unknown) => {
  const s = (value ?? {}) as { businessIds?: unknown; categoryIds?: unknown }
  return { businessIds: ids(s.businessIds, 'Lista de establecimientos'), categoryIds: ids(s.categoryIds, 'Lista de categorías') }
}
const time = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new DomainError('Hora inválida')
  return value
}

const optionalNum = (value: unknown, label: string) => (value === null || value === undefined || value === '' ? null : num(value, label))
const optionalInt = (value: unknown, label: string) => (value === null || value === undefined || value === '' ? null : int(value, label))
const dateKey = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string' || !isCalendarDate(value)) throw new DomainError('Fecha inválida')
  return value
}

const DAYS: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']
const SOFT_DELETABLE: A.SoftDeletable[] = [
  'businesses',
  'categories',
  'rewards',
  'missions',
  'promotions',
  'catalogItems',
  'users',
  'events',
  'badges',
  'spaces',
  'spinPrizes',
]
const REWARD_TYPES: RewardType[] = ['PERCENT_DISCOUNT', 'AMOUNT_DISCOUNT', 'FREE_PRODUCT']
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
type SpaceData = Parameters<typeof A.saveSpace>[2]
type PrizeData = Parameters<typeof A.savePrize>[2]
type BirthdayPerkData = Parameters<typeof A.saveBirthdayPerk>[2]
type Scope = { businessIds: number[]; categoryIds: number[] }

export const commands = {
  // ---------- Merchant ----------
  registerPurchase: (db: Database, actor: Actor, input: { customerId: number; businessId: number; items: A.PurchaseLine[] }) =>
    A.registerPurchase(db, {
      customerId: id(input.customerId, 'Cliente'),
      businessId: id(input.businessId, 'Establecimiento'),
      items: list(input.items, 'Lista de productos').map((value) => {
        const line = value as Partial<A.PurchaseLine> | null
        return { catalogItemId: id(line?.catalogItemId, 'Producto'), quantity: int(line?.quantity, 'Cantidad') }
      }),
      performedById: actor.id,
    }),

  undoPurchase: (db: Database, actor: Actor, input: { transactionId: number }) => {
    A.undoPurchase(db, id(input.transactionId, 'Compra'), actor.id)
    return true
  },

  requestCancellation: (db: Database, actor: Actor, input: { transactionId: number; reason: string }) => {
    A.requestCancellation(db, { transactionId: id(input.transactionId, 'Compra'), reason: str(input.reason) }, actor.id)
    return true
  },

  validateRedemption: (db: Database, actor: Actor, input: { token: string; businessId: number }) =>
    A.validateRedemption(db, { token: str(input.token, 'Código de canje'), businessId: id(input.businessId, 'Establecimiento'), staffId: actor.id }),

  claimBirthdayPerk: (db: Database, actor: Actor, input: { customerId: number; businessId: number }) =>
    A.claimBirthdayPerk(db, { customerId: id(input.customerId, 'Cliente'), businessId: id(input.businessId, 'Establecimiento'), staffId: actor.id }),

  saveBirthdayPerk: (db: Database, actor: Actor, input: { businessId: number; data: BirthdayPerkData }) => {
    A.saveBirthdayPerk(
      db,
      id(input.businessId, 'Establecimiento'),
      {
        type: oneOf(data(input).type, REWARD_TYPES, 'Tipo de regalo'),
        discountPercent: optionalInt(data(input).discountPercent, 'Porcentaje'),
        discountAmount: optionalNum(data(input).discountAmount, 'Descuento'),
        catalogItemId: optionalId(data(input).catalogItemId),
        quantity: optionalInt(data(input).quantity, 'Cantidad') ?? 1,
        description: optionalStr(data(input).description),
        isActive: data(input).isActive !== false,
      },
      actor.id,
    )
    return true
  },

  saveCatalogItem: (db: Database, actor: Actor, input: { id: number | null; data: CatalogItemData }) =>
    A.saveCatalogItem(
      db,
      optionalId(input.id),
      {
        businessId: id(data(input).businessId, 'Establecimiento'),
        name: str(data(input).name),
        description: optionalStr(data(input).description),
        price: num(data(input).price, 'Precio'),
        isAvailable: data(input).isAvailable !== false,
      },
      actor.id,
    ),

  saveReward: (db: Database, actor: Actor, input: { id: number | null; data: RewardData }) =>
    A.saveReward(
      db,
      optionalId(input.id),
      {
        businessId: id(data(input).businessId, 'Establecimiento'),
        type: oneOf(data(input).type, REWARD_TYPES, 'Tipo de recompensa'),
        discountPercent: optionalInt(data(input).discountPercent, 'Porcentaje'),
        discountAmount: optionalNum(data(input).discountAmount, 'Descuento'),
        catalogItemId: optionalId(data(input).catalogItemId),
        quantity: optionalInt(data(input).quantity, 'Cantidad') ?? 1,
        minimumPurchase: optionalNum(data(input).minimumPurchase, 'Compra mínima'),
        description: optionalStr(data(input).description),
        pointsCost: int(data(input).pointsCost, 'Costo'),
        minimumTierId: optionalId(data(input).minimumTierId),
        stock: optionalInt(data(input).stock, 'Cantidad disponible'),
        startsAt: optionalDate(data(input).startsAt),
        endsAt: optionalDate(data(input).endsAt),
        status: oneOf(data(input).status, ['DRAFT', 'ACTIVE', 'INACTIVE'] as const, 'Estado'),
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

  dismissNotification: (db: Database, actor: Actor, input: { notificationId: number }) => {
    A.dismissNotification(db, id(input.notificationId, 'Aviso'), actor.id)
    return true
  },

  checkInSpace: (db: Database, actor: Actor, input: { code: string }) => A.checkInSpace(db, actor.id, str(input.code)),

  spinWheel: (db: Database, actor: Actor, input: { source: SpinSource }) =>
    A.spinWheel(db, actor.id, oneOf(input.source, ['DAILY', 'EXTRA', 'FREE'] as const, 'Tipo de giro')),

  claimBirthdayReward: (db: Database, actor: Actor, input: { rewardId: number }) => {
    A.claimBirthdayReward(db, actor.id, id(input.rewardId, 'Recompensa'))
    return true
  },

  // ---------- Any signed-in user ----------
  updateProfile: (
    db: Database,
    actor: Actor,
    input: { firstName: string; lastName: string; email: string; phone: string | null },
  ) => {
    A.updateProfile(db, actor.id, {
      firstName: str(input.firstName),
      lastName: str(input.lastName),
      email: str(input.email),
      phone: optionalStr(input.phone),
    })
    return true
  },

  // ---------- Admin ----------
  reviewFraudAlert: (db: Database, actor: Actor, input: { alertId: number; decision: Exclude<FraudAlertStatus, 'OPEN'> }) => {
    A.reviewFraudAlert(db, id(input.alertId), oneOf(input.decision, ['RESOLVED', 'DISMISSED'] as const, 'Decisión'), actor.id)
    return true
  },

  reviewCancellation: (db: Database, actor: Actor, input: { requestId: number; decision: Exclude<CancellationRequestStatus, 'PENDING'>; note: string }) => {
    A.reviewCancellation(
      db,
      {
        requestId: id(input.requestId, 'Solicitud'),
        decision: oneOf(input.decision, ['APPROVED', 'REJECTED'] as const, 'Decisión'),
        note: str(input.note),
      },
      actor.id,
    )
    return true
  },

  adjustBalance: (db: Database, actor: Actor, input: { userId: number; ledger: 'POINTS' | 'STATUS'; amount: number }) => {
    A.adjustBalance(
      db,
      { userId: id(input.userId), ledger: oneOf(input.ledger, ['POINTS', 'STATUS'] as const, 'Tipo de puntos'), amount: int(input.amount, 'Cantidad') },
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
        name: str(data(input).name),
        description: str(data(input).description),
        logoUrl: optionalStr(data(input).logoUrl),
        phone: optionalStr(data(input).phone),
        floor: optionalStr(data(input).floor),
        sector: optionalStr(data(input).sector),
        localNumber: optionalStr(data(input).localNumber),
        status: oneOf(data(input).status, ['ACTIVE', 'INACTIVE'] as const, 'Estado'),
      },
      ids(input.categoryIds, 'Lista de categorías'),
      list(input.schedules, 'Lista de horarios').map((value) => {
        const s = (value ?? {}) as Partial<ScheduleData>
        const isClosed = s.isClosed === true
        return {
          dayOfWeek: oneOf(s.dayOfWeek, DAYS, 'Día'),
          isClosed,
          openTime: isClosed ? null : time(s.openTime),
          closeTime: isClosed ? null : time(s.closeTime),
        }
      }),
      actor.id,
    ),

  saveCategory: (db: Database, actor: Actor, input: { id: number | null; data: CategoryData }) =>
    A.saveCategory(
      db,
      optionalId(input.id),
      {
        name: str(data(input).name),
        parentId: optionalId(data(input).parentId),
        status: oneOf(data(input).status, ['ACTIVE', 'INACTIVE'] as const, 'Estado'),
      },
      actor.id,
    ),

  saveTier: (db: Database, actor: Actor, input: { id: number | null; data: TierData }) =>
    A.saveTier(
      db,
      optionalId(input.id),
      {
        name: str(data(input).name),
        minimumStatus: int(data(input).minimumStatus, 'Puntos de nivel mínimos'),
        pointsMultiplier: num(data(input).pointsMultiplier, 'Multiplicador'),
        sortOrder: int(data(input).sortOrder, 'Orden'),
        isActive: data(input).isActive !== false,
      },
      actor.id,
    ),

  saveEvent: (db: Database, actor: Actor, input: { id: number | null; data: EventData }) =>
    A.saveEvent(
      db,
      optionalId(input.id),
      {
        name: str(data(input).name),
        description: optionalStr(data(input).description),
        location: optionalStr(data(input).location),
        startsAt: date(data(input).startsAt),
        endsAt: date(data(input).endsAt),
        pointsReward: int(data(input).pointsReward, 'Puntos'),
        status: oneOf(data(input).status, ['DRAFT', 'ACTIVE', 'INACTIVE'] as const, 'Estado'),
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
        name: str(data(input).name),
        description: optionalStr(data(input).description),
        type: oneOf(data(input).type, BADGE_TYPES, 'Tipo de insignia'),
        goal: optionalInt(data(input).goal, 'Cantidad'),
        tierId: optionalId(data(input).tierId),
        categoryId: optionalId(data(input).categoryId),
        date: dateKey(data(input).date),
        status: oneOf(data(input).status, ['ACTIVE', 'INACTIVE'] as const, 'Estado'),
      },
      actor.id,
    ),

  saveMission: (db: Database, actor: Actor, input: { id: number | null; data: MissionData; scope: Scope }) =>
    A.saveMission(
      db,
      optionalId(input.id),
      {
        name: str(data(input).name),
        description: optionalStr(data(input).description),
        type: oneOf(
          data(input).type,
          ['BUY_DISTINCT_BUSINESSES', 'BUY_CATEGORY', 'BUY_DISTINCT_CATEGORIES', 'TOTAL_PURCHASE_AMOUNT', 'TRANSACTION_COUNT', 'WEEKLY_PURCHASE', 'DISCOVER_BUSINESS'] as const,
          'Tipo',
        ),
        goal: int(data(input).goal, 'Objetivo'),
        rewardPoints: int(data(input).rewardPoints, 'Puntos de premio'),
        rewardStatus: int(data(input).rewardStatus, 'Puntos de nivel de premio'),
        rewardSpins: optionalInt(data(input).rewardSpins, 'Giros de premio') ?? 0,
        startsAt: date(data(input).startsAt),
        endsAt: date(data(input).endsAt),
        status: oneOf(data(input).status, ['DRAFT', 'ACTIVE', 'INACTIVE'] as const, 'Estado'),
      },
      scope(input.scope),
      actor.id,
    ),

  savePromotion: (db: Database, actor: Actor, input: { id: number | null; data: PromotionData; scope: Scope }) =>
    A.savePromotion(
      db,
      optionalId(input.id),
      {
        name: str(data(input).name),
        type: oneOf(data(input).type, ['POINTS_MULTIPLIER', 'FIXED_POINTS'] as const, 'Tipo'),
        value: num(data(input).value, 'Valor'),
        startsAt: date(data(input).startsAt),
        endsAt: date(data(input).endsAt),
        status: oneOf(data(input).status, ['DRAFT', 'ACTIVE', 'INACTIVE'] as const, 'Estado'),
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

  reviewKyc: (db: Database, actor: Actor, input: { requestId: number; decision: Exclude<KycStatus, 'PENDING'>; note: string }) => {
    A.reviewKyc(
      db,
      {
        requestId: id(input.requestId, 'Solicitud'),
        decision: oneOf(input.decision, ['APPROVED', 'REJECTED'] as const, 'Decisión'),
        note: str(input.note),
      },
      actor.id,
    )
    return true
  },

  saveSpace: (db: Database, actor: Actor, input: { id: number | null; data: SpaceData }) =>
    A.saveSpace(
      db,
      optionalId(input.id),
      {
        name: str(data(input).name),
        description: optionalStr(data(input).description),
        location: optionalStr(data(input).location),
        pointsReward: int(data(input).pointsReward, 'Puntos'),
        statusReward: int(data(input).statusReward, 'Puntos de nivel'),
        status: oneOf(data(input).status, ['ACTIVE', 'INACTIVE'] as const, 'Estado'),
      },
      actor.id,
    ),

  regenerateSpaceCode: (db: Database, actor: Actor, input: { spaceId: number }) => {
    A.regenerateSpaceCode(db, id(input.spaceId, 'Espacio'), actor.id)
    return true
  },

  savePrize: (db: Database, actor: Actor, input: { id: number | null; data: PrizeData }) =>
    A.savePrize(
      db,
      optionalId(input.id),
      {
        type: oneOf(data(input).type, ['POINTS', 'MULTIPLIER', 'REWARD', 'EXTRA_SPIN'] as const, 'Tipo de premio'),
        points: optionalInt(data(input).points, 'Puntos'),
        multiplier: optionalNum(data(input).multiplier, 'Multiplicador'),
        rewardId: optionalId(data(input).rewardId),
        validDays: optionalInt(data(input).validDays, 'Vigencia') ?? 7,
        weight: int(data(input).weight, 'Peso'),
        stock: optionalInt(data(input).stock, 'Cantidad disponible'),
        status: oneOf(data(input).status, ['ACTIVE', 'INACTIVE'] as const, 'Estado'),
      },
      actor.id,
    ),

  saveSetting: (db: Database, actor: Actor, input: { key: keyof typeof SETTING_DEFAULTS; value: string }) => {
    const key = oneOf(input.key, Object.keys(SETTING_DEFAULTS) as (keyof typeof SETTING_DEFAULTS)[], 'Parámetro')
    const value = str(input.value, 'Valor').trim()
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
