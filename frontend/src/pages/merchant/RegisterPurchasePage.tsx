import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  CakeSlice,
  CheckCircle2,
  Gift,
  Minus,
  Plus,
  Search,
  Ticket,
  Trash2,
  TrendingUp,
  Undo2,
  UserRound,
  X,
} from 'lucide-react'
import { ApiError, api, type IdentifiedCustomer } from '../../data/api'
import { useDb } from '../../data/store'
import { birthdayPerksOf, birthdayUsedAt, quoteCheckout, usableRedemptions, type Benefit } from '../../domain/checkout'
import { localYear } from '../../domain/engagement'
import { purchaseLines, redemptionExpiresAt, rewardTitle } from '../../domain/loyalty'
import { LIMITS } from '../../domain/validation'
import { formatDate, formatDateTime, formatInt, formatMoney, fullName, normalizeText, plural } from '../../lib/format'
import { useNow } from '../../lib/useNow'
import { useUser } from '../../session'
import type { CatalogItem, Redemption } from '../../types/domain'
import { Badge, Card, Empty, Field, Modal, PageHeader, notify, prefersReducedMotion, run, vanish } from '../../components/ui'
import { confirmDialog } from '../../components/dialog'
import { ScanOrCode } from '../../components/ScanOrCode'
import { UndoPurchase } from '../../components/UndoPurchase'
import { useWorkplace } from './useWorkplace'

type Line = { item: CatalogItem; quantity: number }

const REJECT_EXAMPLES = [
  'Se agotó el producto de la recompensa.',
  'La promoción ya no está vigente en el local.',
  'El cliente pidió no usar el canje.',
]

/** Staff refuse a canje: the customer gets the points back and a notice; the reason goes to the Paseo admin. */
function RejectModal({ redemption, customerName, onClose }: { redemption: Redemption; customerName: string; onClose: () => void }) {
  const db = useDb()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const reward = db.rewards.find((r) => r.id === redemption.rewardId)
  const valid = reason.trim().length >= LIMITS.reasonMin

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const ok = await run(
      'rejectRedemption',
      { redemptionId: redemption.id, reason },
      redemption.pointsSpent > 0 ? 'Canje cancelado: los puntos volvieron al cliente' : 'Canje cancelado',
    )
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <Modal title="No entregar el canje" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <p>
          <b>{reward ? rewardTitle(db, reward) : 'Recompensa'}</b> de <b>{customerName}</b>.
        </p>
        <p className="muted small">
          {redemption.pointsSpent > 0 ? `Se le devuelven ${plural(redemption.pointsSpent, 'punto', 'puntos')} y recibe un aviso. ` : 'Recibe un aviso. '}
          El motivo solo lo ve la administración del Paseo.
        </p>
        <Field label="Motivo" hint={`${reason.trim().length}/${LIMITS.reason} · mínimo ${LIMITS.reasonMin}`}>
          <textarea rows={3} maxLength={LIMITS.reason} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
        </Field>
        <div className="chips" aria-label="Motivos frecuentes">
          {REJECT_EXAMPLES.map((r) => (
            <button key={r} type="button" className="chip chip-suggest" onClick={() => setReason(r)}>
              {r}
            </button>
          ))}
        </div>
        <div className="row end gap">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Volver
          </button>
          <button className="btn danger-solid" type="submit" disabled={!valid || busy}>
            Cancelar canje
          </button>
        </div>
      </form>
    </Modal>
  )
}

const benefitLine = (b: Benefit) => (
  <li key={b.title}>
    <b>{b.title}</b>
    {b.discount > 0 ? ` · −${formatMoney(b.discount)}` : ` · ${b.note}`}
  </li>
)

