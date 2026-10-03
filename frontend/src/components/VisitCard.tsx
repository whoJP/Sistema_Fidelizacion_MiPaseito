import { useState, type CSSProperties } from 'react'
import { Clock, Stamp, Ticket } from 'lucide-react'
import { visitCard } from '../domain/engagement'
import { getSetting, personalPromotions } from '../domain/loyalty'
import { formatDayMonth, formatDaysLeft, formatNumber } from '../lib/format'
import type { Database } from '../types/domain'
import { ClubGem } from './BrandMark'
import { prefersReducedMotion } from './ui'

const openedKey = (promotionId: number) => `paseo:sobre:${promotionId}`
const wasOpened = (promotionId: number) => {
  try {
    return localStorage.getItem(openedKey(promotionId)) === '1'
  } catch {
    return false
  }
}

/** Stamp card: every day with a purchase or a space visit is a stamp. A full card leaves a sealed coupon. */
export function VisitCard({ db, userId }: { db: Database; userId: number }) {
  const card = visitCard(db, userId)
  const coupon = personalPromotions(db, userId).find((p) => p.origin === 'VISIT_CARD')
  const [opened, setOpened] = useState<Set<number>>(() => new Set(coupon && wasOpened(coupon.id) ? [coupon.id] : []))
  const [opening, setOpening] = useState(false)
  const left = card.size - card.stamps

  const open = () => {
    if (!coupon) return
    try {
      localStorage.setItem(openedKey(coupon.id), '1')
    } catch {
      // Private mode: the envelope simply opens again next time.
    }
    if (prefersReducedMotion()) {
      setOpened(new Set([...opened, coupon.id]))
      return
    }
    setOpening(true)
    setTimeout(() => {
      setOpening(false)
      setOpened(new Set([...opened, coupon.id]))
    }, 900)
  }

  return (
    <section className="visit-card" aria-label="Tarjeta de visitas">
      <div className="visit-head">
        <span className="visit-eyebrow">
          <Stamp size={15} aria-hidden /> Tarjeta de visitas
          {card.completedCards > 0 && <span className="visit-done">×{card.completedCards}</span>}
        </span>
        <h2>{left === 1 ? '1 visita para tu premio' : `${left} visitas para tu premio`}</h2>
        <span className="visit-prize">
          <Ticket size={14} aria-hidden /> Cupón ×{formatNumber(getSetting(db, 'VISIT_CARD_MULTIPLIER'))} <span aria-hidden>·</span> <ClubGem size={13} /> Giro gratis
        </span>
      </div>

      <ol className="visit-stamps" style={{ '--n': card.size } as CSSProperties} aria-label={`${card.stamps} de ${card.size} sellos`}>
        {Array.from({ length: card.size }, (_, i) => {
          const gift = i < card.giftStamps
          const filled = i < card.stamps
          return (
            <li key={i} className={`visit-stamp ${filled ? 'is-filled' : ''} ${gift ? 'is-gift' : ''}`} style={{ '--i': i } as CSSProperties}>
              {filled ? <ClubGem size={16} /> : <span className="visit-stamp-n">{i + 1}</span>}
            </li>
          )
        })}
      </ol>
      {coupon &&
        (opened.has(coupon.id) ? (
          <div className="coupon-open">
            <span className="coupon-big">×{formatNumber(coupon.value)}</span>
            <div>
              <strong>Cupón de regreso</strong>
              <p>En tu próxima compra, automático</p>
              <span className="coupon-foot">
                <Clock size={13} aria-hidden /> Hasta el {formatDayMonth(coupon.endsAt)} · {formatDaysLeft(coupon.endsAt)}
              </span>
            </div>
          </div>
        ) : (
          <button type="button" className={`envelope ${opening ? 'is-opening' : ''}`} onClick={open} disabled={opening}>
            <span className="envelope-flap" aria-hidden />
            <span className="envelope-seal" aria-hidden>
              <ClubGem size={22} />
            </span>
            <span className="envelope-text">
              <strong>Tarjeta completa</strong>
              <span>Toca para abrir</span>
            </span>
          </button>
        ))}
    </section>
  )
}
