import { useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { ApiError, api } from '../data/api'
import type { CommandInput, CommandName, CommandResult } from '../data/commands'
import { applySnapshot } from '../data/store'

// ---------- Toasts ----------

type Toast = { id: number; kind: 'success' | 'error'; message: string }
let toasts: Toast[] = []
let toastSeq = 0
const toastListeners = new Set<() => void>()

export function notify(kind: Toast['kind'], message: string) {
  const toast = { id: ++toastSeq, kind, message }
  toasts = [...toasts, toast]
  toastListeners.forEach((l) => l())
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== toast.id)
    toastListeners.forEach((l) => l())
  }, 4500)
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
        <div key={t.id} className={`toast toast-${t.kind}`}>
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

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'accent' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function Progress({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="progress-bar" style={{ width: `${pct}%` }} />
    </div>
  )
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

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
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
