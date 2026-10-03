import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CakeSlice, Gift, Pencil, Plus } from 'lucide-react'
import { useDb } from '../../data/store'
import type { BirthdayPerkData } from '../../data/actions'
import { birthdayPerkCondition, birthdayPerkTitle, catalogCategories } from '../../domain/checkout'
import { localYear } from '../../domain/engagement'
import { LIMITS, moneyError } from '../../domain/validation'
import { formatDateTime, formatMoney, fullName, plural } from '../../lib/format'
import type { BirthdayDiscountScope, BirthdayGiftCondition, BirthdayPerk } from '../../types/domain'
import { Badge, Card, Empty, Field, Modal, PageHeader, Stat, run, vanish } from '../../components/ui'
import { confirmDialog } from '../../components/dialog'
import { FormActions } from '../admin/shared'
import { useWorkplace } from './useWorkplace'

type Kind = 'GIFT' | 'DISCOUNT'

interface Draft {
  id: number | null
  kind: Kind
  percent: boolean
  discountPercent: string
  discountAmount: string
  discountScope: BirthdayDiscountScope
  targetItemId: number | null
  targetCategory: string
  catalogItemId: number | null
  quantity: string
  giftCondition: BirthdayGiftCondition
  minimumPurchase: string
  requiredItemId: number | null
  description: string
  isActive: boolean
}

const toDraft = (p?: BirthdayPerk): Draft => ({
  id: p?.id ?? null,
  kind: !p || p.type === 'FREE_PRODUCT' ? 'GIFT' : 'DISCOUNT',
  percent: p?.type !== 'AMOUNT_DISCOUNT',
  discountPercent: p?.discountPercent?.toString() ?? '',
  discountAmount: p?.discountAmount?.toString() ?? '',
  discountScope: p?.discountScope ?? 'PRODUCT',
  targetItemId: p?.targetItemId ?? null,
  targetCategory: p?.targetCategory ?? '',
  catalogItemId: p?.catalogItemId ?? null,
  quantity: String(p?.quantity ?? 1),
  giftCondition: p?.giftCondition ?? 'MIN_PURCHASE',
  minimumPurchase: p?.minimumPurchase?.toString() ?? '',
  requiredItemId: p?.requiredItemId ?? null,
  description: p?.description ?? '',
  isActive: p?.isActive ?? true,
})

const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')))

function toData(d: Draft): BirthdayPerkData {
  const gift = d.kind === 'GIFT'
  return {
    type: gift ? 'FREE_PRODUCT' : d.percent ? 'PERCENT_DISCOUNT' : 'AMOUNT_DISCOUNT',
    discountPercent: !gift && d.percent ? numOrNull(d.discountPercent) : null,
    discountAmount: !gift && !d.percent ? numOrNull(d.discountAmount) : null,
    catalogItemId: gift ? d.catalogItemId : null,
    quantity: gift ? Math.trunc(Number(d.quantity) || 1) : 1,
    giftCondition: gift ? d.giftCondition : null,
    minimumPurchase: gift && d.giftCondition === 'MIN_PURCHASE' ? numOrNull(d.minimumPurchase) : null,
    requiredItemId: gift && d.giftCondition === 'PRODUCT' ? d.requiredItemId : null,
    discountScope: gift ? null : d.discountScope,
    targetItemId: !gift && d.discountScope === 'PRODUCT' ? d.targetItemId : null,
    targetCategory: !gift && d.discountScope === 'CATEGORY' ? d.targetCategory || null : null,
    description: d.description.trim() || null,
    isActive: d.isActive,
  }
}

const perkData = (p: BirthdayPerk): BirthdayPerkData => ({
  type: p.type,
  discountPercent: p.discountPercent,
  discountAmount: p.discountAmount,
  catalogItemId: p.catalogItemId,
  quantity: p.quantity,
  giftCondition: p.giftCondition,
  minimumPurchase: p.minimumPurchase,
  requiredItemId: p.requiredItemId,
  discountScope: p.discountScope,
  targetItemId: p.targetItemId,
  targetCategory: p.targetCategory,
  description: p.description,
  isActive: p.isActive,
})

