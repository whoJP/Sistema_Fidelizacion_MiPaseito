import { useEffect, useState } from 'react'
import { CheckCircle2, Clock, Lock, MapPin, TimerOff } from 'lucide-react'
import { ClubGem } from '../../components/BrandMark'
import { Sparks } from '../../components/Sparks'
import { haptic } from '../../lib/motion'
import { useDb } from '../../data/store'
import { redemptionExpiresAt } from '../../data/actions'
import { MemberCard } from '../../components/MemberCard'
import { TierChip } from '../../components/TierIcon'
import {
  currentTier,
  pointsBalance,
  rewardBlocker,
  rewardConditions,
  rewardRemainingStock,
  rewardTitle,
  visibleRewards,
} from '../../domain/loyalty'
import { businessLocation, formatCountdown, formatDateTime, formatInt } from '../../lib/format'
import { useNow } from '../../lib/useNow'
import { useUser } from '../../session'
import type { Redemption, Reward } from '../../types/domain'
import { Badge, Card, Empty, Modal, PageHeader, Progress, TimeBar, flash, rowOf, run } from '../../components/ui'
import { confirmDialog } from '../../components/dialog'
const STATUS_LABEL: Record<Redemption['status'], [string, 'accent' | 'success' | 'neutral' | 'danger']> = {
  PENDING: ['Pendiente', 'accent'],
  REDEEMED: ['Canjeado', 'success'],
  EXPIRED: ['Expirado', 'neutral'],
  CANCELLED: ['Cancelado', 'danger'],
}

const ORIGIN_LABEL: Record<Exclude<Redemption['origin'], 'POINTS'>, string> = {
  PRIZE: 'Premio de la ruleta',
  BIRTHDAY: 'Regalo de cumpleaños',
}

/** Gifts last days; point redemptions last minutes and show a countdown. */
const LONG_VALIDITY_MS = 60 * 60_000

