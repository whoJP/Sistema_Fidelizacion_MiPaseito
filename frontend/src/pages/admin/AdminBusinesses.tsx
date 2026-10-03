import { useState, type FormEvent } from 'react'
import { getDb, useDb } from '../../data/store'
import { DAY_LABELS, DAYS_IN_ORDER, MEMBER_ROLE_LABELS, floorLabel, fullName } from '../../lib/format'
import type { Business, BusinessMemberRole, BusinessSchedule, Database } from '../../types/domain'
import { Badge, Card, Empty, Field, Modal, MultiSelect, run } from '../../components/ui'
import { AdminHeader, FormActions, StatusBadge, categoryLabel, liveCategoryOptions } from './shared'

type ScheduleDraft = Omit<BusinessSchedule, 'id' | 'businessId'>

interface Draft {
  id: number | null
  name: string
  description: string
  logoUrl: string
  phone: string
  floor: string
  sector: string
  localNumber: string
  status: Business['status']
  categoryIds: number[]
  schedules: ScheduleDraft[]
}

function toDraft(db: Database, b?: Business): Draft {
  const existing = b ? db.businessSchedules.filter((s) => s.businessId === b.id) : []
  return {
    id: b?.id ?? null,
    name: b?.name ?? '',
    description: b?.description ?? '',
    logoUrl: b?.logoUrl ?? '',
    phone: b?.phone ?? '',
    floor: b?.floor ?? '',
    sector: b?.sector ?? '',
    localNumber: b?.localNumber ?? '',
    status: b?.status ?? 'ACTIVE',
    categoryIds: b ? db.businessCategories.filter((c) => c.businessId === b.id).map((c) => c.categoryId) : [],
    schedules: DAYS_IN_ORDER.map((day) => {
      const s = existing.find((x) => x.dayOfWeek === day)
      return s
        ? { dayOfWeek: day, openTime: s.openTime, closeTime: s.closeTime, isClosed: s.isClosed }
        : day === 'SUNDAY'
          ? { dayOfWeek: day, openTime: '11:00', closeTime: '21:00', isClosed: false }
          : { dayOfWeek: day, openTime: '10:00', closeTime: '22:00', isClosed: false }
    }),
  }
}

const orNull = (v: string) => v.trim() || null

function MembersPanel({ businessId }: { businessId: number }) {
  const db = useDb()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<BusinessMemberRole>('STAFF')
  const members = db.businessMembers.filter((m) => m.businessId === businessId && m.status === 'ACTIVE')

  return (
    <div className="stack">
      <span className="field-label">Equipo del establecimiento</span>
      {members.length === 0 ? (
        <p className="muted small">Sin personal. Hace falta al menos una persona para registrar compras.</p>
      ) : (
        <ul className="list">
          {members.map((m) => {
            const u = db.users.find((x) => x.id === m.userId)
            return (
              <li key={m.id} className="list-row">
                <span>
                  {u && fullName(u)} <span className="muted small">{u?.email}</span>
                </span>
                <span className="row gap">
                  <Badge tone={m.role === 'MANAGER' ? 'accent' : 'neutral'}>{MEMBER_ROLE_LABELS[m.role]}</Badge>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => run('deactivateMembership', { memberId: m.id }, 'Persona quitada del equipo')}>
                    Quitar
                  </button>
                </span>
              </li>
            )
          })}
        </ul>
      )}
      <div className="row gap wrap">
        <input placeholder="Correo de su cuenta en Paseo Points" value={email} onChange={(e) => setEmail(e.target.value)} className="grow" />
        <select value={role} onChange={(e) => setRole(e.target.value as BusinessMemberRole)}>
          <option value="STAFF">{MEMBER_ROLE_LABELS.STAFF}</option>
          <option value="MANAGER">{MEMBER_ROLE_LABELS.MANAGER}</option>
        </select>
        <button
          type="button"
          className="btn"
          onClick={async () => {
            if (await run('saveMembership', { email, businessId, role }, 'Persona agregada al equipo')) setEmail('')
          }}
        >
          Agregar
        </button>
      </div>
      <p className="muted small">
        <b>Personal</b> registra compras y valida canjes. <b>Encargado</b> además maneja el catálogo, las recompensas y puede anular registros.
      </p>
    </div>
  )
}

