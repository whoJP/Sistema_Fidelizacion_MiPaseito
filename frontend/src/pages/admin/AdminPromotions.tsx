import { useState, type FormEvent } from 'react'
import { useDb } from '../../data/store'
import { promotionScope } from '../../domain/loyalty'
import { formatDate, formatInt, fromLocalInput, toLocalInput } from '../../lib/format'
import type { Database, Promotion, PromotionStatus, PromotionType } from '../../types/domain'
import { Card, Empty, Field, Modal, run } from '../../components/ui'
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
  const promotions = db.promotions.filter((p) => p.deletedAt === null).sort((a, b) => b.id - a.id)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft) return
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
          value: Math.round(Number(draft.value) * 100) / 100,
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
                    <td>{p.type === 'POINTS_MULTIPLIER' ? `Puntos ×${p.value}` : `+${formatInt(p.value)} puntos`}</td>
                    <td className="small">
                      {formatDate(p.startsAt)} - {formatDate(p.endsAt)}
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
                      <button
                        className="btn btn-ghost btn-sm danger"
                        onClick={() => confirm(`¿Eliminar "${p.name}"?`) && run('softDelete', { table: 'promotions', id: p.id }, 'Promoción eliminada')}
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
        <Modal title={draft.id ? 'Editar promoción' : 'Nueva promoción'} onClose={() => setDraft(null)} wide>
          <form className="stack" onSubmit={save}>
            <div className="grid-2">
              <Field label="Nombre">
                <input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
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
              <Field label={draft.type === 'POINTS_MULTIPLIER' ? 'Multiplicador (ej. 2 = doble)' : 'Puntos extra por compra'}>
                <input type="number" step={draft.type === 'POINTS_MULTIPLIER' ? 0.1 : 1} min={0} required value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} />
              </Field>
            </div>
            <div className="grid-2">
              <Field label="Inicio">
                <input type="datetime-local" required value={draft.startsAt} onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })} />
              </Field>
              <Field label="Fin">
                <input type="datetime-local" required value={draft.endsAt} onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })} />
              </Field>
            </div>
            <ScopeEditor db={db} value={draft.scope} onChange={(scope) => setDraft({ ...draft, scope })} />
            <FormActions onCancel={() => setDraft(null)} />
          </form>
        </Modal>
      )}
    </div>
  )
}
