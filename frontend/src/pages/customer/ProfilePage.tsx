import { CalendarDays, MapPin } from 'lucide-react'
import { useDb } from '../../data/store'
import {
  attendedEventIds,
  badgeProgress,
  completedTransactions,
  earnedBadges,
  isEventOpen,
  pointsBalance,
  statusTotal,
  tierForStatus,
  upcomingEvents,
  visibleBadges,
} from '../../domain/loyalty'
import { todayKey } from '../../domain/time'
import { formatDate, formatDateKey, formatDateTime, formatInt } from '../../lib/format'
import { useUser } from '../../session'
import type { Badge as BadgeDef, Database } from '../../types/domain'
import { BadgeMedal } from '../../components/BadgeMedal'
import { Badge, Card, Empty, PageHeader, Progress, Stat } from '../../components/ui'

function pendingHint(db: Database, badge: BadgeDef, current: number, goal: number): string {
  switch (badge.type) {
    case 'SPECIAL_DATE':
      return `Visita el Paseo el ${formatDateKey(badge.date!)}`
    case 'TIER_REACHED':
      return `Te faltan ${formatInt(goal - current)} puntos de nivel`
    case 'CATEGORY_PURCHASES':
      return `${formatInt(current)}/${formatInt(goal)} compras en ${db.categories.find((c) => c.id === badge.categoryId)?.name ?? 'la categoría'}`
    case 'PURCHASE_COUNT':
      return `${formatInt(current)}/${formatInt(goal)} compras`
    case 'DISTINCT_BUSINESSES':
      return `${formatInt(current)}/${formatInt(goal)} establecimientos`
    case 'MISSIONS_COMPLETED':
      return `${formatInt(current)}/${formatInt(goal)} misiones`
  }
}

export function ProfilePage() {
  const db = useDb()
  const user = useUser()
  const status = statusTotal(db, user.id)
  const tier = tierForStatus(db, status)
  const earned = earnedBadges(db, user.id)
  const attended = attendedEventIds(db, user.id)
  const today = todayKey()
  const txs = completedTransactions(db, user.id)

  const pending = visibleBadges(db)
    .map((badge) => ({ badge, ...badgeProgress(db, badge, user.id) }))
    .filter((b) => !b.earnedAt && !(b.badge.type === 'SPECIAL_DATE' && b.badge.date! < today))
    .sort((a, b) => b.current / b.goal - a.current / a.goal)
  const events = upcomingEvents(db).filter((e) => !attended.has(e.id))
  const totalAvailable = earned.length + pending.length + events.length

  return (
    <div className="page">
      <PageHeader title="Mi perfil" subtitle="Tus datos, tus insignias y los eventos donde puedes ganar más." />

      <div className="detail-grid">
        <Card className="card-gold">
          <div className="row between align-start">
            <div>
              <h2>
                {user.firstName} {user.lastName}
              </h2>
              <div className="muted small">{user.email}</div>
              {user.phone && <div className="muted small">{user.phone}</div>}
              <div className="muted small">Cliente desde {formatDate(user.createdAt)}</div>
            </div>
            <span className={`tier-chip tier-${(tier?.name ?? 'none').toLowerCase()}`}>{tier?.name ?? 'Sin nivel'}</span>
          </div>
        </Card>
        <div className="stats-row">
          <Stat label="Puntos" value={formatInt(pointsBalance(db, user.id))} />
          <Stat label="Puntos de nivel" value={formatInt(status)} />
          <Stat label="Insignias" value={`${earned.length} / ${totalAvailable}`} />
          <Stat label="Compras" value={formatInt(txs.length)} hint={`en ${new Set(txs.map((t) => t.businessId)).size} establecimientos`} />
        </div>
      </div>

      {events.length > 0 && (
        <>
          <h2 className="section-title">Próximos eventos del Paseo</h2>
          <div className="cards-grid">
            {events.map((e) => (
              <Card key={e.id}>
                <div className="row between">
                  {isEventOpen(e) ? <Badge tone="success">En curso</Badge> : <Badge>Próximamente</Badge>}
                  {e.pointsReward > 0 && <Badge tone="accent">+{formatInt(e.pointsReward)} puntos</Badge>}
                </div>
                <h3>{e.name}</h3>
                {e.description && <p className="muted small">{e.description}</p>}
                <div className="small row gap">
                  <CalendarDays size={14} aria-hidden /> {formatDateTime(e.startsAt)} - {formatDateTime(e.endsAt)}
                </div>
                {e.location && (
                  <div className="small row gap">
                    <MapPin size={14} /> {e.location}
                  </div>
                )}
                <p className="small">Muestra tu código QR en el ingreso para ganar los puntos y la insignia del evento.</p>
              </Card>
            ))}
          </div>
        </>
      )}

      <h2 className="section-title">Mis insignias</h2>
      {earned.length === 0 ? (
        <Empty>Aún no tienes insignias. Compra en el Paseo, asiste a eventos y completa misiones para ganarlas.</Empty>
      ) : (
        <div className="medals">
          {earned.map((b) => (
            <BadgeMedal key={b.key} kind={b.kind} name={b.name} description={b.description} earned footer={`Obtenida el ${formatDate(b.earnedAt)}`} />
          ))}
        </div>
      )}

      {pending.length > 0 && (
        <>
          <h2 className="section-title">Por conseguir</h2>
          <div className="medals">
            {pending.map(({ badge, current, goal }) => (
              <BadgeMedal
                key={badge.id}
                kind={badge.type}
                name={badge.name}
                description={badge.description}
                earned={false}
                footer={
                  <>
                    {pendingHint(db, badge, current, goal)}
                    {badge.type !== 'SPECIAL_DATE' && <Progress value={current} max={goal} />}
                  </>
                }
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
