import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, MapPin, Megaphone, Search, Sparkles, Stamp } from 'lucide-react'
import { useDb } from '../../data/store'
import {
  businessCategoryClosure,
  businessCategoryIds,
  discoveredBusinessIds,
  promotionsForBusiness,
  rootCategories,
} from '../../domain/loyalty'
import { useUser } from '../../session'
import { Badge, Empty, PageHeader } from '../../components/ui'
import { businessLocation } from '../../lib/format'

export function DirectoryPage() {
  const db = useDb()
  const user = useUser()
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const discovered = discoveredBusinessIds(db, user.id)
  const roots = rootCategories(db).filter((c) => c.status === 'ACTIVE')

  const q = query.trim().toLowerCase()
  const businesses = db.businesses
    .filter((b) => b.deletedAt === null && b.status === 'ACTIVE')
    .filter((b) => !categoryId || businessCategoryClosure(db, b.id).has(categoryId))
    .filter((b) => !q || b.name.toLowerCase().includes(q) || b.description.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="page">
      <PageHeader title="Locales" />

      <div className="filters">
        <label className="search">
          <Search size={16} />
          <input placeholder="Buscar" aria-label="Buscar establecimiento" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="chips chips-scroll">
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
        <Empty>Sin resultados</Empty>
      ) : (
        <div className="cards-grid business-grid">
          {businesses.map((b) => {
            const cats = businessCategoryIds(db, b.id)
              .map((id) => db.categories.find((c) => c.id === id && c.deletedAt === null)?.name)
              .filter(Boolean)
            const promos = promotionsForBusiness(db, b.id)
            const found = discovered.has(b.id)
            return (
              <Link key={b.id} to={`/app/directory/${b.id}`} className="card business-card">
                <span className="logo">{b.logoUrl ? <img src={b.logoUrl} alt="" /> : b.name[0]}</span>
                <span className="business-main">
                  <h3>{b.name}</h3>
                  <span className="business-meta">
                    <MapPin size={13} aria-hidden /> {businessLocation(b) || cats[0] || 'Paseo Aranjuez'}
                  </span>
                  <span className="business-tags">
                    {found ? (
                      <Badge tone="success">
                        <Stamp size={11} aria-hidden /> Sellado
                      </Badge>
                    ) : (
                      <Badge>
                        <Sparkles size={11} aria-hidden /> Nuevo
                      </Badge>
                    )}
                    {promos.length > 0 && (
                      <Badge tone="accent">
                        <Megaphone size={11} aria-hidden /> Promo
                      </Badge>
                    )}
                  </span>
                </span>
                <ChevronRight className="business-go" size={18} aria-hidden />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
