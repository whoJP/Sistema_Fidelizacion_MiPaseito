import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Check, Plus } from 'lucide-react'
import { useDb } from '../../data/store'
import { rewardConditions, rewardRedeemedCount, rewardTitle } from '../../domain/loyalty'
import { REWARD_TYPE_LABELS, formatDateTime, formatInt, formatMoney, fromLocalInput, toLocalInput } from '../../lib/format'
import type { Database, Reward, RewardStatus, RewardType } from '../../types/domain'
import { Card, Empty, Field, Modal, PageHeader, run, vanish } from '../../components/ui'
import { confirmDialog } from '../../components/dialog'
import { WindowFields, draftWindowError } from '../../components/WindowFields'
import { LIMITS, MAX_POINTS, MAX_STOCK, moneyError } from '../../domain/validation'
import { FormActions, StatusBadge } from '../admin/shared'
import { useWorkplace } from './useWorkplace'

const CONDITION_EXAMPLES = [
  'No acumulable con otras promociones.',
  'Válido solo para consumo en el local.',
  'Sujeto a disponibilidad del producto.',
  'Válido de lunes a viernes.',
  'No válido en feriados.',
  'No canjeable por dinero en efectivo.',
]

const appendCondition = (text: string, condition: string) => (text.trim() ? `${text.trim()} ${condition}` : condition)

interface Draft {
  id: number | null
  type: RewardType
  discountPercent: string
  discountAmount: string
  catalogItemId: number | null
  quantity: string
  minimumPurchase: string
  description: string
  pointsCost: string
  minimumTierId: number | null
  stock: string
  startsAt: string
  endsAt: string
  status: RewardStatus
}

const toDraft = (r?: Reward): Draft => ({
  id: r?.id ?? null,
  type: r?.type ?? 'AMOUNT_DISCOUNT',
  discountPercent: r?.discountPercent?.toString() ?? '',
  discountAmount: r?.discountAmount?.toString() ?? '',
  catalogItemId: r?.catalogItemId ?? null,
  quantity: String(r?.quantity ?? 1),
  minimumPurchase: r?.minimumPurchase?.toString() ?? '',
  description: r?.description ?? '',
  pointsCost: r?.pointsCost.toString() ?? '',
  minimumTierId: r?.minimumTierId ?? null,
  stock: r?.stock?.toString() ?? '',
  startsAt: toLocalInput(r?.startsAt ?? null),
  endsAt: toLocalInput(r?.endsAt ?? null),
  status: r?.status ?? 'DRAFT',
})

const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')))

/** Preview of how the customer will see the reward, using the same derivation as the customer screens. */
function previewTitle(db: Database, businessId: number, d: Draft): string {
  const preview: Reward = {
    id: 0,
    businessId,
    type: d.type,
    discountPercent: numOrNull(d.discountPercent),
    discountAmount: numOrNull(d.discountAmount),
    catalogItemId: d.catalogItemId,
    quantity: Number(d.quantity) || 1,
    minimumPurchase: numOrNull(d.minimumPurchase),
    description: null,
    pointsCost: 0,
    minimumTierId: null,
    stock: null,
    startsAt: null,
    endsAt: null,
    status: 'DRAFT',
    createdById: 0,
    deletedAt: null,
  }
  return [rewardTitle(db, preview), ...rewardConditions(db, preview)].join('. ')
}

const rewardData = (r: Reward, status: RewardStatus) => ({
  businessId: r.businessId,
  type: r.type,
  discountPercent: r.discountPercent,
  discountAmount: r.discountAmount,
  catalogItemId: r.catalogItemId,
  quantity: r.quantity,
  minimumPurchase: r.minimumPurchase,
  description: r.description,
  pointsCost: r.pointsCost,
  minimumTierId: r.minimumTierId,
  stock: r.stock,
  startsAt: r.startsAt,
  endsAt: r.endsAt,
  status,
})

