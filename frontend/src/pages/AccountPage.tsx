import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { BadgeCheck, CakeSlice, Camera, KeyRound, ShieldQuestion, Upload, UserRound } from 'lucide-react'
import { ApiError, api } from '../data/api'
import { applySnapshot, useDb } from '../data/store'
import { kycState } from '../domain/engagement'
import { todayKey } from '../domain/time'
import { LIMITS, birthDateRange, emailError, passwordError, personNameError, phoneError } from '../domain/validation'
import { MEMBER_ROLE_LABELS, formatDate, formatLongDayKey } from '../lib/format'
import { useSession, useUser } from '../session'
import type { User } from '../types/domain'
import { Card, Field, PageHeader, notify, run } from '../components/ui'

const ROLE_LABEL: Record<User['role'], string> = {
  CUSTOMER: 'Cliente',
  MERCHANT: 'Personal de tienda',
  ADMIN: 'Administrador',
}

type Draft = { firstName: string; lastName: string; email: string; phone: string }

const toDraft = (u: User): Draft => ({
  firstName: u.firstName,
  lastName: u.lastName,
  email: u.email,
  phone: u.phone ?? '',
})

function ProfileForm({ user }: { user: User }) {
  const [draft, setDraft] = useState(() => toDraft(user))
  const [busy, setBusy] = useState(false)
  const saved = toDraft(user)
  const dirty = (Object.keys(draft) as (keyof Draft)[]).some((k) => draft[k].trim() !== saved[k])
  const set = (key: keyof Draft) => (e: { target: { value: string } }) => setDraft({ ...draft, [key]: e.target.value })
  const errors = {
    firstName: draft.firstName.trim() ? personNameError(draft.firstName, 'El nombre') : null,
    lastName: draft.lastName.trim() ? personNameError(draft.lastName, 'El apellido') : null,
    email: draft.email.trim() ? emailError(draft.email) : null,
    phone: phoneError(draft.phone),
  }
  const invalid = Object.values(errors).some(Boolean)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (invalid || busy) return
    setBusy(true)
    await run(
      'updateProfile',
      {
        firstName: draft.firstName,
        lastName: draft.lastName,
        email: draft.email,
        phone: draft.phone.trim() || null,
      },
      'Datos actualizados',
    )
    setBusy(false)
  }

  return (
    <form className="stack" onSubmit={submit}>
      <div className="grid-2">
        <Field label="Nombre" error={errors.firstName}>
          <input required maxLength={LIMITS.personName} autoComplete="given-name" value={draft.firstName} onChange={set('firstName')} />
        </Field>
        <Field label="Apellido" error={errors.lastName}>
          <input required maxLength={LIMITS.personName} autoComplete="family-name" value={draft.lastName} onChange={set('lastName')} />
        </Field>
      </div>
      <Field label="Correo electrónico" hint="Es el que usas para ingresar." error={errors.email}>
        <input required type="email" maxLength={LIMITS.email} autoComplete="email" value={draft.email} onChange={set('email')} />
      </Field>
      <Field label="Teléfono (opcional)" error={errors.phone}>
        <input type="tel" inputMode="tel" maxLength={LIMITS.phone} autoComplete="tel" placeholder="+591 7xx xxxxx" value={draft.phone} onChange={set('phone')} />
      </Field>
      <div className="row end gap">
        <button type="button" className="btn btn-ghost" disabled={!dirty || busy} onClick={() => setDraft(saved)}>
          Descartar cambios
        </button>
        <button className="btn btn-primary" type="submit" disabled={!dirty || invalid || busy}>
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
  const nextError = !next ? null : passwordError(next) ?? (next === current ? 'Debe ser distinta a la actual' : null)
  const valid = current.length > 0 && !!next && !nextError && next === repeat

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid || busy) return
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
        <input type="password" autoComplete="current-password" maxLength={LIMITS.passwordMax} value={current} onChange={(e) => setCurrent(e.target.value)} />
      </Field>
      <Field label="Nueva contraseña" error={nextError} hint={`Mínimo ${LIMITS.passwordMin} caracteres, con letras y números.`}>
        <input type="password" autoComplete="new-password" maxLength={LIMITS.passwordMax} value={next} onChange={(e) => setNext(e.target.value)} />
      </Field>
      <Field label="Repite la nueva contraseña" error={mismatch}>
        <input type="password" autoComplete="new-password" maxLength={LIMITS.passwordMax} value={repeat} onChange={(e) => setRepeat(e.target.value)} />
      </Field>
      <div className="row end">
        <button className="btn btn-primary" type="submit" disabled={!valid || busy}>
          Cambiar contraseña
        </button>
      </div>
    </form>
  )
}

