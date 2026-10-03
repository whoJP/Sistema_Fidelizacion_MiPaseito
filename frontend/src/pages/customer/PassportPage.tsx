import { Link } from 'react-router-dom'
import { Sparkles, Stamp } from 'lucide-react'
import { useDb } from '../../data/store'
import { businessCategoryIds, discoveredBusinessIds, passportProgress } from '../../domain/loyalty'
import { formatDate } from '../../lib/format'
import { useUser } from '../../session'
import { Card, PageHeader, Progress, Stat } from '../../components/ui'

export function PassportPage() {
  const db = useDb()
  const user = useUser()
  const discovered = discoveredBusinessIds(db, user.id)
  const businesses = db.businesses.filter((b) => b.deletedAt === null && b.status === 'ACTIVE')
  const progress = passportProgress(db, user.id)
  const exploredCategories = new Set(
    [...discovered].flatMap((id) => businessCategoryIds(db, id)),
  )
  const discoveries = db.businessDiscoveries.filter((d) => d.userId === user.id)

  return (
    <div className="page">
      <PageHeader title="Pasaporte del Paseo" subtitle="Tu primera compra en cada establecimiento lo sella en tu pasaporte y te da puntos de nivel extra." />

      <div className="stats-row">
        <Stat label="Locales descubiertos" value={`${discovered.size} de ${businesses.length}`} />
        <Stat label="Categorías exploradas" value={exploredCategories.size} />
        <Stat label="Por descubrir" value={businesses.length - [...discovered].filter((id) => businesses.some((b) => b.id === id)).length} />
      </div>

      {progress.length > 0 && (
        <Card>
          <h2>Progreso por categoría</h2>
          <ul className="list">
            {progress.map((p) => (
              <li key={p.category.id} className="mission-mini">
                <div className="row between">
                  <strong>{p.category.name}</strong>
                  <span className="small muted tabular">
                    {p.discovered} de {p.total}
                  </span>
                </div>
                <Progress value={p.discovered} max={p.total} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <h2 className="section-title">Sellos</h2>
      <div className="stamps">
        <div className="stamp stamp-on stamp-welcome">
          <span className="stamp-seal" aria-hidden>
            <Sparkles size={22} />
          </span>
          <strong>Bienvenida al Paseo</strong>
          <span className="small">{formatDate(user.createdAt)}</span>
        </div>
        {businesses.map((b) => {
          const found = discoveries.find((d) => d.businessId === b.id)
          return (
            <Link key={b.id} to={`/app/directory/${b.id}`} className={`stamp ${found ? 'stamp-on' : ''}`}>
              <span className="stamp-seal" aria-hidden>
                <Stamp size={22} />
              </span>
              <strong>{b.name}</strong>
              <span className="small">{found ? formatDate(found.discoveredAt) : 'Sin sello'}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
