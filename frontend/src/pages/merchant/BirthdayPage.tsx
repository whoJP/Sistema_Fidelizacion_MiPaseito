import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CakeSlice, CheckCircle2, Gift, Pencil } from 'lucide-react'
import { ApiError, api } from '../../data/api'
import { useDb } from '../../data/store'
import { localYear } from '../../domain/engagement'
import { rewardTitle } from '../../domain/loyalty'
import { LIMITS, moneyError } from '../../domain/validation'
import { REWARD_TYPE_LABELS, formatDateTime, formatMoney, fullName } from '../../lib/format'
import type { BirthdayPerk, RewardType } from '../../types/domain'
import { Badge, Card, Empty, Field, Modal, PageHeader, notify, run } from '../../components/ui'
import { ScanOrCode } from '../../components/ScanOrCode'
import { FormActions } from '../admin/shared'
import { useWorkplace } from './useWorkplace'

interface Draft {
  type: RewardType
  discountPercent: string
  discountAmount: string
  catalogItemId: number | null
  quantity: string
  description: string
  isActive: boolean
}

const toDraft = (p?: BirthdayPerk): Draft => ({
  type: p?.type ?? 'FREE_PRODUCT',
  discountPercent: p?.discountPercent?.toString() ?? '',
  discountAmount: p?.discountAmount?.toString() ?? '',
  catalogItemId: p?.catalogItemId ?? null,
  quantity: String(p?.quantity ?? 1),
  description: p?.description ?? '',
  isActive: p?.isActive ?? true,
})

const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')))

type Delivered = { title: string; customerName: string }

