import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { ChevronsUp, Crown, ShoppingBag, TrendingUp } from 'lucide-react'
import { useDb } from '../../data/store'
import { statusRanking, type RankingRow } from '../../domain/engagement'
import { getSetting, statusTotal, tierForStatus } from '../../domain/loyalty'
import { formatInt, formatMoney, plural } from '../../lib/format'
import { useNow } from '../../lib/useNow'
import { useUser } from '../../session'
import type { Database } from '../../types/domain'
import { CountUp, Empty } from '../../components/ui'
import { TierIcon } from '../../components/TierIcon'

const TOP = 10

/** Other customers are shown by first name and last-name initial only. */
const shortName = (u: RankingRow['user']) => `${u.firstName} ${u.lastName.charAt(0)}.`

const PODIUM_ORDER = [1, 0, 2]
const METALS = ['gold', 'silver', 'bronze'] as const

function Avatar({ db, row, size }: { db: Database; row: RankingRow; size?: number }) {
  const tier = tierForStatus(db, statusTotal(db, row.user.id))
  return (
    <span className="rk-avatar" style={size ? ({ '--s': `${size}px` } as CSSProperties) : undefined}>
      <span aria-hidden>{row.user.firstName.charAt(0)}</span>
      {tier && <TierIcon tier={tier} size={Math.max(18, Math.round((size ?? 56) * 0.38))} className="rk-avatar-tier" />}
    </span>
  )
}

function Podium({ db, rows, meId }: { db: Database; rows: RankingRow[]; meId: number }) {
  return (
    <ol className="rk-podium" aria-label="Podio">
      {PODIUM_ORDER.map((i) => {
        const row = rows[i]
        if (!row) return <li key={i} className="rk-step is-empty" aria-hidden />
        const me = row.user.id === meId
        return (
          <li
            key={row.user.id}
            className={`rk-step rk-${METALS[i]} ${me ? 'is-me' : ''}`}
            style={{ '--i': i } as CSSProperties}
            aria-current={me ? 'true' : undefined}
          >
            <span className="rk-step-who">
              {i === 0 && <Crown className="rk-crown" size={22} aria-hidden />}
              <Avatar db={db} row={row} size={i === 0 ? 72 : 56} />
              <strong>{me ? 'Tú' : shortName(row.user)}</strong>
              <span className="rk-step-pts tabular">
                {formatInt(row.status)} <small>pts</small>
              </span>
            </span>
            <span className="rk-block">
              <span className="rk-block-n">{row.position}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function Row({ db, row, me, top }: { db: Database; row: RankingRow; me: boolean; top: number }) {
  return (
    <li
      className={`rk-row ${me ? 'is-me' : ''}`}
      aria-current={me ? 'true' : undefined}
      style={{ '--w': top > 0 ? row.status / top : 0 } as CSSProperties}
    >
      <span className="rk-pos tabular">{row.position}</span>
      <Avatar db={db} row={row} size={36} />
      <span className="rk-name">
        <strong>{me ? 'Tú' : shortName(row.user)}</strong>
      </span>
      <span className="rk-pts tabular">
        {formatInt(row.status)} <small>pts</small>
      </span>
    </li>
  )
}

export function RankingPage() {
  const db = useDb()
  const user = useUser()
  const ranking = statusRanking(db, new Date(useNow(60_000)))
  const mine = ranking.find((r) => r.user.id === user.id)
  const top = ranking.slice(0, TOP)
  const leader = ranking[0]?.status ?? 0
  const rate = getSetting(db, 'STATUS_BASE_RATE')

  const first = mine?.position === 1
  const ahead = mine && !first ? [...ranking].reverse().find((r) => r.status > mine.status) : undefined
  const gap = mine && ahead ? ahead.status - mine.status + 1 : 0
  const gapBs = rate > 0 ? Math.ceil(gap / rate) : null
  const runnerUp = first ? ranking.find((r) => r.status < mine.status) : undefined
  const tied = first && ranking.filter((r) => r.position === 1).length > 1

  return (
    <div className="page rk">
      <header className="rk-head">
        <span className="page-eyebrow">
          Últimos 30 días{ranking.length > 0 && ` · ${plural(ranking.length, 'cliente', 'clientes')}`}
        </span>
        <h1>Ranking</h1>
      </header>

      <section className={`rk-me ${first ? 'is-first' : ''}`} aria-label="Tu puesto">
        <span className="rk-me-pos">
          {first ? <Crown size={18} aria-hidden /> : <small>Tu puesto</small>}
          <strong className="tabular">{mine ? `#${mine.position}` : '—'}</strong>
        </span>
        <span className="rk-me-body">
          {!mine ? (
            <>
              <b>Aún no estás en el ranking</b>
              <span>Entras con tu primera compra</span>
            </>
          ) : first ? (
            <>
              <b>{tied ? 'Empatado en el primer puesto' : 'Eres el #1 del Paseo'}</b>
              <span>
                <CountUp value={mine.status} /> pts
                {runnerUp && !tied && <> · {formatInt(mine.status - runnerUp.status)} de ventaja</>}
              </span>
            </>
          ) : (
            <>
              <b>
                <ChevronsUp size={17} aria-hidden /> {formatInt(gap)} pts para el #{ahead?.position}
              </b>
              {gapBs !== null && <span>≈ {formatMoney(gapBs)} en compras</span>}
              {ahead && (
                <span className="rk-me-bar" style={{ '--p': Math.min(1, mine.status / ahead.status) } as CSSProperties} aria-hidden />
              )}
            </>
          )}
        </span>
      </section>

      {top.length === 0 ? (
        <Empty>Sé el primero del mes.</Empty>
      ) : (
        <>
          <Podium db={db} rows={top.slice(0, 3)} meId={user.id} />
          {(top.length > 3 || (mine && !top.includes(mine))) && (
            <ol className="rk-list" start={4}>
              {top.slice(3).map((row) => (
                <Row key={row.user.id} db={db} row={row} me={row.user.id === user.id} top={leader} />
              ))}
              {mine && !top.includes(mine) && (
                <>
                  <li className="rk-gap" aria-hidden>
                    ···
                  </li>
                  <Row db={db} row={mine} me top={leader} />
                </>
              )}
            </ol>
          )}
        </>
      )}

      {!first && (
        <Link to="/app/directory" className="rk-cta">
          <span className="rk-cta-icon" aria-hidden>
            {mine ? <TrendingUp size={20} /> : <ShoppingBag size={20} />}
          </span>
          <span>
            <strong>{mine ? 'Sube posiciones' : 'Haz tu primera compra'}</strong>
            <small>Cada Bs suma</small>
          </span>
          <ChevronsUp size={18} aria-hidden />
        </Link>
      )}
    </div>
  )
}
