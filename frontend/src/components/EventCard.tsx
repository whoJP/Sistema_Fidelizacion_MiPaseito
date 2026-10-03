import { Clock, MapPin, QrCode } from 'lucide-react'
import { isEventOpen } from '../domain/loyalty'
import { localDateKey } from '../domain/time'
import { formatDay, formatDayMonth, formatInt, formatMonth, formatStartsIn, formatTime, formatWeekday } from '../lib/format'
import type { PaseoEvent } from '../types/domain'
import { Medallion } from './BadgeMedal'

function schedule(e: PaseoEvent, open: boolean): string {
  const at = (iso: string) => `${formatDayMonth(iso)}, ${formatTime(iso)}`
  if (localDateKey(e.startsAt) === localDateKey(e.endsAt)) return `${at(e.startsAt)} a ${formatTime(e.endsAt)}`
  return open ? `Hasta el ${at(e.endsAt)}` : `Del ${at(e.startsAt)} al ${at(e.endsAt)}`
}

/** Event invitation: when, where, what you win and how to join. `onShowCode` adds a shortcut to the QR. */
export function EventCard({ event: e, onShowCode }: { event: PaseoEvent; onShowCode?: () => void }) {
  const open = isEventOpen(e)
  return (
    <article className={`event ${open ? 'is-live' : ''}`}>
      <div className="event-date" aria-hidden>
        <span className="event-month">{formatMonth(e.startsAt)}</span>
        <span className="event-day">{formatDay(e.startsAt)}</span>
        <span className="event-weekday">{formatWeekday(e.startsAt)}</span>
      </div>
      <div className="event-body">
        {open ? (
          <span className="event-status event-live">
            <span className="live-dot" aria-hidden /> En curso
          </span>
        ) : (
          <span className="event-status">{formatStartsIn(e.startsAt)}</span>
        )}
        <h3>{e.name}</h3>
        {e.description && <p className="event-desc">{e.description}</p>}
        <ul className="event-meta">
          <li>
            <Clock size={15} aria-hidden /> {schedule(e, open)}
          </li>
          {e.location && (
            <li>
              <MapPin size={15} aria-hidden /> {e.location}
            </li>
          )}
        </ul>
        <div className="event-prize">
          <Medallion kind="EVENT" earned size={38} />
          <span>{e.pointsReward > 0 ? <b>+{formatInt(e.pointsReward)} pts + insignia</b> : <b>Insignia del evento</b>}</span>
        </div>
        {open && onShowCode ? (
          <button type="button" className="btn btn-primary btn-sm event-cta" onClick={onShowCode}>
            <QrCode size={15} aria-hidden /> Mostrar mi QR
          </button>
        ) : (
          <span className="event-how">
            <QrCode size={13} aria-hidden /> Entra con tu QR
          </span>
        )}
      </div>
    </article>
  )
}
