// Paseo Aranjuez local time. Bolivia is UTC−4 all year (no daylight saving), so a fixed offset is exact
// and results don't depend on the timezone of the server or the browser.
const OFFSET_MS = -4 * 3600_000

const shifted = (iso: string) => new Date(new Date(iso).getTime() + OFFSET_MS)

/** `YYYY-MM-DD` of the instant in Bolivia. */
export function localDateKey(iso: string): string {
  return shifted(iso).toISOString().slice(0, 10)
}

/** Hour 0–23 in Bolivia. */
export function localHour(iso: string): number {
  return shifted(iso).getUTCHours()
}

/** 0 = Monday … 6 = Sunday, in Bolivia. */
export function localWeekday(iso: string): number {
  return (shifted(iso).getUTCDay() + 6) % 7
}

/** Start (00:00) of a Bolivian calendar day as an ISO instant. */
export function startOfLocalDay(dateKey: string): string {
  return new Date(Date.parse(`${dateKey}T00:00:00.000Z`) - OFFSET_MS).toISOString()
}

/** End (23:59:59.999) of a Bolivian calendar day as an ISO instant. */
export function endOfLocalDay(dateKey: string): string {
  return new Date(Date.parse(`${dateKey}T23:59:59.999Z`) - OFFSET_MS).toISOString()
}

export function todayKey(now = new Date()): string {
  return localDateKey(now.toISOString())
}

export function addDaysKey(dateKey: string, days: number): string {
  return new Date(Date.parse(`${dateKey}T12:00:00.000Z`) + days * 86_400_000).toISOString().slice(0, 10)
}

/** Same day `months` later; clamps to the last day when it doesn't exist (31-ene + 1 = 28/29-feb). */
export function addMonthsKey(dateKey: string, months: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const target = new Date(Date.UTC(y, m - 1 + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d, lastDay))
  return target.toISOString().slice(0, 10)
}

/** Calendar days from `from` to `to`, both included. */
export function daysBetweenKeys(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00.000Z`) - Date.parse(`${from}T12:00:00.000Z`)) / 86_400_000) + 1
}