export function AdminBusinesses() {
  const db = useDb()
  const [draft, setDraft] = useState<Draft | null>(null)
  const businesses = db.businesses.filter((b) => b.deletedAt === null).sort((a, b) => a.name.localeCompare(b.name))

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft) return
    const saved = await run(
      'saveBusiness',
      {
        id: draft.id,
        data: {
          name: draft.name,
          description: draft.description,
          logoUrl: orNull(draft.logoUrl),
          phone: orNull(draft.phone),
          floor: orNull(draft.floor),
          sector: orNull(draft.sector),
          localNumber: orNull(draft.localNumber),
          status: draft.status,
        },
        categoryIds: draft.categoryIds,
        schedules: draft.schedules.map((s) => (s.isClosed ? { ...s, openTime: null, closeTime: null } : s)),
      },
      'Establecimiento guardado',
    )
    if (saved) setDraft(draft.id ? null : toDraft(getDb(), saved))
  }

  const setSchedule = (i: number, patch: Partial<ScheduleDraft>) =>
    draft && setDraft({ ...draft, schedules: draft.schedules.map((s, j) => (i === j ? { ...s, ...patch } : s)) })

  return (
    <div className="page">
      <AdminHeader
        title="Establecimientos"
        subtitle="Restaurantes, tiendas y servicios del Paseo, con su ubicación, horario y personal."
        onCreate={() => setDraft(toDraft(db))}
      />
      <Card>
        {businesses.length === 0 ? (
          <Empty>No hay establecimientos. Crea el primero.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Categorías</th>
                  <th>Ubicación</th>
                  <th>Equipo</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {businesses.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <strong>{b.name}</strong>
                    </td>
                    <td className="small">
                      {db.businessCategories
                        .filter((c) => c.businessId === b.id)
                        .map((c) => categoryLabel(db, c.categoryId))
                        .join(', ') || '—'}
                    </td>
                    <td className="small">{[b.floor && floorLabel(b.floor), b.sector, b.localNumber].filter(Boolean).join(' · ') || '—'}</td>
                    <td>{db.businessMembers.filter((m) => m.businessId === b.id && m.status === 'ACTIVE').length}</td>
                    <td>
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="row end gap">
                      <button className="btn btn-ghost btn-sm" onClick={() => setDraft(toDraft(db, b))}>
                        Editar
                      </button>
                      <button
                        className="btn btn-ghost btn-sm danger"
                        onClick={() =>
                          confirm(`¿Eliminar "${b.name}"? Su historial de compras se conserva.`) &&
                          run('softDelete', { table: 'businesses', id: b.id }, 'Establecimiento eliminado')
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
        <Modal title={draft.id ? `Editar ${draft.name}` : 'Nuevo establecimiento'} onClose={() => setDraft(null)} wide>
          <form className="stack" onSubmit={save}>
            <div className="grid-2">
              <Field label="Nombre">
                <input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </Field>
              <Field label="Estado">
                <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as Business['status'] })}>
                  <option value="ACTIVE">Activo</option>
                  <option value="INACTIVE">Inactivo</option>
                </select>
              </Field>
            </div>
            <Field label="Descripción">
              <textarea rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </Field>
            <div className="grid-4">
              <Field label="Piso">
                <input value={draft.floor} onChange={(e) => setDraft({ ...draft, floor: e.target.value })} />
              </Field>
              <Field label="Sector">
                <input value={draft.sector} onChange={(e) => setDraft({ ...draft, sector: e.target.value })} />
              </Field>
              <Field label="Local">
                <input value={draft.localNumber} onChange={(e) => setDraft({ ...draft, localNumber: e.target.value })} />
              </Field>
              <Field label="Teléfono">
                <input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
              </Field>
            </div>
            <Field label="URL del logo (opcional)">
              <input type="url" value={draft.logoUrl} onChange={(e) => setDraft({ ...draft, logoUrl: e.target.value })} />
            </Field>
            <Field label="Categorías">
              <MultiSelect options={liveCategoryOptions(db)} value={draft.categoryIds} onChange={(categoryIds) => setDraft({ ...draft, categoryIds })} />
            </Field>

            <div>
              <span className="field-label">Horario</span>
              <div className="schedule-editor">
                {draft.schedules.map((s, i) => (
                  <div key={s.dayOfWeek} className="schedule-row">
                    <span>{DAY_LABELS[s.dayOfWeek]}</span>
                    <input type="time" value={s.openTime ?? ''} disabled={s.isClosed} onChange={(e) => setSchedule(i, { openTime: e.target.value || null })} />
                    <input type="time" value={s.closeTime ?? ''} disabled={s.isClosed} onChange={(e) => setSchedule(i, { closeTime: e.target.value || null })} />
                    <label className="check">
                      <input type="checkbox" checked={s.isClosed} onChange={(e) => setSchedule(i, { isClosed: e.target.checked })} />
                      Cerrado
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {draft.id ? <MembersPanel businessId={draft.id} /> : <p className="muted small">Guarda el establecimiento para asignar su equipo.</p>}

            <FormActions onCancel={() => setDraft(null)} />
          </form>
        </Modal>
      )}
    </div>
  )
}
