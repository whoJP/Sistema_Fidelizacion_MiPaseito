// Field limits and format rules shared by the forms (HTML attributes, inline errors) and the server (data/actions.ts).
// Text limits match the column sizes in backend/prisma/schema.prisma. Each check returns an error message or null.
import { formatInt, formatMoney } from '../lib/format'

export const LIMITS = {
  personName: 100,
  email: 191,
  phone: 30,
  passwordMin: 6,
  passwordMax: 72,
  /** Businesses, products, missions, promotions, events and spaces. */
  name: 150,
  categoryName: 100,
  /** Group of products inside a business catalog (CatalogItem.category). */
  catalogCategory: 80,
  badgeName: 100,
  tierName: 50,
  description: 500,
  location: 150,
  url: 500,
  floor: 20,
  sector: 50,
  localNumber: 20,
  note: 300,
  reasonMin: 10,
  reason: 500,
  settingValue: 255,
  /** Anything typed or scanned into a code box (customer QR, redemption, space). */
  scanCode: 300,
} as const

/** Largest amount in Bs a DECIMAL(10,2) column holds. */
export const MAX_MONEY = 99_999_999.99
/** Points granted or charged by one configuration (costs, prizes, mission and event rewards). */
export const MAX_REWARD_POINTS = 100_000
/** Points a reward can cost and the largest manual adjustment. */
export const MAX_POINTS = 1_000_000
export const MAX_STOCK = 1_000_000
export const MAX_GOAL = 1_000_000
export const MAX_TIER_STATUS = 10_000_000
export const MAX_MULTIPLIER = 10
/** Icons a level can show; the artwork lives in components/TierIcon.tsx. */
export const TIER_ICON_KEYS = ['shield', 'medal', 'award', 'star', 'crown', 'gem', 'trophy', 'flame', 'zap', 'rocket', 'heart', 'sparkles'] as const
export const MAX_SORT_ORDER = 1000
export const MAX_SCOPE_ITEMS = 200

