import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { useDb } from '../../data/store'
import { rewardTitle } from '../../domain/loyalty'
import { formatDateTime, formatInt, formatMoney, fullName, normalizeText, plural } from '../../lib/format'
import { Card, Empty, PageHeader, Stat } from '../../components/ui'

/** Log of canjes that a business refused at the counter, with the reason only the admin sees. */
export function AdminRedemptionCancellations() {
  const db = useDb()
  const [query, setQuery] = useState('')
  const [businessId, setBusinessId] = useState<number | null>(null)

  const rows = db.redemptions
    .filter((r) => r.status === 'CANCELLED' && r.cancelledById !== null)
    .sort((a, b) => (b.cancelledAt ?? '').localeCompare(a.cancelledAt ?? ''))
    .map((r) => {
      const reward = db.rewards.find((x) => x.id === r.rewardId)
      return {
        r,
        reward,
        business: db.businesses.find((b) => b.id === reward?.businessId),
        customer: db.users.find((u) => u.id === r.userId),
        staff: db.users.find((u) => u.id === r.cancelledById),
      }
    })
  const businesses = [...new Map(rows.flatMap((x) => (x.business ? [[x.business.id, x.business] as const] : []))).values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'es'),
  )
  const q = normalizeText(query.trim())
  const shown = rows.filter(
    (x) =>
      (businessId === null || x.business?.id === businessId) &&
      (!q ||
        [x.customer && fullName(x.customer), x.customer?.email, x.staff && fullName(x.staff), x.r.cancelReason, x.reward && rewardTitle(db, x.reward)].some(
          (s) => s && normalizeText(s).includes(q),
        )),
  )
  const refunded = shown.reduce((s, x) => s + x.r.pointsSpent, 0)
  const byBusiness = businesses
    .map((b) => ({ b, count: rows.filter((x) => x.business?.id === b.id).length }))
    .sort((a, b) => b.count - a.count)[0]

  return (
    <div className="page">
      <PageHeader title="Canjes cancelados" subtitle="Canjes que un local decidió no entregar · el motivo solo lo ves tú" />
      <div className="stats-row">
        <Stat label="Canjes cancelados" value={formatInt(shown.length)} />
        <Stat label="Puntos devueltos" value={formatInt(refunded)} />
        <Stat label="Local con más cancelaciones" value={byBusiness ? byBusiness.b.name : '—'} hint={byBusiness && plural(byBusiness.count, 'canje', 'canjes')} />
      </div>

      <Card>
        <div className="filters-row">
          <label className="search">
            <Search size={16} aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por cliente, personal, recompensa o motivo"
              aria-label="Buscar canjes cancelados"
            />
            {query && (
              <button type="button" className="search-clear" onClick={() => setQuery('')} aria-label="Borrar búsqueda">
                <X size={15} />
              </button>
            )}
          </label>
          <select value={businessId ?? ''} onChange={(e) => setBusinessId(e.target.value ? Number(e.target.value) : null)} aria-label="Establecimiento">
            <option value="">Todos los locales</option>
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {rows.length === 0 ? (
          <Empty>Ningún local canceló canjes todavía.</Empty>
        ) : shown.length === 0 ? (
          <Empty>Ningún canje cancelado coincide con los filtros.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table table-stack">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Local</th>
                  <th>Cliente</th>
                  <th>Recompensa</th>
                  <th className="num">Devuelto</th>
                  <th>Canceló</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(({ r, reward, business, customer, staff }) => (
                  <tr key={r.id}>
                    <td data-label="Fecha">
                      {r.cancelledAt ? formatDateTime(r.cancelledAt) : '—'}
                      <div className="muted small">Canjeado el {formatDateTime(r.createdAt)}</div>
                    </td>
                    <td data-label="Local">{business?.name ?? '—'}</td>
                    <td data-label="Cliente">
                      <strong>{customer ? fullName(customer) : 'Cliente'}</strong>
                      {customer?.email && <div className="muted small">{customer.email}</div>}
                    </td>
                    <td className="small" data-label="Recompensa">
                      {reward ? rewardTitle(db, reward) : 'Recompensa'}
                      {reward?.minimumPurchase ? <div className="muted">Compra mínima {formatMoney(reward.minimumPurchase)}</div> : null}
                    </td>
                    <td className="num" data-label="Devuelto">
                      {r.pointsSpent > 0 ? `${formatInt(r.pointsSpent)} pts` : 'Regalo'}
                    </td>
                    <td data-label="Canceló">{staff ? fullName(staff) : '—'}</td>
                    <td className="small" data-label="Motivo">
                      {r.cancelReason ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
