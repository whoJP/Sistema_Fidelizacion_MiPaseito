import { useState, type FormEvent } from 'react'
import { ApiError, api } from '../../data/api'
import { applySnapshot, getDb, useDb } from '../../data/store'
import { DAY_LABELS, DAYS_IN_ORDER, MEMBER_ROLE_LABELS, floorLabel, fullName } from '../../lib/format'
import type { Business, BusinessMemberRole, BusinessSchedule, Database } from '../../types/domain'
import { Badge, Card, Empty, Field, Modal, MultiSelect, notify, run, vanish } from '../../components/ui'
import { confirmDialog } from '../../components/dialog'
import { LIMITS, emailError, floorError, localNumberError, passwordError, personNameError, phoneError, urlError } from '../../domain/validation'
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

function scheduleError(schedules: ScheduleDraft[]): string | null {
  for (const s of schedules) {
    if (s.isClosed) continue
    const day = DAY_LABELS[s.dayOfWeek].toLowerCase()
    if (!s.openTime || !s.closeTime) return `Indica la hora de apertura y de cierre del ${day}`
    if (s.openTime >= s.closeTime) return `El ${day}, la apertura debe ser anterior al cierre`
  }
  return null
}

const EMPTY_ACCOUNT = { firstName: '', lastName: '', email: '', phone: '', password: '', role: 'STAFF' as BusinessMemberRole }

function RoleSelect({ value, onChange }: { value: BusinessMemberRole; onChange: (role: BusinessMemberRole) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as BusinessMemberRole)}>
      <option value="STAFF">{MEMBER_ROLE_LABELS.STAFF}</option>
      <option value="MANAGER">{MEMBER_ROLE_LABELS.MANAGER}</option>
    </select>
  )
}

function MembersPanel({ businessId }: { businessId: number }) {
  const db = useDb()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<BusinessMemberRole>('STAFF')
  const [account, setAccount] = useState(EMPTY_ACCOUNT)
  const [creating, setCreating] = useState(false)
  const members = db.businessMembers.filter((m) => m.businessId === businessId && m.status === 'ACTIVE')

  const createAccount = async () => {
    setCreating(true)
    try {
      const { version, db: next } = await api.createMerchant({ ...account, businessId })
      applySnapshot(version, next)
      notify('success', `Cuenta creada. ${account.firstName} ya puede ingresar con su correo y contraseña.`)
      setAccount(EMPTY_ACCOUNT)
    } catch (err) {
      notify('error', err instanceof ApiError ? err.message : 'Error inesperado')
    } finally {
      setCreating(false)
    }
  }
  const accountErrors = {
    firstName: account.firstName.trim() ? personNameError(account.firstName, 'El nombre') : null,
    lastName: account.lastName.trim() ? personNameError(account.lastName, 'El apellido') : null,
    email: account.email.trim() ? emailError(account.email) : null,
    password: account.password ? passwordError(account.password) : null,
    phone: phoneError(account.phone),
  }
  const accountReady =
    account.firstName.trim() && account.lastName.trim() && account.email.trim() && account.password && !Object.values(accountErrors).some(Boolean)

  return (
    <div className="stack">
      <span className="field-label">Equipo del establecimiento</span>
      {members.length === 0 ? (
        <p className="muted small">Sin personal.</p>
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
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm danger"
                    onClick={async (e) => {
                      const row = e.currentTarget
                      const ok = await confirmDialog({
                        title: `¿Quitar a ${u ? fullName(u) : 'esta persona'} del equipo?`,
                        message: 'Pierde el acceso a este local. Sus registros se conservan.',
                        confirmLabel: 'Quitar',
                        tone: 'danger',
                      })
                      if (ok) void vanish(row, () => run('deactivateMembership', { memberId: m.id }, 'Persona quitada del equipo'))
                    }}
                  >
                    Quitar
                  </button>
                </span>
              </li>
            )
          })}
        </ul>
      )}
      <span className="field-label">Nueva cuenta de personal</span>
      <div className="grid-2">
        <Field label="Nombre" error={accountErrors.firstName}>
          <input maxLength={LIMITS.personName} value={account.firstName} onChange={(e) => setAccount({ ...account, firstName: e.target.value })} />
        </Field>
        <Field label="Apellido" error={accountErrors.lastName}>
          <input maxLength={LIMITS.personName} value={account.lastName} onChange={(e) => setAccount({ ...account, lastName: e.target.value })} />
        </Field>
        <Field label="Correo" error={accountErrors.email}>
          <input
            type="email"
            autoComplete="off"
            maxLength={LIMITS.email}
            value={account.email}
            onChange={(e) => setAccount({ ...account, email: e.target.value })}
          />
        </Field>
        <Field
          label="Contraseña inicial"
          hint={`${LIMITS.passwordMin}+ caracteres, letras y números`}
          error={accountErrors.password}
        >
          <input
            type="text"
            autoComplete="off"
            maxLength={LIMITS.passwordMax}
            value={account.password}
            onChange={(e) => setAccount({ ...account, password: e.target.value })}
          />
        </Field>
        <Field label="Teléfono (opcional)" error={accountErrors.phone}>
          <input
            type="tel"
            inputMode="tel"
            maxLength={LIMITS.phone}
            value={account.phone}
            onChange={(e) => setAccount({ ...account, phone: e.target.value })}
          />
        </Field>
        <Field label="Cargo">
          <RoleSelect value={account.role} onChange={(r) => setAccount({ ...account, role: r })} />
        </Field>
      </div>
      <div className="row end">
        <button type="button" className="btn" disabled={!accountReady || creating} onClick={createAccount}>
          Crear cuenta
        </button>
      </div>

      <span className="field-label">Asignar una cuenta de personal existente</span>
      <div className="row gap wrap">
        <input
          type="email"
          placeholder="Correo de la cuenta de personal"
          aria-label="Correo de la cuenta de personal"
          maxLength={LIMITS.email}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="grow"
        />
        <RoleSelect value={role} onChange={setRole} />
        <button
          type="button"
          className="btn"
          disabled={!!emailError(email)}
          onClick={async () => {
            if (await run('saveMembership', { email, businessId, role }, 'Persona agregada al equipo')) setEmail('')
          }}
        >
          Agregar
        </button>
      </div>
      <p className="muted small">
        <b>Personal</b>: compras y canjes. <b>Encargado</b>: además catálogo y recompensas.
      </p>
    </div>
  )
}

