import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { AlertTriangle, HelpCircle } from 'lucide-react'

interface DialogOptions {
  title: string
  message?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** `danger` for deletions and irreversible actions. */
  tone?: 'danger' | 'primary'
}

type Pending = DialogOptions & { id: number; resolve: (ok: boolean) => void }

let pending: Pending | null = null
let seq = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

/** In-app replacement for `window.confirm`, styled with the current role theme. Resolves to `true` when confirmed. */
export function confirmDialog(options: DialogOptions): Promise<boolean> {
  pending?.resolve(false)
  return new Promise((resolve) => {
    pending = { ...options, id: ++seq, resolve }
    emit()
  })
}

function close(ok: boolean) {
  const current = pending
  pending = null
  emit()
  current?.resolve(ok)
}

/** Mount once per layout (inside the themed shell) so the dialog inherits the role colors. */
export function DialogHost() {
  const dialog = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => pending,
  )

  useEffect(() => () => close(false), [])

  return dialog ? <ConfirmSheet key={dialog.id} dialog={dialog} /> : null
}

function ConfirmSheet({ dialog }: { dialog: Pending }) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  // The answer is held until the exit animation ends.
  const [answer, setAnswer] = useState<boolean | null>(null)

  useEffect(() => {
    ;(dialog.tone === 'danger' ? cancelRef : confirmRef).current?.focus()
    // Capture phase so Escape closes only this dialog, not a Modal underneath.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      setAnswer((a) => a ?? false)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [dialog])

  const danger = dialog.tone === 'danger'
  const Icon = danger ? AlertTriangle : HelpCircle
  return (
    <div
      className={`modal-backdrop modal-backdrop-top ${answer !== null ? 'is-closing' : ''}`}
      onMouseDown={(e) => e.target === e.currentTarget && setAnswer((a) => a ?? false)}
      onAnimationEnd={(e) => answer !== null && e.target === e.currentTarget && close(answer)}
    >
      <div className="modal modal-confirm" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-message">
        <span className={`confirm-icon ${danger ? 'is-danger' : ''}`} aria-hidden>
          <Icon size={24} />
        </span>
        <h2 id="dialog-title">{dialog.title}</h2>
        {dialog.message && (
          <div id="dialog-message" className="confirm-message">
            {dialog.message}
          </div>
        )}
        <div className="confirm-actions">
          <button ref={cancelRef} className="btn btn-ghost" onClick={() => setAnswer((a) => a ?? false)}>
            {dialog.cancelLabel ?? 'Cancelar'}
          </button>
          <button ref={confirmRef} className={`btn ${danger ? 'danger-solid' : 'btn-primary'}`} onClick={() => setAnswer((a) => a ?? true)}>
            {dialog.confirmLabel ?? (danger ? 'Eliminar' : 'Confirmar')}
          </button>
        </div>
      </div>
    </div>
  )
}
