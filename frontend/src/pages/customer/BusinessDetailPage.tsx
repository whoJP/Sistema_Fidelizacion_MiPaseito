import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Clock, MapPin, Megaphone, Phone } from 'lucide-react'
import { useDb } from '../../data/store'
import { businessCategoryIds, discoveredBusinessIds, promotionsForBusiness, rewardTitle, visibleRewards } from '../../domain/loyalty'
import { DAY_LABELS, DAYS_IN_ORDER, formatInt, formatMoney } from '../../lib/format'
import { useUser } from '../../session'
import { Badge, Card, CardHead, Empty, MoreLink, PageHeader } from '../../components/ui'
import { businessLocation } from './DirectoryPage'

export function BusinessDetailPage() {
  const db = useDb()
  const user = useUser()
  const { businessId } = useParams()
  const business = db.businesses.find((b) => b.id === Number(businessId) && b.deletedAt === null && b.status === 'ACTIVE')

  if (!business) {
    return (
      <div className="page">
        <Empty>Este establecimiento no está disponible.</Empty>
      </div>
    )
  }

  const schedules = db.businessSchedules.filter((s) => s.businessId === business.id)
  const catalog = db.catalogItems.filter((i) => i.businessId === business.id && i.deletedAt === null)
  const categories = businessCategoryIds(db, business.id)
    .map((id) => db.categories.find((c) => c.id === id && c.deletedAt === null))
    .filter((c) => c !== undefined)
  const promos = promotionsForBusiness(db, business.id)
  const rewards = visibleRewards(db).filter((r) => r.businessId === business.id)
  const today = DAYS_IN_ORDER[(new Date().getDay() + 6) % 7]

  return (
    <div className="page">
      <Link to="/app/directory" className="back">
        <ArrowLeft size={16} /> Directorio
      </Link>
      <PageHeader
        title={business.name}
        subtitle={
          <span className="row gap wrap">
            {categories.map((c) => (
              <span key={c.id} className="chip chip-static">
                {c.name}
              </span>
            ))}
            {discoveredBusinessIds(db, user.id).has(business.id) ? <Badge tone="success">Descubierto</Badge> : <Badge>Nuevo para ti</Badge>}
          </span>
        }
      />

      <div className="detail-grid">
        <div className="stack">
          <Card>
            <p>{business.description}</p>
            <div className="stack-sm small">
              <span className="row gap">
                <MapPin size={16} /> {businessLocation(business) || 'Ubicación por confirmar'}
              </span>
              {business.phone && (
                <span className="row gap">
                  <Phone size={16} /> {business.phone}
                </span>
              )}
            </div>
          </Card>

          {promos.length > 0 && (
            <Card>
              <CardHead icon={Megaphone} title="Promociones" />
              <ul className="list">
                {promos.map((p) => (
                  <li key={p.id} className="list-row">
                    <span>{p.name}</span>
                    <Badge tone="accent">{p.type === 'POINTS_MULTIPLIER' ? `Puntos ×${p.value}` : `+${formatInt(p.value)} puntos`}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <h2>Catálogo</h2>
            {catalog.length === 0 ? (
              <p className="muted">Este establecimiento aún no publicó su catálogo.</p>
            ) : (
              <ul className="list">
                {catalog.map((item) => (
                  <li key={item.id} className="list-row">
                    <div>
                      <strong className={item.isAvailable ? '' : 'strike'}>{item.name}</strong>
                      {item.description && <div className="muted small">{item.description}</div>}
                    </div>
                    <span className="row gap">
                      {!item.isAvailable && <Badge>No disponible</Badge>}
                      <strong>{formatMoney(item.price)}</strong>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="stack">
          <Card>
            <CardHead icon={Clock} title="Horario" />
            {schedules.length === 0 ? (
              <p className="muted small">Horario no publicado.</p>
            ) : (
              <ul className="schedule">
                {DAYS_IN_ORDER.map((day) => {
                  const s = schedules.find((x) => x.dayOfWeek === day)
                  return (
                    <li key={day} className={day === today ? 'today' : ''}>
                      <span>{DAY_LABELS[day]}</span>
                      <span>{!s ? 'Sin horario' : s.isClosed ? 'Cerrado' : `${s.openTime ?? '?'} - ${s.closeTime ?? '?'}`}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
          {rewards.length > 0 && (
            <Card>
              <h2>Recompensas aquí</h2>
              <ul className="list">
                {rewards.map((r) => (
                  <li key={r.id} className="list-row">
                    <span>{rewardTitle(db, r)}</span>
                    <strong>{formatInt(r.pointsCost)} puntos</strong>
                  </li>
                ))}
              </ul>
              <MoreLink to="/app/rewards">Ir a recompensas</MoreLink>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
