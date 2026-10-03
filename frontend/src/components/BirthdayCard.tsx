import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BadgeCheck, CakeSlice, Check, ChevronRight, Gift, ShieldQuestion, Sparkles, Store } from 'lucide-react'
import { birthdayGifts, birthdayRewardClaimed, birthdayRewardOptions, isBirthdayToday, kycState, localYear } from '../domain/engagement'
import { getSetting, rewardTitle } from '../domain/loyalty'
import { localDateKey } from '../domain/time'
import { formatInt } from '../lib/format'
import type { Database, User } from '../types/domain'
import { ClubGem } from './BrandMark'
import { Modal, run } from './ui'

/** Permanent reminder until the birthday is verified: it unlocks the birthday benefits. */
export function KycBanner({ db, userId }: { db: Database; userId: number }) {
  const state = kycState(db, userId)
  if (state.status === 'VERIFIED') return null
  if (state.status === 'PENDING') {
    return (
      <div className="kyc-banner is-pending" role="status">
        <ShieldQuestion size={18} aria-hidden />
        <span>Estamos revisando la verificación de tu cumpleaños. Te avisaremos apenas esté lista.</span>
      </div>
    )
  }
  return (
    <Link to="/account#cumpleanos" className="kyc-banner">
      <CakeSlice size={18} aria-hidden />
      <span>
        {state.status === 'REJECTED' ? (
          <>
            <b>No pudimos verificar tu cumpleaños.</b> Revisa el motivo y envíalo de nuevo desde Mi perfil.
          </>
        ) : (
          <>
            <b>Registra tu cumpleaños</b> para recibir puntos, un giro y regalos de los locales ese día.
          </>
        )}
      </span>
      <ChevronRight size={18} aria-hidden />
    </Link>
  )
}

/** Shown on the customer's verified birthday: bonus, free reward of their choice and the gifts of every business. */
export function BirthdayCard({ db, user }: { db: Database; user: User }) {
  const navigate = useNavigate()
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState<number | null>(null)
  if (!isBirthdayToday(user)) return null

  const year = localYear()
  const bonus = db.pointMovements.find((m) => m.userId === user.id && m.type === 'BIRTHDAY' && localDateKey(m.createdAt).startsWith(`${year}-`))
  const chosen = db.redemptions.find((r) => r.userId === user.id && r.origin === 'BIRTHDAY' && localDateKey(r.createdAt).startsWith(`${year}-`))
  const chosenReward = chosen && db.rewards.find((r) => r.id === chosen.rewardId)
  const claimed = new Set(db.birthdayClaims.filter((c) => c.userId === user.id && c.year === year).map((c) => c.businessId))
  const gifts = birthdayGifts(db)
  const options = birthdayRewardOptions(db)

  const choose = async (rewardId: number) => {
    setBusy(rewardId)
    const ok = await run('claimBirthdayReward', { rewardId }, 'Tu regalo está listo en Mis canjes')
    setBusy(null)
    if (ok) {
      setPicking(false)
      navigate('/app/rewards')
    }
  }

  return (
    <section className="bday" aria-label="Tu cumpleaños">
      <div className="bday-glow" aria-hidden />
      <div className="bday-head">
        <span className="bday-eyebrow">
          <ClubGem size={14} /> Paseo Club te celebra
        </span>
        <h2>Feliz cumpleaños, {user.firstName}</h2>
        <p>Hoy el Paseo es tuyo. Estos son tus regalos, válidos hasta la medianoche.</p>
      </div>

      <ul className="bday-perks">
        <li>
          <Sparkles size={18} aria-hidden />
          <span>
            <b>{formatInt(bonus?.amount ?? getSetting(db, 'BIRTHDAY_BONUS_POINTS'))} puntos</b>
            <small>{bonus ? 'Ya están en tu saldo' : 'Llegan en unos minutos'}</small>
          </span>
        </li>
        <li>
          <ClubGem size={18} />
          <span>
            <b>Un giro gratis</b>
            <small>
              <Link to="/app/spin">Ir a la ruleta</Link>
            </small>
          </span>
        </li>
        <li>
          <Gift size={18} aria-hidden />
          <span>
            <b>{chosenReward ? rewardTitle(db, chosenReward) : 'Una recompensa a elección'}</b>
            <small>
              {chosen ? (
                <Link to="/app/rewards">{chosen.status === 'REDEEMED' ? 'Ya la disfrutaste' : 'Ver en Mis canjes'}</Link>
              ) : options.length > 0 ? (
                <button type="button" className="link-btn" onClick={() => setPicking(true)}>
                  Elegir mi regalo
                </button>
              ) : (
                'No hay recompensas disponibles hoy'
              )}
            </small>
          </span>
        </li>
      </ul>

      {gifts.length > 0 && (
        <div className="bday-gifts">
          <h3>
            <Store size={16} aria-hidden /> Regalos de los locales
          </h3>
          <p className="muted small">Con tu compra de hoy en el local, muestra tu tarjeta en caja y pide tu regalo de cumpleaños.</p>
          <ul>
            {gifts.map((g) => (
              <li key={g.business.id} className={claimed.has(g.business.id) ? 'is-claimed' : ''}>
                <span className="bday-gift-name">{g.business.name}</span>
                <span className="bday-gift-title">
                  {claimed.has(g.business.id) ? (
                    <>
                      <Check size={14} aria-hidden /> Recibido
                    </>
                  ) : (
                    g.title
                  )}
                </span>
                {g.description && !claimed.has(g.business.id) && <small>{g.description}</small>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {picking && !birthdayRewardClaimed(db, user.id, year) && (
        <Modal title="Elige tu regalo de cumpleaños" onClose={() => setPicking(false)} wide>
          <p className="muted small">
            Es gratis y no usa tus puntos. Lo canjeas hoy mostrando tu tarjeta en el local; si no lo usas, vence a la medianoche.
          </p>
          <ul className="pick-list">
            {options.map((r) => {
              const business = db.businesses.find((b) => b.id === r.businessId)
              return (
                <li key={r.id}>
                  <button type="button" className="pick" onClick={() => choose(r.id)} disabled={busy !== null}>
                    <span>
                      <b>{rewardTitle(db, r)}</b>
                      <small>
                        {business?.name} · vale {formatInt(r.pointsCost)} puntos
                      </small>
                    </span>
                    {busy === r.id ? <span className="muted small">Generando…</span> : <BadgeCheck size={20} aria-hidden />}
                  </button>
                </li>
              )
            })}
          </ul>
        </Modal>
      )}
    </section>
  )
}
