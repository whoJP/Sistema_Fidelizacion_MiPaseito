import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useDb } from '../../data/store'
import { eligiblePrizes, prizeOdds, prizeRemainingStock, prizeTitle } from '../../domain/engagement'
import { getSetting, rewardTitle } from '../../domain/loyalty'
import { localDateKey, todayKey } from '../../domain/time'
import { formatInt } from '../../lib/format'
import type { SpinPrize, SpinPrizeStatus, SpinPrizeType } from '../../types/domain'
import { Card, Empty, Field, Modal, Stat, run, vanish } from '../../components/ui'
import { confirmDialog } from '../../components/dialog'
import { MAX_MULTIPLIER, MAX_REWARD_POINTS, MAX_STOCK } from '../../domain/validation'
import { AdminHeader, FormActions, StatusBadge } from './shared'

const TYPE_LABEL: Record<SpinPrizeType, string> = {
  POINTS: 'Puntos',
  MULTIPLIER: 'Multiplicador para una compra',
  REWARD: 'Recompensa de un local',
  EXTRA_SPIN: 'Otro giro',
}

interface Draft {
  id: number | null
  type: SpinPrizeType
  points: string
  multiplier: string
  rewardId: number | null
  validDays: string
  weight: string
  stock: string
  status: SpinPrizeStatus
}

const toDraft = (p?: SpinPrize): Draft => ({
  id: p?.id ?? null,
  type: p?.type ?? 'POINTS',
  points: p?.points?.toString() ?? '',
  multiplier: p?.multiplier?.toString() ?? '2',
  rewardId: p?.rewardId ?? null,
  validDays: String(p?.validDays ?? 7),
  weight: String(p?.weight ?? 10),
  stock: p?.stock?.toString() ?? '',
  status: p?.status ?? 'ACTIVE',
})

const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')))
const percent = (share: number) => `${(share * 100).toLocaleString('es-BO', { maximumFractionDigits: 1 })}%`

