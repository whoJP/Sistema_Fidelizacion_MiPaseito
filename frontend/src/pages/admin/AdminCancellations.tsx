import { useState, type FormEvent } from 'react'
import { Check, X } from 'lucide-react'
import { useDb } from '../../data/store'
import { cancellationImpact, cancellationNotice } from '../../data/actions'
import { pointsBalance, purchaseLines, statusTotal } from '../../domain/loyalty'
import { LIMITS } from '../../domain/validation'
import { formatDateTime, formatInt, formatMoney, fullName } from '../../lib/format'
import type { CancellationRequest, Database } from '../../types/domain'
import { Badge, Card, Empty, Field, Modal, PageHeader, run } from '../../components/ui'

type Tab = 'pending' | 'reviewed'
type Decision = { request: CancellationRequest; decision: 'APPROVED' | 'REJECTED' }

const REASON_EXAMPLES = [
  'el establecimiento registró la compra por error',
  'la compra se registró dos veces',
  'devolviste los productos de esta compra',
  'los productos registrados no corresponden a tu compra',
]

function details(db: Database, request: CancellationRequest) {
  const tx = db.transactions.find((t) => t.id === request.transactionId)!
  return {
    tx,
    business: db.businesses.find((b) => b.id === tx.businessId),
    customer: db.users.find((u) => u.id === tx.customerId),
    cashier: db.users.find((u) => u.id === tx.performedById),
    requester: db.users.find((u) => u.id === request.requestedById),
    reviewer: db.users.find((u) => u.id === request.reviewedById),
    lines: purchaseLines(db, tx.id),
  }
}

