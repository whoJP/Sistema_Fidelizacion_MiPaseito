import { useMemo, useState, type FormEvent } from 'react'
import { useDb } from '../../data/store'
import { badgeProgress } from '../../domain/loyalty'
import { BADGE_TYPE_LABELS, formatDateKey, formatInt } from '../../lib/format'
import type { Badge as BadgeDef, BadgeStatus, BadgeType, Database } from '../../types/domain'
import { BadgeMedal } from '../../components/BadgeMedal'
import { Card, Empty, Field, Modal, run, vanish } from '../../components/ui'
import { confirmDialog } from '../../components/dialog'
import { LIMITS, MAX_GOAL } from '../../domain/validation'
import { AdminHeader, FormActions, StatusBadge, liveCategoryOptions } from './shared'

interface Draft {
  id: number | null
  name: string
  description: string
  type: BadgeType
  goal: string
  tierId: string
  categoryId: string
  date: string
  status: BadgeStatus
}

const toDraft = (b?: BadgeDef): Draft => ({
  id: b?.id ?? null,
  name: b?.name ?? '',
  description: b?.description ?? '',
  type: b?.type ?? 'SPECIAL_DATE',
  goal: String(b?.goal ?? 1),
  tierId: b?.tierId ? String(b.tierId) : '',
  categoryId: b?.categoryId ? String(b.categoryId) : '',
  date: b?.date ?? '',
  status: b?.status ?? 'ACTIVE',
})

function requirement(db: Database, b: BadgeDef): string {
  switch (b.type) {
    case 'SPECIAL_DATE':
      return `Comprar o asistir a un evento el ${b.date ? formatDateKey(b.date) : '?'} (00:00 a 23:59)`
    case 'TIER_REACHED':
      return `Llegar a nivel ${db.tiers.find((t) => t.id === b.tierId)?.name ?? '?'}`
    case 'CATEGORY_PURCHASES':
      return `${formatInt(b.goal ?? 0)} compras en ${db.categories.find((c) => c.id === b.categoryId)?.name ?? '?'}`
    case 'PURCHASE_COUNT':
      return `${formatInt(b.goal ?? 0)} compras en el Paseo`
    case 'DISTINCT_BUSINESSES':
      return `Comprar en ${formatInt(b.goal ?? 0)} establecimientos distintos`
    case 'MISSIONS_COMPLETED':
      return `Completar ${formatInt(b.goal ?? 0)} misiones`
  }
}

const GROUPS: { title: string; types: BadgeType[] }[] = [
  { title: 'Fechas especiales', types: ['SPECIAL_DATE'] },
  { title: 'Logros', types: ['TIER_REACHED', 'PURCHASE_COUNT', 'CATEGORY_PURCHASES', 'DISTINCT_BUSINESSES', 'MISSIONS_COMPLETED'] },
]

