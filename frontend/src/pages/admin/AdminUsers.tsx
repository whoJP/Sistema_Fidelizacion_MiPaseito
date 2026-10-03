import { useState, type FormEvent } from 'react'
import { Search } from 'lucide-react'
import { useDb } from '../../data/store'
import { consumptionProfile, kycState, pointsExpiry, visitCard } from '../../domain/engagement'
import { pointsBalance, statusTotal, tierForStatus } from '../../domain/loyalty'
import { MEMBER_ROLE_LABELS, formatDateKey, formatInt, formatLongDayKey, formatMoney, fullName, plural } from '../../lib/format'
import { useUser } from '../../session'
import type { User } from '../../types/domain'
import { Badge, Card, Field, Modal, PageHeader, Progress, Stat, flash, run } from '../../components/ui'
import { confirmDialog } from '../../components/dialog'
import { LIMITS, MAX_POINTS, intError } from '../../domain/validation'
import { StatusBadge } from './shared'

type Filter = 'all' | 'customers' | 'staff' | 'admins'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'customers', label: 'Clientes' },
  { id: 'staff', label: 'Personal de tiendas' },
  { id: 'admins', label: 'Administradores' },
]

const ROLE_FILTER: Record<Exclude<Filter, 'all'>, User['role']> = {
  customers: 'CUSTOMER',
  staff: 'MERCHANT',
  admins: 'ADMIN',
}

const WEEKDAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados', 'domingos']
const KYC_LABEL = { VERIFIED: 'Verificado', PENDING: 'En revisión', REJECTED: 'Rechazado', NONE: 'Sin enviar' } as const

