import { useDb } from '../../data/store'
import { statusRanking, type RankingRow } from '../../domain/engagement'
import { statusTotal, tierForStatus } from '../../domain/loyalty'
import { formatInt } from '../../lib/format'
import { useNow } from '../../lib/useNow'
import { useUser } from '../../session'
import type { Database } from '../../types/domain'
import { Card, Empty, PageHeader, Stat } from '../../components/ui'

const TOP = 10

/** Other customers are shown by first name and last-name initial only. */
const shortName = (u: RankingRow['user']) => `${u.firstName} ${u.lastName.charAt(0)}.`

function Row({ db, row, me }: { db: Database; row: RankingRow; me: boolean }) {
  const tier = tierForStatus(db, statusTotal(db, row.user.id))
  return (
    <li className={`list-row rank-row ${me ? 'is-me' : ''}`} aria-current={me ? 'true' : undefined}>
      <span className={`rank-pos tabular ${row.position <= 3 ? 'is-podium' : ''}`}>{row.position}</span>
      <div className="rank-who">
        <strong>
          {shortName(row.user)}
          {me && <span className="muted"> (tú)</span>}
        </strong>
        {tier && <span className={`tier-chip tier-${tier.name.toLowerCase()}`}>{tier.name}</span>}
      </div>
      <span className="rank-points tabular">{formatInt(row.status)}</span>
    </li>
  )
}

export function RankingPage() {
  const db = useDb()
  const user = useUser()
  const ranking = statusRanking(db, new Date(useNow(60_000)))
  const mine = ranking.find((r) => r.user.id === user.id)
  const top = ranking.slice(0, TOP)

  return (
    <div className="page">
      <PageHeader title="Ranking" subtitle="Clientes que más puntos de nivel ganaron en los últimos 30 días. Canjear no te baja de puesto." />

      <div className="stats-row">
        <Stat label="Tu posición" value={mine ? `#${mine.position}` : '-'} hint={mine ? `de ${formatInt(ranking.length)}` : 'Haz una compra para entrar'} />
        <Stat label="Tus puntos de nivel" value={formatInt(mine?.status ?? 0)} hint="últimos 30 días" />
      </div>

      <Card>
        <div className="row between">
          <h2>Top {TOP}</h2>
          <span className="small muted">Puntos de nivel</span>
        </div>
        {top.length === 0 ? (
          <Empty>Todavía nadie sumó puntos de nivel en los últimos 30 días.</Empty>
        ) : (
          <ol className="list">
            {top.map((row) => (
              <Row key={row.user.id} db={db} row={row} me={row.user.id === user.id} />
            ))}
            {mine && !top.includes(mine) && (
              <>
                <li className="rank-gap" aria-hidden>
                  ···
                </li>
                <Row db={db} row={mine} me />
              </>
            )}
          </ol>
        )}
      </Card>
    </div>
  )
}
