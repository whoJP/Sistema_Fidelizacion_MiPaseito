import { useState } from 'react'
import { CheckCircle2, Lock, TimerOff } from 'lucide-react'
import { useDb } from '../../data/store'
import { redemptionExpiresAt } from '../../data/actions'
import { MemberCard } from '../../components/MemberCard'
import {
  currentTier,
  pointsBalance,
  rewardBlocker,
  rewardConditions,
  rewardRemainingStock,
  rewardTitle,
  visibleRewards,
} from '../../domain/loyalty'
import { formatDateTime, formatInt } from '../../lib/format'
import { useUser } from '../../session'
import type { Redemption, Reward } from '../../types/domain'
import { Badge, Card, Empty, Modal, PageHeader, TimeBar, flash, formatCountdown, rowOf, run, useNow } from '../../components/ui'
import { confirmDialog } from '../../components/dialog'
import { businessLocation } from './DirectoryPage'

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
      <PageHeader title="Recompensas" subtitle={<>Tienes <b>{formatInt(balance)}</b> puntos disponibles. Cada recompensa se canjea en su establecimiento.</>} />

      {businessesWithRewards.length > 1 && (
        <div className="chips">
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
        <Empty>Aún no hay recompensas publicadas.</Empty>
      ) : (
        <div className="cards-grid">
          {rewards.map((reward) => {
            const blocker = rewardBlocker(db, reward, user.id)
            const tier = reward.minimumTierId ? db.tiers.find((t) => t.id === reward.minimumTierId) : null
            const stock = rewardRemainingStock(db, reward)
            return (
              <Card key={reward.id} className="reward">
                <div className="row between">
                  <strong className="reward-cost">
                    {formatInt(reward.pointsCost)}
                    <small>puntos</small>
                  </strong>
                  {tier && (
                    <Badge tone={blocker === 'TIER' ? 'warning' : 'neutral'}>
                      {blocker === 'TIER' && <Lock size={12} aria-hidden />} {tier.name}+
                    </Badge>
                  )}
                </div>
                <h3>{rewardTitle(db, reward)}</h3>
                <p className="reward-where">{whereLabel(reward.id)}</p>
                {[...rewardConditions(db, reward), reward.description].filter(Boolean).map((c) => (
                  <p key={c} className="muted small">
                    {c}
                  </p>
                ))}
                {stock !== null && <p className="small muted">Quedan {stock}</p>}
                <button className="btn btn-block" disabled={blocker !== null} onClick={() => setConfirm(reward)}>
                  {blocker === 'POINTS'
                    ? `Te faltan ${formatInt(reward.pointsCost - balance)} puntos`
                    : blocker === 'TIER'
                      ? `Requiere nivel ${tier?.name}`
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
        <Empty>Todavía no has canjeado recompensas.</Empty>
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
                        <button className="btn btn-sm" onClick={() => setShowing(r.id)}>
                          Usar en el local
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
          <p>
            Vas a canjear <b>{rewardTitle(db, confirm)}</b> en <b>{whereLabel(confirm.id)}</b> por <b>{formatInt(confirm.pointsCost)} puntos</b>. Te
            quedarán {formatInt(balance - confirm.pointsCost)} puntos.
          </p>
          <p className="muted small">
            Tendrás {redemptionMinutes} minutos para mostrar tu tarjeta en el establecimiento: canjea cuando ya estés ahí. Si no se usa a tiempo, los
            puntos vuelven a tu saldo.
          </p>
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
  if (!r) return null
  const created = new Date(r.createdAt).getTime()
  const expires = redemptionExpiresAt(db, r.createdAt, r.expiresAt).getTime()
  const expired = r.status === 'EXPIRED' || (r.status === 'PENDING' && now >= expires)
  const gift = r.origin !== 'POINTS'

  if (r.status === 'REDEEMED')
    return (
      <div className="stack center pass-done">
        <span className="pass-icon is-success" aria-hidden>
          <CheckCircle2 size={32} />
        </span>
        <h3>¡Canje validado!</h3>
        <p className="muted">
          Disfruta tu <b>{title(r.rewardId)}</b> en {where(r.rewardId)}.
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
            ? 'Los regalos tienen fecha de vencimiento. ¡Que no se te pase el próximo!'
            : r.status === 'EXPIRED' || r.status === 'CANCELLED'
              ? `Te devolvimos ${formatInt(r.pointsSpent)} puntos. Puedes volver a canjear cuando estés en el establecimiento.`
              : `Estamos devolviendo tus ${formatInt(r.pointsSpent)} puntos; se verán en tu saldo en unos segundos.`}
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
        Muestra tu tarjeta en <b>{where(r.rewardId)}</b>: al escanearla verán este canje y lo validan.
      </p>
      <div className="pass-card">
        <MemberCard user={user} tierName={currentTier(db, user.id)?.name ?? null} points={pointsBalance(db, user.id)} revealed locked onToggle={() => {}} />
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
      <p className="muted small">
        {gift ? 'Es un regalo: no usa tus puntos.' : `Si no se usa a tiempo, los ${formatInt(r.pointsSpent)} puntos vuelven a tu saldo.`}
      </p>
      <p className="pass-fallback small">
        ¿No pueden escanear? Dicta el código del canje <code className="token">{r.verificationToken}</code>
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
  return <>{r.origin === 'POINTS' ? 'Expiró, tus puntos vuelven a tu saldo' : 'Venció'}</>
}
