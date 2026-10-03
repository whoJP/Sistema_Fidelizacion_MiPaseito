import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CakeSlice, CheckCircle2, Minus, Plus, Search, Trash2, TrendingUp, Undo2, UserRound, X } from 'lucide-react'
import { ApiError, api, type IdentifiedCustomer } from '../../data/api'
import { useDb } from '../../data/store'
import { purchaseLines } from '../../domain/loyalty'
import { formatDateTime, formatInt, formatMoney, fullName, normalizeText, plural } from '../../lib/format'
import { useUser } from '../../session'
import type { CatalogItem } from '../../types/domain'
import { Badge, Card, Empty, PageHeader, notify, prefersReducedMotion, run, vanish } from '../../components/ui'
import { ScanOrCode } from '../../components/ScanOrCode'
import { UndoPurchase } from '../../components/UndoPurchase'
import { useWorkplace } from './useWorkplace'

type Line = { item: CatalogItem; quantity: number }

export function RegisterPurchasePage() {
  const db = useDb()
  const me = useUser()
  const { business, membership } = useWorkplace()
  const productsRef = useRef<HTMLDivElement>(null)
  const [customer, setCustomer] = useState<IdentifiedCustomer | null>(null)
  const [query, setQuery] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [lastId, setLastId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  const catalog = db.catalogItems
    .filter((i) => i.businessId === business.id && i.deletedAt === null && i.isAvailable)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const q = normalizeText(query.trim())
  const matches = q ? catalog.filter((i) => normalizeText(i.name).includes(q) || normalizeText(i.description ?? '').includes(q)) : catalog
  const quantityOf = (itemId: number) => lines.find((l) => l.item.id === itemId)?.quantity ?? 0
  const total = Math.round(lines.reduce((s, l) => s + l.item.price * l.quantity, 0) * 100) / 100
  const units = lines.reduce((s, l) => s + l.quantity, 0)
  const last = lastId ? db.transactions.find((t) => t.id === lastId) : undefined
  const recent = db.transactions
    .filter((t) => t.businessId === business.id && t.performedById === me.id && t.id !== last?.id)
    .sort((a, b) => b.id - a.id)
    .slice(0, 5)

  const identify = async (value: string) => {
    if (!value.trim() || busy) return false
    setBusy(true)
    try {
      const found = await api.identifyCustomer(value.trim())
      setCustomer(found)
      notify('success', `Cliente identificado: ${fullName(found)}`)
      if (lines.length === 0) productsRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
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

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!customer || lines.length === 0) return
    setBusy(true)
    const r = await run('registerPurchase', {
      customerId: customer.id,
      businessId: business.id,
      items: lines.map((l) => ({ catalogItemId: l.item.id, quantity: l.quantity })),
    })
    setBusy(false)
    if (!r) return
    notify(r.flagged ? 'error' : 'success', r.flagged ? 'Compra registrada y enviada a revisión' : 'Compra registrada')
    setLastId(r.transaction.id)
    setLines([])
    setQuery('')
    setCustomer(null)
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }

  const lastCustomer = last && db.users.find((u) => u.id === last.customerId)
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
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCustomer(null)}>
                  Cambiar
                </button>
              </div>
            ) : (
              <ScanOrCode kind="customer" onSubmit={identify} busy={busy} scanLabel="Escanea el QR del cliente" />
            )}
            {customer?.birthdayToday && (
              <p className="register-hint is-birthday">
                <CakeSlice size={16} aria-hidden />
                <span>
                  ¡Hoy cumple años! Tras la compra, entrega su regalo en <Link to={`/merchant/${business.id}/birthday`}>Cumpleaños</Link>.
                </span>
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
                                {item.description && <span className="muted small clamp-1">{item.description}</span>}
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
                    </div>
                  )}

                  <div className="checkout-bar">
                    <div className="checkout-total">
                      <span className="muted small">{lines.length === 0 ? 'Sin productos' : plural(units, 'producto', 'productos')}</span>
                      <strong className="tabular">{formatMoney(total)}</strong>
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
              </ul>
              {last.status === 'FLAGGED' && <p className="small">La administración la revisará.</p>}
              {last.status === 'CANCELLED' && <p className="muted small">Anulada, sin puntos.</p>}
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
    </div>
  )
}
