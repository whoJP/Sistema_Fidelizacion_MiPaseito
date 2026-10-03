import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useDb } from '../../data/store'
import { rewardConditions, rewardRedeemedCount, rewardTitle } from '../../domain/loyalty'
import { REWARD_TYPE_LABELS, formatDate, formatInt, formatMoney, fromLocalInput, toLocalInput } from '../../lib/format'
import type { Database, Reward, RewardStatus, RewardType } from '../../types/domain'
import { Card, Empty, Field, Modal, PageHeader, run } from '../../components/ui'
import { FormActions, StatusBadge } from '../admin/shared'
import { useWorkplace } from './useWorkplace'

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
  return [rewardTitle(db, preview), ...rewardConditions(db, preview)].join(' · ')
}

export function MerchantRewardsPage() {
  const db = useDb()
  const { business } = useWorkplace()
  const [draft, setDraft] = useState<Draft | null>(null)
  const rewards = db.rewards.filter((r) => r.businessId === business.id && r.deletedAt === null).sort((a, b) => a.pointsCost - b.pointsCost)
  const products = db.catalogItems.filter((i) => i.businessId === business.id && i.deletedAt === null)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft) return
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
        title="Recompensas"
        subtitle={`${business.name} · lo que tus clientes pueden canjear con sus puntos. Solo se canjean en tu establecimiento.`}
        actions={
          <button className="btn btn-primary" onClick={() => setDraft(toDraft())}>
            <Plus size={16} /> Nueva recompensa
          </button>
        }
      />
      <Card>
        {rewards.length === 0 ? (
          <Empty>Aún no tienes recompensas. Crea la primera para atraer clientes con sus puntos.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Recompensa</th>
                  <th>Tipo</th>
                  <th className="num">Costo</th>
                  <th>Nivel mínimo</th>
                  <th className="num">Canjes / disponibles</th>
                  <th>Vigencia</th>
                  <th>Estado</th>
                  <th />
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
                    <td className="small">{REWARD_TYPE_LABELS[r.type]}</td>
                    <td className="num">{formatInt(r.pointsCost)} puntos</td>
                    <td>{db.tiers.find((t) => t.id === r.minimumTierId)?.name ?? 'Cualquiera'}</td>
                    <td className="num">
                      {rewardRedeemedCount(db, r.id)} / {r.stock ?? '∞'}
                    </td>
                    <td className="small">
                      {r.startsAt || r.endsAt ? `${r.startsAt ? formatDate(r.startsAt) : '…'} - ${r.endsAt ? formatDate(r.endsAt) : '…'}` : 'Sin límite'}
                    </td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="row end gap">
                      <button className="btn btn-ghost btn-sm" onClick={() => setDraft(toDraft(r))}>
                        Editar
                      </button>
                      <button
                        className="btn btn-ghost btn-sm danger"
                        onClick={() =>
                          confirm(`¿Eliminar "${rewardTitle(db, r)}"? Los clientes ya no podrán canjearla. Los canjes hechos se conservan.`) &&
                          run('softDelete', { table: 'rewards', id: r.id }, 'Recompensa eliminada')
                        }
                      >
                        Eliminar
                      </button>
                    </td>
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
                <Field label="Compra mínima en Bs (opcional)" hint="Vacío = sin mínimo">
                  <input inputMode="decimal" value={draft.minimumPurchase} onChange={(e) => setDraft({ ...draft, minimumPurchase: e.target.value })} />
                </Field>
              </div>
            )}
            {draft.type === 'AMOUNT_DISCOUNT' && (
              <div className="grid-2">
                <Field label="Descuento en Bs">
                  <input inputMode="decimal" required value={draft.discountAmount} onChange={(e) => setDraft({ ...draft, discountAmount: e.target.value })} />
                </Field>
                <Field label="Compra mínima en Bs (opcional)" hint="Vacío = sin mínimo">
                  <input inputMode="decimal" value={draft.minimumPurchase} onChange={(e) => setDraft({ ...draft, minimumPurchase: e.target.value })} />
                </Field>
              </div>
            )}
            {draft.type === 'FREE_PRODUCT' &&
              (products.length === 0 ? (
                <p className="muted small">
                  Primero agrega productos a tu <Link to={`/merchant/${business.id}/catalog`}>catálogo</Link>; la recompensa se elige de ahí.
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
                          {p.name}
                          {p.price !== null ? ` · ${formatMoney(p.price)}` : ''}
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
                <input type="number" min={1} step={1} required value={draft.pointsCost} onChange={(e) => setDraft({ ...draft, pointsCost: e.target.value })} />
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
              <Field label="Cantidad disponible" hint="Vacío = sin límite">
                <input type="number" min={0} step={1} value={draft.stock} onChange={(e) => setDraft({ ...draft, stock: e.target.value })} />
              </Field>
            </div>
            <div className="grid-2">
              <Field label="Disponible desde (opcional)">
                <input type="datetime-local" value={draft.startsAt} onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })} />
              </Field>
              <Field label="Disponible hasta (opcional)">
                <input type="datetime-local" value={draft.endsAt} onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })} />
              </Field>
            </div>
            <Field label="Condiciones adicionales (opcional)" hint="Ej.: no acumulable con otras ofertas. El beneficio ya queda definido arriba.">
              <textarea rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </Field>
            <FormActions onCancel={() => setDraft(null)} />
          </form>
        </Modal>
      )}
    </div>
  )
}