export function RewardsPage() {
  const db = useDb()
  const user = useUser()
  const [confirm, setConfirm] = useState<Reward | null>(null)
  const [showing, setShowing] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  const redeem = async (reward: Reward) => {
    setBusy(true)
    const r = await run('createRedemption', { rewardId: reward.id }, 'Canje generado')
    setBusy(false)
    setConfirm(null)
    if (r) setShowing(r.id)
  }

  const cancel = async (r: Redemption, trigger: HTMLElement) => {
    const row = rowOf(trigger)
    const ok = await confirmDialog({
      title: '¿Cancelar este canje?',
      message: `El código dejará de funcionar y te devolvemos ${formatInt(r.pointsSpent)} puntos.`,
      confirmLabel: 'Cancelar canje',
      cancelLabel: 'Volver',
      tone: 'danger',
    })
    if (ok && (await run('cancelRedemption', { redemptionId: r.id }, 'Canje cancelado, puntos devueltos'))) flash(row)
  }
  const balance = pointsBalance(db, user.id)
  const redemptionMinutes = Math.round(redemptionExpiresAt(db, new Date(0).toISOString()).getTime() / 60_000)

  const [businessId, setBusinessId] = useState<number | null>(null)
  const available = visibleRewards(db).sort((a, b) => a.pointsCost - b.pointsCost)
  const rewards = available.filter((r) => businessId === null || r.businessId === businessId)
  const businessesWithRewards = [...new Set(available.map((r) => r.businessId))]
    .map((id) => db.businesses.find((b) => b.id === id)!)
    .sort((a, b) => a.name.localeCompare(b.name))
  const mine = db.redemptions
    .filter((r) => r.userId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const titleOf = (rewardId: number) => {
    const reward = db.rewards.find((x) => x.id === rewardId)
    return reward ? rewardTitle(db, reward) : 'Recompensa'
  }
  const whereLabel = (rewardId: number) => {
    const business = db.businesses.find((b) => b.id === db.rewards.find((r) => r.id === rewardId)?.businessId)
    if (!business) return ''
    const location = businessLocation(business)
    return location ? `${business.name} · ${location}` : business.name
  }

  return (
    <div className="page">
      <PageHeader
        title="Recompensas"
        actions={
          <span className="balance-pill">
            <ClubGem size={15} /> <b className="tabular">{formatInt(balance)}</b> pts
          </span>
        }
      />

      {businessesWithRewards.length > 1 && (
        <div className="chips chips-scroll">
          <button className={`chip ${businessId === null ? 'chip-active' : ''}`} onClick={() => setBusinessId(null)}>
            Todos
          </button>
          {businessesWithRewards.map((b) => (
            <button key={b.id} className={`chip ${businessId === b.id ? 'chip-active' : ''}`} onClick={() => setBusinessId(b.id)}>
              {b.name}
            </button>
          ))}
        </div>
      )}

      {rewards.length === 0 ? (
        <Empty>Pronto habrá recompensas</Empty>
      ) : (
        <div className="cards-grid rewards-grid">
          {rewards.map((reward) => {
            const blocker = rewardBlocker(db, reward, user.id)
            const tier = reward.minimumTierId ? db.tiers.find((t) => t.id === reward.minimumTierId) : null
            const stock = rewardRemainingStock(db, reward)
            const business = db.businesses.find((b) => b.id === reward.businessId)
            const conditions = [...rewardConditions(db, reward), reward.description].filter(Boolean)
            return (
              <Card key={reward.id} className={`reward ${blocker === null ? 'is-ready' : ''}`}>
                <div className="reward-top">
                  <strong className="reward-cost">
                    {formatInt(reward.pointsCost)}
                    <small>pts</small>
                  </strong>
                  {tier ? (
                    <span className="row gap">
                      {blocker === 'TIER' && <Lock size={13} className="muted" aria-label="Bloqueada" />}
                      <TierChip tier={tier} small />
                    </span>
                  ) : (
                    stock !== null && stock <= 10 && <Badge tone="warning">Quedan {stock}</Badge>
                  )}
                </div>
                <h3>{rewardTitle(db, reward)}</h3>
                <p className="reward-where">
                  <MapPin size={13} aria-hidden /> {business?.name}
                </p>
                {conditions.length > 0 && <p className="reward-cond">{conditions.join(' · ')}</p>}
                {blocker === 'POINTS' && <Progress value={balance} max={reward.pointsCost} />}
                <button className={`btn btn-block ${blocker === null ? 'btn-primary' : ''}`} disabled={blocker !== null} onClick={() => setConfirm(reward)}>
                  {blocker === 'POINTS'
                    ? `Faltan ${formatInt(reward.pointsCost - balance)}`
                    : blocker === 'TIER'
                      ? `Nivel ${tier?.name}`
                      : blocker === 'STOCK'
                        ? 'Agotado'
                        : 'Canjear'}
                </button>
              </Card>
            )
          })}
        </div>
      )}

      <h2 className="section-title">Mis canjes</h2>
      {mine.length === 0 ? (
        <Empty>Aún sin canjes</Empty>
      ) : (
        <Card>
          <ul className="list">
            {mine.map((r) => {
              const business = db.businesses.find((b) => b.id === db.rewards.find((x) => x.id === r.rewardId)?.businessId)
              const [label, tone] = STATUS_LABEL[r.status]
              return (
                <li key={r.id} className="list-row">
                  <div>
                    <strong>{titleOf(r.rewardId)}</strong>
                    <div className="muted small">
                      {business?.name} · {r.origin === 'POINTS' ? `${formatInt(r.pointsSpent)} puntos` : ORIGIN_LABEL[r.origin]}
                    </div>
                    <div className="muted small">
                      {r.status === 'PENDING' ? <ExpiresIn redemption={r} /> : formatDateTime(r.redeemedAt ?? r.createdAt)}
                    </div>
                  </div>
                  <div className="row gap">
                    <Badge tone={tone}>{label}</Badge>
                    {r.status === 'PENDING' && (
                      <>
                        <button className="btn btn-primary btn-sm" onClick={() => setShowing(r.id)}>
                          Usar
                        </button>
                        {r.origin === 'POINTS' && (
                          <button className="btn btn-ghost btn-sm" onClick={(e) => cancel(r, e.currentTarget)}>
                            Cancelar
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {confirm && (
        <Modal title="Confirmar canje" onClose={() => setConfirm(null)}>
          <div className="redeem-sum">
            <h3>{rewardTitle(db, confirm)}</h3>
            <span className="reward-where">
              <MapPin size={13} aria-hidden /> {whereLabel(confirm.id)}
            </span>
            {[...rewardConditions(db, confirm), confirm.description].filter(Boolean).map((c) => (
              <span key={c} className="muted small">
                {c}
              </span>
            ))}
            <div className="redeem-math">
              <span>
                <b className="tabular">−{formatInt(confirm.pointsCost)}</b> pts
              </span>
              <span className="muted">
                Te quedan <b className="tabular">{formatInt(balance - confirm.pointsCost)}</b>
              </span>
            </div>
            <span className="redeem-note">
              <Clock size={14} aria-hidden /> Válido {redemptionMinutes} min · canjea ya en el local
            </span>
          </div>
          <div className="row end gap">
            <button className="btn btn-ghost" onClick={() => setConfirm(null)}>
              Volver
            </button>
            <button className="btn btn-primary" disabled={busy} onClick={() => redeem(confirm)}>
              Canjear
            </button>
          </div>
        </Modal>
      )}

      {showing !== null && (
        <Modal title="Usar en el local" onClose={() => setShowing(null)}>
          <RedemptionPass redemptionId={showing} title={titleOf} where={whereLabel} onClose={() => setShowing(null)} />
        </Modal>
      )}
    </div>
  )
}

/** Live QR for a redemption: counts down, and switches to the final state when validated or expired. */
function RedemptionPass({
  redemptionId,
  title,
  where,
  onClose,
}: {
  redemptionId: number
  title: (rewardId: number) => string
  where: (rewardId: number) => string
  onClose: () => void
}) {
  const db = useDb()
  const user = useUser()
  const now = useNow(500)
  const r = db.redemptions.find((x) => x.id === redemptionId)
  const validated = r?.status === 'REDEEMED'
  useEffect(() => {
    if (validated) haptic([18, 60, 18, 60, 40])
  }, [validated])
  if (!r) return null
  const created = new Date(r.createdAt).getTime()
  const expires = redemptionExpiresAt(db, r.createdAt, r.expiresAt).getTime()
  const expired = r.status === 'EXPIRED' || (r.status === 'PENDING' && now >= expires)
  const gift = r.origin !== 'POINTS'

  if (r.status === 'REDEEMED')
    return (
      <div className="stack center pass-done">
        <span className="pass-icon is-success is-celebrating" aria-hidden>
          <CheckCircle2 size={32} />
          <Sparks count={16} spread={64} />
        </span>
        <h3>¡Canje validado!</h3>
        <p className="muted">
          Disfruta tu <b>{title(r.rewardId)}</b>
        </p>
        <button className="btn btn-primary" onClick={onClose}>
          Listo
        </button>
      </div>
    )

  if (expired || r.status === 'CANCELLED')
    return (
      <div className="stack center pass-done">
        <span className="pass-icon" aria-hidden>
          <TimerOff size={32} />
        </span>
        <h3>{r.status === 'CANCELLED' ? 'Canje cancelado' : gift ? 'Este regalo venció' : 'El código expiró'}</h3>
        <p className="muted">
          {gift
            ? '¡Que no se te pase el próximo!'
            : r.status === 'EXPIRED' || r.status === 'CANCELLED'
              ? `Recuperaste ${formatInt(r.pointsSpent)} pts`
              : `Devolviendo ${formatInt(r.pointsSpent)} pts…`}
        </p>
        <button className="btn" onClick={onClose}>
          Cerrar
        </button>
      </div>
    )

  return (
    <div className="stack center">
      <h3>{title(r.rewardId)}</h3>
      <p className="muted small">
        Muestra tu tarjeta en <b>{where(r.rewardId)}</b>
      </p>
      <div className="pass-card">
        <MemberCard user={user} tier={currentTier(db, user.id)} points={pointsBalance(db, user.id)} revealed locked onToggle={() => {}} />
      </div>
      {gift && expires - now > LONG_VALIDITY_MS ? (
        <p className="small">
          {ORIGIN_LABEL[r.origin as keyof typeof ORIGIN_LABEL]} · válido hasta el <b>{formatDateTime(new Date(expires).toISOString())}</b>
        </p>
      ) : (
        <div className="pass-timer">
          <div className="row between small">
            <span className="muted">Vence en</span>
            <strong className="tabular">{formatCountdown(expires - now)}</strong>
          </div>
          <TimeBar key={r.id} start={created} end={expires} now={now} />
        </div>
      )}
      <p className="muted small">{gift ? 'Regalo · no usa tus puntos' : 'Si vence, recuperas tus puntos'}</p>
      <p className="pass-fallback small">
        Código <code className="token">{r.verificationToken}</code>
      </p>
    </div>
  )
}

function ExpiresIn({ redemption: r }: { redemption: Redemption }) {
  const db = useDb()
  const now = useNow(1000)
  const expires = redemptionExpiresAt(db, r.createdAt, r.expiresAt)
  const left = expires.getTime() - now
  if (left > LONG_VALIDITY_MS) return <>Válido hasta el {formatDateTime(expires.toISOString())}</>
  if (left > 0) return <>Vence en {formatCountdown(left)}</>
  return <>{r.origin === 'POINTS' ? 'Expiró · puntos devueltos' : 'Venció'}</>
}
