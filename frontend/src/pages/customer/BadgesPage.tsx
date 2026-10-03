import { useDb } from '../../data/store'
import { attendedEventIds, badgeHint, completedTransactions, earnedBadges, pendingBadges, statusTotal, tierForStatus, upcomingEvents } from '../../domain/loyalty'
import { formatDate, formatInt, plural } from '../../lib/format'
import { useUser } from '../../session'
import { BadgeMedal } from '../../components/BadgeMedal'
import { EventCard } from '../../components/EventCard'
import { Empty, PageHeader, Progress, Stat } from '../../components/ui'

export function BadgesPage() {
  const db = useDb()
  const user = useUser()
  const tier = tierForStatus(db, statusTotal(db, user.id))
  const earned = earnedBadges(db, user.id)
  const attended = attendedEventIds(db, user.id)
  const txs = completedTransactions(db, user.id)

  const pending = pendingBadges(db, user.id)
  const events = upcomingEvents(db).filter((e) => !attended.has(e.id))
  const totalAvailable = earned.length + pending.length + events.length

  return (
    <div className="page">
      <PageHeader title="Insignias" subtitle="Tu colección y los eventos del Paseo donde puedes ganar más." />

      <div className="stats-row">
        <Stat label="Insignias" value={`${earned.length} de ${totalAvailable}`} />
        <Stat label="Nivel" value={tier?.name ?? 'Sin nivel'} />
        <Stat label="Eventos asistidos" value={formatInt(attended.size)} />
        <Stat label="Compras" value={formatInt(txs.length)} hint={`en ${plural(new Set(txs.map((t) => t.businessId)).size, 'establecimiento', 'establecimientos')}`} />
      </div>

      {events.length > 0 && (
        <>
          <h2 className="section-title">Próximos eventos del Paseo</h2>
          <div className="events events-grid">
            {events.map((e) => (
              <EventCard key={e.id} event={e} />
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
                    {badgeHint(db, badge, current, goal)}
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
