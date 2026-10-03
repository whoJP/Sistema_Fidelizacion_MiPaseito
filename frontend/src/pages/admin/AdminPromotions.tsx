import { useState, type FormEvent } from 'react'
import { useDb } from '../../data/store'
import { promotionReason } from '../../domain/engagement'
import { promotionScope, promotionUsed } from '../../domain/loyalty'
import { formatDateTime, formatInt, fromLocalInput, fullName, toLocalInput } from '../../lib/format'
import type { Database, Promotion, PromotionStatus, PromotionType } from '../../types/domain'
import { useNow } from '../../lib/useNow'
import { Badge, Card, Empty, Field, Modal, run, vanish } from '../../components/ui'
import { confirmDialog } from '../../components/dialog'
import { WindowFields, draftWindowError } from '../../components/WindowFields'
import { LIMITS, MAX_MULTIPLIER, MAX_REWARD_POINTS, intError, multiplierError } from '../../domain/validation'
import { AdminHeader, FormActions, ScopeEditor, StatusBadge, scopeSummary, type ScopeValue } from './shared'

interface Draft {
  id: number | null
  name: string
  type: PromotionType
  value: string
  startsAt: string
  endsAt: string
  status: PromotionStatus
  scope: ScopeValue
}

const AUTOMATIC_SHOWN = 30

const benefit = (p: Promotion) => (p.type === 'POINTS_MULTIPLIER' ? `Puntos ×${p.value}` : `+${formatInt(p.value)} puntos`)

const toDraft = (db: Database, p?: Promotion): Draft => ({
  id: p?.id ?? null,
  name: p?.name ?? '',
  type: p?.type ?? 'POINTS_MULTIPLIER',
  value: String(p?.value ?? 2),
  startsAt: toLocalInput(p?.startsAt ?? new Date().toISOString()),
  endsAt: toLocalInput(p?.endsAt ?? new Date(Date.now() + 14 * 24 * 3600_000).toISOString()),
  status: p?.status ?? 'DRAFT',
  scope: p ? promotionScope(db, p.id) : { businessIds: [], categoryIds: [] },
})