export function AdminBadges() {
  const db = useDb()
  const [draft, setDraft] = useState<Draft | null>(null)
  const badges = db.badges.filter((b) => b.deletedAt === null)
  const { customers, holders } = useMemo(() => {
    const customers = db.users.filter((u) => u.role === 'CUSTOMER' && u.deletedAt === null)
    const holders = new Map<number, number>()
    for (const b of db.badges) {
      if (b.deletedAt !== null) continue
      holders.set(b.id, customers.filter((u) => badgeProgress(db, b, u.id).earnedAt).length)
    }
    return { customers, holders }
  }, [db])

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft) return
    const ok = await run(
      'saveBadge',
      {
        id: draft.id,
        data: {
          name: draft.name,
          description: draft.description,
          type: draft.type,
          goal: draft.goal ? Number(draft.goal) : null,
          tierId: draft.tierId ? Number(draft.tierId) : null,
          categoryId: draft.categoryId ? Number(draft.categoryId) : null,
          date: draft.date || null,
          status: draft.status,
        },
      },
      'Insignia guardada',
    )
    if (ok) setDraft(null)
  }

  const needsGoal = draft && !['SPECIAL_DATE', 'TIER_REACHED'].includes(draft.type)

  return (
    <div className="page">
      <AdminHeader
        title="Insignias"
        subtitle="Se otorgan solas al cumplir la condición"
        onCreate={() => setDraft(toDraft())}
        createLabel="Nueva insignia"
      />

      {GROUPS.map((group) => {
        const list = badges
          .filter((b) => group.types.includes(b.type))
          .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.type.localeCompare(b.type) || (a.goal ?? 0) - (b.goal ?? 0))
        return (
          <section key={group.title} className="stack">
            <h2 className="section-title">{group.title}</h2>
            <Card>
              {list.length === 0 ? (
                <Empty>No hay insignias de este tipo.</Empty>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Insignia</th>
                        <th>Cómo se gana</th>
                        <th className="num">Clientes que la tienen</th>
                        <th>Estado</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((b) => (
                        <tr key={b.id}>
                          <td>
                            <strong>{b.name}</strong>
                            {b.description && <div className="muted small">{b.description}</div>}
                          </td>
                          <td className="small">{requirement(db, b)}</td>
                          <td className="num">
                            {formatInt(holders.get(b.id) ?? 0)} de {formatInt(customers.length)}
                          </td>
                          <td>
                            <StatusBadge status={b.status} />
                          </td>
                          <td className="row end gap">
                            <button className="btn btn-ghost btn-sm" onClick={() => setDraft(toDraft(b))}>
                              Editar
                            </button>
                            <button
                              className="btn btn-ghost btn-sm danger"
                              onClick={async (e) => {
                                const row = e.currentTarget
                                const ok = await confirmDialog({
                                  title: `¿Eliminar "${b.name}"?`,
                                  message: 'Desaparecerá del perfil de todos los clientes que la ganaron.',
                                  confirmLabel: 'Eliminar',
                                  tone: 'danger',
                                })
                                if (ok) void vanish(row, () => run('softDelete', { table: 'badges', id: b.id }, 'Insignia eliminada'))
                              }}
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
          </section>
        )
      })}

      {draft && (
        <Modal title={draft.id ? 'Editar insignia' : 'Nueva insignia'} onClose={() => setDraft(null)} wide>
          <form className="stack" onSubmit={save}>
            <div className="grid-2">
              <Field label="Nombre">
                <input
                  required
                  maxLength={LIMITS.badgeName}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Ej. Navidad 2026"
                />
              </Field>
              <Field label="Estado">
                <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as BadgeStatus })}>
                  <option value="ACTIVE">Activa</option>
                  <option value="INACTIVE">Inactiva (oculta)</option>
                </select>
              </Field>
            </div>
            <Field label="Descripción corta">
              <input maxLength={LIMITS.description} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </Field>
            <Field label="Cómo se gana">
              <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as BadgeType })}>
                {(Object.keys(BADGE_TYPE_LABELS) as BadgeType[]).map((t) => (
                  <option key={t} value={t}>
                    {BADGE_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </Field>

            {draft.type === 'SPECIAL_DATE' && (
              <Field label="Fecha" hint="La gana quien compre o asista ese día">
                <input type="date" required min="2000-01-01" max="2100-12-31" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
              </Field>
            )}
            {draft.type === 'TIER_REACHED' && (
              <Field label="Nivel">
                <select required value={draft.tierId} onChange={(e) => setDraft({ ...draft, tierId: e.target.value })}>
                  <option value="">Elige un nivel</option>
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
            )}
            {draft.type === 'CATEGORY_PURCHASES' && (
              <Field label="Categoría">
                <select required value={draft.categoryId} onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}>
                  <option value="">Elige una categoría</option>
                  {liveCategoryOptions(db).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {needsGoal && (
              <Field label="Cantidad necesaria">
                <input type="number" min={1} max={MAX_GOAL} step={1} required value={draft.goal} onChange={(e) => setDraft({ ...draft, goal: e.target.value })} />
              </Field>
            )}

            <div className="row gap">
              <span className="muted small">Vista previa:</span>
            </div>
            <div className="medals">
              <BadgeMedal
                kind={draft.type}
                name={draft.name || 'Nombre de la insignia'}
                description={draft.description || null}
                earned
                footer="Obtenida el …"
              />
            </div>
            <FormActions onCancel={() => setDraft(null)} />
          </form>
        </Modal>
      )}
    </div>
  )
}
