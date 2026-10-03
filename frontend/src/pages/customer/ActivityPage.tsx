import { useState } from 'react'
import { useDb } from '../../data/store'
import { pointsBalance, purchaseLines, rewardTitle, statusTotal } from '../../domain/loyalty'
import {
  POINT_MOVEMENT_LABELS,
  STATUS_MOVEMENT_LABELS,
  formatDateTime,
  formatInt,
  formatMoney,
  signed,
} from '../../lib/format'
import { useUser } from '../../session'
import type { Database } from '../../types/domain'
import { Badge, Card, Empty, PageHeader } from '../../components/ui'

type Tab = 'points' | 'status' | 'purchases' | 'notices'

function movementDetail(
  db: Database,
  m: { transactionId: number | null; missionId: number | null; redemptionId?: number | null; promotionId?: number | null; eventId?: number | null },
) {
  if (m.promotionId) return db.promotions.find((p) => p.id === m.promotionId)?.name
  if (m.missionId) return db.missions.find((x) => x.id === m.missionId)?.name
  if (m.eventId) return db.events.find((x) => x.id === m.eventId)?.name
  if (m.redemptionId) {
    const r = db.redemptions.find((x) => x.id === m.redemptionId)
    const reward = db.rewards.find((x) => x.id === r?.rewardId)
    const business = db.businesses.find((b) => b.id === reward?.businessId)
    return reward && (business ? `${rewardTitle(db, reward)} en ${business.name}` : rewardTitle(db, reward))
  }
  if (m.transactionId) {
    const t = db.transactions.find((x) => x.id === m.transactionId)
    return db.businesses.find((b) => b.id === t?.businessId)?.name
  }
  return undefined
}

export function ActivityPage() {
  const db = useDb()
  const user = useUser()
  const [tab, setTab] = useState<Tab>('points')

  const points = db.pointMovements.filter((m) => m.userId === user.id).sort((a, b) => b.id - a.id)
  const status = db.statusMovements.filter((m) => m.userId === user.id).sort((a, b) => b.id - a.id)
  const purchases = db.transactions.filter((t) => t.customerId === user.id).sort((a, b) => b.id - a.id)
  const notices = db.notifications.filter((n) => n.userId === user.id).sort((a, b) => b.id - a.id)
  const lines = (transactionId: number) =>
    purchaseLines(db, transactionId)
      .map((l) => `${formatInt(l.quantity)} × ${l.name}`)
      .join(', ')

  return (
    <div className="page">
      <PageHeader
        title="Actividad"
        subtitle={
          <>
            Tienes <b>{formatInt(pointsBalance(db, user.id))}</b> puntos para canjear y <b>{formatInt(statusTotal(db, user.id))}</b> puntos de nivel.
          </>
        }
      />
      <div className="tabs">
        {(
          [
            ['points', 'Puntos'],
            ['status', 'Puntos de nivel'],
            ['purchases', 'Compras'],
            ['notices', 'Avisos'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} className={tab === id ? 'tab tab-active' : 'tab'} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      <Card>
        {tab === 'points' &&
          (points.length === 0 ? (
            <Empty>Sin movimientos de puntos.</Empty>
          ) : (
            <ul className="list">
              {points.map((m) => (
                <li key={m.id} className="list-row">
                  <div>
                    <strong>{POINT_MOVEMENT_LABELS[m.type]}</strong>
                    <div className="muted small">
                      {[movementDetail(db, m), formatDateTime(m.createdAt)].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <strong className={m.amount >= 0 ? 'success' : 'danger'}>{signed(m.amount)}</strong>
                </li>
              ))}
            </ul>
          ))}

        {tab === 'status' &&
          (status.length === 0 ? (
            <Empty>Sin movimientos de puntos de nivel.</Empty>
          ) : (
            <ul className="list">
              {status.map((m) => (
                <li key={m.id} className="list-row">
                  <div>
                    <strong>{STATUS_MOVEMENT_LABELS[m.type]}</strong>
                    <div className="muted small">
                      {[movementDetail(db, m), formatDateTime(m.createdAt)].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <strong className={m.amount >= 0 ? 'success' : 'danger'}>{signed(m.amount)}</strong>
                </li>
              ))}
            </ul>
          ))}

        {tab === 'purchases' &&
          (purchases.length === 0 ? (
            <Empty>Aún no registras compras.</Empty>
          ) : (
            <ul className="list">
              {purchases.map((t) => {
                const earned = db.pointMovements
                  .filter((m) => m.transactionId === t.id)
                  .reduce((s, m) => s + m.amount, 0)
                return (
                  <li key={t.id} className="list-row">
                    <div>
                      <strong>{db.businesses.find((b) => b.id === t.businessId)?.name}</strong>
                      <div className="muted small">{formatDateTime(t.createdAt)}</div>
                      {lines(t.id) && <div className="muted small">{lines(t.id)}</div>}
                    </div>
                    <div className="row gap">
                      {t.status !== 'COMPLETED' && (
                        <Badge tone={t.status === 'FLAGGED' ? 'warning' : 'danger'}>
                          {t.status === 'FLAGGED' ? 'En revisión' : 'Anulada'}
                        </Badge>
                      )}
                      <span>{formatMoney(t.amount)}</span>
                      <strong className="success">{signed(earned)} puntos</strong>
                    </div>
                  </li>
                )
              })}
            </ul>
          ))}

        {tab === 'notices' &&
          (notices.length === 0 ? (
            <Empty>No tienes avisos.</Empty>
          ) : (
            <ul className="list">
              {notices.map((n) => (
                <li key={n.id} className="list-row">
                  <div className="stack-sm">
                    <strong>{n.title}</strong>
                    <span className="small">{n.message}</span>
                    <span className="muted small">{formatDateTime(n.createdAt)}</span>
                  </div>
                  {n.readAt === null && <Badge tone="accent">Nuevo</Badge>}
                </li>
              ))}
            </ul>
          ))}
      </Card>
    </div>
  )
}
