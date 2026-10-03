import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ApiError, api, type SessionPayload } from '../data/api'
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../data/demoAccounts'
import { signIn, signOut, useSession } from '../session'
import { Field, Toaster, notify } from '../components/ui'

export function LoginPage() {
  const session = useSession()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '' })
  const [busy, setBusy] = useState(false)

  if (session.user || session.loading) return <Navigate to="/" replace />

  const attempt = async (request: () => Promise<SessionPayload>, welcome?: string) => {
    setBusy(true)
    try {
      signIn(await request())
      if (welcome) notify('success', welcome)
      navigate('/')
    } catch (err) {
      notify('error', err instanceof ApiError ? err.message : 'Error inesperado')
    } finally {
      setBusy(false)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (mode === 'login') return attempt(() => api.login(email, password))
    return attempt(() => api.register({ email, password, ...form }), '¡Bienvenido a Paseo Points!')
  }

  const resetDemo = async () => {
    if (!confirm('¿Restablecer los datos de demostración? Se borran los cambios hechos en la base de datos.')) return
    setBusy(true)
    try {
      await api.resetDemo()
      signOut()
      notify('success', 'Datos de demostración restablecidos')
    } catch (err) {
      notify('error', err instanceof ApiError ? err.message : 'Error inesperado')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth-hero">
        <div className="brand brand-lg">
          <span className="brand-mark">P</span>
          <span className="brand-name">
            Paseo <b>Points</b>
          </span>
        </div>
        <h1>Cada visita a Paseo Aranjuez suma.</h1>
        <p>
          Acumula puntos en las tiendas, el Paseo de Comidas y la terraza El 4to (Bs 1 = 1 punto), sube de nivel, asiste a
          eventos, completa misiones, gana insignias y descubre nuevos lugares con tu Pasaporte.
        </p>
        <p className="small">Av. América #488 esq. Pantaleón Dalence · Cochabamba</p>
      </div>

      <div className="auth-panel">
        <div className="tabs">
          <button className={mode === 'login' ? 'tab tab-active' : 'tab'} onClick={() => setMode('login')}>
            Ingresar
          </button>
          <button className={mode === 'register' ? 'tab tab-active' : 'tab'} onClick={() => setMode('register')}>
            Crear cuenta
          </button>
        </div>

        <form className="stack" onSubmit={onSubmit}>
          <Field label="Correo electrónico">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          {mode === 'register' && (
            <div className="grid-2">
              <Field label="Nombre">
                <input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              </Field>
              <Field label="Apellido">
                <input required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </Field>
              <Field label="Teléfono (opcional)">
                <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
            </div>
          )}
          <Field label="Contraseña" hint={mode === 'register' ? 'Mínimo 6 caracteres.' : undefined}>
            <input
              type="password"
              required
              minLength={mode === 'register' ? 6 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </Field>
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {mode === 'login' ? 'Ingresar' : 'Crear cuenta'}
          </button>
        </form>

        <div className="demo-accounts">
          <span className="muted small">Cuentas de demostración (contraseña {DEMO_PASSWORD})</span>
          {DEMO_ACCOUNTS.map((a) => (
            <button key={a.email} className="demo-account" disabled={busy} onClick={() => attempt(() => api.login(a.email, DEMO_PASSWORD))}>
              <strong>{a.email}</strong>
              <span>{a.label}</span>
            </button>
          ))}
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={resetDemo}>
            Restablecer datos de demo
          </button>
        </div>
      </div>
      <Toaster />
    </div>
  )
}
