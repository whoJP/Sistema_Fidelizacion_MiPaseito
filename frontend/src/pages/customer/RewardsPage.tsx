import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Lock } from 'lucide-react'
import { useDb } from '../../data/store'
import { redemptionExpiresAt } from '../../data/actions'
import {
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
import { Badge, Card, Empty, Modal, PageHeader, run } from '../../components/ui'
import { businessLocation } from './DirectoryPage'

const STATUS_LABEL: Record<Redemption['status'], [string, 'accent' | 'success' | 'neutral' | 'danger']> = {
  PENDING: ['Pendiente', 'accent'],
  REDEEMED: ['Canjeado', 'success'],
  EXPIRED: ['Expirado', 'neutral'],
  CANCELLED: ['Cancelado', 'danger'],
}

export function RewardsPage() {
  const db = useDb()
  const user = useUser()
  const [confirm, setConfirm] = useState<Reward | null>(null)
  const [showing, setShowing] = useState<Redemption | null>(null)
  const [busy, setBusy] = useState(false)

  const redeem = async (reward: Reward) => {
    setBusy(true)
    const r = await run('createRedemption', { rewardId: reward.id }, 'Canje generado')
    setBusy(false)
    setConfirm(null)
    if (r) setShowing(r)
  }
  const balance = pointsBalance(db, user.id)

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
                  <strong className="reward-cost">{formatInt(reward.pointsCost)} puntos</strong>
                  {tier && (
                    <Badge tone={blocker === 'TIER' ? 'warning' : 'neutral'}>
                      {blocker === 'TIER' && <Lock size={12} />} {tier.name}+
                    </Badge>
                  )}
                </div>
                <h3>{rewardTitle(db, reward)}</h3>
                <p className="small">
                  <b>{whereLabel(reward.id)}</b>
                </p>
                {[...rewardConditions(db, reward), reward.description].filter(Boolean).map((c) => (
                  <p key={c} className="muted small">
                    {c}
                  </p>
                ))}
                {stock !== null && <p className="small muted">Quedan {stock}</p>}
                <button className="btn btn-primary btn-block" disabled={blocker !== null} onClick={() => setConfirm(reward)}>
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
                      {business?.name} · {formatInt(r.pointsSpent)} puntos · {formatDateTime(r.createdAt)}
                      {r.status === 'PENDING' && ` · vence ${formatDateTime(redemptionExpiresAt(db, r.createdAt).toISOString())}`}
                    </div>
                  </div>
                  <div className="row gap">
                    <Badge tone={tone}>{label}</Badge>
                    {r.status === 'PENDING' && (
                      <>
                        <button className="btn btn-sm" onClick={() => setShowing(r)}>
                          Mostrar código
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => run('cancelRedemption', { redemptionId: r.id }, 'Canje cancelado, puntos devueltos')}
                        >
                          Cancelar
                        </button>
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
          <p className="muted small">Recibirás un código para presentar en el establecimiento. Si no lo usas a tiempo, los puntos se devuelven.</p>
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

      {showing && (
        <Modal title="Código de canje" onClose={() => setShowing(null)}>
          <div className="stack center">
            <div className="qr-box">
              <QRCodeSVG value={showing.verificationToken} size={180} />
            </div>
            <code className="token token-lg">{showing.verificationToken}</code>
            <strong>{titleOf(showing.rewardId)}</strong>
            <p className="muted small">
              Preséntalo en {whereLabel(showing.rewardId)}. Vence el{' '}
              {formatDateTime(redemptionExpiresAt(db, showing.createdAt).toISOString())}.
            </p>
          </div>
        </Modal>
      )}
    </div>
  )
}
