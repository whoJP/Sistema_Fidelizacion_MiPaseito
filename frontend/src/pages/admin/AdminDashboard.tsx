import { Link } from 'react-router-dom'
import { useDb } from '../../data/store'
import { activeTiers, statusTotal, tierForStatus } from '../../domain/loyalty'
import { formatInt, formatMoney, fullName, plural } from '../../lib/format'
import { Card, PageHeader, Progress, Stat } from '../../components/ui'

/** Every figure here is computed on the fly; analytics are never stored. */
export function AdminDashboard() {
  const db = useDb()
  const since = Date.now() - 30 * 24 * 3600_000
  const customers = db.users.filter((u) => u.role === 'CUSTOMER' && u.deletedAt === null)
  const recent = db.transactions.filter((t) => t.status === 'COMPLETED' && new Date(t.createdAt).getTime() >= since)
  const issued = db.pointMovements.filter((m) => m.amount > 0 && m.type !== 'REVERSAL').reduce((s, m) => s + m.amount, 0)
  const redeemed = -db.pointMovements.filter((m) => m.type === 'REDEMPTION').reduce((s, m) => s + m.amount, 0)
  const outstanding = db.pointMovements.reduce((s, m) => s + m.amount, 0)
  const openAlerts = db.fraudAlerts.filter((a) => a.status === 'OPEN').length
  const activeCustomers = new Set(recent.map((t) => t.customerId)).size

  const byBusiness = db.businesses
    .filter((b) => b.deletedAt === null)
    .map((b) => {
      const txs = recent.filter((t) => t.businessId === b.id)
      return { business: b, count: txs.length, amount: txs.reduce((s, t) => s + t.amount, 0) }
    })
    .filter((x) => x.count > 0)
    .sort((a, b) => b.amount - a.amount)
  const maxAmount = byBusiness[0]?.amount ?? 1

  const frequentCustomers = customers
    .map((u) => {
      const txs = recent.filter((t) => t.customerId === u.id)
      return {
        user: u,
        visits: txs.length,
        businesses: new Set(txs.map((t) => t.businessId)).size,
        amount: txs.reduce((s, t) => s + t.amount, 0),
      }
    })
    .filter((x) => x.visits > 0)
    .sort((a, b) => b.visits - a.visits || b.amount - a.amount)
    .slice(0, 5)

  const tiers = activeTiers(db)
  const distribution = tiers.map((tier) => ({
    tier,
    count: customers.filter((u) => tierForStatus(db, statusTotal(db, u.id))?.id === tier.id).length,
  }))

  return (
    <div className="page">
      <PageHeader
        title="Resumen del programa"
        subtitle="Últimos 30 días, calculado en tiempo real."
        actions={
          <Link className="btn btn-ghost" to="/admin/metrics">
            Ver métricas detalladas →
          </Link>
        }
      />
      <div className="stats-row">
        <Stat label="Ventas registradas" value={formatMoney(recent.reduce((s, t) => s + t.amount, 0))} hint={plural(recent.length, 'compra', 'compras')} />
        <Stat label="Clientes activos" value={activeCustomers} hint={`de ${customers.length} registrados`} />
        <Stat label="Puntos entregados (histórico)" value={formatInt(issued)} hint={`${formatInt(redeemed)} canjeados`} />
        <Stat label="Puntos sin usar" value={formatInt(outstanding)} hint="saldo total de los clientes" />
        <Stat
          label="Alertas de fraude abiertas"
          value={<Link to="/admin/fraud">{openAlerts}</Link>}
        />
      </div>

      <div className="detail-grid">
        <Card>
          <h2>Establecimientos con mayor actividad</h2>
          {byBusiness.length === 0 ? (
            <p className="muted">Sin compras en el período.</p>
          ) : (
            <ul className="list">
              {byBusiness.map(({ business, count, amount }) => (
                <li key={business.id} className="mission-mini">
                  <div className="row between">
                    <strong>{business.name}</strong>
                    <span className="small muted">
                      {formatMoney(amount)} · {plural(count, 'compra', 'compras')}
                    </span>
                  </div>
                  <Progress value={amount} max={maxAmount} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2>Clientes frecuentes</h2>
          {frequentCustomers.length === 0 ? (
            <p className="muted">Sin compras en el período.</p>
          ) : (
            <ol className="list">
              {frequentCustomers.map(({ user, visits, businesses, amount }) => {
                const tier = tierForStatus(db, statusTotal(db, user.id))
                return (
                  <li key={user.id} className="list-row">
                    <div>
                      <strong>{fullName(user)}</strong>
                      <div className="muted small">
                        {plural(visits, 'compra', 'compras')} en {plural(businesses, 'establecimiento', 'establecimientos')} ·{' '}
                        {formatMoney(amount)}
                      </div>
                    </div>
                    {tier && <span className={`tier-chip tier-${tier.name.toLowerCase()}`}>{tier.name}</span>}
                  </li>
                )
              })}
            </ol>
          )}
        </Card>
        <Card>
          <h2>Clientes por nivel</h2>
          {tiers.length === 0 ? (
            <p className="muted">
              No hay niveles configurados. <Link to="/admin/tiers">Crear niveles</Link>
            </p>
          ) : (
            <ul className="list">
              {distribution.map(({ tier, count }) => (
                <li key={tier.id} className="mission-mini">
                  <div className="row between">
                    <span className={`tier-chip tier-${tier.name.toLowerCase()}`}>{tier.name}</span>
                    <span className="small muted">{count} clientes</span>
                  </div>
                  <Progress value={count} max={Math.max(1, customers.length)} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
