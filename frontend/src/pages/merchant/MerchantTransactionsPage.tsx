import { useState, type FormEvent } from 'react'
import { MessageSquareWarning } from 'lucide-react'
import { useDb } from '../../data/store'
import { undoDeadline } from '../../data/actions'
import { purchaseLines } from '../../domain/loyalty'
import { formatDateTime, formatInt, formatMoney, fullName, plural } from '../../lib/format'
import { useUser } from '../../session'
import type { CancellationRequestStatus, Transaction, TransactionStatus } from '../../types/domain'
import { Badge, Card, Empty, Field, Modal, PageHeader, Stat, run, useNow } from '../../components/ui'
import { UndoPurchase } from '../../components/UndoPurchase'
import { useWorkplace } from './useWorkplace'

const STATUS: Record<TransactionStatus, [string, 'success' | 'warning' | 'danger']> = {
  COMPLETED: ['Completada', 'success'],
  FLAGGED: ['En revisión', 'warning'],
  CANCELLED: ['Anulada', 'danger'],
}

const REQUEST_STATUS: Record<CancellationRequestStatus, [string, 'warning' | 'success' | 'danger']> = {
  PENDING: ['Esperando respuesta', 'warning'],
  APPROVED: ['Anulación aprobada', 'success'],
  REJECTED: ['Anulación rechazada', 'danger'],
}

const REASON_EXAMPLES = [
  'Se registró a otro cliente por error.',
  'Se registraron productos o cantidades equivocadas.',
  'La compra se registró dos veces.',
  'El cliente devolvió los productos.',
]

