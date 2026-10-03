import { useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { CakeSlice, Coins, Gift, Lock, Repeat, Sparkles, Stamp, Target, Ticket, TrendingUp, Zap, type LucideIcon } from 'lucide-react'
import { useDb } from '../../data/store'
import { eligiblePrizes, prizeOdds, prizeTitle, spinAvailability } from '../../domain/engagement'
import { pointsBalance } from '../../domain/loyalty'
import { formatDayMonth, formatInt, formatMoney, formatNumber } from '../../lib/format'
import { useUser } from '../../session'
import type { SpinPrize, SpinPrizeType, SpinSource } from '../../types/domain'
import { ClubGem } from '../../components/BrandMark'
import { Empty, prefersReducedMotion, run } from '../../components/ui'

interface Segment {
  key: string
  prize: SpinPrize
  start: number
  sweep: number
}

const SIZE = 320
const R = SIZE / 2
const SPIN_MS = 5200
const BULBS = 16
const SLICES = 12

/** Equal slices; each prize gets a share proportional to its odds (at least one), spread around the wheel. */
function segmentsOf(prizes: SpinPrize[]): Segment[] {
  if (prizes.length === 0) return []
  const odds = prizeOdds(prizes)
  const total = Math.max(SLICES, prizes.length)
  const exact = prizes.map((p) => (odds.get(p.id) ?? 0) * total)
  const counts = exact.map((x) => Math.max(1, Math.floor(x)))
  const byRemainder = prizes.map((_, i) => i).sort((a, b) => exact[b] - Math.floor(exact[b]) - (exact[a] - Math.floor(exact[a])))
  let left = total - counts.reduce((sum, c) => sum + c, 0)
  for (let k = 0; left > 0; k++, left--) counts[byRemainder[k % prizes.length]]++
  while (left < 0) {
    const biggest = counts.indexOf(Math.max(...counts))
    counts[biggest]--
    left++
  }
  const sweep = 360 / total
  return prizes
    .flatMap((prize, i) =>
      Array.from({ length: counts[i] }, (_, k) => ({ prize, k, pos: (k + (i + 0.5) / prizes.length) / counts[i] })),
    )
    .sort((a, b) => a.pos - b.pos)
    .map(({ prize, k }, slot) => ({ key: `${prize.id}-${k}`, prize, start: slot * sweep, sweep }))
}

const PRIZE_ICON: Record<SpinPrizeType, LucideIcon> = {
  POINTS: Coins,
  MULTIPLIER: Zap,
  REWARD: Gift,
  EXTRA_SPIN: Repeat,
}

const shortLabel = (p: Pick<SpinPrize, 'type' | 'points' | 'multiplier'>) =>
  p.type === 'POINTS' ? formatInt(p.points ?? 0) : p.type === 'MULTIPLIER' ? `×${formatNumber(p.multiplier ?? 2)}` : p.type === 'EXTRA_SPIN' ? '+1 giro' : 'Regalo'

const chipLabel = (p: SpinPrize) =>
  p.type === 'POINTS' ? `${formatInt(p.points ?? 0)} pts` : p.type === 'MULTIPLIER' ? `Puntos ×${formatNumber(p.multiplier ?? 2)}` : p.type === 'EXTRA_SPIN' ? 'Giro extra' : 'Regalo'

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
    <div className={`wheel-wrap ${spinning ? 'is-spinning' : ''}`}>
      <span className="wheel-halo" aria-hidden />
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
          const mid = s.start + s.sweep / 2
          const [lx, ly] = point(mid, R * 0.62)
          return (
            <g key={s.key}>
              <path d={arc(s.start, s.sweep)} className={`wheel-slice wheel-slice-${i % 2} wheel-${s.prize.type.toLowerCase()}`} />
              {s.sweep >= 14 && (
                <text
                  x={lx}
                  y={ly}
                  className="wheel-label"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${mid > 180 ? mid + 90 : mid - 90} ${lx} ${ly})`}
                >
                  {shortLabel(s.prize)}
                </text>
              )}
            </g>
          )
        })}
        <circle cx={R} cy={R} r={34} className="wheel-hub" />
      </svg>
      <svg className="wheel-bulbs" viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden>
        {Array.from({ length: BULBS }, (_, i) => {
          const [x, y] = point((360 / BULBS) * i, R - 3)
          return <circle key={i} cx={x} cy={y} r={3.2} className={`wheel-bulb ${i % 2 ? 'is-odd' : ''}`} />
        })}
      </svg>
      <span className="wheel-gem" aria-hidden>
        <ClubGem size={30} />
      </span>
    </div>
  )
}

const CONFETTI = 28

function WinOverlay({ prize, title, onClose }: { prize: SpinPrize; title: string; onClose: () => void }) {
  const Icon = PRIZE_ICON[prize.type]
  return (
    <div className="win" role="dialog" aria-modal="true" aria-label="Tu premio" onClick={onClose}>
      <div className="win-confetti" aria-hidden>
        {Array.from({ length: CONFETTI }, (_, i) => (
          <span key={i} style={{ '--i': i, '--x': `${(i * 37) % 100}%`, '--d': `${(i % 7) * 90}ms` } as CSSProperties} />
        ))}
      </div>
      <div className="win-card" onClick={(e) => e.stopPropagation()}>
        <span className="win-rays" aria-hidden />
        <span className="win-icon" aria-hidden>
          <Icon size={34} />
        </span>
        <span className="win-eyebrow">¡Ganaste!</span>
        <h2>{prize.type === 'EXTRA_SPIN' ? 'Un giro extra' : title}</h2>
        <p>
          {prize.type === 'POINTS' && 'Ya en tu saldo'}
          {prize.type === 'MULTIPLIER' && 'En tu próxima compra'}
          {prize.type === 'REWARD' && 'Listo en Mis canjes'}
          {prize.type === 'EXTRA_SPIN' && 'Gíralo cuando quieras'}
        </p>
        {prize.type === 'REWARD' ? (
          <Link className="btn btn-primary btn-block btn-lg" to="/app/rewards">
            Ver mi premio
          </Link>
        ) : (
          <button className="btn btn-primary btn-block btn-lg" onClick={onClose}>
            {prize.type === 'EXTRA_SPIN' ? 'Seguir girando' : 'Genial'}
          </button>
        )}
      </div>
    </div>
  )
}

const EARN_WAYS: { icon: LucideIcon; label: string; to: string }[] = [
  { icon: Stamp, label: 'Visitas', to: '/app' },
  { icon: Target, label: 'Misiones', to: '/app/missions' },
  { icon: TrendingUp, label: 'Subir nivel', to: '/app/ranking' },
  { icon: CakeSlice, label: 'Cumpleaños', to: '/account#cumpleanos' },
]

type SpinResult = { spinId: number; prizeId: number; title: string }

export function SpinPage() {
  const db = useDb()
  const user = useUser()
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [frozen, setFrozen] = useState<Segment[] | null>(null)
  const [result, setResult] = useState<SpinResult | null>(null)
  const pending = useRef<SpinResult | null>(null)

  const prizes = eligiblePrizes(db)
  const odds = prizeOdds(prizes)
  const live = segmentsOf(prizes)
  const segments = frozen ?? live
  const avail = spinAvailability(db, user.id)
  const balance = pointsBalance(db, user.id)
  const busy = spinning || frozen !== null
  const history = db.spins.filter((s) => s.userId === user.id).sort((a, b) => b.id - a.id).slice(0, 6)
  const empty = segments.length === 0

  const finish = () => {
    setSpinning(false)
    setFrozen(null)
    if (pending.current) {
      setResult(pending.current)
      navigator.vibrate?.([30, 40, 60])
    }
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
    const matches = snapshot.filter((s) => s.prize.id === r.prizeId)
    const segment = matches[Math.floor(Math.random() * matches.length)]
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

  const primary: { source: SpinSource; label: string; sub: string; disabled?: boolean } | null = avail.extraUnlock
    ? { source: 'EXTRA', label: 'Girar', sub: 'Gratis por tu compra' }
    : !avail.dailyUsed
      ? {
          source: 'DAILY',
          label: 'Girar',
          sub: avail.canAffordDaily ? `${formatInt(avail.dailyCost)} pts` : `Necesitas ${formatInt(avail.dailyCost)} pts`,
          disabled: !avail.canAffordDaily,
        }
      : avail.freeAvailable > 0
        ? { source: 'FREE', label: 'Girar', sub: 'Giro gratis' }
        : null
  const showFree = avail.freeAvailable > 0 && primary?.source !== 'FREE'

  return (
    <div className="page spin">
      <header className="spin-head">
        <h1>Ruleta</h1>
        <div className="spin-wallet">
          <span className="spin-pill">
            <ClubGem size={14} /> <b className="tabular">{formatInt(balance)}</b> pts
          </span>
          {avail.freeAvailable > 0 && (
            <span className="spin-pill is-free">
              <Ticket size={14} aria-hidden /> <b className="tabular">{formatInt(avail.freeAvailable)}</b> gratis
            </span>
          )}
        </div>
      </header>

      <section className="spin-stage" aria-label="Ruleta">
        {empty ? <Empty>Sin premios por ahora.</Empty> : <Wheel segments={segments} rotation={rotation} spinning={spinning} onDone={finish} />}

        <div className="spin-actions">
          {primary ? (
            <button className="spin-btn" disabled={busy || empty || primary.disabled} onClick={() => spin(primary.source)}>
              <span className="spin-btn-label">{spinning ? 'Girando…' : primary.label}</span>
              <span className="spin-btn-sub">{primary.sub}</span>
            </button>
          ) : (
            <div className="spin-locked">
              <Lock size={18} aria-hidden />
              {avail.extraUsedToday < avail.extraMax ? (
                <span>
                  Compra desde <b>{formatMoney(avail.extraMinPurchase)}</b> y gira gratis
                </span>
              ) : (
                <span>Vuelve mañana</span>
              )}
            </div>
          )}
          {showFree && (
            <button className="btn btn-block spin-free" disabled={busy || empty} onClick={() => spin('FREE')}>
              <Sparkles size={17} aria-hidden /> Usar giro gratis · {formatInt(avail.freeAvailable)}
            </button>
          )}
        </div>
      </section>

      {!empty && (
        <section className="spin-section" aria-label="Premios">
          <h2 className="spin-title">Premios</h2>
          <ul className="prize-strip">
            {prizes.map((prize) => {
              const Icon = PRIZE_ICON[prize.type]
              return (
                <li key={prize.id} className={`prize-chip prize-${prize.type.toLowerCase()}`} title={prizeTitle(db, prize)}>
                  <span className="prize-chip-icon" aria-hidden>
                    <Icon size={18} />
                  </span>
                  <span>{chipLabel(prize)}</span>
                </li>
              )
            })}
          </ul>
          <details className="spin-odds">
            <summary>Probabilidades</summary>
            <ul>
              {prizes.map((prize) => (
                <li key={prize.id}>
                  <span>{prizeTitle(db, prize)}</span>
                  <b className="tabular">{formatNumber(Math.round((odds.get(prize.id) ?? 0) * 1000) / 10)}%</b>
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}

      <section className="spin-section" aria-label="Gana giros gratis">
        <h2 className="spin-title">Gana giros gratis</h2>
        <ul className="earn-ways">
          {EARN_WAYS.map(({ icon: Icon, label, to }) => (
            <li key={label}>
              <Link to={to} className="earn-way">
                <span className="earn-way-icon" aria-hidden>
                  <Icon size={20} />
                </span>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {history.length > 0 && (
        <section className="spin-section" aria-label="Tus últimos premios">
          <h2 className="spin-title">Tus premios</h2>
          <ul className="won-strip">
            {history.map((s) => {
              const prize = db.spinPrizes.find((p) => p.id === s.prizeId)
              const Icon = PRIZE_ICON[s.prizeType]
              return (
                <li key={s.id} className="won-item" title={prize ? prizeTitle(db, prize) : undefined}>
                  <Icon size={16} aria-hidden />
                  <b>{prize ? chipLabel(prize) : 'Premio'}</b>
                  <small>{formatDayMonth(s.createdAt)}</small>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {result && won && <WinOverlay prize={won} title={result.title} onClose={() => setResult(null)} />}
    </div>
  )
}
