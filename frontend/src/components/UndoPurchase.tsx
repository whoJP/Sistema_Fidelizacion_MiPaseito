import { useState, type MouseEvent, type ReactNode } from 'react'
import { Undo2 } from 'lucide-react'
import { PURCHASE_UNDO_MS, undoDeadline } from '../data/actions'
import { formatMoney } from '../lib/format'
import type { Transaction } from '../types/domain'
import { confirmDialog } from './dialog'
import { TimeBar, flash, formatCountdown, rowOf, run, useNow } from './ui'

/** "Deshacer registro" with a bar that empties during the undo window; shows `after` once the window closes. */
export function UndoPurchase({ tx, after = null }: { tx: Transaction; after?: ReactNode }) {
  const now = useNow(500)
  const [busy, setBusy] = useState(false)
  const deadline = undoDeadline(tx)
  if (tx.status === 'CANCELLED') return null
  if (now >= deadline) return <>{after}</>

  const undo = async (e: MouseEvent<HTMLButtonElement>) => {
    const row = rowOf(e.currentTarget.parentElement)
    const ok = await confirmDialog({
      title: '¿Deshacer este registro?',
      message: `La compra de ${formatMoney(tx.amount)} se anula y el cliente no recibe sus puntos. Después podrás registrarla de nuevo si hace falta.`,
      confirmLabel: 'Deshacer registro',
      cancelLabel: 'Mantener',
      tone: 'danger',
    })
    if (!ok) return
    setBusy(true)
    const done = await run('undoPurchase', { transactionId: tx.id }, 'Registro deshecho')
    setBusy(false)
    if (done) flash(row)
  }

  return (
    <div className="undo">
      <button className="btn btn-sm undo-btn" onClick={undo} disabled={busy}>
        <Undo2 size={15} aria-hidden /> Deshacer registro
        <span className="undo-time tabular">{formatCountdown(deadline - now)}</span>
      </button>
      <TimeBar key={tx.id} start={deadline - PURCHASE_UNDO_MS} end={deadline} now={now} />
    </div>
  )
}