export function BirthdayPage() {
  const db = useDb()
  const { business, membership } = useWorkplace()
  const isManager = membership.role === 'MANAGER'
  const perk = db.birthdayPerks.find((p) => p.businessId === business.id)
  const products = db.catalogItems.filter((i) => i.businessId === business.id && i.deletedAt === null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [delivered, setDelivered] = useState<Delivered | null>(null)
  const year = localYear()
  const claims = db.birthdayClaims
    .filter((c) => c.businessId === business.id && c.year === year)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const validate = async (code: string) => {
    if (busy) return false
    setBusy(true)
    try {
      const customer = await api.identifyCustomer(code.trim())
      const result = await run('claimBirthdayPerk', { customerId: customer.id, businessId: business.id })
      if (!result) return false
      notify('success', `Regalo entregado a ${result.customerName}`)
      setDelivered({ title: result.title, customerName: fullName(customer) })
      return true
    } catch (err) {
      notify('error', err instanceof ApiError ? err.message : 'No se pudo identificar al cliente')
      return false
    } finally {
      setBusy(false)
    }
  }

  const discount = draft?.type === 'AMOUNT_DISCOUNT' ? numOrNull(draft.discountAmount) : null
  const discountProblem = discount !== null ? moneyError(discount, 'El descuento', { minExclusive: true }) : null

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft || discountProblem) return
    const ok = await run(
      'saveBirthdayPerk',
      {
        businessId: business.id,
        data: {
          type: draft.type,
          discountPercent: numOrNull(draft.discountPercent),
          discountAmount: numOrNull(draft.discountAmount),
          catalogItemId: draft.catalogItemId,
          quantity: Math.trunc(Number(draft.quantity) || 1),
          description: draft.description.trim() || null,
          isActive: draft.isActive,
        },
      },
      'Regalo de cumpleaños guardado',
    )
    if (ok) setDraft(null)
  }

  const preview =
    draft &&
    rewardTitle(db, {
      type: draft.type,
      discountPercent: numOrNull(draft.discountPercent),
      discountAmount: numOrNull(draft.discountAmount),
      catalogItemId: draft.catalogItemId,
      quantity: Number(draft.quantity) || 1,
      description: null,
    })

  return (
    <div className="page">
      <PageHeader
        title="Cumpleaños"
        subtitle={`${business.name} · El día de su cumpleaños, el cliente recibe tu regalo con una compra en el local. Una vez al año.`}
      />
      <div className="detail-grid">
        <div className="stack">
          {delivered && (
            <Card className="card-success">
              <h2 className="row gap">
                <CheckCircle2 size={20} aria-hidden /> Entrega: {delivered.title}
              </h2>
              {perk?.description && <p className="small">{perk.description}</p>}
              <p>
                Cliente: <b>{delivered.customerName}</b>. ¡Deséale un feliz cumpleaños!
              </p>
              <button type="button" className="btn btn-sm align-start" onClick={() => setDelivered(null)}>
                Validar otro cumpleaños
              </button>
            </Card>
          )}
          <Card>
            <h2 className="card-title">
              <CakeSlice size={18} aria-hidden /> Validar cumpleaños
            </h2>
            {perk?.isActive ? (
              <>
                <p className="muted small">
                  Requisitos: cumpleaños verificado, que sea hoy y una compra de hoy registrada en {business.name}. Registra la compra primero en{' '}
                  <Link to={`/merchant/${business.id}`}>Registrar compra</Link>.
                </p>
                <ScanOrCode kind="customer" onSubmit={validate} busy={busy} scanLabel="Pide al cliente su QR de Paseo Club y apúntale con la cámara" />
              </>
            ) : (
              <Empty>
                {isManager
                  ? 'Configura tu regalo de cumpleaños para empezar a entregarlo.'
                  : 'Tu local aún no tiene un regalo de cumpleaños activo. Pídele al encargado que lo configure.'}
              </Empty>
            )}
          </Card>
        </div>

        <div className="stack">
          <Card>
            <div className="card-head">
              <h2 className="card-title">
                <Gift size={18} aria-hidden /> Tu regalo
              </h2>
              {isManager && (
                <button className="btn btn-sm" onClick={() => setDraft(toDraft(perk))}>
                  <Pencil size={14} aria-hidden /> {perk ? 'Editar' : 'Configurar'}
                </button>
              )}
            </div>
            {perk ? (
              <div className="perk-summary">
                <strong>{rewardTitle(db, perk)}</strong>
                {perk.description && <span className="muted small">{perk.description}</span>}
                <Badge tone={perk.isActive ? 'success' : 'neutral'}>{perk.isActive ? 'Activo' : 'Pausado'}</Badge>
              </div>
            ) : (
              <Empty>Sin regalo configurado. Los clientes lo ven en su tarjeta de cumpleaños junto a los regalos de otros locales.</Empty>
            )}
          </Card>

          <Card>
            <h2>Entregados en {year}</h2>
            {claims.length === 0 ? (
              <Empty>Nadie lo recibió todavía este año.</Empty>
            ) : (
              <ul className="list">
                {claims.map((c) => {
                  const customer = db.users.find((u) => u.id === c.userId)
                  return (
                    <li key={c.id} className="list-row">
                      <div>
                        <strong>{customer ? fullName(customer) : 'Cliente'}</strong>
                        <div className="muted small">
                          {c.perkTitle} · {formatDateTime(c.createdAt)}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {draft && (
        <Modal title="Regalo de cumpleaños" onClose={() => setDraft(null)}>
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
                <select value={draft.isActive ? 'on' : 'off'} onChange={(e) => setDraft({ ...draft, isActive: e.target.value === 'on' })}>
                  <option value="on">Activo</option>
                  <option value="off">Pausado</option>
                </select>
              </Field>
            </div>
            {draft.type === 'PERCENT_DISCOUNT' && (
              <Field label="Porcentaje de descuento (%)">
                <input type="number" min={1} max={100} step={1} required value={draft.discountPercent} onChange={(e) => setDraft({ ...draft, discountPercent: e.target.value })} />
              </Field>
            )}
            {draft.type === 'AMOUNT_DISCOUNT' && (
              <Field label="Descuento en Bs" error={discountProblem}>
                <input
                  inputMode="decimal"
                  required
                  maxLength={14}
                  value={draft.discountAmount}
                  onChange={(e) => setDraft({ ...draft, discountAmount: e.target.value })}
                />
              </Field>
            )}
            {draft.type === 'FREE_PRODUCT' &&
              (products.length === 0 ? (
                <p className="muted small">
                  Primero agrega productos a tu <Link to={`/merchant/${business.id}/catalog`}>catálogo</Link>; el regalo se elige de ahí.
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
                    <input type="number" min={1} max={5} step={1} required value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} />
                  </Field>
                </div>
              ))}
            <p className="small">
              Así lo verá el cliente: <b>{preview}</b>
            </p>
            <Field label="Condiciones (opcional)" hint="Ej.: válido solo para consumo en el local.">
              <textarea rows={2} maxLength={LIMITS.note} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </Field>
            <FormActions onCancel={() => setDraft(null)} disabled={!!discountProblem} />
          </form>
        </Modal>
      )}
    </div>
  )
}
