import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Gift, Lock, Sparkles, Ticket } from 'lucide-react'
import { useDb } from '../../data/store'
import { eligiblePrizes, prizeOdds, prizeTitle, spinAvailability } from '../../domain/engagement'
import { pointsBalance } from '../../domain/loyalty'
import { formatDateTime, formatInt, formatMoney, formatNumber, plural } from '../../lib/format'
import { useUser } from '../../session'
import type { SpinPrize, SpinSource } from '../../types/domain'
import { ClubGem } from '../../components/BrandMark'
import { Card, CardHead, Empty, Modal, PageHeader, prefersReducedMotion, run } from '../../components/ui'

interface Segment {
  prize: SpinPrize
  start: number
  sweep: number
}

const SIZE = 320
const R = SIZE / 2
const SPIN_MS = 5200

function segmentsOf(prizes: SpinPrize[]): Segment[] {
  const odds = prizeOdds(prizes)
  let start = 0
  return prizes.map((prize) => {
    const sweep = (odds.get(prize.id) ?? 0) * 360
    const segment = { prize, start, sweep }
    start += sweep
    return segment
  })
}

const shortLabel = (p: SpinPrize) =>
  p.type === 'POINTS' ? formatInt(p.points ?? 0) : p.type === 'MULTIPLIER' ? `×${formatNumber(p.multiplier ?? 2)}` : p.type === 'EXTRA_SPIN' ? '+1 giro' : 'Regalo'

const point = (angle: number, radius: number) => {
  const rad = ((angle - 90) * Math.PI) / 180
  return [R + radius * Math.cos(rad), R + radius * Math.sin(rad)] as const
}

function arc(start: number, sweep: number) {
  if (sweep >= 359.99) return `M ${R} ${R - (R - 6)} A ${R - 6} ${R - 6} 0 1 1 ${R - 0.01} ${R - (R - 6)} Z`
  const [x1, y1] = point(start, R - 6)
  const [x2, y2] = point(start + sweep, R - 6)
  return `M ${R} ${R} L ${x1} ${y1} A ${R - 6} ${R - 6} 0 ${sweep > 180 ? 1 : 0} 1 ${x2} ${y2} Z`
}