export function BirthdayPage() {
  const db = useDb()
  const { business, membership } = useWorkplace()
  const isManager = membership.role === 'MANAGER'
  const [draft, setDraft] = useState<Draft | null>(null)
  const thisYear = localYear()
  const [year, setYear] = useState(thisYear)

  const perks = db.birthdayPerks.filter((p) => p.businessId === business.id).sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.id - b.id)
  const products = db.catalogItems.filter((i) => i.businessId === business.id && i.deletedAt === null).sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const categories = catalogCategories(db, business.id)
  const allClaims = db.birthdayClaims.filter((c) => c.businessId === business.id)
  const years = [...new Set([thisYear, ...allClaims.map((c) => c.year)])].sort((a, b) => b - a)
  const claims = allClaims.filter((c) => c.year === year).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const given = claims.reduce((s, c) => s + c.discount, 0)

  const minimum = draft?.kind === 'GIFT' && draft.giftCondition === 'MIN_PURCHASE' ? numOrNull(draft.minimumPurchase) : null
  const minimumProblem = minimum !== null ? moneyError(minimum, 'La compra mínima', { minExclusive: true }) : null
  const amount = draft?.kind === 'DISCOUNT' && !draft.percent ? numOrNull(draft.discountAmount) : null
  const target = draft?.discountScope === 'PRODUCT' ? products.find((p) => p.id === draft.targetItemId) : undefined
  const amountProblem =
    amount !== null
      ? (moneyError(amount, 'El descuento', { minExclusive: true }) ??
        (target && amount >= target.price ? `Debe ser menor que el precio de ${target.name} (${formatMoney(target.price)})` : null))
      : null

  const preview = draft && { ...toData(draft), id: 0, businessId: business.id, updatedAt: '' }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft || minimumProblem || amountProblem) return
    const ok = await run('saveBirthdayPerk', { id: draft.id, businessId: business.id, data: toData(draft) }, 'Beneficio de cumpleaños guardado')
    if (ok) setDraft(null)
  }

  const toggle = (p: BirthdayPerk) =>
    run(
      'saveBirthdayPerk',
      { id: p.id, businessId: business.id, data: { ...perkData(p), isActive: !p.isActive } },
      p.isActive ? 'Beneficio pausado' : 'Beneficio activado',
    )

  const remove = async (p: BirthdayPerk, row: HTMLElement) => {
    const ok = await confirmDialog({
      title: `¿Eliminar "${birthdayPerkTitle(db, p)}"?`,
      message: 'Los cumpleañeros ya no lo recibirán. Las entregas pasadas se conservan.',
      confirmLabel: 'Eliminar',
      tone: 'danger',
    })
    if (ok) void vanish(row, () => run('deleteBirthdayPerk', { id: p.id }, 'Beneficio eliminado'))
  }

  const productOptions = (
    <>
      <option value="">Elige un producto</option>
      {products.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name} · {formatMoney(p.price)}
        </option>
      ))}
    </>
  )

  return (
    <div className="page">
      <PageHeader
        title="Cumpleaños"
        subtitle={`Qué recibe el cliente en su cumpleaños en ${business.name}`}
        actions={
          isManager && (
            <button className="btn btn-primary" onClick={() => setDraft(toDraft())} disabled={products.length === 0}>
              <Plus size={16} /> Agregar beneficio
            </button>
          )
        }
      />
      <p className="muted small page-note">
        No hay un QR aparte: al escanear la tarjeta del cliente en <Link to={`/merchant/${business.id}`}>Registrar compra</Link>, el sistema avisa si
        cumple años y aplica estos beneficios a la compra. Se usan una sola vez al año.
      </p>

      <Card>
        <h2 className="card-title">
          <Gift size={18} aria-hidden /> Beneficios
        </h2>
        {products.length === 0 && isManager ? (
          <Empty>
            Primero agrega productos a tu <Link to={`/merchant/${business.id}/catalog`}>catálogo</Link>.
          </Empty>
        ) : perks.length === 0 ? (
          <Empty>{isManager ? 'Aún no hay beneficios. Agrega un regalo o un descuento.' : 'Sin beneficios de cumpleaños. Los configura el encargado.'}</Empty>
        ) : (
          <ul className="list">
            {perks.map((p) => {
              const condition = birthdayPerkCondition(db, p)
              return (
                <li key={p.id} className="list-row">
                  <div className="stack-xs grow">
                    <strong className="row gap-sm">
                      {p.type === 'FREE_PRODUCT' ? <Gift size={15} aria-hidden /> : <CakeSlice size={15} aria-hidden />} {birthdayPerkTitle(db, p)}
                    </strong>
                    <span className="muted small">
                      {condition ?? 'Sin otra compra necesaria'}
                      {p.description && ` · ${p.description}`}
                    </span>
                  </div>
                  <Badge tone={p.isActive ? 'success' : 'neutral'}>{p.isActive ? 'Activo' : 'Pausado'}</Badge>
                  {isManager && (
                    <div className="row gap-sm">
                      <button className="btn btn-ghost btn-sm" onClick={() => setDraft(toDraft(p))}>
                        <Pencil size={14} aria-hidden /> Editar
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => void toggle(p)}>
                        {p.isActive ? 'Pausar' : 'Activar'}
                      </button>
                      <button className="btn btn-ghost btn-sm danger" onClick={(e) => void remove(p, e.currentTarget)}>
                        Eliminar
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card>
        <div className="card-head">
          <h2 className="card-title">
            <CakeSlice size={18} aria-hidden /> Entregados en {year}
          </h2>
          {years.length > 1 && (
            <select className="select-sm" value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Año">
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="stats-row">
          <Stat label="Cumpleañeros atendidos" value={claims.length} />
          <Stat label="Descuentos dados" value={formatMoney(given)} />
        </div>
        {claims.length === 0 ? (
          <Empty>Nadie usó sus beneficios de cumpleaños en {year}.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table table-stack">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Fecha</th>
                  <th>Beneficios</th>
                  <th className="num">Descuento</th>
                  <th>Atendió</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((c) => {
                  const customer = db.users.find((u) => u.id === c.userId)
                  const staff = db.users.find((u) => u.id === c.validatedById)
                  return (
                    <tr key={c.id}>
                      <td data-label="Cliente">
                        <strong>{customer ? fullName(customer) : 'Cliente'}</strong>
                      </td>
                      <td data-label="Fecha">{formatDateTime(c.createdAt)}</td>
                      <td className="small" data-label="Beneficios">
                        {c.perkTitle}
                      </td>
                      <td className="num" data-label="Descuento">
                        {c.discount > 0 ? formatMoney(c.discount) : '—'}
                      </td>
                      <td data-label="Atendió">{staff?.firstName ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {claims.length > 0 && <p className="muted small">{plural(claims.length, 'entrega', 'entregas')} en {year}.</p>}
      </Card>

      {draft && (
        <Modal title={draft.id ? 'Editar beneficio de cumpleaños' : 'Nuevo beneficio de cumpleaños'} onClose={() => setDraft(null)} wide>
          <form className="stack" onSubmit={save}>
            <div className="chips" role="radiogroup" aria-label="Tipo de beneficio">
              {(
                [
                  ['GIFT', 'Regalo'],
                  ['DISCOUNT', 'Descuento'],
                ] as const
              ).map(([kind, label]) => (
                <button
                  key={kind}
                  type="button"
                  role="radio"
                  aria-checked={draft.kind === kind}
                  className={`chip ${draft.kind === kind ? 'chip-active' : ''}`}
                  onClick={() => setDraft({ ...draft, kind })}
                >
                  {label}
                </button>
              ))}
            </div>

            {draft.kind === 'GIFT' ? (
              <>
                <p className="muted small">El regalo se entrega si su compra cumple la condición.</p>
                <div className="grid-2">
                  <Field label="Producto de regalo">
                    <select
                      required
                      value={draft.catalogItemId ?? ''}
                      onChange={(e) => setDraft({ ...draft, catalogItemId: e.target.value ? Number(e.target.value) : null })}
                    >
                      {productOptions}
                    </select>
                  </Field>
                  <Field label="Cantidad">
                    <input type="number" min={1} max={5} step={1} required value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} />
                  </Field>
                </div>
                <div className="grid-2">
                  <Field label="Condición">
                    <select value={draft.giftCondition} onChange={(e) => setDraft({ ...draft, giftCondition: e.target.value as BirthdayGiftCondition })}>
                      <option value="MIN_PURCHASE">Compra mínima de otros productos</option>
                      <option value="PRODUCT">Comprar un producto específico</option>
                    </select>
                  </Field>
                  {draft.giftCondition === 'MIN_PURCHASE' ? (
                    <Field label="Compra mínima en Bs" error={minimumProblem}>
                      <input
                        inputMode="decimal"
                        required
                        maxLength={14}
                        value={draft.minimumPurchase}
                        onChange={(e) => setDraft({ ...draft, minimumPurchase: e.target.value })}
                      />
                    </Field>
                  ) : (
                    <Field label="Producto que debe comprar">
                      <select
                        required
                        value={draft.requiredItemId ?? ''}
                        onChange={(e) => setDraft({ ...draft, requiredItemId: e.target.value ? Number(e.target.value) : null })}
                      >
                        {productOptions}
                      </select>
                    </Field>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="muted small">El descuento se aplica solo, sin necesidad de comprar otras cosas.</p>
                <div className="grid-2">
                  <Field label="Descuento">
                    <select value={draft.percent ? 'PERCENT' : 'AMOUNT'} onChange={(e) => setDraft({ ...draft, percent: e.target.value === 'PERCENT' })}>
                      <option value="PERCENT">Porcentaje (%)</option>
                      <option value="AMOUNT">Monto fijo (Bs)</option>
                    </select>
                  </Field>
                  {draft.percent ? (
                    <Field label="Porcentaje de descuento (%)">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        step={1}
                        required
                        value={draft.discountPercent}
                        onChange={(e) => setDraft({ ...draft, discountPercent: e.target.value })}
                      />
                    </Field>
                  ) : (
                    <Field label="Descuento en Bs" error={amountProblem}>
                      <input
                        inputMode="decimal"
                        required
                        maxLength={14}
                        value={draft.discountAmount}
                        onChange={(e) => setDraft({ ...draft, discountAmount: e.target.value })}
                      />
                    </Field>
                  )}
                </div>
                <div className="grid-2">
                  <Field label="Se aplica en">
                    <select value={draft.discountScope} onChange={(e) => setDraft({ ...draft, discountScope: e.target.value as BirthdayDiscountScope })}>
                      <option value="PRODUCT">Un producto</option>
                      <option value="CATEGORY" disabled={categories.length === 0}>
                        Una categoría de productos{categories.length === 0 ? ' (agrega categorías en el catálogo)' : ''}
                      </option>
                      <option value="ALL">Toda la compra</option>
                    </select>
                  </Field>
                  {draft.discountScope === 'PRODUCT' && (
                    <Field label="Producto con descuento" hint="Se descuenta 1 unidad">
                      <select
                        required
                        value={draft.targetItemId ?? ''}
                        onChange={(e) => setDraft({ ...draft, targetItemId: e.target.value ? Number(e.target.value) : null })}
                      >
                        {productOptions}
                      </select>
                    </Field>
                  )}
                  {draft.discountScope === 'CATEGORY' && (
                    <Field label="Categoría" hint="Se descuenta 1 producto, el de mayor precio">
                      <select required value={draft.targetCategory} onChange={(e) => setDraft({ ...draft, targetCategory: e.target.value })}>
                        <option value="">Elige una categoría</option>
                        {categories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}
                </div>
              </>
            )}

            {preview && (
              <p className="small">
                Así lo verán el cliente y la caja: <b>{birthdayPerkTitle(db, preview)}</b>
                {birthdayPerkCondition(db, preview) && <> · {birthdayPerkCondition(db, preview)}</>}
              </p>
            )}
            <div className="grid-2">
              <Field label="Condiciones (opcional)" hint="Ej.: válido solo para consumo en el local.">
                <textarea rows={2} maxLength={LIMITS.note} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              </Field>
              <Field label="Estado">
                <select value={draft.isActive ? 'on' : 'off'} onChange={(e) => setDraft({ ...draft, isActive: e.target.value === 'on' })}>
                  <option value="on">Activo</option>
                  <option value="off">Pausado</option>
                </select>
              </Field>
            </div>
            <FormActions onCancel={() => setDraft(null)} disabled={!!(minimumProblem || amountProblem)} />
          </form>
        </Modal>
      )}
    </div>
  )
}
