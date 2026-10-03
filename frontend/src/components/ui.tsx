import { Fragment, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, X, type LucideIcon } from 'lucide-react'
import { ApiError, api } from '../data/api'
import type { CommandInput, CommandName, CommandResult } from '../data/commands'
import { applySnapshot } from '../data/store'
import { formatInt } from '../lib/format'
import { haptic, useDragToClose } from '../lib/motion'

// ---------- Toasts ----------

type Toast = { id: number; kind: 'success' | 'error'; message: string; leaving?: boolean }
let toasts: Toast[] = []
let toastSeq = 0
const toastListeners = new Set<() => void>()
const TOAST_MS = 4500
const TOAST_OUT_MS = 300

function dismiss(id: number) {
  if (!toasts.some((t) => t.id === id && !t.leaving)) return
  toasts = toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t))
  toastListeners.forEach((l) => l())
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id)
    toastListeners.forEach((l) => l())
  }, TOAST_OUT_MS)
}

export function notify(kind: Toast['kind'], message: string) {
  const toast = { id: ++toastSeq, kind, message }
  toasts = [...toasts, toast]
  toastListeners.forEach((l) => l())
  if (kind === 'error') haptic([10, 40, 10])
  setTimeout(() => dismiss(toast.id), TOAST_MS - TOAST_OUT_MS)
}

export function Toaster() {
  const list = useSyncExternalStore(
    (l) => {
      toastListeners.add(l)
      return () => toastListeners.delete(l)
    },
    () => toasts,
  )
  return (
    <div className="toaster" role="status" aria-live="polite">
      {list.map((t) => (
        <div
          key={t.id}
          className={`toast toast-${t.kind} ${t.leaving ? 'is-leaving' : ''}`}
          style={{ '--life': `${TOAST_MS - TOAST_OUT_MS}ms` } as CSSProperties}
          onClick={() => dismiss(t.id)}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}

/** Executes a command on the server; errors become an error toast and resolve to `undefined`. */
export async function run<K extends CommandName>(
  name: K,
  input: CommandInput<K>,
  success?: string | ((result: CommandResult<K>) => string),
): Promise<CommandResult<K> | undefined> {
  try {
    const { result, version, db } = await api.command(name, input)
    applySnapshot(version, db)
    if (success) notify('success', typeof success === 'function' ? success(result) : success)
    return result
  } catch (err) {
    notify('error', err instanceof ApiError ? err.message : 'Error inesperado')
    return undefined
  }
}

// ---------- Layout primitives ----------

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
}: {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  eyebrow?: string
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <span className="page-eyebrow">{eyebrow}</span>}
        <h1>
          <span className="sr-only">{title}</span>
          <span className="title-words" aria-hidden>
            {title.split(' ').map((word, i) => (
              <Fragment key={i}>
                {i > 0 && ' '}
                <span className="title-word">
                  <span style={{ '--w': i } as CSSProperties}>{word}</span>
                </span>
              </Fragment>
            ))}
          </span>
        </h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>
}

export function MoreLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link className="link-arrow" to={to}>
      {children} <ArrowUpRight size={15} aria-hidden />
    </Link>
  )
}

export function CardHead({ icon: Icon, title, action }: { icon?: LucideIcon; title: string; action?: ReactNode }) {
  return (
    <div className="card-head">
      <h2 className="card-title">
        {Icon && <Icon size={18} aria-hidden />} {title}
      </h2>
      {action}
    </div>
  )
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'accent' }) {
  // Keyed by its text so a status change remounts it and replays the entrance.
  return (
    <span key={typeof children === 'string' ? children : undefined} className={`badge badge-${tone}`}>
      {children}
    </span>
  )
}

export function Progress({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="progress-bar" style={{ width: `${pct}%` }} />
    </div>
  )
}