export function AdminPromotions() {
  const db = useDb()
  const [draft, setDraft] = useState<Draft | null>(null)
  const promotions = db.promotions.filter((p) => p.deletedAt === null && p.userId === null).sort((a, b) => b.id - a.id)
  const personal = db.promotions
    .filter((p) => p.deletedAt === null && p.userId !== null)
    .sort((a, b) => b.id - a.id)
    .slice(0, AUTOMATIC_SHOWN)
  const now = useNow(60_000)
  const personalState = (p: Promotion): [string, 'success' | 'neutral' | 'accent'] => {
    if (promotionUsed(db, p)) return ['Usada', 'accent']
    if (Date.parse(p.endsAt) < now) return ['Vencida', 'neutral']
    return ['Vigente', 'success']
  }
  const editing = (draft?.id && db.promotions.find((p) => p.id === draft.id)) || null
  const windowProblem = draft && draftWindowError(draft, editing, true)
  const valueProblem =
    !draft || !draft.value.trim()
      ? null
      : draft.type === 'POINTS_MULTIPLIER'
        ? multiplierError(Number(draft.value), 'El multiplicador')
        : intError(Number(draft.value), 'Los puntos extra', 1, MAX_REWARD_POINTS)

  const remove = async (p: Promotion, row: HTMLElement) => {
    const ok = await confirmDialog({
      title: `¿Eliminar "${p.name}"?`,
      message: 'Deja de aplicarse a las compras nuevas. Los puntos extra ya entregados se conservan.',
      confirmLabel: 'Eliminar',
      tone: 'danger',
    })
    if (ok) void vanish(row, () => run('softDelete', { table: 'promotions', id: p.id }, 'Promoción eliminada'))
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft || windowProblem || valueProblem) return
    const startsAt = fromLocalInput(draft.startsAt)
    const endsAt = fromLocalInput(draft.endsAt)
    if (!startsAt || !endsAt) return
    const ok = await run(
      'savePromotion',
      {
        id: draft.id,
        data: {
          name: draft.name,
          type: draft.type,
          value: Number(draft.value),
          startsAt,
          endsAt,
          status: draft.status,
        },
        scope: draft.scope,
      },
      'Promoción guardada',
    )
    if (ok) setDraft(null)
  }

  return (
    <div className="page">
      <AdminHeader
        title="Promociones"
        subtitle="Puntos dobles (×2) o puntos extra fijos (+100) por compra, en todo el Paseo o solo en las tiendas o categorías que elijas."
        onCreate={() => setDraft(toDraft(db))}
      />
      <Card>
        {promotions.length === 0 ? (
          <Empty>No hay promociones configuradas.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Beneficio</th>
                  <th>Vigencia</th>
                  <th>Alcance</th>
                  <th className="num">Puntos extra entregados</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {promotions.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.name}</strong>
                    </td>
                    <td>{benefit(p)}</td>
                    <td className="small">
                      {formatDateTime(p.startsAt)} - {formatDateTime(p.endsAt)}
                    </td>
                    <td className="small">{scopeSummary(db, promotionScope(db, p.id))}</td>
                    <td className="num">
                      {formatInt(db.pointMovements.filter((m) => m.promotionId === p.id).reduce((s, m) => s + m.amount, 0))}
                    </td>
                    <td>
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="row end gap">
                      <button className="btn btn-ghost btn-sm" onClick={() => setDraft(toDraft(db, p))}>
                        Editar
                      </button>
                      <button className="btn btn-ghost btn-sm danger" onClick={(e) => remove(p, e.currentTarget)}>
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

      <Card>
        <h2>Promociones automáticas</h2>
        <p className="muted small">
          Las crea el sistema para un cliente: regreso de clientes dormidos, aniversarios, tarjeta de visitas completa y premios de la ruleta. Se ajustan
          desde Configuración.
        </p>
        {personal.length === 0 ? (
          <Empty>Todavía no se generó ninguna.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table table-stack">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Motivo</th>
                  <th>Beneficio</th>
                  <th>Vigencia</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {personal.map((p) => {
                  const customer = db.users.find((u) => u.id === p.userId)
                  const [label, tone] = personalState(p)
                  return (
                    <tr key={p.id}>
                      <td>
                        <strong>{customer ? fullName(customer) : 'Cliente'}</strong>
                        <div className="muted small">{p.name}</div>
                      </td>
                      <td data-label="Motivo">{promotionReason(p)}</td>
                      <td data-label="Beneficio">
                        {benefit(p)}
                        {p.singleUse && <span className="muted small"> · una compra</span>}
                      </td>
                      <td className="small" data-label="Vigencia">
                        {formatDateTime(p.startsAt)} - {formatDateTime(p.endsAt)}
                      </td>
                      <td data-label="Estado">
                        <Badge tone={tone}>{label}</Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {draft && (
        <Modal title={draft.id ? 'Editar promoción' : 'Nueva promoción'} onClose={() => setDraft(null)} wide>
          <form className="stack" onSubmit={save}>
            <div className="grid-2">
              <Field label="Nombre">
                <input required maxLength={LIMITS.name} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </Field>
              <Field label="Estado">
                <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as PromotionStatus })}>
                  <option value="DRAFT">Borrador</option>
                  <option value="ACTIVE">Activa</option>
                  <option value="INACTIVE">Inactiva</option>
                </select>
              </Field>
            </div>
            <div className="grid-2">
              <Field label="Tipo">
                <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as PromotionType })}>
                  <option value="POINTS_MULTIPLIER">Multiplicar los puntos</option>
                  <option value="FIXED_POINTS">Puntos extra fijos</option>
                </select>
              </Field>
              <Field label={draft.type === 'POINTS_MULTIPLIER' ? 'Multiplicador (ej. 2 = doble)' : 'Puntos extra por compra'} error={valueProblem}>
                <input
                  type="number"
                  step={draft.type === 'POINTS_MULTIPLIER' ? 0.01 : 1}
                  min={draft.type === 'POINTS_MULTIPLIER' ? 1.01 : 1}
                  max={draft.type === 'POINTS_MULTIPLIER' ? MAX_MULTIPLIER : MAX_REWARD_POINTS}
                  required
                  value={draft.value}
                  onChange={(e) => setDraft({ ...draft, value: e.target.value })}
                />
              </Field>
            </div>
            <WindowFields value={draft} onChange={(w) => setDraft({ ...draft, ...w })} previous={editing} required />
            <ScopeEditor db={db} value={draft.scope} onChange={(scope) => setDraft({ ...draft, scope })} />
            <FormActions onCancel={() => setDraft(null)} disabled={!!(windowProblem || valueProblem)} />
          </form>
        </Modal>
      )}
    </div>
  )
}
