import { useState, type FormEvent } from 'react'
import { KeyRound, UserRound } from 'lucide-react'
import { ApiError, api } from '../data/api'
import { MEMBER_ROLE_LABELS, formatDate } from '../lib/format'
import { useSession, useUser } from '../session'
import type { User } from '../types/domain'
import { Card, Field, PageHeader, notify, run } from '../components/ui'

const ROLE_LABEL: Record<User['role'], string> = {
  CUSTOMER: 'Cliente',
  MERCHANT: 'Personal de tienda',
  ADMIN: 'Administrador',
}

type Draft = { firstName: string; lastName: string; email: string; phone: string; birthDate: string }

const toDraft = (u: User): Draft => ({
  firstName: u.firstName,
  lastName: u.lastName,
  email: u.email,
  phone: u.phone ?? '',
  birthDate: u.birthDate ?? '',
})

function ProfileForm({ user }: { user: User }) {
  const [draft, setDraft] = useState(() => toDraft(user))
  const [busy, setBusy] = useState(false)
  const saved = toDraft(user)
  const dirty = (Object.keys(draft) as (keyof Draft)[]).some((k) => draft[k].trim() !== saved[k])
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const set = (key: keyof Draft) => (e: { target: { value: string } }) => setDraft({ ...draft, [key]: e.target.value })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    await run(
      'updateProfile',
      {
        firstName: draft.firstName,
        lastName: draft.lastName,
        email: draft.email,
        phone: draft.phone.trim() || null,
        birthDate: draft.birthDate || null,
      },
      'Datos actualizados',
    )
    setBusy(false)
  }

  return (
    <form className="stack" onSubmit={submit}>
      <div className="grid-2">
        <Field label="Nombre">
          <input required maxLength={100} autoComplete="given-name" value={draft.firstName} onChange={set('firstName')} />
        </Field>
        <Field label="Apellido">
          <input required maxLength={100} autoComplete="family-name" value={draft.lastName} onChange={set('lastName')} />
        </Field>
      </div>
      <Field label="Correo electrónico" hint="Es el que usas para ingresar.">
        <input required type="email" maxLength={150} autoComplete="email" value={draft.email} onChange={set('email')} />
      </Field>
      <div className="grid-2">
        <Field label="Teléfono (opcional)">
          <input type="tel" inputMode="tel" maxLength={30} autoComplete="tel" placeholder="+591 7xx xxxxx" value={draft.phone} onChange={set('phone')} />
        </Field>
        <Field label="Fecha de nacimiento (opcional)" hint={user.role === 'CUSTOMER' ? 'Para tu insignia de cumpleaños.' : undefined}>
          <input type="date" min="1900-01-01" max={today} autoComplete="bday" value={draft.birthDate} onChange={set('birthDate')} />
        </Field>
      </div>
      <div className="row end gap">
        <button type="button" className="btn btn-ghost" disabled={!dirty || busy} onClick={() => setDraft(saved)}>
          Descartar cambios
        </button>
        <button className="btn btn-primary" type="submit" disabled={!dirty || busy}>
          Guardar
        </button>
      </div>
    </form>
  )
}

function PasswordForm() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [busy, setBusy] = useState(false)
  const mismatch = repeat.length > 0 && next !== repeat ? 'Las contraseñas no coinciden' : null
  const short = next.length > 0 && next.length < 6 ? 'Mínimo 6 caracteres' : null
  const valid = current.length > 0 && next.length >= 6 && next === repeat

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.changePassword(current, next)
      notify('success', 'Contraseña actualizada')
      setCurrent('')
      setNext('')
      setRepeat('')
    } catch (err) {
      notify('error', err instanceof ApiError ? err.message : 'No se pudo cambiar la contraseña')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <Field label="Contraseña actual">
        <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </Field>
      <Field label="Nueva contraseña" error={short}>
        <input type="password" autoComplete="new-password" maxLength={72} value={next} onChange={(e) => setNext(e.target.value)} />
      </Field>
      <Field label="Repite la nueva contraseña" error={mismatch}>
        <input type="password" autoComplete="new-password" maxLength={72} value={repeat} onChange={(e) => setRepeat(e.target.value)} />
      </Field>
      <div className="row end">
        <button className="btn btn-primary" type="submit" disabled={!valid || busy}>
          Cambiar contraseña
        </button>
      </div>
    </form>
  )
}

export function AccountPage() {
  const user = useUser()
  const { workplace } = useSession()
  const roleLabel = workplace ? `${MEMBER_ROLE_LABELS[workplace.membership.role]} · ${workplace.business.name}` : ROLE_LABEL[user.role]

  return (
    <div className="page">
      <PageHeader title="Mi perfil" subtitle={`${roleLabel} · Cuenta creada el ${formatDate(user.createdAt)}`} />
      <div className="account-grid">
        <Card>
          <h2 className="card-title">
            <UserRound size={18} aria-hidden /> Mis datos
          </h2>
          <ProfileForm key={user.updatedAt} user={user} />
        </Card>
        <Card>
          <h2 className="card-title">
            <KeyRound size={18} aria-hidden /> Contraseña
          </h2>
          <PasswordForm />
        </Card>
      </div>
    </div>
  )
}
