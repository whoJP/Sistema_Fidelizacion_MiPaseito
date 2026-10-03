// Validity window of rewards, missions, promotions and events. Shared by the forms (inline errors) and the server.

const MINUTE_MS = 60_000
/** Time allowed to fill the form: a start set to "now" is still accepted a few minutes later. */
const GRACE_MS = 10 * MINUTE_MS

export interface Window {
  startsAt: string | null
  endsAt: string | null
}

const minuteOf = (iso: string) => Math.floor(Date.parse(iso) / MINUTE_MS)
const sameMinute = (a: string | null, b: string | null) => (a && b ? minuteOf(a) === minuteOf(b) : a === b)

/** An existing record that already started keeps its start date. */
export function startLocked(previous: Window | null | undefined, now = new Date()): boolean {
  return !!previous?.startsAt && Date.parse(previous.startsAt) <= now.getTime()
}

/**
 * Error message for the window, or null when valid. `previous` is the saved record when editing.
 * Dates left unchanged while editing are not checked against the current time.
 */
export function windowError(next: Window, previous: Window | null, required: boolean, now = new Date()): string | null {
  const { startsAt, endsAt } = next
  if (required && (!startsAt || !endsAt)) return 'Indica la fecha de inicio y la de fin'
  const t = now.getTime()

  if (startLocked(previous, now)) {
    if (!sameMinute(startsAt, previous!.startsAt)) return 'Ya comenzó: la fecha de inicio no se puede cambiar'
  } else if (startsAt && !sameMinute(startsAt, previous?.startsAt ?? null) && Date.parse(startsAt) < t - GRACE_MS) {
    return 'El inicio no puede ser anterior a la fecha y hora actual'
  }

  if (endsAt && !sameMinute(endsAt, previous?.endsAt ?? null) && Date.parse(endsAt) <= t) {
    return 'El fin debe ser posterior a la fecha y hora actual'
  }
  if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) return 'El fin debe ser posterior al inicio'
  return null
}