export function AdminSpin() {
  const db = useDb()
  const [draft, setDraft] = useState<Draft | null>(null)
  const prizes = db.spinPrizes.filter((p) => p.deletedAt === null).sort((a, b) => b.weight - a.weight)
  const odds = prizeOdds(eligiblePrizes(db))
  const rewards = db.rewards.filter((r) => r.deletedAt === null && r.status === 'ACTIVE')
  const today = todayKey()
  const spinsToday = db.spins.filter((s) => localDateKey(s.createdAt) === today)
  const pointsSpent = db.spins.reduce((sum, s) => sum + s.cost, 0)
  const pointsGiven = db.spins.reduce((sum, s) => sum + s.points, 0)

  const remove = async (p: SpinPrize, row: HTMLElement) => {
    const ok = await confirmDialog({
      title: `¿Quitar "${prizeTitle(db, p)}" de la ruleta?`,
      message: 'Deja de salir en los giros nuevos. Los premios ya ganados se conservan.',
      confirmLabel: 'Quitar',
      tone: 'danger',
    })
    if (ok) void vanish(row, () => run('softDelete', { table: 'spinPrizes', id: p.id }, 'Premio quitado'))
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft) return
    const ok = await run(
      'savePrize',
      {
        id: draft.id,
        data: {
          type: draft.type,
          points: draft.type === 'POINTS' ? numOrNull(draft.points) : null,
          multiplier: draft.type === 'MULTIPLIER' ? numOrNull(draft.multiplier) : null,
          rewardId: draft.type === 'REWARD' ? draft.rewardId : null,
          validDays: Math.trunc(Number(draft.validDays) || 7),
          weight: Math.trunc(Number(draft.weight) || 0),
          stock: draft.stock.trim() === '' ? null : Math.trunc(Number(draft.stock)),
          status: draft.status,
        },
      },
      'Premio guardado',
    )
    if (ok) setDraft(null)
  }

  return (
    <div className="page">
      <AdminHeader
        title="Ruleta"
        subtitle={
          <>
            Premios del giro diario. El peso define qué tan seguido sale cada uno. Costo del giro y giros extra en{' '}
            <Link to="/admin/settings">Configuración</Link>.
          </>
        }
        onCreate={() => setDraft(toDraft())}
        createLabel="Nuevo premio"
      />
      <div className="stats-row">
        <Stat label="Giros hoy" value={formatInt(spinsToday.length)} />
        <Stat label="Costo del giro del día" value={`${formatInt(getSetting(db, 'SPIN_COST'))} puntos`} />
        <Stat label="Puntos cobrados (total)" value={formatInt(pointsSpent)} />
        <Stat label="Puntos entregados (total)" value={formatInt(pointsGiven)} />
      </div>
      <Card>
        {prizes.length === 0 ? (
          <Empty>La ruleta no tiene premios. Sin premios activos no se puede girar.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table table-stack">
              <thead>
                <tr>
                  <th>Premio</th>
                  <th className="num">Peso</th>
                  <th className="num">Probabilidad</th>
                  <th className="num">Disponibles</th>
                  <th className="num">Salió</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {prizes.map((p) => {
                  const share = odds.get(p.id)
                  const left = prizeRemainingStock(db, p)
                  return (
                    <tr key={p.id}>
                      <td>
                        <strong>{prizeTitle(db, p)}</strong>
                        <div className="muted small">
                          {TYPE_LABEL[p.type]}
                          {(p.type === 'MULTIPLIER' || p.type === 'REWARD') && ` · vale ${formatInt(p.validDays)} días`}
                        </div>
                      </td>
                      <td className="num" data-label="Peso">
                        {formatInt(p.weight)}
                      </td>
                      <td className="num" data-label="Probabilidad">
                        {share === undefined ? <span className="muted small">No sale</span> : percent(share)}
                      </td>
                      <td className="num" data-label="Disponibles">
                        {left === null ? 'Sin límite' : `${formatInt(left)} de ${formatInt(p.stock ?? 0)}`}
                      </td>
                      <td className="num" data-label="Salió">
                        {formatInt(db.spins.filter((s) => s.prizeId === p.id).length)}
                      </td>
                      <td data-label="Estado">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="row end gap">
                        <button className="btn btn-ghost btn-sm" onClick={() => setDraft(toDraft(p))}>
                          Editar
                        </button>
                        <button className="btn btn-ghost btn-sm danger" onClick={(e) => remove(p, e.currentTarget)}>
                          Quitar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted small">
          "No sale" = inactivo, sin unidades o con una recompensa que ya no está disponible. La probabilidad se reparte entre los que sí salen.
        </p>
      </Card>

      {draft && (
        <Modal title={draft.id ? 'Editar premio' : 'Nuevo premio'} onClose={() => setDraft(null)}>
          <form className="stack" onSubmit={save}>
            <div className="grid-2">
              <Field label="Tipo de premio">
                <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as SpinPrizeType })}>
                  {(Object.keys(TYPE_LABEL) as SpinPrizeType[]).map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Estado">
                <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as SpinPrizeStatus })}>
                  <option value="ACTIVE">Activo</option>
                  <option value="INACTIVE">Inactivo</option>
                </select>
              </Field>
            </div>
            {draft.type === 'POINTS' && (
              <Field label="Puntos" hint={`Mínimo ${formatInt(getSetting(db, 'SPIN_COST'))}: lo que cuesta el giro del día.`}>
                <input
                  type="number"
                  min={Math.max(1, getSetting(db, 'SPIN_COST'))}
                  max={MAX_REWARD_POINTS}
                  step={1}
                  required
                  value={draft.points}
                  onChange={(e) => setDraft({ ...draft, points: e.target.value })}
                />
              </Field>
            )}
            {draft.type === 'MULTIPLIER' && (
              <Field label="Multiplicador" hint="Ej. 2 = puntos dobles en la próxima compra.">
                <input type="number" min={1.01} max={MAX_MULTIPLIER} step={0.01} required value={draft.multiplier} onChange={(e) => setDraft({ ...draft, multiplier: e.target.value })} />
              </Field>
            )}
            {draft.type === 'REWARD' && (
              <Field label="Recompensa" hint="Se entrega gratis, como un canje listo para usar.">
                <select required value={draft.rewardId ?? ''} onChange={(e) => setDraft({ ...draft, rewardId: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">Elige una recompensa</option>
                  {rewards.map((r) => (
                    <option key={r.id} value={r.id}>
                      {rewardTitle(db, r)} · {db.businesses.find((b) => b.id === r.businessId)?.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {(draft.type === 'MULTIPLIER' || draft.type === 'REWARD') && (
              <Field label="Días para usarlo">
                <input type="number" min={1} max={60} step={1} required value={draft.validDays} onChange={(e) => setDraft({ ...draft, validDays: e.target.value })} />
              </Field>
            )}
            <div className="grid-2">
              <Field label="Peso" hint="Más peso, sale más seguido.">
                <input type="number" min={1} max={1000} step={1} required value={draft.weight} onChange={(e) => setDraft({ ...draft, weight: e.target.value })} />
              </Field>
              <Field label="Cantidad disponible" hint="Vacío = sin límite">
                <input type="number" min={0} max={MAX_STOCK} step={1} value={draft.stock} onChange={(e) => setDraft({ ...draft, stock: e.target.value })} />
              </Field>
            </div>
            <FormActions onCancel={() => setDraft(null)} />
          </form>
        </Modal>
      )}
    </div>
  )
}
