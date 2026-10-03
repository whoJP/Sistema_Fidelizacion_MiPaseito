import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Megaphone, Search, Stamp } from 'lucide-react'
import { useDb } from '../../data/store'
import {
  businessCategoryClosure,
  businessCategoryIds,
  discoveredBusinessIds,
  promotionsForBusiness,
  rootCategories,
} from '../../domain/loyalty'
import { useUser } from '../../session'
import { Badge, Card, Empty, PageHeader } from '../../components/ui'
import { floorLabel } from '../../lib/format'
import type { Business } from '../../types/domain'

export function businessLocation(b: Business) {
  return [b.floor && floorLabel(b.floor), b.sector, b.localNumber && `Local ${b.localNumber}`].filter(Boolean).join(', ')
}

export function DirectoryPage() {
  const db = useDb()
  const user = useUser()
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const discovered = discoveredBusinessIds(db, user.id)
  const roots = rootCategories(db).filter((c) => c.status === 'ACTIVE')

  const businesses = useMemo(() => {
    const q = query.trim().toLowerCase()
    return db.businesses
      .filter((b) => b.deletedAt === null && b.status === 'ACTIVE')
      .filter((b) => !categoryId || businessCategoryClosure(db, b.id).has(categoryId))
      .filter((b) => !q || b.name.toLowerCase().includes(q) || b.description.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [db, query, categoryId])

  return (
    <div className="page">
      <PageHeader title="Directorio" subtitle="Todos los establecimientos del Paseo." />

      <div className="filters">
        <label className="search">
          <Search size={16} />
          <input placeholder="Buscar establecimiento" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="chips">
          <button className={`chip ${categoryId === null ? 'chip-active' : ''}`} onClick={() => setCategoryId(null)}>
            Todos
          </button>
          {roots.map((c) => (
            <button key={c.id} className={`chip ${categoryId === c.id ? 'chip-active' : ''}`} onClick={() => setCategoryId(c.id)}>
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {businesses.length === 0 ? (
        <Empty>No hay establecimientos que coincidan.</Empty>
      ) : (
        <div className="cards-grid">
          {businesses.map((b) => {
            const cats = businessCategoryIds(db, b.id)
              .map((id) => db.categories.find((c) => c.id === id && c.deletedAt === null)?.name)
              .filter(Boolean)
            const promos = promotionsForBusiness(db, b.id)
            return (
              <Link key={b.id} to={`/app/directory/${b.id}`} className="card business-card">
                <div className="row between">
                  <span className="logo">{b.logoUrl ? <img src={b.logoUrl} alt="" /> : b.name[0]}</span>
                  {discovered.has(b.id) ? (
                    <Badge tone="success">
                      <Stamp size={12} /> Descubierto
                    </Badge>
                  ) : (
                    <Badge>Nuevo para ti</Badge>
                  )}
                </div>
                <h3>{b.name}</h3>
                <p className="muted small clamp">{b.description}</p>
                <div className="small muted row gap">
                  <MapPin size={14} /> {businessLocation(b) || 'Ubicación por confirmar'}
                </div>
                <div className="chips">
                  {cats.map((name) => (
                    <span key={name} className="chip chip-static">
                      {name}
                    </span>
                  ))}
                  {promos.length > 0 && (
                    <Badge tone="accent">
                      <Megaphone size={12} aria-hidden /> Promoción
                    </Badge>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
      <Card className="hint-card">
        <p className="small muted">Las categorías y establecimientos los configura la administración del Paseo.</p>
      </Card>
    </div>
  )
}
