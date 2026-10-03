import { useState, type FormEvent } from 'react'
import { useDb } from '../../data/store'
import { missionScope } from '../../domain/loyalty'
import { MISSION_GOAL_HINTS, MISSION_TYPE_LABELS, formatDate, formatInt, formatMoney, fromLocalInput, toLocalInput } from '../../lib/format'
import type { Database, Mission, MissionStatus, MissionType } from '../../types/domain'
import { Card, Empty, Field, Modal, run } from '../../components/ui'
import { AdminHeader, FormActions, ScopeEditor, StatusBadge, scopeSummary, type ScopeValue } from './shared'

interface Draft {
  id: number | null
  name: string
  description: string
  type: MissionType
  goal: string
  rewardPoints: string
  rewardStatus: string
  startsAt: string
  endsAt: string
  status: MissionStatus
  scope: ScopeValue
}

const toDraft = (db: Database, m?: Mission): Draft => {
  const start = new Date()
  const end = new Date(Date.now() + 30 * 24 * 3600_000)
  return {
    id: m?.id ?? null,
    name: m?.name ?? '',
    description: m?.description ?? '',
    type: m?.type ?? 'BUY_DISTINCT_BUSINESSES',
    goal: String(m?.goal ?? ''),
    rewardPoints: String(m?.rewardPoints ?? 0),
    rewardStatus: String(m?.rewardStatus ?? 0),
    startsAt: toLocalInput(m?.startsAt ?? start.toISOString()),
    endsAt: toLocalInput(m?.endsAt ?? end.toISOString()),
    status: m?.status ?? 'DRAFT',
    scope: m ? missionScope(db, m.id) : { businessIds: [], categoryIds: [] },
  }
}

export function AdminMissions() {
  const db = useDb()
  const [draft, setDraft] = useState<Draft | null>(null)
  const missions = db.missions.filter((m) => m.deletedAt === null).sort((a, b) => b.id - a.id)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft) return
    const startsAt = fromLocalInput(draft.startsAt)
    const endsAt = fromLocalInput(draft.endsAt)
    if (!startsAt || !endsAt) return
    const ok = await run(
      'saveMission',
      {
        id: draft.id,
        data: {
          name: draft.name,
          description: draft.description.trim() || null,
          type: draft.type,
          goal: Math.trunc(Number(draft.goal)),
          rewardPoints: Math.max(0, Math.trunc(Number(draft.rewardPoints))),
          rewardStatus: Math.max(0, Math.trunc(Number(draft.rewardStatus))),
          startsAt,
          endsAt,
          status: draft.status,
        },
        scope: draft.scope,
      },
      'Misión guardada',
    )
    if (ok) setDraft(null)
  }

  return (
    <div className="page">
      <AdminHeader
        title="Misiones"
        subtitle="Retos con un objetivo y un premio. El premio se entrega solo al cumplirlo (también a quien ya lo cumple al publicarla) y se retira si se anula la compra que lo logró."
        onCreate={() => setDraft(toDraft(db))}
      />
      <Card>
        {missions.length === 0 ? (
          <Empty>No hay misiones configuradas.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th className="num">Objetivo</th>
                  <th>Recompensa</th>
                  <th>Vigencia</th>
                  <th>Alcance</th>
                  <th className="num">La completaron</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {missions.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <strong>{m.name}</strong>
                    </td>
                    <td className="small">{MISSION_TYPE_LABELS[m.type]}</td>
                    <td className="num">{m.type === 'TOTAL_PURCHASE_AMOUNT' ? formatMoney(m.goal) : formatInt(m.goal)}</td>
                    <td className="small">
                      {formatInt(m.rewardPoints)} puntos · {formatInt(m.rewardStatus)} de nivel
                    </td>
                    <td className="small">
                      {formatDate(m.startsAt)} – {formatDate(m.endsAt)}
                    </td>
                    <td className="small">{scopeSummary(db, missionScope(db, m.id))}</td>
                    <td className="num">{db.missionProgress.filter((p) => p.missionId === m.id && p.completedAt).length}</td>
                    <td>
                      <StatusBadge status={m.status} />
                    </td>
                    <td className="row end gap">
                      <button className="btn btn-ghost btn-sm" onClick={() => setDraft(toDraft(db, m))}>
                        Editar
                      </button>
                      <button
                        className="btn btn-ghost btn-sm danger"
                        onClick={() => confirm(`¿Eliminar "${m.name}"?`) && run('softDelete', { table: 'missions', id: m.id }, 'Misión eliminada')}
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
        <Modal title={draft.id ? 'Editar misión' : 'Nueva misión'} onClose={() => setDraft(null)} wide>
          <form className="stack" onSubmit={save}>
            <div className="grid-2">
              <Field label="Nombre">
                <input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </Field>
              <Field label="Estado">
                <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as MissionStatus })}>
                  <option value="DRAFT">Borrador</option>
                  <option value="ACTIVE">Activa</option>
                  <option value="INACTIVE">Inactiva</option>
                </select>
              </Field>
            </div>
            <Field label="Descripción (opcional)">
              <textarea rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </Field>
            <div className="grid-2">
              <Field label="Tipo">
                <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as MissionType })}>
                  {(Object.keys(MISSION_TYPE_LABELS) as MissionType[]).map((t) => (
                    <option key={t} value={t}>
                      {MISSION_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={draft.type === 'TOTAL_PURCHASE_AMOUNT' ? 'Objetivo (Bs)' : 'Objetivo'} hint={MISSION_GOAL_HINTS[draft.type]}>
                <input type="number" min={1} step={1} required value={draft.goal} onChange={(e) => setDraft({ ...draft, goal: e.target.value })} />
              </Field>
            </div>
            <div className="grid-2">
              <Field label="Puntos de premio">
                <input type="number" min={0} step={1} value={draft.rewardPoints} onChange={(e) => setDraft({ ...draft, rewardPoints: e.target.value })} />
              </Field>
              <Field label="Puntos de nivel de premio">
                <input type="number" min={0} step={1} value={draft.rewardStatus} onChange={(e) => setDraft({ ...draft, rewardStatus: e.target.value })} />
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
