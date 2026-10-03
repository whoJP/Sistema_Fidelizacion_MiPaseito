import { useState, type CSSProperties } from 'react'
import { Clock, Stamp } from 'lucide-react'
import { visitCard } from '../domain/engagement'
import { personalPromotions } from '../domain/loyalty'
import { formatDayMonth, formatDaysLeft, formatNumber, plural } from '../lib/format'
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
        </span>
        <h2>{left === 1 ? 'Te falta una visita' : `Te faltan ${left} visitas`}</h2>
        <p>Cada día que compras o visitas un espacio del Paseo suma un sello. Al completarla recibes un cupón de regreso y un giro gratis.</p>
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
      <p className="visit-note">
        {card.giftStamps > 0 && <>Los primeros {plural(card.giftStamps, 'sello va', 'sellos van')} de regalo. </>}
        {card.completedCards > 0 && <>Ya completaste {plural(card.completedCards, 'tarjeta', 'tarjetas')}.</>}
      </p>

      {coupon &&
        (opened.has(coupon.id) ? (
          <div className="coupon-open">
            <span className="coupon-big">×{formatNumber(coupon.value)}</span>
            <div>
              <strong>Cupón de regreso</strong>
              <p>Tu próxima compra en cualquier local suma puntos ×{formatNumber(coupon.value)}. Se aplica solo, sin mostrar nada.</p>
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
              <strong>Completaste tu tarjeta</strong>
              <span>Toca para abrir tu sobre</span>
            </span>
          </button>
        ))}
    </section>
  )
}