export function MerchantRewardsPage() {
  const db = useDb()
  const { business, membership } = useWorkplace()
  const isManager = membership.role === 'MANAGER'
  const [draft, setDraft] = useState<Draft | null>(null)
  const activeCanjes = (rewardId: number) => db.redemptions.filter((x) => x.rewardId === rewardId && x.status === 'PENDING').length
  const rewards = db.rewards.filter((r) => r.businessId === business.id && r.deletedAt === null).sort((a, b) => a.pointsCost - b.pointsCost)
  const products = db.catalogItems.filter((i) => i.businessId === business.id && i.deletedAt === null)
  const editing = (draft?.id && db.rewards.find((r) => r.id === draft.id)) || null
  const windowProblem = draft && draftWindowError(draft, editing, false)
  const discount = draft ? numOrNull(draft.discountAmount) : null
  const minimum = draft ? numOrNull(draft.minimumPurchase) : null
  const discountProblem = draft?.type === 'AMOUNT_DISCOUNT' && discount !== null ? moneyError(discount, 'El descuento', { minExclusive: true }) : null
  const minimumProblem =
    draft && draft.type !== 'FREE_PRODUCT' && minimum !== null
      ? (moneyError(minimum, 'La compra mínima') ??
        (draft.type === 'AMOUNT_DISCOUNT' && discount !== null && minimum > 0 && discount >= minimum ? 'Debe ser mayor que el descuento' : null))
      : null
  const usedStock = editing ? rewardRedeemedCount(db, editing.id) : 0

  const remove = async (r: Reward, row: HTMLElement) => {
    const ok = await confirmDialog({
      title: `¿Eliminar "${rewardTitle(db, r)}"?`,
      message: 'Los clientes ya no podrán canjearla. Los canjes hechos se conservan.',
      confirmLabel: 'Eliminar',
      tone: 'danger',
    })
    if (ok) void vanish(row, () => run('softDelete', { table: 'rewards', id: r.id }, 'Recompensa eliminada'))
  }

  const setStatus = async (r: Reward, status: RewardStatus) => {
    if (status !== 'ACTIVE') {
      const ok = await confirmDialog({
        title: `¿Desactivar "${rewardTitle(db, r)}"?`,
        message: 'Los clientes dejan de verla. Los canjes ya hechos siguen activos en sus tarjetas.',
        confirmLabel: 'Desactivar',
      })
      if (!ok) return
    }
    await run('saveReward', { id: r.id, data: rewardData(r, status) }, status === 'ACTIVE' ? 'Recompensa activada' : 'Recompensa desactivada')
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft || windowProblem || discountProblem || minimumProblem) return
    const ok = await run(
      'saveReward',
      {
        id: draft.id,
        data: {
          businessId: business.id,
          type: draft.type,
          discountPercent: numOrNull(draft.discountPercent),
          discountAmount: numOrNull(draft.discountAmount),
          catalogItemId: draft.catalogItemId,
          quantity: Math.trunc(Number(draft.quantity) || 1),
          minimumPurchase: numOrNull(draft.minimumPurchase),
          description: draft.description.trim() || null,
          pointsCost: Math.trunc(Number(draft.pointsCost)),
          minimumTierId: draft.minimumTierId,
          stock: draft.stock.trim() === '' ? null : Math.trunc(Number(draft.stock)),
          startsAt: fromLocalInput(draft.startsAt),
          endsAt: fromLocalInput(draft.endsAt),
          status: draft.status,
        },
      },
      'Recompensa guardada',
    )
    if (ok) setDraft(null)
  }

  return (
    <div className="page">
      <PageHeader
        title="Canje"
        subtitle={`Recompensas que los clientes canjean con sus puntos en ${business.name}`}
        actions={
          isManager && (
            <button className="btn btn-primary" onClick={() => setDraft(toDraft())}>
              <Plus size={16} /> Nueva recompensa
            </button>
          )
        }
      />
      <p className="muted small page-note">
        Cuando un cliente canjea, el canje queda activo en su tarjeta. Al escanearla en <b>Registrar compra</b> verás sus canjes para aplicarlos o
        cancelarlos.
      </p>
      <Card>
        {rewards.length === 0 ? (
          <Empty>{isManager ? 'Aún no tienes recompensas.' : 'Tu local aún no tiene recompensas. Las configura el encargado.'}</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table table-stack">
              <thead>
                <tr>
                  <th>Recompensa</th>
                  <th>Tipo</th>
                  <th className="num">Costo</th>
                  <th>Nivel mínimo</th>
                  <th className="num">Canjes</th>
                  <th>Vigencia</th>
                  <th>Estado</th>
                  {isManager && <th />}
                </tr>
              </thead>
              <tbody>
                {rewards.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{rewardTitle(db, r)}</strong>
                      {[...rewardConditions(db, r), r.description].filter(Boolean).map((c) => (
                        <div key={c} className="muted small">
                          {c}
                        </div>
                      ))}
                    </td>
                    <td className="small" data-label="Tipo">
                      {REWARD_TYPE_LABELS[r.type]}
                    </td>
                    <td className="num" data-label="Costo">
                      {formatInt(r.pointsCost)} puntos
                    </td>
                    <td data-label="Nivel mínimo">{db.tiers.find((t) => t.id === r.minimumTierId)?.name ?? 'Cualquiera'}</td>
                    <td className="num" data-label="Canjes">
                      {r.stock === null ? `${rewardRedeemedCount(db, r.id)}, sin límite` : `${rewardRedeemedCount(db, r.id)} de ${r.stock}`}
                      {activeCanjes(r.id) > 0 && <div className="muted small">{formatInt(activeCanjes(r.id))} por entregar</div>}
                    </td>
                    <td className="small" data-label="Vigencia">
                      {r.startsAt && r.endsAt
                        ? `${formatDateTime(r.startsAt)} - ${formatDateTime(r.endsAt)}`
                        : r.startsAt
                          ? `Desde ${formatDateTime(r.startsAt)}`
                          : r.endsAt
                            ? `Hasta ${formatDateTime(r.endsAt)}`
                            : 'Sin límite'}
                    </td>
                    <td data-label="Estado">
                      <StatusBadge status={r.status} />
                    </td>
                    {isManager && (
                      <td className="row end gap">
                        <button className="btn btn-ghost btn-sm" onClick={() => setDraft(toDraft(r))}>
                          Editar
                        </button>
                        {r.status === 'ACTIVE' ? (
                          <button className="btn btn-ghost btn-sm" onClick={() => void setStatus(r, 'INACTIVE')}>
                            Desactivar
                          </button>
                        ) : (
                          <button className="btn btn-ghost btn-sm" onClick={() => void setStatus(r, 'ACTIVE')}>
                            Activar
                          </button>
                        )}
                        <button className="btn btn-ghost btn-sm danger" onClick={(e) => remove(r, e.currentTarget)}>
                          Eliminar
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {draft && (
        <Modal title={draft.id ? 'Editar recompensa' : 'Nueva recompensa'} onClose={() => setDraft(null)} wide>
          <form className="stack" onSubmit={save}>
            <div className="grid-2">
              <Field label="¿Qué recibe el cliente?">
                <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as RewardType })}>
                  {(Object.keys(REWARD_TYPE_LABELS) as RewardType[]).map((t) => (
                    <option key={t} value={t}>
                      {REWARD_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Estado">
                <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as RewardStatus })}>
                  <option value="DRAFT">Borrador (no visible)</option>
                  <option value="ACTIVE">Activa (visible para clientes)</option>
                  <option value="INACTIVE">Inactiva</option>
                </select>
              </Field>
            </div>

            {draft.type === 'PERCENT_DISCOUNT' && (
              <div className="grid-2">
                <Field label="Porcentaje de descuento (%)">
                  <input type="number" min={1} max={100} step={1} required value={draft.discountPercent} onChange={(e) => setDraft({ ...draft, discountPercent: e.target.value })} />
                </Field>
                <Field label="Compra mínima en Bs (opcional)" hint="Vacío = sin mínimo" error={minimumProblem}>
                  <input inputMode="decimal" maxLength={14} value={draft.minimumPurchase} onChange={(e) => setDraft({ ...draft, minimumPurchase: e.target.value })} />
                </Field>
              </div>
            )}
            {draft.type === 'AMOUNT_DISCOUNT' && (
              <div className="grid-2">
                <Field label="Descuento en Bs" error={discountProblem}>
                  <input
                    inputMode="decimal"
                    required
                    maxLength={14}
                    value={draft.discountAmount}
                    onChange={(e) => setDraft({ ...draft, discountAmount: e.target.value })}
                  />
                </Field>
                <Field label="Compra mínima en Bs (opcional)" hint="Vacío = sin mínimo" error={minimumProblem}>
                  <input inputMode="decimal" maxLength={14} value={draft.minimumPurchase} onChange={(e) => setDraft({ ...draft, minimumPurchase: e.target.value })} />
                </Field>
              </div>
            )}
            {draft.type === 'FREE_PRODUCT' &&
              (products.length === 0 ? (
                <p className="muted small">
                  Primero agrega productos a tu <Link to={`/merchant/${business.id}/catalog`}>catálogo</Link>.
                </p>
              ) : (
                <div className="grid-2">
                  <Field label="Producto de tu catálogo">
                    <select
                      required
                      value={draft.catalogItemId ?? ''}
                      onChange={(e) => setDraft({ ...draft, catalogItemId: e.target.value ? Number(e.target.value) : null })}
                    >
                      <option value="">Elige un producto</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {formatMoney(p.price)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Cantidad">
                    <input type="number" min={1} max={20} step={1} required value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} />
                  </Field>
                </div>
              ))}

            <p className="small">
              Así lo verá el cliente: <b>{previewTitle(db, business.id, draft)}</b>
            </p>

            <div className="grid-3">
              <Field label="Costo en puntos">
                <input
                  type="number"
                  min={1}
                  max={MAX_POINTS}
                  step={1}
                  required
                  value={draft.pointsCost}
                  onChange={(e) => setDraft({ ...draft, pointsCost: e.target.value })}
                />
              </Field>
              <Field label="Nivel mínimo del cliente">
                <select value={draft.minimumTierId ?? ''} onChange={(e) => setDraft({ ...draft, minimumTierId: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">Cualquiera</option>
                  {db.tiers
                    .filter((t) => t.isActive)
                    .sort((a, b) => a.minimumStatus - b.minimumStatus)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Cantidad disponible" hint={usedStock > 0 ? `Vacío = sin límite. Ya se canjearon ${formatInt(usedStock)}` : 'Vacío = sin límite'}>
                <input type="number" min={usedStock} max={MAX_STOCK} step={1} value={draft.stock} onChange={(e) => setDraft({ ...draft, stock: e.target.value })} />
              </Field>
            </div>
            <WindowFields
              value={draft}
              onChange={(w) => setDraft({ ...draft, ...w })}
              previous={editing}
              required={false}
              startLabel="Disponible desde"
              endLabel="Disponible hasta"
            />
            <div className="stack-sm">
              <Field label="Condiciones adicionales (opcional)" hint="Toca un ejemplo para agregarlo">
                <textarea rows={2} maxLength={LIMITS.description} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              </Field>
              <div className="chips" aria-label="Condiciones frecuentes">
                {CONDITION_EXAMPLES.map((c) => {
                  const added = draft.description.includes(c)
                  return (
                    <button
                      key={c}
                      type="button"
                      className={`chip chip-suggest ${added ? 'chip-active' : ''}`}
                      onClick={() => setDraft({ ...draft, description: added ? draft.description : appendCondition(draft.description, c) })}
                      aria-pressed={added}
                    >
                      {added ? <Check size={13} aria-hidden /> : <Plus size={13} aria-hidden />} {c}
                    </button>
                  )
                })}
              </div>
            </div>
            <FormActions onCancel={() => setDraft(null)} disabled={!!(windowProblem || discountProblem || minimumProblem)} />
          </form>
        </Modal>
      )}
    </div>
  )
}