export function ProgressRing({ value, max, size = 64 }: { value: number; max: number; size?: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  const stroke = 5
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="ring" style={{ width: size, height: size }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        {pct > 0 && (
          <circle
            className="ring-bar"
            cx={size / 2}
            cy={size / 2}
            r={r}
            strokeWidth={stroke}
            strokeDasharray={c}
            strokeDashoffset={c - (c * pct) / 100}
            style={{ '--c': c } as CSSProperties}
          />
        )}
      </svg>
      <span className="ring-value">{pct}%</span>
    </div>
  )
}

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

const ROW = '[data-row], tr, li, .list-row, .card'
/** List row, table row or card holding `trigger`. Resolve it before awaiting if the trigger may unmount. */
export const rowOf = (trigger: Element | null | undefined) => trigger?.closest<HTMLElement>(ROW) ?? null

/**
 * Fades out the row holding `trigger` and then runs `action`. If the row is still rendered afterwards
 * (the command failed or kept the item), it fades back in.
 */
export async function vanish<T>(trigger: Element | null | undefined, action: () => T | Promise<T>): Promise<T> {
  const el = rowOf(trigger)
  if (!el) return action()
  const out = el.animate(
    prefersReducedMotion()
      ? [{ opacity: 1 }, { opacity: 0 }]
      : [
          { opacity: 1, transform: 'none' },
          { opacity: 0, transform: 'translateX(14px) scale(0.98)' },
        ],
    { duration: 220, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' },
  )
  await out.finished.catch(() => undefined)
  try {
    return await action()
  } finally {
    // Wait for React to commit the removal before deciding the row survived.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (!el.isConnected) return
        out.cancel()
        el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' })
      }),
    )
  }
}

/** Briefly highlights the row holding `trigger` after an in-place change (status, availability). */
export function flash(trigger: Element | null | undefined) {
  const el = rowOf(trigger)
  if (!el) return
  const style = getComputedStyle(el)
  const accent = style.getPropertyValue('--accent-rgb').trim() || '245 200 76'
  el.animate([{ backgroundColor: `rgb(${accent} / 0.18)` }, { backgroundColor: style.backgroundColor }], { duration: 1000, easing: 'ease-out' })
}

/** Integer that rolls from its previous value to the new one. Writes to the DOM directly to avoid a render per frame. */
export function CountUp({ value, duration = 1100 }: { value: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const shown = useRef(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const from = shown.current
    if (from === value || prefersReducedMotion()) {
      shown.current = value
      el.textContent = formatInt(value)
      return
    }
    el.textContent = formatInt(from)
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / duration)
      shown.current = Math.round(from + (value - from) * (1 - Math.pow(1 - k, 4)))
      el.textContent = formatInt(shown.current)
      if (k < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, duration])
  return <span ref={ref} className="tabular" />
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}

export function Field({ label, children, hint, error }: { label: string; children: ReactNode; hint?: string; error?: string | null }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {error ? (
        <span className="field-error" role="alert">
          {error}
        </span>
      ) : (
        hint && <span className="field-hint">{hint}</span>
      )}
    </label>
  )
}

/** Bar that empties with the time left until `end`; it moves on every `now` tick. */
export function TimeBar({ start, end, now }: { start: number; end: number; now: number }) {
  const ratio = Math.min(1, Math.max(0, (end - now) / Math.max(1, end - start)))
  return (
    <div className="timebar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)}>
      <div className={`timebar-fill ${ratio < 0.2 ? 'is-low' : ''}`} style={{ transform: `scaleX(${ratio})` }} />
    </div>
  )
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  // Closing from inside (X, Escape, backdrop) plays the exit first; the parent unmounts on animation end.
  const [closing, setClosing] = useState(false)
  const drag = useDragToClose('.modal', onClose)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setClosing(true)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <div
      className={`modal-backdrop ${closing ? 'is-closing' : ''}`}
      onMouseDown={(e) => e.target === e.currentTarget && setClosing(true)}
      onAnimationEnd={(e) => closing && e.target === e.currentTarget && onClose()}
    >
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head" {...drag}>
          <h2>{title}</h2>
          <button className="icon-btn" onClick={() => setClosing(true)} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export function MultiSelect({
  options,
  value,
  onChange,
}: {
  options: { id: number; label: string }[]
  value: number[]
  onChange: (ids: number[]) => void
}) {
  if (options.length === 0) return <span className="muted small">Sin opciones</span>
  return (
    <div className="chips">
      {options.map((o) => {
        const active = value.includes(o.id)
        return (
          <button
            type="button"
            key={o.id}
            className={`chip ${active ? 'chip-active' : ''}`}
            onClick={() => onChange(active ? value.filter((v) => v !== o.id) : [...value, o.id])}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