const MAX_SIDE = 1600

/** Re-encodes the photo as JPEG, at most 1600 px per side, so it travels light and without metadata. */
async function compressPhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.85)
}

function BirthdayVerification() {
  const db = useDb()
  const user = useUser()
  const state = kycState(db, user.id)
  const [birthDate, setBirthDate] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [today] = useState(() => todayKey())

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      notify('error', 'Elige una foto (JPG o PNG)')
      return
    }
    try {
      setPhoto(await compressPhoto(file))
    } catch {
      notify('error', 'No pudimos leer esa foto. Prueba con otra.')
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!photo || !birthDate) return
    setBusy(true)
    try {
      const { version, db: next } = await api.submitKyc(birthDate, photo)
      applySnapshot(version, next)
      notify('success', 'Enviado. Te avisaremos cuando lo revisemos')
      setPhoto(null)
      setBirthDate('')
    } catch (err) {
      notify('error', err instanceof ApiError ? err.message : 'No se pudo enviar')
    } finally {
      setBusy(false)
    }
  }

  if (state.status === 'VERIFIED' && user.birthDate) {
    return (
      <div className="kyc-done">
        <BadgeCheck size={22} aria-hidden />
        <div>
          <strong>Cumpleaños verificado: {formatLongDayKey(user.birthDate)}</strong>
          <p className="muted small">Ese día tendrás puntos de regalo, un giro gratis, una recompensa a elección y los regalos de los locales.</p>
        </div>
      </div>
    )
  }
  if (state.status === 'PENDING') {
    return (
      <div className="kyc-done is-pending">
        <ShieldQuestion size={22} aria-hidden />
        <div>
          <strong>En revisión</strong>
          <p className="muted small">
            Enviaste tu fecha ({formatLongDayKey(state.request.birthDate)}) el {formatDate(state.request.createdAt)}. Te avisaremos cuando la administración
            la apruebe.
          </p>
        </div>
      </div>
    )
  }

  return (
    <form className="stack" onSubmit={submit}>
      {state.status === 'REJECTED' && (
        <p className="kyc-rejected" role="alert">
          No pudimos verificarlo: {state.request.reviewNote ?? 'los datos no coinciden.'} Vuelve a enviarlo.
        </p>
      )}
      <p className="muted small">
        Para darte los beneficios de cumpleaños necesitamos confirmar tu fecha con una foto de tu carnet. Solo la ve la administración del Paseo y la
        borramos apenas la revisa.
      </p>
      <Field label="Fecha de nacimiento">
        <input
          type="date"
          required
          min={birthDateRange(today).min}
          max={birthDateRange(today).max}
          autoComplete="bday"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
        />
      </Field>
      <div className="field">
        <span className="field-label">Foto de tu carnet (lado de la fecha)</span>
        {photo ? (
          <div className="kyc-preview">
            <img src={photo} alt="Vista previa del carnet" />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPhoto(null)}>
              Cambiar foto
            </button>
          </div>
        ) : (
          <div className="row gap wrap">
            <label className="btn">
              <Camera size={17} aria-hidden /> Tomar foto
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={pick} />
            </label>
            <label className="btn btn-ghost">
              <Upload size={17} aria-hidden /> Subir foto
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={pick} />
            </label>
          </div>
        )}
      </div>
      <div className="row end">
        <button className="btn btn-primary" type="submit" disabled={!photo || !birthDate || busy}>
          {busy ? 'Enviando…' : 'Enviar para verificar'}
        </button>
      </div>
    </form>
  )
}

export function AccountPage() {
  const user = useUser()
  const { workplace } = useSession()
  const { hash } = useLocation()
  const roleLabel = workplace ? `${MEMBER_ROLE_LABELS[workplace.membership.role]} · ${workplace.business.name}` : ROLE_LABEL[user.role]

  useEffect(() => {
    if (hash === '#cumpleanos') document.getElementById('cumpleanos')?.scrollIntoView({ block: 'start' })
  }, [hash])

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
        {user.role === 'CUSTOMER' && (
          <section className="card" id="cumpleanos">
            <h2 className="card-title">
              <CakeSlice size={18} aria-hidden /> Mi cumpleaños
            </h2>
            <BirthdayVerification />
          </section>
        )}
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