function Wheel({ segments, rotation, spinning, onDone }: { segments: Segment[]; rotation: number; spinning: boolean; onDone: () => void }) {
  return (
    <div className="wheel-wrap">
      <span className="wheel-pointer" aria-hidden />
      <svg
        className="wheel"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ transform: `rotate(${rotation}deg)`, transitionDuration: spinning ? `${SPIN_MS}ms` : '0ms' }}
        onTransitionEnd={onDone}
        role="img"
        aria-label="Ruleta de premios"
      >
        <circle cx={R} cy={R} r={R - 1} className="wheel-rim" />
        {segments.map((s, i) => {
          const [lx, ly] = point(s.start + s.sweep / 2, R * 0.66)
          return (
            <g key={s.prize.id}>
              <path d={arc(s.start, s.sweep)} className={`wheel-slice wheel-slice-${i % 3} wheel-${s.prize.type.toLowerCase()}`} />
              {s.sweep >= 14 && (
                <text
                  x={lx}
                  y={ly}
                  className="wheel-label"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${s.start + s.sweep / 2} ${lx} ${ly})`}
                >
                  {shortLabel(s.prize)}
                </text>
              )}
            </g>
          )
        })}
        <circle cx={R} cy={R} r={34} className="wheel-hub" />
      </svg>
      <span className="wheel-gem" aria-hidden>
        <ClubGem size={30} />
      </span>
    </div>
  )
}

type SpinResult = { spinId: number; prizeId: number; title: string }

export function SpinPage() {
  const db = useDb()
  const user = useUser()
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [frozen, setFrozen] = useState<Segment[] | null>(null)
  const [result, setResult] = useState<SpinResult | null>(null)
  const pending = useRef<SpinResult | null>(null)

  const live = segmentsOf(eligiblePrizes(db))
  const segments = frozen ?? live
  const avail = spinAvailability(db, user.id)
  const balance = pointsBalance(db, user.id)
  const busy = spinning || frozen !== null
  const history = db.spins.filter((s) => s.userId === user.id).sort((a, b) => b.id - a.id).slice(0, 8)

  const finish = () => {
    setSpinning(false)
    setFrozen(null)
    if (pending.current) setResult(pending.current)
    pending.current = null
  }

  const spin = async (source: SpinSource) => {
    const snapshot = live
    setFrozen(snapshot)
    setResult(null)
    const r = await run('spinWheel', { source })
    if (!r) {
      setFrozen(null)
      return
    }
    const segment = snapshot.find((s) => s.prize.id === r.prizeId)
    pending.current = r
    if (!segment || prefersReducedMotion()) {
      finish()
      return
    }
    const landing = segment.start + segment.sweep / 2 + (Math.random() - 0.5) * segment.sweep * 0.6
    const base = rotation - (rotation % 360)
    setSpinning(true)
    setRotation(base + 360 * 6 + (360 - landing))
  }

  const won = result ? db.spinPrizes.find((p) => p.id === result.prizeId) : undefined
  const wonSpin = result ? db.spins.find((s) => s.id === result.spinId) : undefined
  const wonPromo = wonSpin?.promotionId ? db.promotions.find((p) => p.id === wonSpin.promotionId) : undefined
  const sources = avail.freeEarned

  return (
    <div className="page">
      <PageHeader
        title="Ruleta del Paseo"
        subtitle={
          <>
            Un giro al día por <b>{formatInt(avail.dailyCost)} puntos</b>. Todos los premios de puntos valen más que el giro. Tienes{' '}
            <b>{formatInt(balance)}</b> puntos.
          </>
        }
      />

      <div className="spin-layout">
        <Card className="spin-stage">
          {segments.length === 0 ? (
            <Empty>La ruleta no tiene premios disponibles por ahora.</Empty>
          ) : (
            <Wheel segments={segments} rotation={rotation} spinning={spinning} onDone={finish} />
          )}

          <div className="spin-actions">
            {!avail.dailyUsed ? (
              <button className="btn btn-primary btn-block" disabled={busy || !avail.canAffordDaily || segments.length === 0} onClick={() => spin('DAILY')}>
                {avail.canAffordDaily ? `Girar por ${formatInt(avail.dailyCost)} puntos` : `Necesitas ${formatInt(avail.dailyCost)} puntos`}
              </button>
            ) : avail.extraUnlock ? (
              <button className="btn btn-primary btn-block" disabled={busy || segments.length === 0} onClick={() => spin('EXTRA')}>
                <Ticket size={17} aria-hidden /> Girar gratis por tu compra
              </button>
            ) : (
              <p className="spin-hint">
                {avail.extraUsedToday < avail.extraMax ? (
                  <>
                    <Lock size={15} aria-hidden /> Ya usaste tu giro de hoy. Compra desde <b>{formatMoney(avail.extraMinPurchase)}</b> en cualquier local y
                    desbloquea otro gratis (hasta {plural(avail.extraMax - avail.extraUsedToday, 'giro más', 'giros más')} hoy).
                  </>
                ) : (
                  <>Ya usaste todos tus giros de hoy. Vuelve mañana.</>
                )}
              </p>
            )}
            {avail.freeAvailable > 0 && (
              <button className="btn btn-block" disabled={busy || segments.length === 0} onClick={() => spin('FREE')}>
                <Sparkles size={17} aria-hidden /> Usar giro gratis · {plural(avail.freeAvailable, 'disponible', 'disponibles')}
              </button>
            )}
          </div>
        </Card>

        <div className="stack">
          <Card>
            <CardHead icon={Gift} title="Premios y probabilidades" />
            <ul className="odds">
              {segments.map((s) => (
                <li key={s.prize.id}>
                  <span className={`odds-dot wheel-${s.prize.type.toLowerCase()}`} aria-hidden />
                  <span className="odds-title">{prizeTitle(db, s.prize)}</span>
                  <span className="odds-pct tabular">{formatNumber(Math.round((s.sweep / 360) * 1000) / 10)}%</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHead icon={Sparkles} title="Giros gratis" />
            <ul className="earn-list">
              <li>
                <span>Completar tu tarjeta de visitas</span>
                <b className="tabular">{formatInt(sources.visitCards)}</b>
              </li>
              <li>
                <span>Misiones con giro de premio</span>
                <b className="tabular">{formatInt(sources.missions)}</b>
              </li>
              {avail.nextMilestone > 0 && (
                <li>
                  <span>Cada hito de puntos de nivel (el próximo a los {formatInt(avail.nextMilestone)})</span>
                  <b className="tabular">{formatInt(sources.milestones)}</b>
                </li>
              )}
              <li>
                <span>Tu cumpleaños verificado</span>
                <b className="tabular">{formatInt(sources.birthdays)}</b>
              </li>
              <li>
                <span>Premio «giro extra» de la ruleta</span>
                <b className="tabular">{formatInt(sources.prizes)}</b>
              </li>
            </ul>
          </Card>

          <Card>
            <CardHead title="Tus últimos giros" />
            {history.length === 0 ? (
              <Empty>Todavía no giraste la ruleta.</Empty>
            ) : (
              <ul className="list">
                {history.map((s) => {
                  const prize = db.spinPrizes.find((p) => p.id === s.prizeId)
                  return (
                    <li key={s.id} className="list-row">
                      <div>
                        <strong>{prize ? prizeTitle(db, prize) : 'Premio'}</strong>
                        <div className="muted small">
                          {s.source === 'DAILY' ? `Giro del día · ${formatInt(s.cost)} puntos` : s.source === 'EXTRA' ? 'Giro por compra' : 'Giro gratis'} ·{' '}
                          {formatDateTime(s.createdAt)}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {result && won && (
        <Modal title="Tu premio" onClose={() => setResult(null)}>
          <div className="stack center spin-won">
            <span className="spin-won-gem" aria-hidden>
              <ClubGem size={38} />
            </span>
            <h3>{won.type === 'EXTRA_SPIN' ? '¡Un giro extra!' : result.title}</h3>
            <p className="muted">
              {won.type === 'POINTS' && 'Ya están en tu saldo.'}
              {won.type === 'MULTIPLIER' &&
                `Se aplica solo en tu próxima compra en cualquier local${wonPromo ? `, hasta el ${formatDateTime(wonPromo.endsAt)}` : ''}.`}
              {won.type === 'REWARD' && 'Lo tienes en Mis canjes. Para usarlo, muestra tu tarjeta en el local antes de que venza.'}
              {won.type === 'EXTRA_SPIN' && 'Ya lo tienes disponible en «Usar giro gratis».'}
            </p>
            {won.type === 'REWARD' ? (
              <Link className="btn btn-primary" to="/app/rewards">
                Ver en Mis canjes
              </Link>
            ) : (
              <button className="btn btn-primary" onClick={() => setResult(null)}>
                Listo
              </button>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