export function RegisterPurchasePage() {
  const db = useDb()
  const me = useUser()
  const now = useNow(30_000)
  const { business, membership } = useWorkplace()
  const productsRef = useRef<HTMLDivElement>(null)
  const [customer, setCustomer] = useState<IdentifiedCustomer | null>(null)
  const [query, setQuery] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [useBirthday, setUseBirthday] = useState(true)
  const [rejecting, setRejecting] = useState<Redemption | null>(null)
  const [lastId, setLastId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  const catalog = db.catalogItems
    .filter((i) => i.businessId === business.id && i.deletedAt === null && i.isAvailable)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const q = normalizeText(query.trim())
  const matches = q ? catalog.filter((i) => normalizeText(i.name).includes(q) || normalizeText(i.description ?? '').includes(q)) : catalog
  const quantityOf = (itemId: number) => lines.find((l) => l.item.id === itemId)?.quantity ?? 0
  const units = lines.reduce((s, l) => s + l.quantity, 0)

  // Benefits the customer brings to this counter: canjes of this business and, on their birthday, its birthday perks.
  const canjes = customer ? usableRedemptions(db, customer.id, business.id, new Date(now)) : []
  const perks = birthdayPerksOf(db, business.id)
  const birthdayUsed = !!customer && birthdayUsedAt(db, customer.id, business.id, localYear(new Date(now)))
  const birthdayEligible = !!customer?.birthdayToday && perks.length > 0 && !birthdayUsed
  const chosen = canjes.filter((r) => selected.includes(r.id))
  const applyBirthday = birthdayEligible && useBirthday
  const quote = quoteCheckout(db, { lines, redemptions: chosen, birthdayPerks: applyBirthday ? perks : [] })
  const preview = quoteCheckout(db, { lines, redemptions: canjes, birthdayPerks: birthdayEligible ? perks : [] })
  const birthdayRows = applyBirthday ? quote.birthday : preview.birthday
  const appliedCanjes = quote.redemptions.filter((b) => b.applies)
  const appliedBirthday = quote.birthday.filter((b) => b.applies)

  const last = lastId ? db.transactions.find((t) => t.id === lastId) : undefined
  const recent = db.transactions
    .filter((t) => t.businessId === business.id && t.performedById === me.id && t.id !== last?.id)
    .sort((a, b) => b.id - a.id)
    .slice(0, 5)

  const reset = () => {
    setCustomer(null)
    setSelected([])
    setUseBirthday(true)
  }

  const identify = async (value: string) => {
    if (!value.trim() || busy) return false
    setBusy(true)
    try {
      const found = await api.identifyCustomer(value.trim())
      const usable = usableRedemptions(db, found.id, business.id)
      const birthday = found.birthdayToday && perks.length > 0 && !birthdayUsedAt(db, found.id, business.id, localYear())
      setCustomer(found)
      setSelected(usable.map((r) => r.id))
      setUseBirthday(true)
      const extras = [usable.length > 0 && `tiene ${plural(usable.length, 'canje', 'canjes')} aquí`, birthday && '¡hoy cumple años!'].filter(Boolean)
      notify('success', `Cliente identificado: ${fullName(found)}${extras.length ? ` · ${extras.join(' y ')}` : ''}`)
      if (lines.length === 0 && !usable.length && !birthday) {
        productsRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
      }
      return true
    } catch (err) {
      notify('error', err instanceof ApiError ? err.message : 'Error inesperado')
      return false
    } finally {
      setBusy(false)
    }
  }

  const add = (item: CatalogItem) =>
    setLines((current) =>
      current.some((l) => l.item.id === item.id)
        ? current.map((l) => (l.item.id === item.id ? { ...l, quantity: Math.min(999, l.quantity + 1) } : l))
        : [...current, { item, quantity: 1 }],
    )
  const setQuantity = (itemId: number, quantity: number) =>
    setLines((current) => current.map((l) => (l.item.id === itemId ? { ...l, quantity: Math.max(1, Math.min(999, Math.trunc(quantity) || 1)) } : l)))
  const remove = (itemId: number) => setLines((current) => current.filter((l) => l.item.id !== itemId))
  const toggle = (id: number, on: boolean) => setSelected((current) => (on ? [...current, id] : current.filter((x) => x !== id)))

  const handOver = async (r: Redemption) => {
    const reward = db.rewards.find((x) => x.id === r.rewardId)
    const ok = await confirmDialog({
      title: 'Entregar sin compra',
      message: (
        <p>
          Entrega <b>{reward ? rewardTitle(db, reward) : 'la recompensa'}</b> a {customer && fullName(customer)} sin registrar una compra. El canje queda
          usado.
        </p>
      ),
      confirmLabel: 'Entregar',
    })
    if (ok) await run('redeemWithoutPurchase', { redemptionId: r.id }, 'Canje entregado')
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!customer || lines.length === 0) return
    if (canjes.length > 0 || birthdayEligible) {
      const pendingCanjes = canjes.filter((r) => !appliedCanjes.some((b) => b.redemption.id === r.id))
      const ok = await confirmDialog({
        title: appliedCanjes.length || appliedBirthday.length ? 'Confirma los beneficios' : 'Sin beneficios en esta compra',
        message: (
          <div className="stack-sm">
            {birthdayEligible &&
              (appliedBirthday.length > 0 ? (
                <div>
                  <span className="muted small">Cumpleaños (solo una vez este año):</span>
                  <ul className="confirm-list">{appliedBirthday.map(benefitLine)}</ul>
                </div>
              ) : (
                <p>
                  <CakeSlice size={15} aria-hidden /> No está usando sus beneficios de cumpleaños. Podrá usarlos en otra compra de hoy.
                </p>
              ))}
            {appliedCanjes.length > 0 && (
              <div>
                <span className="muted small">Canjes que se usan:</span>
                <ul className="confirm-list">{appliedCanjes.map(benefitLine)}</ul>
              </div>
            )}
            {pendingCanjes.length > 0 && (
              <p className="muted small">
                {pendingCanjes.length === 1 ? 'Queda 1 canje activo' : `Quedan ${pendingCanjes.length} canjes activos`} en su tarjeta para otra compra.
              </p>
            )}
            <p>
              Total a cobrar: <b className="tabular">{formatMoney(quote.total)}</b>
              {quote.discount > 0 && <span className="muted"> (descuento {formatMoney(quote.discount)})</span>}
            </p>
          </div>
        ),
        confirmLabel: 'Seguir y registrar',
        cancelLabel: 'Cancelar',
      })
      if (!ok) return
    }
    setBusy(true)
    const r = await run('registerPurchase', {
      customerId: customer.id,
      businessId: business.id,
      items: lines.map((l) => ({ catalogItemId: l.item.id, quantity: l.quantity })),
      redemptionIds: appliedCanjes.map((b) => b.redemption.id),
      useBirthday: applyBirthday && appliedBirthday.length > 0,
    })
    setBusy(false)
    if (!r) return
    notify(r.flagged ? 'error' : 'success', r.flagged ? 'Compra registrada y enviada a revisión' : 'Compra registrada')
    setLastId(r.transaction.id)
    setLines([])
    setQuery('')
    reset()
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }

  const lastCustomer = last && db.users.find((u) => u.id === last.customerId)
  const lastCanjes = last ? db.redemptions.filter((r) => r.transactionId === last.id) : []
  const lastBirthday = last && db.birthdayClaims.find((c) => c.transactionId === last.id)
  const submitLabel = !customer
    ? 'Identifica al cliente para registrar'
    : lines.length === 0
      ? 'Agrega productos para registrar'
      : 'Registrar compra'

  return (
    <div className="page">
      <PageHeader title="Registrar compra" subtitle={business.name} />

      <div className="detail-grid">
        <div className="stack">
          <Card>
            <h2 className="card-title">
              <span className={`step-num ${customer ? 'is-done' : ''}`}>{customer ? <CheckCircle2 size={16} aria-hidden /> : 1}</span> Cliente
            </h2>
            {customer ? (
              <div className="identified">
                <span className="avatar">
                  <UserRound size={18} aria-hidden />
                </span>
                <div className="identified-name">
                  <strong>{fullName(customer)}</strong>
                  <span className="muted small">{customer.email}</span>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
                  Cambiar
                </button>
              </div>
            ) : (
              <ScanOrCode kind="customer" onSubmit={identify} busy={busy} scanLabel="Escanea el QR de la tarjeta del cliente" />
            )}
            {customer?.birthdayToday && birthdayUsed && (
              <p className="register-hint">
                <CakeSlice size={16} aria-hidden />
                <span>Hoy cumple años. Ya usó sus beneficios de cumpleaños en este local.</span>
              </p>
            )}
            {customer?.birthdayToday && !birthdayUsed && perks.length === 0 && (
              <p className="register-hint is-birthday">
                <CakeSlice size={16} aria-hidden />
                <span>¡Hoy cumple años! Tu local no tiene beneficios de cumpleaños configurados.</span>
              </p>
            )}
            {customer?.nextTier?.missingBs != null && (
              <p className="register-hint">
                <TrendingUp size={16} aria-hidden />
                <span>
                  Le faltan <b className="tabular">{formatMoney(customer.nextTier.missingBs)}</b> para {customer.nextTier.tierName}.
                </span>
              </p>
            )}
          </Card>

          {customer && (canjes.length > 0 || birthdayEligible) && (
            <Card className="benefits-card">
              <h2 className="card-title">
                <Gift size={18} aria-hidden /> Beneficios del cliente
              </h2>

              {birthdayEligible && (
                <div className="benefit-group is-birthday">
                  <div className="row between wrap gap">
                    <strong className="row gap-sm">
                      <CakeSlice size={16} aria-hidden /> ¡Hoy cumple años!
                    </strong>
                    <label className="check">
                      <input type="checkbox" checked={useBirthday} onChange={(e) => setUseBirthday(e.target.checked)} />
                      Aplicar en esta compra
                    </label>
                  </div>
                  <ul className="benefit-list">
                    {birthdayRows.map((b) => (
                      <li key={b.perk.id} className={`benefit-row ${b.applies && applyBirthday ? 'is-on' : ''}`}>
                        <div className="grow">
                          <span>{b.title}</span>
                          <span className="muted small">{b.note}</span>
                        </div>
                        {b.applies && applyBirthday ? (
                          <Badge tone="success">{b.discount > 0 ? `−${formatMoney(b.discount)}` : 'Aplica'}</Badge>
                        ) : (
                          <Badge>{b.applies ? 'Sin aplicar' : 'Aún no aplica'}</Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className="muted small">Se usan una sola vez al año en este local, solo los que apliquen a la compra.</p>
                </div>
              )}

              {canjes.length > 0 && (
                <div className="benefit-group">
                  <strong className="row gap-sm">
                    <Ticket size={16} aria-hidden /> {canjes.length === 1 ? 'Canje activo en este local' : `${canjes.length} canjes activos en este local`}
                  </strong>
                  <ul className="benefit-list">
                    {preview.redemptions.map((b) => {
                      const on = selected.includes(b.redemption.id)
                      const applied = quote.redemptions.find((x) => x.redemption.id === b.redemption.id)
                      const expires = redemptionExpiresAt(db, b.redemption.createdAt, b.redemption.expiresAt)
                      return (
                        <li key={b.redemption.id} className={`benefit-row ${on && applied?.applies ? 'is-on' : ''}`}>
                          <label className="check grow">
                            <input type="checkbox" checked={on} onChange={(e) => toggle(b.redemption.id, e.target.checked)} />
                            <span className="stack-xs">
                              <span>{b.title}</span>
                              <span className="muted small">
                                {on && applied && !applied.applies ? applied.note : b.note} · vence el {formatDate(expires.toISOString())}
                              </span>
                            </span>
                          </label>
                          {on && applied?.applies && applied.discount > 0 && <Badge tone="success">−{formatMoney(applied.discount)}</Badge>}
                          <div className="row gap-sm">
                            {b.reward?.type === 'FREE_PRODUCT' && (
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void handOver(b.redemption)}>
                                Entregar sin compra
                              </button>
                            )}
                            <button type="button" className="btn btn-ghost btn-sm danger" onClick={() => setRejecting(b.redemption)}>
                              No entregar
                            </button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                  <p className="muted small">Los marcados se usan al registrar la compra; los demás siguen activos en su tarjeta.</p>
                </div>
              )}
            </Card>
          )}

          <Card>
            <div ref={productsRef} className="scroll-target">
              <div className="card-head">
                <h2 className="card-title">
                  <span className="step-num">2</span> Productos
                </h2>
                {catalog.length > 0 && <span className="muted small">{plural(catalog.length, 'disponible', 'disponibles')}</span>}
              </div>
              {catalog.length === 0 ? (
                <Empty>
                  {membership.role === 'MANAGER' ? (
                    <>
                      Agrega productos a tu <Link to={`/merchant/${business.id}/catalog`}>catálogo</Link>.
                    </>
                  ) : (
                    'Sin productos. Pide al encargado que los agregue.'
                  )}
                </Empty>
              ) : (
                <form className="stack" onSubmit={submit}>
                  <div className="picker">
                    <label className="search">
                      <Search size={16} aria-hidden />
                      <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar producto por nombre" aria-label="Buscar producto" />
                      {query && (
                        <button type="button" className="search-clear" onClick={() => setQuery('')} aria-label="Borrar búsqueda">
                          <X size={15} />
                        </button>
                      )}
                    </label>
                    <ul className="pick-list" aria-label="Productos del catálogo">
                      {matches.map((item) => {
                        const qty = quantityOf(item.id)
                        return (
                          <li key={item.id}>
                            <button type="button" className={`pick-row ${qty ? 'is-picked' : ''}`} onClick={() => add(item)} aria-label={`Agregar ${item.name}, ${formatMoney(item.price)}`}>
                              <span className="pick-name">
                                <strong>{item.name}</strong>
                                {(item.category || item.description) && (
                                  <span className="muted small clamp-1">{[item.category, item.description].filter(Boolean).join(' · ')}</span>
                                )}
                              </span>
                              <span className="pick-price tabular">{formatMoney(item.price)}</span>
                              <span className="pick-add" aria-hidden>
                                {qty ? <b className="tabular">{qty}</b> : <Plus size={16} />}
                              </span>
                            </button>
                          </li>
                        )
                      })}
                      {matches.length === 0 && <li className="pick-empty muted small">Ningún producto coincide con «{query}».</li>}
                    </ul>
                  </div>

                  {lines.length > 0 && (
                    <div className="stack-sm">
                      <div className="row between">
                        <h3 className="small-title">Productos de esta compra</h3>
                        <button type="button" className="btn btn-ghost btn-sm danger" onClick={() => setLines([])}>
                          <Trash2 size={14} aria-hidden /> Vaciar
                        </button>
                      </div>
                      <ul className="cart" aria-label="Productos de la compra">
                        {lines.map(({ item, quantity }) => (
                          <li key={item.id} className="cart-row">
                            <div className="cart-name">
                              <strong>{item.name}</strong>
                              <span className="muted small tabular">
                                {formatMoney(item.price)} c/u · <b className="tabular">{formatMoney(item.price * quantity)}</b>
                              </span>
                            </div>
                            <div className="qty">
                              <button
                                type="button"
                                className="icon-btn"
                                aria-label={quantity <= 1 ? `Quitar ${item.name}` : `Quitar una unidad de ${item.name}`}
                                onClick={(e) => (quantity <= 1 ? void vanish(e.currentTarget, () => remove(item.id)) : setQuantity(item.id, quantity - 1))}
                              >
                                {quantity <= 1 ? <Trash2 size={15} /> : <Minus size={15} />}
                              </button>
                              <input
                                type="number"
                                inputMode="numeric"
                                min={1}
                                max={999}
                                step={1}
                                value={quantity}
                                onChange={(e) => setQuantity(item.id, Number(e.target.value))}
                                aria-label={`Cantidad de ${item.name}`}
                              />
                              <button type="button" className="icon-btn" aria-label={`Agregar una unidad de ${item.name}`} onClick={() => setQuantity(item.id, quantity + 1)}>
                                <Plus size={15} />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                      {quote.discount > 0 && (
                        <ul className="receipt">
                          <li>
                            <span>Subtotal</span>
                            <span className="tabular">{formatMoney(quote.subtotal)}</span>
                          </li>
                          {[...appliedBirthday, ...appliedCanjes]
                            .filter((b) => b.discount > 0)
                            .map((b) => (
                              <li key={b.title} className="receipt-discount">
                                <span>{b.title}</span>
                                <span className="tabular">−{formatMoney(b.discount)}</span>
                              </li>
                            ))}
                        </ul>
                      )}
                    </div>
                  )}

                  <div className="checkout-bar">
                    <div className="checkout-total">
                      <span className="muted small">
                        {lines.length === 0 ? 'Sin productos' : plural(units, 'producto', 'productos')}
                        {quote.discount > 0 && ` · −${formatMoney(quote.discount)}`}
                      </span>
                      <strong className="tabular">{formatMoney(quote.total)}</strong>
                    </div>
                    <button className="btn btn-primary" type="submit" disabled={!customer || lines.length === 0 || busy}>
                      {busy && customer ? 'Registrando…' : submitLabel}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </Card>
        </div>

        <div className="stack">
          {last && lastCustomer && (
            <Card className={last.status === 'CANCELLED' ? '' : last.status === 'FLAGGED' ? 'card-warning' : 'card-success'}>
              <h2 className="row gap">
                {last.status === 'CANCELLED' ? <Undo2 size={20} /> : last.status === 'FLAGGED' ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
                {last.status === 'CANCELLED' ? 'Registro deshecho' : last.status === 'FLAGGED' ? 'Registrada, en revisión' : 'Compra registrada'}
              </h2>
              <p>
                <b>{fullName(lastCustomer)}</b> · {formatMoney(last.amount)} · {formatDateTime(last.createdAt)}
              </p>
              <ul className="receipt">
                {purchaseLines(db, last.id).map((l) => (
                  <li key={l.id}>
                    <span>
                      {formatInt(l.quantity)} × {l.name}
                    </span>
                    <span className="tabular">{formatMoney(l.unitPrice * l.quantity)}</span>
                  </li>
                ))}
                {last.discount > 0 && (
                  <li className="receipt-discount">
                    <span>Descuentos</span>
                    <span className="tabular">−{formatMoney(last.discount)}</span>
                  </li>
                )}
              </ul>
              {(lastCanjes.length > 0 || lastBirthday) && (
                <ul className="receipt-benefits small">
                  {lastBirthday && (
                    <li>
                      <CakeSlice size={14} aria-hidden /> {lastBirthday.perkTitle}
                    </li>
                  )}
                  {lastCanjes.map((r) => {
                    const reward = db.rewards.find((x) => x.id === r.rewardId)
                    return (
                      <li key={r.id}>
                        <Ticket size={14} aria-hidden /> Canje: {reward ? rewardTitle(db, reward) : 'Recompensa'}
                      </li>
                    )
                  })}
                </ul>
              )}
              {last.status === 'FLAGGED' && <p className="small">La administración la revisará.</p>}
              {last.status === 'CANCELLED' && <p className="muted small">Anulada, sin puntos. Sus canjes y beneficios volvieron a estar disponibles.</p>}
              <UndoPurchase tx={last} />
            </Card>
          )}

          <Card>
            <h2>Tus últimos registros</h2>
            {recent.length === 0 ? (
              <Empty>Aún sin registros.</Empty>
            ) : (
              <ul className="list">
                {recent.map((t) => {
                  const c = db.users.find((u) => u.id === t.customerId)
                  return (
                    <li key={t.id} className="list-row">
                      <div>
                        <strong>{c && fullName(c)}</strong>
                        <div className="muted small">
                          {formatDateTime(t.createdAt)} · {formatMoney(t.amount)}
                        </div>
                      </div>
                      {t.status === 'CANCELLED' ? (
                        <Badge tone="danger">Anulada</Badge>
                      ) : t.status === 'FLAGGED' ? (
                        <Badge tone="warning">En revisión</Badge>
                      ) : (
                        <UndoPurchase tx={t} />
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {rejecting && customer && <RejectModal redemption={rejecting} customerName={fullName(customer)} onClose={() => setRejecting(null)} />}
    </div>
  )
}