function CustomerProfile({ user }: { user: User }) {
  const db = useDb()
  const profile = consumptionProfile(db, user.id)
  const card = visitCard(db, user.id)
  const expiry = pointsExpiry(db, user)
  const kyc = kycState(db, user.id)
  const spaces = new Set(db.spaceCheckIns.filter((c) => c.userId === user.id).map((c) => c.spaceId)).size
  const habits = [
    profile.usualWeekday !== null && `suele venir los ${WEEKDAYS[profile.usualWeekday]}`,
    profile.usualMoment && `por la ${profile.usualMoment}`,
  ].filter(Boolean)

  return (
    <div className="stack">
      <div className="stats-row">
        <Stat label="Compras (90 días)" value={formatInt(profile.purchases)} />
        <Stat label="Gastado" value={formatMoney(profile.total)} />
        <Stat label="Ticket promedio" value={formatMoney(profile.averageTicket)} />
        <Stat
          label="Última compra"
          value={profile.daysSinceLastPurchase === null ? 'Nunca' : profile.daysSinceLastPurchase === 0 ? 'Hoy' : `Hace ${formatInt(profile.daysSinceLastPurchase)} días`}
        />
      </div>
      {habits.length > 0 && <p className="small">Hábito: {habits.join(', ')}.</p>}

      <div className="grid-2">
        <section>
          <h3>Categorías</h3>
          {profile.categories.length === 0 ? (
            <p className="muted small">Sin compras en los últimos 90 días.</p>
          ) : (
            <ul className="list profile-shares">
              {profile.categories.slice(0, 5).map((c) => (
                <li key={c.category.id}>
                  <div className="row between small">
                    <span>{c.category.name}</span>
                    <span className="tabular muted">{Math.round(c.share * 100)}%</span>
                  </div>
                  <Progress value={c.share} max={1} />
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h3>Locales favoritos</h3>
          {profile.businesses.length === 0 ? (
            <p className="muted small">Sin compras en los últimos 90 días.</p>
          ) : (
            <ul className="list">
              {profile.businesses.slice(0, 5).map((b) => (
                <li key={b.business.id} className="list-row small">
                  <span>{b.business.name}</span>
                  <span className="tabular muted">
                    {plural(b.purchases, 'compra', 'compras')} · {formatMoney(b.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <dl className="profile-facts small">
        <div>
          <dt>Tarjeta de visitas</dt>
          <dd>
            {card.stamps} de {card.size} sellos · {plural(card.completedCards, 'tarjeta completa', 'tarjetas completas')}
          </dd>
        </div>
        <div>
          <dt>Espacios visitados</dt>
          <dd>{formatInt(spaces)}</dd>
        </div>
        <div>
          <dt>Cumpleaños</dt>
          <dd>
            {KYC_LABEL[kyc.status]}
            {user.birthDate && ` · ${formatLongDayKey(user.birthDate)}`}
          </dd>
        </div>
        <div>
          <dt>Puntos vencen</dt>
          <dd>{expiry.balance > 0 ? formatDateKey(expiry.expiresOn) : '-'}</dd>
        </div>
      </dl>
    </div>
  )
}

export function AdminUsers() {
  const db = useDb()
  const admin = useUser()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [adjusting, setAdjusting] = useState<User | null>(null)
  const [profiling, setProfiling] = useState<User | null>(null)
  const [balance, setBalance] = useState<'POINTS' | 'STATUS'>('POINTS')
  const [amount, setAmount] = useState('')

  const worksAt = (userId: number) => db.businessMembers.filter((m) => m.userId === userId && m.status === 'ACTIVE')
  const q = query.trim().toLowerCase()
  const users = db.users
    .filter((u) => u.deletedAt === null)
    .filter((u) => !q || u.email.toLowerCase().includes(q) || fullName(u).toLowerCase().includes(q))
    .filter((u) => filter === 'all' || u.role === ROLE_FILTER[filter])

  const current = adjusting ? (balance === 'POINTS' ? pointsBalance(db, adjusting.id) : statusTotal(db, adjusting.id)) : 0
  const amountValue = Number(amount)
  const amountProblem = !amount.trim()
    ? null
    : amountValue === 0
      ? 'El ajuste no puede ser 0'
      : (intError(amountValue, 'El ajuste', -MAX_POINTS, MAX_POINTS) ??
        (current + amountValue < 0 ? `No puede quedar en negativo: tiene ${formatInt(current)}` : null))

  const submitAdjust = async (e: FormEvent) => {
    e.preventDefault()
    if (!adjusting || amountProblem || !amount.trim()) return
    const ok = await run('adjustBalance', { userId: adjusting.id, ledger: balance, amount: amountValue }, 'Ajuste registrado')
    if (ok) {
      setAdjusting(null)
      setAmount('')
    }
  }

  const toggleStatus = async (u: User, row: HTMLElement) => {
    if (u.status === 'ACTIVE') {
      const ok = await confirmDialog({
        title: `¿Suspender a ${fullName(u)}?`,
        message:
          'Mientras esté suspendido no podrá sumar puntos, canjear recompensas ni registrar compras en tiendas. ' +
          'Sus puntos e historial se conservan y puedes reactivarlo cuando quieras.',
        confirmLabel: 'Suspender',
        tone: 'danger',
      })
      if (!ok) return
    }
    const done = await run(
      'setUserStatus',
      { userId: u.id, status: u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' },
      u.status === 'ACTIVE' ? 'Usuario suspendido' : 'Usuario reactivado',
    )
    if (done !== undefined) flash(row)
  }

  return (
    <div className="page">
      <PageHeader
        title="Usuarios"
        subtitle="Clientes, personal de tiendas y administradores. Las cuentas de personal se crean desde Establecimientos."
      />
      <div className="filters-row">
        <label className="search">
          <Search size={16} />
          <input placeholder="Buscar por nombre o correo" maxLength={LIMITS.email} value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="chips">
          {FILTERS.map((f) => (
            <button key={f.id} className={`chip ${filter === f.id ? 'chip-active' : ''}`} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <Card>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Tipo</th>
                <th>Trabaja en</th>
                <th className="num">Puntos</th>
                <th className="num">Puntos de nivel</th>
                <th>Nivel</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const status = statusTotal(db, u.id)
                const tier = tierForStatus(db, status)
                return (
                  <tr key={u.id}>
                    <td>
                      <strong>{fullName(u)}</strong>
                      <div className="muted small">{u.email}</div>
                    </td>
                    <td>
                      {u.role === 'ADMIN' ? <Badge tone="accent">Administrador</Badge> : u.role === 'MERCHANT' ? <Badge tone="neutral">Personal</Badge> : 'Cliente'}
                    </td>
                    <td className="small">
                      {worksAt(u.id)
                        .map((m) => `${db.businesses.find((b) => b.id === m.businessId)?.name} (${MEMBER_ROLE_LABELS[m.role]})`)
                        .join(', ') || '-'}
                    </td>
                    <td className="num">{u.role === 'CUSTOMER' ? formatInt(pointsBalance(db, u.id)) : '-'}</td>
                    <td className="num">{u.role === 'CUSTOMER' ? formatInt(status) : '-'}</td>
                    <td>{u.role === 'CUSTOMER' && tier ? <span className={`tier-chip tier-${tier.name.toLowerCase()}`}>{tier.name}</span> : '-'}</td>
                    <td>
                      <StatusBadge status={u.status} />
                    </td>
                    <td className="row end gap">
                      {u.role === 'CUSTOMER' && (
                        <>
                          <button className="btn btn-ghost btn-sm" onClick={() => setProfiling(u)}>
                            Perfil
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setAdjusting(u)}>
                            Ajustar puntos
                          </button>
                        </>
                      )}
                      {u.id !== admin.id && (
                        <button className={`btn btn-ghost btn-sm ${u.status === 'ACTIVE' ? 'danger' : ''}`} onClick={(e) => toggleStatus(u, e.currentTarget)}>
                          {u.status === 'ACTIVE' ? 'Suspender' : 'Reactivar'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {profiling && (
        <Modal title={`Perfil de consumo · ${fullName(profiling)}`} onClose={() => setProfiling(null)} wide>
          <CustomerProfile user={profiling} />
        </Modal>
      )}

      {adjusting && (
        <Modal title={`Ajustar puntos · ${fullName(adjusting)}`} onClose={() => setAdjusting(null)}>
          <form className="stack" onSubmit={submitAdjust}>
            <p className="muted small">
              Úsalo para corregir errores o compensar a un cliente. Queda registrado en su historial y en Auditoría.
            </p>
            <div className="grid-2">
              <Field label="Qué ajustar">
                <select value={balance} onChange={(e) => setBalance(e.target.value as 'POINTS' | 'STATUS')}>
                  <option value="POINTS">Puntos (para canjear)</option>
                  <option value="STATUS">Puntos de nivel</option>
                </select>
              </Field>
              <Field label="Cantidad" hint="Positiva para sumar, negativa para restar (ej. -50)." error={amountProblem}>
                <input
                  type="number"
                  step={1}
                  min={-Math.min(current, MAX_POINTS)}
                  max={MAX_POINTS}
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </Field>
            </div>
            <div className="row end gap">
              <button type="button" className="btn btn-ghost" onClick={() => setAdjusting(null)}>
                Cancelar
              </button>
              <button className="btn btn-primary" type="submit" disabled={!amount.trim() || !!amountProblem}>
                Registrar ajuste
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
