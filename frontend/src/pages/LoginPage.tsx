import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
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
    return attempt(() => api.register({ email, password, ...form }), 'Bienvenido a Paseo Points')
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
      <section className="auth-hero">
        <div className="brand brand-lg">
          <span className="brand-mark" aria-hidden>
            P
          </span>
          <span className="brand-name">
            Paseo <b>Points</b>
          </span>
        </div>

        <div className="auth-copy">
          <h1>
            Cada visita a Paseo Aranjuez <em>suma.</em>
          </h1>
          <p>Acumula puntos en tiendas, el Paseo de Comidas y la terraza El 4to. Sube de nivel y canjea recompensas.</p>
          <div className="auth-pillars">
            <div>
              <strong>Un punto</strong>
              <span>por cada boliviano</span>
            </div>
            <div>
              <strong>Cuatro niveles</strong>
              <span>de Bronce a Platinum</span>
            </div>
            <div>
              <strong>Pasaporte</strong>
              <span>un sello por cada local</span>
            </div>
          </div>
        </div>

        <p className="auth-address">Av. América #488 esq. Pantaleón Dalence, Cochabamba</p>
      </section>

      <section className="auth-panel" aria-label="Acceso">
        <h2>{mode === 'login' ? 'Bienvenido de vuelta' : 'Crea tu cuenta'}</h2>

        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'tab tab-active' : 'tab'} onClick={() => setMode('login')}>
            Ingresar
          </button>
          <button
            role="tab"
            aria-selected={mode === 'register'}
            className={mode === 'register' ? 'tab tab-active' : 'tab'}
            onClick={() => setMode('register')}
          >
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
                <input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} autoComplete="given-name" />
              </Field>
              <Field label="Apellido">
                <input required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} autoComplete="family-name" />
              </Field>
              <Field label="Teléfono (opcional)">
                <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" />
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
          <span className="field-label">
            Cuentas de demostración · contraseña <code className="no-caps">{DEMO_PASSWORD}</code>
          </span>
          {DEMO_ACCOUNTS.map((a) => (
            <button key={a.email} className="demo-account" disabled={busy} onClick={() => attempt(() => api.login(a.email, DEMO_PASSWORD))}>
              <span>
                <strong>{a.email}</strong>
                <small>{a.label}</small>
              </span>
              <ArrowUpRight size={16} aria-hidden />
            </button>
          ))}
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={resetDemo}>
            Restablecer datos de demo
          </button>
        </div>
      </section>
      <Toaster />
    </div>
  )
}
