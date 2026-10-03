import { useState, type FormEvent } from 'react'
import { Search } from 'lucide-react'
import { useDb } from '../../data/store'
import { pointsBalance, statusTotal, tierForStatus } from '../../domain/loyalty'
import { MEMBER_ROLE_LABELS, formatInt, fullName } from '../../lib/format'
import { useUser } from '../../session'
import type { User } from '../../types/domain'
import { Badge, Card, Field, Modal, PageHeader, run } from '../../components/ui'
import { StatusBadge } from './shared'

type Filter = 'all' | 'customers' | 'staff' | 'admins'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'customers', label: 'Solo clientes' },
  { id: 'staff', label: 'Trabajan en tiendas' },
  { id: 'admins', label: 'Administradores' },
]

export function AdminUsers() {
  const db = useDb()
  const admin = useUser()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [adjusting, setAdjusting] = useState<User | null>(null)
  const [balance, setBalance] = useState<'POINTS' | 'STATUS'>('POINTS')
  const [amount, setAmount] = useState('')

  const worksAt = (userId: number) => db.businessMembers.filter((m) => m.userId === userId && m.status === 'ACTIVE')
  const q = query.trim().toLowerCase()
  const users = db.users
    .filter((u) => u.deletedAt === null)
    .filter((u) => !q || u.email.toLowerCase().includes(q) || fullName(u).toLowerCase().includes(q))
    .filter((u) => {
      if (filter === 'admins') return u.role === 'ADMIN'
      if (filter === 'staff') return worksAt(u.id).length > 0
      if (filter === 'customers') return u.role === 'CUSTOMER' && worksAt(u.id).length === 0
      return true
    })

  const submitAdjust = async (e: FormEvent) => {
    e.preventDefault()
    if (!adjusting) return
    const ok = await run('adjustBalance', { userId: adjusting.id, ledger: balance, amount: Math.trunc(Number(amount)) }, 'Ajuste registrado')
    if (ok) {
      setAdjusting(null)
      setAmount('')
    }
  }

  const toggleStatus = (u: User) => {
    if (u.status === 'ACTIVE') {
      const ok = confirm(
        `¿Suspender a ${fullName(u)}?\n\n` +
          'Mientras esté suspendido no podrá sumar puntos, canjear recompensas ni registrar compras en tiendas. ' +
          'Sus puntos e historial se conservan y puedes reactivarlo cuando quieras.',
      )
      if (!ok) return
    }
    void run(
      'setUserStatus',
      { userId: u.id, status: u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' },
      u.status === 'ACTIVE' ? 'Usuario suspendido' : 'Usuario reactivado',
    )
  }

  return (
    <div className="page">
      <PageHeader
        title="Usuarios"
        subtitle="Toda cuenta es de cliente. Si además atiende en una tienda, aparece en «Trabaja en» con su cargo."
      />
      <div className="filters-row">
        <label className="search">
          <Search size={16} />
          <input placeholder="Buscar por nombre o correo" value={query} onChange={(e) => setQuery(e.target.value)} />
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
                    <td>{u.role === 'ADMIN' ? <Badge tone="accent">Administrador</Badge> : 'Cliente'}</td>
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
                        <button className="btn btn-ghost btn-sm" onClick={() => setAdjusting(u)}>
                          Ajustar puntos
                        </button>
                      )}
                      {u.id !== admin.id && (
                        <button className={`btn btn-ghost btn-sm ${u.status === 'ACTIVE' ? 'danger' : ''}`} onClick={() => toggleStatus(u)}>
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
              <Field label="Cantidad" hint="Positiva para sumar, negativa para restar (ej. -50).">
                <input type="number" step={1} required value={amount} onChange={(e) => setAmount(e.target.value)} />
              </Field>
            </div>
            <div className="row end gap">
              <button type="button" className="btn btn-ghost" onClick={() => setAdjusting(null)}>
                Cancelar
              </button>
              <button className="btn btn-primary" type="submit">
                Registrar ajuste
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
