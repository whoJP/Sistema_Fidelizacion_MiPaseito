import { useState } from 'react'
import { useDb } from '../../data/store'
import { rewardConditions, rewardRedeemedCount, rewardTitle } from '../../domain/loyalty'
import { REWARD_TYPE_LABELS, formatDate, formatInt } from '../../lib/format'
import { Card, Empty, PageHeader } from '../../components/ui'
import { StatusBadge, liveBusinessOptions } from './shared'

/** Read-only: each business creates and manages its own rewards from its panel. */
export function AdminRewards() {
  const db = useDb()
  const [businessId, setBusinessId] = useState<number | null>(null)
  const rewards = db.rewards
    .filter((r) => r.deletedAt === null && (businessId === null || r.businessId === businessId))
    .sort((a, b) => a.businessId - b.businessId || a.pointsCost - b.pointsCost)

  return (
    <div className="page">
      <PageHeader
        title="Recompensas"
        subtitle="Vista de consulta. Cada establecimiento crea y administra sus propias recompensas desde su panel."
      />
      <div className="filters">
        <select value={businessId ?? ''} onChange={(e) => setBusinessId(e.target.value ? Number(e.target.value) : null)} aria-label="Filtrar por establecimiento">
          <option value="">Todos los establecimientos</option>
          {liveBusinessOptions(db).map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>
      </div>
      <Card>
        {rewards.length === 0 ? (
          <Empty>No hay recompensas para este filtro.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Establecimiento</th>
                  <th>Recompensa</th>
                  <th>Tipo</th>
                  <th className="num">Costo</th>
                  <th>Nivel mínimo</th>
                  <th className="num">Canjes</th>
                  <th>Vigencia</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {rewards.map((r) => (
                  <tr key={r.id}>
                    <td>{db.businesses.find((b) => b.id === r.businessId)?.name}</td>
                    <td>
                      <strong>{rewardTitle(db, r)}</strong>
                      {[...rewardConditions(db, r), r.description].filter(Boolean).map((c) => (
                        <div key={c} className="muted small">
                          {c}
                        </div>
                      ))}
                    </td>
                    <td className="small">{REWARD_TYPE_LABELS[r.type]}</td>
                    <td className="num">{formatInt(r.pointsCost)} puntos</td>
                    <td>{db.tiers.find((t) => t.id === r.minimumTierId)?.name ?? 'Cualquiera'}</td>
                    <td className="num">
                      {r.stock === null ? `${rewardRedeemedCount(db, r.id)}, sin límite` : `${rewardRedeemedCount(db, r.id)} de ${r.stock}`}
                    </td>
                    <td className="small">
                      {r.startsAt || r.endsAt ? `${r.startsAt ? formatDate(r.startsAt) : '…'} - ${r.endsAt ? formatDate(r.endsAt) : '…'}` : 'Sin límite'}
                    </td>
                    <td>
                      <StatusBadge status={r.status} />
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