const PERSON_NAME = /^\p{L}[\p{L}\p{M}' .-]*$/u
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/
const PHONE = /^\+?\d[\d -]*\d$/
const FLOOR = /^(PB|-?\d{1,2})$/i
const LOCAL_NUMBER = /^[A-Za-z0-9-]+$/
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

/** Collapses repeated spaces; used for one-line names before checking or storing them. */
export const singleLine = (value: string) => value.trim().replace(/\s+/g, ' ')

export function textError(value: string | null | undefined, label: string, max: number, options: { required?: boolean; min?: number } = {}): string | null {
  const text = (value ?? '').trim()
  if (!text) return options.required ? `${label} es obligatorio` : null
  if (options.min && text.length < options.min) return `${label} debe tener al menos ${options.min} caracteres`
  if (text.length > max) return `${label} admite hasta ${formatInt(max)} caracteres`
  return null
}

export function personNameError(value: string, label: string): string | null {
  const error = textError(value, label, LIMITS.personName, { required: true })
  if (error) return error
  if (!PERSON_NAME.test(singleLine(value))) return `${label} solo admite letras, espacios, apóstrofos y guiones`
  return null
}

export function emailError(value: string): string | null {
  const email = value.trim()
  if (!email) return 'El correo es obligatorio'
  if (email.length > LIMITS.email || !EMAIL.test(email)) return 'Correo inválido'
  return null
}

/** Optional phone: 7 to 15 digits, with spaces or dashes and an optional leading +. */
export function phoneError(value: string | null | undefined): string | null {
  const phone = (value ?? '').trim()
  if (!phone) return null
  const digits = phone.replace(/\D/g, '').length
  if (phone.length > LIMITS.phone || !PHONE.test(phone) || digits < 7 || digits > 15) {
    return 'Teléfono inválido: de 7 a 15 dígitos, solo números, espacios, guiones y + al inicio'
  }
  return null
}

export function passwordError(value: string): string | null {
  if (value.length < LIMITS.passwordMin) return `La contraseña debe tener al menos ${LIMITS.passwordMin} caracteres`
  // bcrypt only reads the first 72 bytes.
  if (new TextEncoder().encode(value).length > LIMITS.passwordMax) return `La contraseña admite hasta ${LIMITS.passwordMax} caracteres`
  if (!value.trim()) return 'La contraseña no puede ser solo espacios'
  if (!/\p{L}/u.test(value) || !/\d/.test(value)) return 'La contraseña debe combinar letras y números'
  return null
}

export function urlError(value: string | null | undefined): string | null {
  const url = (value ?? '').trim()
  if (!url) return null
  if (url.length > LIMITS.url) return `La URL admite hasta ${LIMITS.url} caracteres`
  try {
    const { protocol } = new URL(url)
    if (protocol !== 'https:' && protocol !== 'http:') return 'La URL debe empezar con https:// o http://'
  } catch {
    return 'URL inválida: debe empezar con https://'
  }
  return null
}

/** "PB" (planta baja) or a floor number, negative for basements. */
export function floorError(value: string | null | undefined): string | null {
  const floor = (value ?? '').trim()
  if (!floor) return null
  if (floor.length > LIMITS.floor || !FLOOR.test(floor)) return 'Piso inválido: escribe PB o el número de piso'
  return null
}

export function localNumberError(value: string | null | undefined): string | null {
  const local = (value ?? '').trim()
  if (!local) return null
  if (local.length > LIMITS.localNumber || !LOCAL_NUMBER.test(local)) return 'Número de local inválido: solo letras, números y guiones'
  return null
}

export function intError(value: number, label: string, min: number, max: number): string | null {
  if (!Number.isInteger(value)) return `${label} debe ser un número entero`
  if (value < min || value > max) return `${label} debe estar entre ${formatInt(min)} y ${formatInt(max)}`
  return null
}

const hasCents = (value: number) => Math.abs(value * 100 - Math.round(value * 100)) > 1e-6

/** Amount in Bs with at most 2 decimals. `min` is exclusive when `minExclusive` (e.g. prices must be > 0). */
export function moneyError(value: number, label: string, options: { min?: number; minExclusive?: boolean; max?: number } = {}): string | null {
  const { min = 0, minExclusive = false, max = MAX_MONEY } = options
  if (!Number.isFinite(value)) return `${label} debe ser un número`
  if (minExclusive ? value <= min : value < min) return `${label} debe ser ${minExclusive ? 'mayor a' : 'al menos'} ${formatMoney(min)}`
  if (value > max) return `${label} no puede superar ${formatMoney(max)}`
  if (hasCents(value)) return `${label} admite hasta 2 decimales`
  return null
}

/** Number in [min, max]; integer or with up to 2 decimals. */
export function rangeError(value: number, label: string, min: number, max: number, integer: boolean): string | null {
  if (integer) return intError(value, label, min, max)
  if (!Number.isFinite(value) || value < min || value > max) return `${label} debe estar entre ${formatInt(min)} y ${formatInt(max)}`
  if (hasCents(value)) return `${label} admite hasta 2 decimales`
  return null
}

/** Multiplier with up to 2 decimals in (min, max]. */
export function multiplierError(value: number, label: string, min = 1, max = MAX_MULTIPLIER): string | null {
  if (!Number.isFinite(value) || value <= min || value > max) return `${label} debe ser mayor a ${min} y hasta ${max}`
  if (hasCents(value)) return `${label} admite hasta 2 decimales`
  return null
}

export const MIN_AGE = 12
export const MAX_AGE = 120

/** Oldest and most recent birth dates accepted on `today` (`YYYY-MM-DD`). */
export function birthDateRange(today: string): { min: string; max: string } {
  const [year, month, day] = today.split('-')
  const shift = (years: number) => {
    const key = `${String(Number(year) - years).padStart(4, '0')}-${month}-${day}`
    return isCalendarDate(key) ? key : key.replace(/-29$/, '-28')
  }
  return { min: shift(MAX_AGE), max: shift(MIN_AGE) }
}

/** `YYYY-MM-DD` that exists in the calendar (rejects 2026-02-30, which `Date.parse` silently accepts). */
export function isCalendarDate(value: string): boolean {
  if (!DATE_KEY.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}
