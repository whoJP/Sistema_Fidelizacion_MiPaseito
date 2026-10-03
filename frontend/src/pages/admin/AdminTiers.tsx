import { useState, type FormEvent } from 'react'
import { useDb } from '../../data/store'
import { statusTotal, tierForStatus } from '../../domain/loyalty'
import { formatInt } from '../../lib/format'
import type { Tier, TierIconKey } from '../../types/domain'
import { Badge, Card, Empty, Field, Modal, run } from '../../components/ui'
import { TIER_ICONS, TierChip, TierIcon } from '../../components/TierIcon'
import { LIMITS, MAX_MULTIPLIER, MAX_SORT_ORDER, MAX_TIER_STATUS, TIER_ICON_KEYS } from '../../domain/validation'
import { AdminHeader, FormActions } from './shared'

type Draft = {
  id: number | null
  name: string
  minimumStatus: string
  pointsMultiplier: string
  sortOrder: string
  isActive: boolean
  icon: TierIconKey
}

const toDraft = (t?: Tier, nextOrder = 1): Draft => ({
  id: t?.id ?? null,
  name: t?.name ?? '',
  minimumStatus: String(t?.minimumStatus ?? 0),
  pointsMultiplier: String(t?.pointsMultiplier ?? 1),
  sortOrder: String(t?.sortOrder ?? nextOrder),
  isActive: t?.isActive ?? true,
  icon: t?.icon ?? 'medal',
})

export function AdminTiers() {
  const db = useDb()
  const [draft, setDraft] = useState<Draft | null>(null)
  const tiers = [...db.tiers].sort((a, b) => a.sortOrder - b.sortOrder)
  const customers = db.users.filter((u) => u.role === 'CUSTOMER' && u.deletedAt === null)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft) return
    const ok = await run(
      'saveTier',
      {
        id: draft.id,
        data: {
          name: draft.name,
          minimumStatus: Math.trunc(Number(draft.minimumStatus)),
          pointsMultiplier: Number(draft.pointsMultiplier),
          sortOrder: Math.trunc(Number(draft.sortOrder)),
          isActive: draft.isActive,
          icon: draft.icon,
        },
      },
      'Nivel guardado',
    )
    if (ok) setDraft(null)
  }

  return (
    <div className="page">
      <AdminHeader
        title="Niveles"
        subtitle="Mínimo de puntos de nivel, multiplicador e ícono"
        onCreate={() => setDraft(toDraft(undefined, tiers.length + 1))}
      />
      <Card>
        {tiers.length === 0 ? (
          <Empty>Sin niveles. Crea al menos uno con 0 puntos de nivel mínimos.</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Orden</th>
                <th>Nivel</th>
                <th className="num">Puntos de nivel mínimos</th>
                <th className="num">Multiplica los puntos</th>
                <th className="num">Clientes</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tiers.map((t) => (
                <tr key={t.id}>
                  <td>{t.sortOrder}</td>
                  <td>
                    <span className="row gap">
                      <TierIcon tier={t} size={30} />
                      <TierChip tier={t} />
                    </span>
                  </td>
                  <td className="num">{formatInt(t.minimumStatus)}</td>
                  <td className="num">×{t.pointsMultiplier}</td>
                  <td className="num">{customers.filter((u) => tierForStatus(db, statusTotal(db, u.id))?.id === t.id).length}</td>
                  <td>{t.isActive ? <Badge tone="success">Activo</Badge> : <Badge>Inactivo</Badge>}</td>
                  <td className="row end">
                    <button className="btn btn-ghost btn-sm" onClick={() => setDraft(toDraft(t))}>
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {draft && (
        <Modal title={draft.id ? 'Editar nivel' : 'Nuevo nivel'} onClose={() => setDraft(null)}>
          <form className="stack" onSubmit={save}>
            <div className="tier-preview">
              <TierIcon tier={{ name: draft.name, icon: draft.icon }} size={52} />
              <TierChip tier={{ name: draft.name.trim() || 'Nuevo nivel', icon: draft.icon }} />
            </div>
            <Field label="Nombre">
              <input required maxLength={LIMITS.tierName} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <div className="field">
              <span className="field-label">Ícono</span>
              <div className="icon-picker" role="radiogroup" aria-label="Ícono del nivel">
                {TIER_ICON_KEYS.map((key) => {
                  const { icon: Icon, label } = TIER_ICONS[key]
                  const active = draft.icon === key
                  return (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-label={label}
                      title={label}
                      className={`icon-pick ${active ? 'is-active' : ''}`}
                      onClick={() => setDraft({ ...draft, icon: key })}
                    >
                      <Icon size={20} aria-hidden />
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="grid-3">
              <Field label="Puntos de nivel mínimos" hint="El nivel inicial va con 0">
                <input
                  type="number"
                  min={0}
                  max={MAX_TIER_STATUS}
                  step={1}
                  required
                  value={draft.minimumStatus}
                  onChange={(e) => setDraft({ ...draft, minimumStatus: e.target.value })}
                />
              </Field>
              <Field label="Multiplicador de puntos" hint="1 = normal, 1.5 = 50 % más">
                <input
                  type="number"
                  min={0.01}
                  max={MAX_MULTIPLIER}
                  step={0.01}
                  required
                  value={draft.pointsMultiplier}
                  onChange={(e) => setDraft({ ...draft, pointsMultiplier: e.target.value })}
                />
              </Field>
              <Field label="Orden">
                <input
                  type="number"
                  min={0}
                  max={MAX_SORT_ORDER}
                  step={1}
                  required
                  value={draft.sortOrder}
                  onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })}
                />
              </Field>
            </div>
            <label className="check">
              <input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />
              Activo
            </label>
            <FormActions onCancel={() => setDraft(null)} />
          </form>
        </Modal>
      )}
    </div>
  )
}
