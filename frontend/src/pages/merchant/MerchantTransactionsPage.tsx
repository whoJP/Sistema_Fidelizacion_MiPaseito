import { useState, type FormEvent } from 'react'
import { CakeSlice, ChevronRight, MessageSquareWarning, Search, Ticket, X } from 'lucide-react'
import { useDb } from '../../data/store'
import { undoDeadline } from '../../data/actions'
import { purchaseLines, rewardTitle } from '../../domain/loyalty'
import { LIMITS } from '../../domain/validation'
import { formatDateTime, formatInt, formatMoney, fullName, normalizeText, plural } from '../../lib/format'
import { useUser } from '../../session'
import type { CancellationRequestStatus, Transaction, TransactionStatus } from '../../types/domain'
import { useNow } from '../../lib/useNow'
import { Badge, Card, Empty, Field, Modal, PageHeader, Stat, run } from '../../components/ui'
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

const PERIODS = [
  ['today', 'Hoy'],
  ['7', 'Últimos 7 días'],
  ['30', 'Últimos 30 días'],
  ['all', 'Todo'],
] as const
type Period = (typeof PERIODS)[number][0]

const PAGE = 50

function RequestModal({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const db = useDb()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const customer = db.users.find((u) => u.id === tx.customerId)
  const valid = reason.trim().length >= LIMITS.reasonMin

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
        <p className="muted small">La administración la revisa. Una solicitud por compra.</p>
        <Field label="Motivo" hint={`${reason.trim().length}/${LIMITS.reason} · mínimo ${LIMITS.reasonMin}`}>
          <textarea rows={3} maxLength={LIMITS.reason} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
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

/** Everything staff may see about one purchase: customer, products, benefits, points and its cancellation. */
function DetailModal({ tx, onRequest, onClose }: { tx: Transaction; onRequest: () => void; onClose: () => void }) {
  const db = useDb()
  const me = useUser()
  const now = useNow(1000)
  const { membership } = useWorkplace()
  const isManager = membership.role === 'MANAGER'
  const customer = db.users.find((u) => u.id === tx.customerId)
  const staff = db.users.find((u) => u.id === tx.performedById)
  const lines = purchaseLines(db, tx.id)
  const subtotal = Math.round((tx.amount + tx.discount) * 100) / 100
  const birthday = db.birthdayClaims.find((c) => c.transactionId === tx.id)
  const canjes = db.redemptions.filter((r) => r.transactionId === tx.id)
  const points = db.pointMovements.filter((m) => m.transactionId === tx.id && m.type !== 'REVERSAL').reduce((s, m) => s + m.amount, 0)
  const status = db.statusMovements.filter((m) => m.transactionId === tx.id && m.amount > 0).reduce((s, m) => s + m.amount, 0)
  const request = db.cancellationRequests.find((r) => r.transactionId === tx.id)
  const [label, tone] = STATUS[tx.status]
  const canUndo = (tx.performedById === me.id || isManager) && now < undoDeadline(tx)
  const canRequest = isManager && tx.status === 'COMPLETED' && !request

  return (
    <Modal title={`Compra #${tx.id}`} onClose={onClose} wide>
      <div className="stack">
        <div className="row between wrap gap">
          <Badge tone={tone}>{label}</Badge>
          <span className="muted small">{formatDateTime(tx.createdAt)}</span>
        </div>

        <dl className="detail-facts">
          <div>
            <dt>Cliente</dt>
            <dd>
              {customer ? fullName(customer) : 'Cliente'}
              {customer?.email && <span className="muted small"> · {customer.email}</span>}
            </dd>
          </div>
          <div>
            <dt>Registró</dt>
            <dd>{staff ? fullName(staff) : '—'}</dd>
          </div>
          <div>
            <dt>Puntos que sumó</dt>
            <dd className="tabular">
              {tx.status === 'COMPLETED' ? `${formatInt(points)} puntos · ${formatInt(status)} de nivel` : tx.status === 'FLAGGED' ? 'Al aprobarse' : 'Ninguno (anulada)'}
            </dd>
          </div>
        </dl>

        <ul className="receipt">
          {lines.map((l) => (
            <li key={l.id}>
              <span>
                {formatInt(l.quantity)} × {l.name} <span className="muted small">({formatMoney(l.unitPrice)} c/u)</span>
              </span>
              <span className="tabular">{formatMoney(l.unitPrice * l.quantity)}</span>
            </li>
          ))}
          {lines.length === 0 && <li className="muted">Sin detalle de productos</li>}
          {tx.discount > 0 && (
            <li className="receipt-total">
              <span>Subtotal</span>
              <span className="tabular">{formatMoney(subtotal)}</span>
            </li>
          )}
          {birthday && birthday.discount > 0 && (
            <li className="receipt-discount">
              <span>Cumpleaños</span>
              <span className="tabular">−{formatMoney(birthday.discount)}</span>
            </li>
          )}
          {canjes
            .filter((r) => (r.discount ?? 0) > 0)
            .map((r) => {
              const reward = db.rewards.find((x) => x.id === r.rewardId)
              return (
                <li key={r.id} className="receipt-discount">
                  <span>Canje: {reward ? rewardTitle(db, reward) : 'Recompensa'}</span>
                  <span className="tabular">−{formatMoney(r.discount ?? 0)}</span>
                </li>
              )
            })}
          <li className="receipt-total">
            <span>Total cobrado</span>
            <span className="tabular">{formatMoney(tx.amount)}</span>
          </li>
        </ul>

        {(birthday || canjes.length > 0) && (
          <div className="stack-sm">
            <h3 className="small-title">Beneficios usados</h3>
            <ul className="receipt-benefits small">
              {birthday && (
                <li>
                  <CakeSlice size={14} aria-hidden /> Cumpleaños: {birthday.perkTitle}
                </li>
              )}
              {canjes.map((r) => {
                const reward = db.rewards.find((x) => x.id === r.rewardId)
                return (
                  <li key={r.id}>
                    <Ticket size={14} aria-hidden /> Canje: {reward ? rewardTitle(db, reward) : 'Recompensa'}
                    {r.origin === 'POINTS' ? ` · ${plural(r.pointsSpent, 'punto', 'puntos')}` : r.origin === 'BIRTHDAY' ? ' · regalo de cumpleaños' : ' · premio de la ruleta'}
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {tx.status === 'FLAGGED' && <p className="small">La administración del Paseo la está revisando; suma puntos al aprobarse.</p>}

        {request && (
          <div className="stack-sm request-row">
            <div className="row between wrap gap">
              <h3 className="small-title">Solicitud de anulación</h3>
              <Badge tone={REQUEST_STATUS[request.status][1]}>{REQUEST_STATUS[request.status][0]}</Badge>
            </div>
            <span className="small">
              <span className="muted">Motivo:</span> {request.reason}
            </span>
            {request.reviewNote && (
              <span className="small request-reply">
                <span className="muted">Respuesta:</span> {request.reviewNote}
              </span>
            )}
            <span className="muted small">
              Enviada el {formatDateTime(request.createdAt)}
              {request.reviewedAt && ` · respondida el ${formatDateTime(request.reviewedAt)}`}
            </span>
          </div>
        )}

        {(canUndo || canRequest) && (
          <div className="row end gap wrap">
            {canUndo && <UndoPurchase tx={tx} />}
            {canRequest && (
              <button className="btn btn-ghost btn-sm" onClick={onRequest}>
                Solicitar anulación
              </button>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

export function MerchantTransactionsPage() {
  const db = useDb()
  const { business, membership } = useWorkplace()
  const isManager = membership.role === 'MANAGER'
  const [requesting, setRequesting] = useState<Transaction | null>(null)
  const [viewing, setViewing] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<TransactionStatus | 'ALL'>('ALL')
  const [period, setPeriod] = useState<Period>('30')
  const [withBenefits, setWithBenefits] = useState(false)
  const [shown, setShown] = useState(PAGE)
  const now = useNow(60_000)

  const txs = db.transactions.filter((t) => t.businessId === business.id).sort((a, b) => b.id - a.id)
  const today = new Date(now).toDateString()
  const completed = txs.filter((t) => t.status === 'COMPLETED')
  const todayTxs = completed.filter((t) => new Date(t.createdAt).toDateString() === today)
  const customers = new Set(completed.map((t) => t.customerId))
  const requests = db.cancellationRequests
    .filter((r) => txs.some((t) => t.id === r.transactionId))
    .sort((a, b) => b.id - a.id)
  const requestFor = (txId: number) => db.cancellationRequests.find((r) => r.transactionId === txId)
  const benefitTx = new Set([
    ...db.redemptions.flatMap((r) => (r.transactionId ? [r.transactionId] : [])),
    ...db.birthdayClaims.map((c) => c.transactionId),
  ])

  const q = normalizeText(query.trim().replace(/^#/, ''))
  const since = period === 'all' ? 0 : period === 'today' ? new Date(new Date(now).toDateString()).getTime() : now - Number(period) * 86_400_000
  const filtered = txs.filter((t) => {
    if (status !== 'ALL' && t.status !== status) return false
    if (new Date(t.createdAt).getTime() < since) return false
    if (withBenefits && !benefitTx.has(t.id)) return false
    if (!q) return true
    const c = db.users.find((u) => u.id === t.customerId)
    return String(t.id) === q || (!!c && (normalizeText(fullName(c)).includes(q) || normalizeText(c.email).includes(q)))
  })
  const filteredTotal = filtered.filter((t) => t.status !== 'CANCELLED').reduce((s, t) => s + t.amount, 0)
  const viewed = viewing ? txs.find((t) => t.id === viewing) : undefined

  return (
    <div className="page">
      <PageHeader title="Movimientos" subtitle={`Compras registradas en ${business.name}`} />
      <div className="stats-row">
        <Stat label="Compras hoy" value={todayTxs.length} hint={formatMoney(todayTxs.reduce((s, t) => s + t.amount, 0))} />
        <Stat label="Ventas registradas" value={formatMoney(completed.reduce((s, t) => s + t.amount, 0))} hint={plural(completed.length, 'compra', 'compras')} />
        <Stat label="Clientes únicos" value={customers.size} />
      </div>

      {isManager && requests.some((r) => r.status === 'PENDING' || r.status === 'REJECTED') && (
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
                      <button type="button" className="link-btn" onClick={() => setViewing(tx.id)}>
                        Compra #{tx.id} · {customer && fullName(customer)} · {formatMoney(tx.amount)}
                      </button>
                      <Badge tone={tone}>{label}</Badge>
                    </div>
                    <span className="small">
                      <span className="muted">Tu motivo:</span> {r.reason}
                    </span>
                    {r.reviewNote && (
                      <span className="small request-reply">
                        <span className="muted">Respuesta:</span> {r.reviewNote}
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      <Card>
        <div className="filters">
          <div className="filters-row">
            <label className="search">
              <Search size={16} aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setShown(PAGE)
                }}
                placeholder="Buscar por nombre, correo o número de compra"
                aria-label="Buscar compras"
              />
              {query && (
                <button type="button" className="search-clear" onClick={() => setQuery('')} aria-label="Borrar búsqueda">
                  <X size={15} />
                </button>
              )}
            </label>
            <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} aria-label="Período">
              {PERIODS.map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
          </div>
          <div className="chips" aria-label="Filtrar por estado">
            {(['ALL', 'COMPLETED', 'FLAGGED', 'CANCELLED'] as const).map((s) => (
              <button key={s} type="button" className={`chip ${status === s ? 'chip-active' : ''}`} aria-pressed={status === s} onClick={() => setStatus(s)}>
                {s === 'ALL' ? 'Todas' : STATUS[s][0]}
              </button>
            ))}
            <button type="button" className={`chip ${withBenefits ? 'chip-active' : ''}`} aria-pressed={withBenefits} onClick={() => setWithBenefits(!withBenefits)}>
              Con canje o cumpleaños
            </button>
          </div>
          <p className="muted small">
            {plural(filtered.length, 'compra', 'compras')} · {formatMoney(filteredTotal)} cobrados
          </p>
        </div>

        {txs.length === 0 ? (
          <Empty>Aún no hay compras registradas.</Empty>
        ) : filtered.length === 0 ? (
          <Empty>Ninguna compra coincide con los filtros.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table table-stack table-rows-click">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Compra</th>
                  <th className="num">Monto</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, shown).map((t) => {
                  const customer = db.users.find((u) => u.id === t.customerId)
                  const lines = purchaseLines(db, t.id)
                  const [label, tone] = STATUS[t.status]
                  const request = requestFor(t.id)
                  const units = lines.reduce((s, l) => s + l.quantity, 0)
                  return (
                    <tr key={t.id} onClick={() => setViewing(t.id)}>
                      <td data-label="Fecha">
                        {formatDateTime(t.createdAt)}
                        <div className="muted small">#{t.id}</div>
                      </td>
                      <td data-label="Cliente">
                        <strong>{customer && fullName(customer)}</strong>
                        {customer?.email && <div className="muted small">{customer.email}</div>}
                      </td>
                      <td className="small" data-label="Compra">
                        {lines.length === 0 ? (
                          <span className="muted">Sin detalle</span>
                        ) : (
                          <span className="clamp-1">
                            {lines.length === 1 ? `${formatInt(lines[0].quantity)} × ${lines[0].name}` : `${plural(units, 'producto', 'productos')}: ${lines.map((l) => l.name).join(', ')}`}
                          </span>
                        )}
                      </td>
                      <td className="num" data-label="Monto">
                        {formatMoney(t.amount)}
                        {t.discount > 0 && <div className="muted small">−{formatMoney(t.discount)} desc.</div>}
                      </td>
                      <td data-label="Estado">
                        <div className="stack-sm">
                          <Badge tone={tone}>{label}</Badge>
                          {request && request.status !== 'APPROVED' && <Badge tone={REQUEST_STATUS[request.status][1]}>{REQUEST_STATUS[request.status][0]}</Badge>}
                        </div>
                      </td>
                      <td className="num">
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Ver compra #${t.id}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            setViewing(t.id)
                          }}
                        >
                          <ChevronRight size={16} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > shown && (
          <button type="button" className="btn btn-ghost align-start" onClick={() => setShown(shown + PAGE)}>
            Mostrar más ({formatInt(filtered.length - shown)} restantes)
          </button>
        )}
      </Card>

      {viewed && !requesting && <DetailModal tx={viewed} onClose={() => setViewing(null)} onRequest={() => setRequesting(viewed)} />}
      {requesting && <RequestModal tx={requesting} onClose={() => setRequesting(null)} />}
    </div>
  )
}
