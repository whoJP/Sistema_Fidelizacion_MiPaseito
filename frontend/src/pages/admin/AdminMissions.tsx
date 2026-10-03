import { useState, type FormEvent } from 'react'
import { useDb } from '../../data/store'
import { missionScope } from '../../domain/loyalty'
import { MISSION_GOAL_HINTS, MISSION_TYPE_LABELS, formatDateTime, formatInt, formatMoney, fromLocalInput, toLocalInput } from '../../lib/format'
import type { Database, Mission, MissionStatus, MissionType } from '../../types/domain'
import { Card, Empty, Field, Modal, run, vanish } from '../../components/ui'
import { confirmDialog } from '../../components/dialog'
import { LIMITS, MAX_GOAL, MAX_REWARD_POINTS } from '../../domain/validation'
import { WindowFields, draftWindowError } from '../../components/WindowFields'
import { AdminHeader, FormActions, ScopeEditor, StatusBadge, scopeSummary, type ScopeValue } from './shared'

interface Draft {
  id: number | null
  name: string
  description: string
  type: MissionType
  goal: string
  rewardPoints: string
  rewardStatus: string
  rewardSpins: string
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
    rewardSpins: String(m?.rewardSpins ?? 0),
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
  const editing = (draft?.id && db.missions.find((m) => m.id === draft.id)) || null
  const windowProblem = draft && draftWindowError(draft, editing, true)
  const rewardProblem =
    draft && [draft.rewardPoints, draft.rewardStatus, draft.rewardSpins].every((v) => !(Number(v) > 0))
      ? 'La misión debe dar puntos, puntos de nivel o giros de ruleta'
      : null
  const scopeProblem =
    draft?.type === 'BUY_CATEGORY' && draft.scope.categoryIds.length === 0 ? 'Elige en Alcance la categoría donde hay que comprar' : null

  const remove = async (m: Mission, row: HTMLElement) => {
    const ok = await confirmDialog({
      title: `¿Eliminar "${m.name}"?`,
      message: 'Deja de mostrarse. Lo ya entregado se conserva.',
      confirmLabel: 'Eliminar',
      tone: 'danger',
    })
    if (ok) void vanish(row, () => run('softDelete', { table: 'missions', id: m.id }, 'Misión eliminada'))
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft || windowProblem || rewardProblem || scopeProblem) return
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
          goal: Number(draft.goal),
          rewardPoints: Number(draft.rewardPoints || 0),
          rewardStatus: Number(draft.rewardStatus || 0),
          rewardSpins: Number(draft.rewardSpins || 0),
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
        subtitle="Objetivo y premio automático"
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
                      {m.rewardSpins > 0 && ` · ${m.rewardSpins === 1 ? '1 giro' : `${m.rewardSpins} giros`}`}
                    </td>
                    <td className="small">
                      {formatDateTime(m.startsAt)} - {formatDateTime(m.endsAt)}
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
                      <button className="btn btn-ghost btn-sm danger" onClick={(e) => remove(m, e.currentTarget)}>
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
                <input required maxLength={LIMITS.name} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
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
              <textarea rows={2} maxLength={LIMITS.description} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
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
                <input type="number" min={1} max={MAX_GOAL} step={1} required value={draft.goal} onChange={(e) => setDraft({ ...draft, goal: e.target.value })} />
              </Field>
            </div>
            <div className="grid-3">
              <Field label="Puntos de premio" error={rewardProblem}>
                <input
                  type="number"
                  min={0}
                  max={MAX_REWARD_POINTS}
                  step={1}
                  value={draft.rewardPoints}
                  onChange={(e) => setDraft({ ...draft, rewardPoints: e.target.value })}
                />
              </Field>
              <Field label="Puntos de nivel de premio">
                <input
                  type="number"
                  min={0}
                  max={MAX_REWARD_POINTS}
                  step={1}
                  value={draft.rewardStatus}
                  onChange={(e) => setDraft({ ...draft, rewardStatus: e.target.value })}
                />
              </Field>
              <Field label="Giros gratis de ruleta">
                <input type="number" min={0} max={5} step={1} value={draft.rewardSpins} onChange={(e) => setDraft({ ...draft, rewardSpins: e.target.value })} />
              </Field>
            </div>
            <WindowFields value={draft} onChange={(w) => setDraft({ ...draft, ...w })} previous={editing} required />
            <ScopeEditor db={db} value={draft.scope} onChange={(scope) => setDraft({ ...draft, scope })} />
            {scopeProblem && (
              <span className="field-error" role="alert">
                {scopeProblem}
              </span>
            )}
            <FormActions onCancel={() => setDraft(null)} disabled={!!(windowProblem || rewardProblem || scopeProblem)} />
          </form>
        </Modal>
      )}
    </div>
  )
}