export function AdminBusinesses() {
  const db = useDb()
  const [draft, setDraft] = useState<Draft | null>(null)
  const businesses = db.businesses.filter((b) => b.deletedAt === null).sort((a, b) => a.name.localeCompare(b.name))

  const errors = draft && {
    floor: floorError(draft.floor),
    localNumber: localNumberError(draft.localNumber),
    phone: phoneError(draft.phone),
    logoUrl: urlError(draft.logoUrl),
    categories: draft.categoryIds.length === 0 ? 'Elige al menos una categoría' : null,
    schedule: scheduleError(draft.schedules),
  }
  const invalid = !!errors && Object.values(errors).some(Boolean)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft || invalid) return
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
        subtitle="Ubicación, horario y personal"
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
                        .join(', ') || '-'}
                    </td>
                    <td className="small">{[b.floor && floorLabel(b.floor), b.sector, b.localNumber && `Local ${b.localNumber}`].filter(Boolean).join(', ') || '-'}</td>
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
                        onClick={async (e) => {
                          const row = e.currentTarget
                          const ok = await confirmDialog({
                            title: `¿Eliminar "${b.name}"?`,
                            message: 'Sale del directorio y su personal pierde el acceso. El historial se conserva.',
                            confirmLabel: 'Eliminar',
                            tone: 'danger',
                          })
                          if (ok) void vanish(row, () => run('softDelete', { table: 'businesses', id: b.id }, 'Establecimiento eliminado'))
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

      {draft && (
        <Modal title={draft.id ? `Editar ${draft.name}` : 'Nuevo establecimiento'} onClose={() => setDraft(null)} wide>
          <form className="stack" onSubmit={save}>
            <div className="grid-2">
              <Field label="Nombre">
                <input required maxLength={LIMITS.name} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </Field>
              <Field label="Estado">
                <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as Business['status'] })}>
                  <option value="ACTIVE">Activo</option>
                  <option value="INACTIVE">Inactivo</option>
                </select>
              </Field>
            </div>
            <Field label="Descripción">
              <textarea
                rows={2}
                maxLength={LIMITS.description}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </Field>
            <div className="grid-4">
              <Field label="Piso" hint="PB o número" error={errors?.floor}>
                <input maxLength={LIMITS.floor} placeholder="PB" value={draft.floor} onChange={(e) => setDraft({ ...draft, floor: e.target.value })} />
              </Field>
              <Field label="Sector">
                <input maxLength={LIMITS.sector} value={draft.sector} onChange={(e) => setDraft({ ...draft, sector: e.target.value })} />
              </Field>
              <Field label="Local" error={errors?.localNumber}>
                <input maxLength={LIMITS.localNumber} value={draft.localNumber} onChange={(e) => setDraft({ ...draft, localNumber: e.target.value })} />
              </Field>
              <Field label="Teléfono" error={errors?.phone}>
                <input type="tel" inputMode="tel" maxLength={LIMITS.phone} value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
              </Field>
            </div>
            <Field label="URL del logo (opcional)" error={errors?.logoUrl}>
              <input
                type="url"
                maxLength={LIMITS.url}
                placeholder="https://"
                value={draft.logoUrl}
                onChange={(e) => setDraft({ ...draft, logoUrl: e.target.value })}
              />
            </Field>
            <Field label="Categorías" error={errors?.categories}>
              <MultiSelect options={liveCategoryOptions(db)} value={draft.categoryIds} onChange={(categoryIds) => setDraft({ ...draft, categoryIds })} />
            </Field>

            <div>
              <span className="field-label">Horario</span>
              {errors?.schedule && (
                <span className="field-error" role="alert">
                  {errors.schedule}
                </span>
              )}
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

            {draft.id ? <MembersPanel businessId={draft.id} /> : <p className="muted small">Guarda para asignar su equipo.</p>}

            <FormActions onCancel={() => setDraft(null)} disabled={invalid} />
          </form>
        </Modal>
      )}
    </div>
  )
}
