import { useEffect, useRef, useState, type MouseEvent, type PointerEvent, type Ref, type TransitionEvent } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Copy, EyeOff, Nfc, QrCode, RefreshCw } from 'lucide-react'
import { api } from '../data/api'
import { formatInt, formatMonthYear } from '../lib/format'
import type { User } from '../types/domain'
import { ClubGem } from './BrandMark'
import { CountUp, notify, prefersReducedMotion } from './ui'

const FINISHES = new Set(['bronce', 'plata', 'oro', 'platinum'])

const stop = (fn: () => void) => (e: MouseEvent) => {
  e.stopPropagation()
  fn()
}

/** Back of the card: personal QR signed by the server. It expires after a few minutes and renews itself. */
function QrBack() {
  const [qr, setQr] = useState<{ token: string; code: string; expiresAt: number } | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const renew = () =>
    api
      .qrToken()
      .then(({ token, code, expiresAt }) => setQr({ token, code, expiresAt: Date.parse(expiresAt) }))
      .catch(() => notify('error', 'No se pudo generar tu código, reintenta'))

  useEffect(() => {
    void renew()
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const remaining = qr ? Math.max(0, qr.expiresAt - now) : 0
  useEffect(() => {
    if (qr && remaining === 0) void renew()
  }, [qr, remaining])

  const mm = Math.floor(remaining / 60000)
  const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0')
  const code = qr ? `${qr.code.slice(0, 3)} ${qr.code.slice(3)}` : '--- ---'
  const copy = () => {
    if (qr) void navigator.clipboard?.writeText(qr.code).then(() => notify('success', 'Código copiado'))
  }

  return (
    <div className="mcard-back-body">
      <div className="mcard-qr">
        {qr ? (
          <QRCodeSVG value={qr.token} size={256} level="M" bgColor="#f3eee0" fgColor="#010102" style={{ width: '100%', height: '100%' }} />
        ) : (
          <span className="mcard-qr-wait" aria-label="Generando tu código" />
        )}
      </div>
      <div className="mcard-back-info">
        <span className="mcard-code-label">Código</span>
        <strong className="mcard-code tabular" aria-label={`Código ${qr?.code.split('').join(' ') ?? ''}`}>
          {code}
        </strong>
        <span>Si no pueden escanear el QR, dicta este código.</span>
        <span className="mcard-timer">
          Cambia en <b className="tabular">{qr ? `${mm}:${ss}` : '-:--'}</b>
        </span>
        <div className="mcard-back-actions">
          <button type="button" className="mcard-icon-btn" onClick={stop(copy)} aria-label="Copiar código" disabled={!qr}>
            <Copy size={16} aria-hidden />
          </button>
          <button type="button" className="mcard-icon-btn" onClick={stop(() => void renew())} aria-label="Generar un código nuevo">
            <RefreshCw size={16} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  )
}

export function MemberCard({
  ref,
  user,
  tierName,
  points,
  revealed,
  onToggle,
}: {
  ref?: Ref<HTMLDivElement>
  user: User
  tierName: string | null
  points: number
  revealed: boolean
  onToggle: () => void
}) {
  // The back stays mounted until the flip finishes so the QR doesn't vanish mid-turn.
  const [backLive, setBackLive] = useState(false)
  const [prevPoints, setPrevPoints] = useState(points)
  const [gain, setGain] = useState<number | null>(null)
  if (points !== prevPoints) {
    setPrevPoints(points)
    setGain(points > prevPoints ? points - prevPoints : null)
  }

  const finish = tierName && FINISHES.has(tierName.toLowerCase()) ? tierName.toLowerCase() : 'oro'

  const tilt = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || prefersReducedMotion()) return
    const r = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    const s = e.currentTarget.style
    s.setProperty('--ry', `${(x - 0.5) * 12}deg`)
    s.setProperty('--rx', `${(0.5 - y) * 10}deg`)
    s.setProperty('--mx', `${x * 100}%`)
    s.setProperty('--my', `${y * 100}%`)
  }
  const untilt = (e: PointerEvent<HTMLDivElement>) => {
    const s = e.currentTarget.style
    for (const p of ['--rx', '--ry', '--mx', '--my']) s.removeProperty(p)
  }
  const flipped = (e: TransitionEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && e.propertyName === 'transform') setBackLive(revealed)
  }
  const cardRef = useRef<HTMLDivElement>(null)
  const toggle = () => {
    onToggle()
    if (prefersReducedMotion()) return
    cardRef.current?.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.93)', offset: 0.4 }, { transform: 'scale(1)' }], {
      duration: 900,
      easing: 'cubic-bezier(0.45, 0, 0.25, 1)',
    })
  }

  return (
    <div className="member" ref={ref}>
      <div
        ref={cardRef}
        className={`mcard mcard-${finish} ${revealed ? 'is-flipped' : ''}`}
        onClick={toggle}
        onPointerMove={tilt}
        onPointerLeave={untilt}
      >
        <div className="mcard-tilt">
          <div className="mcard-inner" onTransitionEnd={flipped}>
            <div className="mcard-face mcard-front" aria-hidden={revealed} inert={revealed}>
              <div className="mcard-row">
                <span className="mcard-brand">
                  <ClubGem size={22} /> Paseo <b>Club</b>
                </span>
                <span className="mcard-tier">{tierName ?? 'Socio'}</span>
              </div>
              <div className="mcard-row mcard-hw" aria-hidden>
                <span className="mcard-chip" />
                <Nfc className="mcard-nfc" />
              </div>
              <div className="mcard-points">
                <span className="mcard-label">Puntos disponibles</span>
                <strong className="mcard-value">
                  <CountUp value={points} />
                </strong>
                {gain !== null && (
                  <span key={points} className="mcard-gain">
                    +{formatInt(gain)}
                  </span>
                )}
              </div>
              <div className="mcard-row mcard-foot">
                <span className="mcard-holder">
                  {user.firstName} {user.lastName}
                </span>
                <span className="mcard-since">
                  <small>Socio desde</small> {formatMonthYear(user.createdAt)}
                </span>
                <span className="mcard-number tabular">•••• {String(user.id).padStart(4, '0')}</span>
              </div>
              <span className="mcard-glare" aria-hidden />
              <span className="mcard-sheen" aria-hidden />
            </div>

            <div className="mcard-face mcard-back" aria-hidden={!revealed} inert={!revealed}>
              <span className="mcard-stripe" aria-hidden />
              {(revealed || backLive) && <QrBack />}
            </div>
          </div>
        </div>
      </div>

      <button type="button" className="mcard-toggle" aria-pressed={revealed} onClick={toggle}>
        <span className="mcard-toggle-icon" aria-hidden>
          {revealed ? <EyeOff size={16} /> : <QrCode size={16} />}
        </span>
        {revealed ? 'Ocultar mi código' : 'Mostrar mi código QR'}
      </button>
    </div>
  )
}
