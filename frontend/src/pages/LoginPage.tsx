import { useState, type CSSProperties, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Coffee, Glasses, Shirt, ShoppingBag, UtensilsCrossed, type LucideIcon } from 'lucide-react'
import { ApiError, api, type SessionPayload } from '../data/api'
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../data/demoAccounts'
import { signIn, signOut, useSession } from '../session'
import { Field, Toaster, notify } from '../components/ui'
import { LIMITS, emailError, passwordError, personNameError, phoneError } from '../domain/validation'
import { BrandMark, ClubGem } from '../components/BrandMark'
import { DialogHost, confirmDialog } from '../components/dialog'

const TIER_LADDER = ['Bronce', 'Plata', 'Oro', 'Platinum'] as const

const PASSPORT_PREVIEW: { icon: LucideIcon; sealed: boolean }[] = [
  { icon: Coffee, sealed: true },
  { icon: Shirt, sealed: true },
  { icon: UtensilsCrossed, sealed: false },
  { icon: Glasses, sealed: false },
]

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
    if (busy) return
    if (mode === 'login') return attempt(() => api.login(email, password))
    const problem =
      emailError(email) ??
      personNameError(form.firstName, 'El nombre') ??
      personNameError(form.lastName, 'El apellido') ??
      phoneError(form.phone) ??
      passwordError(password)
    if (problem) return notify('error', problem)
    return attempt(() => api.register({ email, password, ...form }), 'Bienvenido a Paseo Club')
  }

  const resetDemo = async () => {
    const ok = await confirmDialog({
      title: '¿Restablecer los datos de demostración?',
      message: 'Se borran todos los cambios hechos en la base de datos.',
      confirmLabel: 'Restablecer',
      tone: 'danger',
    })
    if (!ok) return
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
          <BrandMark size={52} />
          <span className="brand-text">
            <span className="brand-name">
              Paseo <b>Club</b>
            </span>
            <span className="brand-context">Paseo Aranjuez</span>
          </span>
        </div>

        <div className="auth-copy">
          <h1>
            Cada visita a Paseo Aranjuez <em>suma.</em>
          </h1>
          <p>Tus compras en el Paseo se convierten en puntos, premios y beneficios que crecen contigo.</p>

          <div className="auth-showcase">
            <article className="auth-tile">
              <span className="auth-tile-icon" aria-hidden>
                <ShoppingBag size={20} />
              </span>
              <h3>Compra y suma</h3>
              <p>Muestra tu QR al pagar y cada compra se convierte en puntos para canjear.</p>
              <div className="auth-earn" aria-label="Ejemplo: una compra de 120 bolivianos suma 120 puntos">
                <span>Compras Bs 120</span>
                <ArrowRight size={14} aria-hidden />
                <span className="auth-earn-pts">+120 puntos</span>
              </div>
            </article>

            <article className="auth-tile">
              <div className="auth-stamps" aria-hidden>
                {PASSPORT_PREVIEW.map(({ icon: Icon, sealed }, i) => (
                  <span key={i} className={sealed ? 'auth-stamp auth-stamp-on' : 'auth-stamp'}>
                    <Icon size={16} />
                  </span>
                ))}
              </div>
              <h3>Pasaporte del Paseo</h3>
              <p>Tu ruta por el Paseo. La primera compra en cada local nuevo lo sella y te acerca al siguiente nivel.</p>
            </article>

            <article className="auth-tile auth-tile-wide">
              <div className="auth-tile-head">
                <h3>Sube de nivel</h3>
                <p>Mientras más compras, más alto llegas y más puntos ganas en cada compra.</p>
              </div>
              <ol className="tier-ladder">
                {TIER_LADDER.map((tier, i) => (
                  <li key={tier} className={`tier-step tier-step-${tier.toLowerCase()}`}>
                    <span className="tier-gem" style={{ '--step': i } as CSSProperties}>
                      <ClubGem size={18 + i * 5} />
                    </span>
                    <span className="tier-step-name">{tier}</span>
                  </li>
                ))}
              </ol>
            </article>
          </div>
        </div>

        <p className="auth-address">Av. América #488 esq. Pantaleón Dalence, Cochabamba</p>
      </section>

      <section className="auth-panel" aria-label="Acceso">
        <div className="auth-panel-brand">
          <BrandMark size={44} />
          <span className="brand-text">
            <span className="brand-name">
              Paseo <b>Club</b>
            </span>
            <span className="brand-context">Cada visita a Paseo Aranjuez suma</span>
          </span>
        </div>
        <h2>{mode === 'login' ? 'Bienvenido de vuelta' : 'Únete a Paseo Club'}</h2>
        <p className="auth-panel-lead muted">
          {mode === 'login' ? 'Ingresa con tu correo para ver tus puntos y premios.' : 'Crea tu cuenta gratis y empieza a sumar puntos desde tu primera compra.'}
        </p>

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
            <input
              type="email"
              required
              maxLength={LIMITS.email}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="tucorreo@ejemplo.com"
            />
          </Field>
          {mode === 'register' && (
            <div className="grid-2">
              <Field label="Nombre">
                <input required maxLength={LIMITS.personName} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} autoComplete="given-name" />
              </Field>
              <Field label="Apellido">
                <input required maxLength={LIMITS.personName} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} autoComplete="family-name" />
              </Field>
              <Field label="Teléfono (opcional)" error={phoneError(form.phone)}>
                <input
                  type="tel"
                  inputMode="tel"
                  maxLength={LIMITS.phone}
                  placeholder="+591 7xx xxxxx"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  autoComplete="tel"
                />
              </Field>
            </div>
          )}
          <Field label="Contraseña" hint={mode === 'register' ? `Mínimo ${LIMITS.passwordMin} caracteres, con letras y números.` : undefined}>
            <input
              type="password"
              required
              minLength={mode === 'register' ? LIMITS.passwordMin : undefined}
              maxLength={LIMITS.passwordMax}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </Field>
          <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={busy}>
            {busy ? 'Un momento…' : mode === 'login' ? 'Ingresar' : 'Unirme al club'}
          </button>
          <p className="auth-switch muted small">
            {mode === 'login' ? '¿Aún no tienes cuenta? ' : '¿Ya tienes cuenta? '}
            <button type="button" className="link-btn" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
              {mode === 'login' ? 'Créala gratis' : 'Ingresa'}
            </button>
          </p>
        </form>

        <div className="demo-accounts">
          <span className="field-label">
            Entrar con una cuenta de prueba · contraseña <code className="no-caps">{DEMO_PASSWORD}</code>
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
      <DialogHost />
    </div>
  )
}