function RequestModal({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const db = useDb()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const customer = db.users.find((u) => u.id === tx.customerId)
  const valid = reason.trim().length >= 10

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const ok = await run('requestCancellation', { transactionId: tx.id, reason }, 'Solicitud enviada a la administración')
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <Modal title="Solicitar anulación" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <p>
          Compra #{tx.id} de <b>{customer && fullName(customer)}</b> por <b>{formatMoney(tx.amount)}</b>, registrada el {formatDateTime(tx.createdAt)}.
        </p>
        <p className="muted small">
          La administración del Paseo revisará tu pedido. Si lo aprueba, la compra se anula y se avisa al cliente; si lo rechaza, verás su respuesta
          aquí. Solo se puede enviar una solicitud por compra.
        </p>
        <Field label="Motivo" hint={`${reason.trim().length}/500 · mínimo 10 caracteres`}>
          <textarea rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
        </Field>
        <div className="chips" aria-label="Motivos frecuentes">
          {REASON_EXAMPLES.map((r) => (
            <button key={r} type="button" className="chip chip-suggest" onClick={() => setReason(r)}>
              {r}
            </button>
          ))}
        </div>
        <div className="row end gap">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" type="submit" disabled={!valid || busy}>
            Enviar solicitud
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function MerchantTransactionsPage() {
  const db = useDb()
  const me = useUser()
  const { business, membership } = useWorkplace()
  const isManager = membership.role === 'MANAGER'
  const [requesting, setRequesting] = useState<Transaction | null>(null)
  const now = useNow(1000)

  const txs = db.transactions.filter((t) => t.businessId === business.id).sort((a, b) => b.id - a.id)
  const today = new Date(now).toDateString()
  const completed = txs.filter((t) => t.status === 'COMPLETED')
  const todayTxs = completed.filter((t) => new Date(t.createdAt).toDateString() === today)
  const customers = new Set(completed.map((t) => t.customerId))
  const requests = db.cancellationRequests
    .filter((r) => txs.some((t) => t.id === r.transactionId))
    .sort((a, b) => b.id - a.id)
  const requestFor = (txId: number) => db.cancellationRequests.find((r) => r.transactionId === txId)

  return (
    <div className="page">
      <PageHeader
        title="Movimientos"
        subtitle={`Compras registradas en ${business.name}. Un registro se puede deshacer durante 2 minutos; después, el encargado solicita la anulación a la administración del Paseo.`}
      />
      <div className="stats-row">
        <Stat label="Compras hoy" value={todayTxs.length} hint={formatMoney(todayTxs.reduce((s, t) => s + t.amount, 0))} />
        <Stat label="Ventas registradas" value={formatMoney(completed.reduce((s, t) => s + t.amount, 0))} hint={plural(completed.length, 'compra', 'compras')} />
        <Stat label="Clientes únicos" value={customers.size} />
      </div>

      {isManager && requests.length > 0 && (
        <Card>
          <h2 className="card-title">
            <MessageSquareWarning size={18} aria-hidden /> Solicitudes de anulación
          </h2>
          <ul className="list">
            {requests.map((r) => {
              const tx = txs.find((t) => t.id === r.transactionId)!
              const customer = db.users.find((u) => u.id === tx.customerId)
              const [label, tone] = REQUEST_STATUS[r.status]
              return (
                <li key={r.id} className="list-row request-row">
                  <div className="stack-sm grow">
                    <div className="row between wrap gap">
                      <strong>
                        Compra #{tx.id} · {customer && fullName(customer)} · {formatMoney(tx.amount)}
                      </strong>
                      <Badge tone={tone}>{label}</Badge>
                    </div>
                    <span className="small">
                      <span className="muted">Tu motivo:</span> {r.reason}
                    </span>
                    {r.reviewNote && (
                      <span className="small request-reply">
                        <span className="muted">Respuesta de la administración:</span> {r.reviewNote}
                      </span>
                    )}
                    <span className="muted small">
                      Enviada el {formatDateTime(r.createdAt)}
                      {r.reviewedAt && ` · respondida el ${formatDateTime(r.reviewedAt)}`}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      <Card>
        {txs.length === 0 ? (
          <Empty>Aún no hay compras registradas.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table table-stack">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Productos</th>
                  <th>Registró</th>
                  <th className="num">Monto</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {txs.map((t) => {
                  const customer = db.users.find((u) => u.id === t.customerId)
                  const staff = db.users.find((u) => u.id === t.performedById)
                  const lines = purchaseLines(db, t.id)
                  const [label, tone] = STATUS[t.status]
                  const request = requestFor(t.id)
                  const canUndo = t.performedById === me.id || isManager
                  const canRequest = isManager && t.status === 'COMPLETED' && !request
                  return (
                    <tr key={t.id}>
                      <td className="muted" data-label="Compra">
                        #{t.id}
                      </td>
                      <td data-label="Fecha">{formatDateTime(t.createdAt)}</td>
                      <td data-label="Cliente">{customer && fullName(customer)}</td>
                      <td className="small" data-label="Productos">
                        {lines.length === 0 ? <span className="muted">Sin detalle</span> : lines.map((l) => `${formatInt(l.quantity)} × ${l.name}`).join(', ')}
                      </td>
                      <td data-label="Registró">{staff?.firstName}</td>
                      <td className="num" data-label="Monto">
                        {formatMoney(t.amount)}
                      </td>
                      <td data-label="Estado">
                        <div className="stack-sm">
                          <Badge tone={tone}>{label}</Badge>
                          {request && request.status !== 'APPROVED' && <Badge tone={REQUEST_STATUS[request.status][1]}>{REQUEST_STATUS[request.status][0]}</Badge>}
                        </div>
                      </td>
                      <td>
                        {canUndo && now < undoDeadline(t) ? (
                          <UndoPurchase
                            tx={t}
                            after={
                              canRequest && (
                                <button className="btn btn-ghost btn-sm" onClick={() => setRequesting(t)}>
                                  Solicitar anulación
                                </button>
                              )
                            }
                          />
                        ) : (
                          canRequest && (
                            <button className="btn btn-ghost btn-sm" onClick={() => setRequesting(t)}>
                              Solicitar anulación
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {requesting && <RequestModal tx={requesting} onClose={() => setRequesting(null)} />}
    </div>
  )
}
