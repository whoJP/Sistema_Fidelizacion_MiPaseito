import type {
  BadgeType,
  BusinessMemberRole,
  DayOfWeek,
  FraudAlertType,
  MissionType,
  PointMovementType,
  RewardType,
  StatusMovementType,
} from '../types/domain'

const money = new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' })
const integer = new Intl.NumberFormat('es-BO')
const dateFmt = new Intl.DateTimeFormat('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })
const dateTimeFmt = new Intl.DateTimeFormat('es-BO', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export const formatMoney = (value: number) => money.format(value)
export const formatInt = (value: number) => integer.format(value)
export const formatDate = (iso: string) => dateFmt.format(new Date(iso))
export const formatDateTime = (iso: string) => dateTimeFmt.format(new Date(iso))
/** Formats a calendar day stored as `YYYY-MM-DD` without shifting it to another day. */
export const formatDateKey = (key: string) => dateFmt.format(new Date(`${key}T12:00:00`))
export const plural = (count: number, one: string, many: string) => `${formatInt(count)} ${count === 1 ? one : many}`
export const signed = (value: number) => (value > 0 ? `+${formatInt(value)}` : formatInt(value))

export const floorLabel = (floor: string) => (floor.toUpperCase() === 'PB' ? 'Planta baja' : `Piso ${floor}`)

export const fullName = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`

export const DAY_LABELS: Record<DayOfWeek, string> = {
  MONDAY: 'Lunes',
  TUESDAY: 'Martes',
  WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves',
  FRIDAY: 'Viernes',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
}

export const DAYS_IN_ORDER = Object.keys(DAY_LABELS) as DayOfWeek[]

export const MISSION_TYPE_LABELS: Record<MissionType, string> = {
  BUY_DISTINCT_BUSINESSES: 'Comprar en establecimientos distintos',
  BUY_CATEGORY: 'Compras en una categoría',
  BUY_DISTINCT_CATEGORIES: 'Comprar en categorías distintas',
  TOTAL_PURCHASE_AMOUNT: 'Monto total de compras (Bs)',
  TRANSACTION_COUNT: 'Cantidad de compras',
  WEEKLY_PURCHASE: 'Semanas distintas con compra',
  DISCOVER_BUSINESS: 'Descubrir establecimientos nuevos',
}

/** What "objetivo" means for each mission type, shown as a hint in the admin form. */
export const MISSION_GOAL_HINTS: Record<MissionType, string> = {
  BUY_DISTINCT_BUSINESSES: 'Cantidad de establecimientos distintos',
  BUY_CATEGORY: 'Cantidad de compras (elige la categoría en Alcance)',
  BUY_DISTINCT_CATEGORIES: 'Cantidad de categorías distintas',
  TOTAL_PURCHASE_AMOUNT: 'Monto en Bs, sin centavos',
  TRANSACTION_COUNT: 'Cantidad de compras',
  WEEKLY_PURCHASE: 'Cantidad de semanas con al menos una compra',
  DISCOVER_BUSINESS: 'Establecimientos donde compra por primera vez',
}

export const POINT_MOVEMENT_LABELS: Record<PointMovementType, string> = {
  PURCHASE: 'Compra',
  MISSION: 'Misión completada',
  PROMOTION: 'Promoción',
  EVENT: 'Asistencia a evento',
  REDEMPTION: 'Canje',
  ADJUSTMENT: 'Ajuste manual',
  REVERSAL: 'Devolución',
}

export const REWARD_TYPE_LABELS: Record<RewardType, string> = {
  PERCENT_DISCOUNT: 'Descuento en porcentaje (%)',
  AMOUNT_DISCOUNT: 'Descuento en Bs',
  FREE_PRODUCT: 'Producto de regalo',
}

export const BADGE_TYPE_LABELS: Record<BadgeType, string> = {
  TIER_REACHED: 'Alcanzar un nivel',
  PURCHASE_COUNT: 'Cantidad de compras',
  CATEGORY_PURCHASES: 'Compras en una categoría',
  DISTINCT_BUSINESSES: 'Establecimientos distintos',
  MISSIONS_COMPLETED: 'Misiones completadas',
  SPECIAL_DATE: 'Visitar el Paseo en una fecha especial',
}

export const MEMBER_ROLE_LABELS: Record<BusinessMemberRole, string> = {
  MANAGER: 'Encargado',
  STAFF: 'Personal',
}

export const STATUS_MOVEMENT_LABELS: Record<StatusMovementType, string> = {
  PURCHASE: 'Compra',
  MISSION: 'Misión completada',
  DISCOVERY: 'Nuevo descubrimiento',
  STREAK: 'Racha semanal',
  ADJUSTMENT: 'Ajuste o devolución',
}

export const FRAUD_TYPE_LABELS: Record<FraudAlertType, string> = {
  DUPLICATE_TRANSACTION: 'Compra duplicada',
  REUSED_REDEMPTION: 'Canje reutilizado',
  HIGH_FREQUENCY: 'Frecuencia anormal',
  ABNORMAL_AMOUNT: 'Monto anormal',
}

/** `datetime-local` input value <-> ISO string. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null
}