function DecisionModal({ request, decision, onClose }: Decision & { onClose: () => void }) {
  const db = useDb()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const { tx, customer, requester } = details(db, request)
  const approve = decision === 'APPROVED'
  const impact = cancellationImpact(db, tx.id)
  const notice = cancellationNotice(db, tx, impact.points, note.trim() || '…')
  const [lead, reason] = notice.message.split(' Motivo: ')
  const valid = approve ? note.trim().length >= 5 : true

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const ok = await run(
      'reviewCancellation',
      { requestId: request.id, decision, note },
      approve ? 'Compra anulada y cliente notificado' : 'Solicitud rechazada',
    )
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <Modal title={approve ? 'Aprobar anulación' : 'Rechazar solicitud'} onClose={onClose} wide={approve}>
      <form className="stack" onSubmit={submit}>
        {approve ? (
          <>
            <p className="small">
              La compra #{tx.id} se anula y se le descuentan los puntos a <b>{customer && fullName(customer)}</b>. Escribe el motivo que verá el cliente;
              el resto del aviso se arma solo.
            </p>
            <Field label="Motivo para el cliente" hint={`${note.trim().length}/${LIMITS.note} · completa la frase después de "Motivo:"`}>
              <textarea rows={2} maxLength={LIMITS.note} value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
            </Field>
            <div className="chips" aria-label="Motivos frecuentes">
              {REASON_EXAMPLES.map((r) => (
                <button key={r} type="button" className="chip chip-suggest" onClick={() => setNote(r)}>
                  {r}
                </button>
              ))}
            </div>
            <div className="notice-preview" aria-live="polite">
              <span className="field-label">Así lo verá el cliente</span>
              <article className="notice">
                <div className="notice-body">
                  <strong>{notice.title}</strong>
                  <p>
                    {lead} Motivo: <mark className={note.trim() ? '' : 'is-empty'}>{reason}</mark>
                  </p>
                </div>
              </article>
            </div>
          </>
        ) : (
          <>
            <p className="small">
              La compra se mantiene. {requester?.firstName ?? 'El encargado'} verá tu respuesta en Movimientos y no podrá volver a solicitar la anulación de esta
              compra.
            </p>
            <Field label="Explicación para el encargado (opcional)" hint={`${note.trim().length}/${LIMITS.note}`}>
              <textarea rows={3} maxLength={LIMITS.note} value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
            </Field>
          </>
        )}
        <div className="row end gap">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Volver
          </button>
          <button className={`btn ${approve ? 'btn-primary' : 'danger-solid'}`} type="submit" disabled={!valid || busy}>
            {approve ? 'Aprobar y notificar' : 'Rechazar solicitud'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function AdminCancellations() {
  const db = useDb()
  const [tab, setTab] = useState<Tab>('pending')
  const [deciding, setDeciding] = useState<Decision | null>(null)

  const all = [...db.cancellationRequests].sort((a, b) => b.id - a.id)
  const pending = all.filter((r) => r.status === 'PENDING').sort((a, b) => a.id - b.id)
  const reviewed = all.filter((r) => r.status !== 'PENDING')
  const shown = tab === 'pending' ? pending : reviewed

  return (
    <div className="page">
      <PageHeader
        title="Solicitudes de anulación"
        subtitle="Los encargados piden anular compras que ya no pueden deshacer. Si apruebas, la compra se anula y el cliente recibe un aviso con el motivo."
      />
      <div className="tabs">
        <button className={tab === 'pending' ? 'tab tab-active' : 'tab'} onClick={() => setTab('pending')}>
          Pendientes ({pending.length})
        </button>
        <button className={tab === 'reviewed' ? 'tab tab-active' : 'tab'} onClick={() => setTab('reviewed')}>
          Respondidas ({reviewed.length})
        </button>
      </div>

      {shown.length === 0 ? (
        <Card>
          <Empty>{tab === 'pending' ? 'No hay solicitudes pendientes.' : 'Aún no respondiste solicitudes.'}</Empty>
        </Card>
      ) : (
        <div className="stack">
          {shown.map((r) => {
            const { tx, business, customer, cashier, requester, reviewer, lines } = details(db, r)
            const impact = r.status === 'PENDING' ? cancellationImpact(db, tx.id) : null
            return (
              <Card key={r.id} className="request-card">
                <div className="row between wrap gap">
                  <div>
                    <h2>
                      Compra #{tx.id} · {business?.name}
                    </h2>
                    <div className="muted small">
                      {formatDateTime(tx.createdAt)} · registró {cashier?.firstName ?? '—'}
                    </div>
                  </div>
                  {r.status === 'PENDING' ? (
                    <Badge tone="warning">Pendiente</Badge>
                  ) : (
                    <Badge tone={r.status === 'APPROVED' ? 'success' : 'danger'}>{r.status === 'APPROVED' ? 'Aprobada' : 'Rechazada'}</Badge>
                  )}
                </div>

                <div className="request-grid">
                  <div className="stack-sm">
                    <span className="field-label">Compra</span>
                    <span>
                      <b>{customer && fullName(customer)}</b> <span className="muted small">{customer?.email}</span>
                    </span>
                    <ul className="receipt">
                      {lines.map((l) => (
                        <li key={l.id}>
                          <span>
                            {formatInt(l.quantity)} × {l.name}
                          </span>
                          <span className="tabular">{formatMoney(l.unitPrice * l.quantity)}</span>
                        </li>
                      ))}
                      <li className="receipt-total">
                        <span>Total</span>
                        <span className="tabular">{formatMoney(tx.amount)}</span>
                      </li>
                    </ul>
                  </div>
                  <div className="stack-sm">
                    <span className="field-label">Motivo del encargado</span>
                    <blockquote className="request-reason">{r.reason}</blockquote>
                    <span className="muted small">
                      {requester && fullName(requester)} · {formatDateTime(r.createdAt)}
                    </span>
                    {impact && customer && (
                      <p className="small request-impact">
                        Al aprobar se descuentan <b>{formatInt(impact.points)} puntos</b> y <b>{formatInt(impact.status)} puntos de nivel</b>. Saldo del cliente:{' '}
                        {formatInt(pointsBalance(db, customer.id))} → <b>{formatInt(pointsBalance(db, customer.id) - impact.points)}</b> puntos · nivel{' '}
                        {formatInt(statusTotal(db, customer.id))} → {formatInt(statusTotal(db, customer.id) - impact.status)}.
                      </p>
                    )}
                    {r.status !== 'PENDING' && (
                      <p className="small request-reply">
                        <span className="muted">{r.status === 'APPROVED' ? 'Motivo enviado al cliente:' : 'Respuesta al encargado:'}</span>{' '}
                        {r.reviewNote ?? 'Sin explicación.'}
                        <span className="muted">
                          {' '}
                          · {reviewer?.firstName} {r.reviewedAt && formatDateTime(r.reviewedAt)}
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                {r.status === 'PENDING' && (
                  <div className="row end gap">
                    <button className="btn btn-ghost danger" onClick={() => setDeciding({ request: r, decision: 'REJECTED' })}>
                      <X size={16} aria-hidden /> Rechazar
                    </button>
                    <button className="btn btn-primary" onClick={() => setDeciding({ request: r, decision: 'APPROVED' })}>
                      <Check size={16} aria-hidden /> Aprobar
                    </button>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {deciding && <DecisionModal {...deciding} onClose={() => setDeciding(null)} />}
    </div>
  )
}
