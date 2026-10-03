import { useState, type FormEvent } from 'react'
import { Plus, Search } from 'lucide-react'
import { useDb } from '../../data/store'
import { formatInt, formatMoney, normalizeText } from '../../lib/format'
import type { CatalogItem } from '../../types/domain'
import { Badge, Card, Empty, Field, Modal, PageHeader, flash, run, vanish } from '../../components/ui'
import { confirmDialog } from '../../components/dialog'
import { LIMITS, moneyError } from '../../domain/validation'
import { catalogCategories } from '../../domain/checkout'
import { useWorkplace } from './useWorkplace'

type Draft = { id: number | null; name: string; description: string; category: string; price: string; isAvailable: boolean }
type Filter = 'all' | 'available' | 'unavailable'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'available', label: 'Disponibles' },
  { id: 'unavailable', label: 'No disponibles' },
]

const toDraft = (item?: CatalogItem): Draft => ({
  id: item?.id ?? null,
  name: item?.name ?? '',
  description: item?.description ?? '',
  category: item?.category ?? '',
  price: item ? item.price.toString() : '',
  isAvailable: item?.isAvailable ?? true,
})

const parsePrice = (s: string) => {
  const n = Number(s.trim().replace(',', '.'))
  return s.trim() === '' || !Number.isFinite(n) ? null : n
}

const PAGE = 30

export function CatalogPage() {
  const db = useDb()
  const { business } = useWorkplace()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [limit, setLimit] = useState(PAGE)
  const [addAnother, setAddAnother] = useState(false)
  const [round, setRound] = useState(0)

  const all = db.catalogItems
    .filter((i) => i.businessId === business.id && i.deletedAt === null)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const categories = catalogCategories(db, business.id)
  const q = normalizeText(query.trim())
  const items = all
    .filter((i) => !q || [i.name, i.description ?? '', i.category ?? ''].some((s) => normalizeText(s).includes(q)))
    .filter((i) => filter === 'all' || i.isAvailable === (filter === 'available'))
  const counts: Record<Filter, number> = {
    all: all.length,
    available: all.filter((i) => i.isAvailable).length,
    unavailable: all.filter((i) => !i.isAvailable).length,
  }

  const sold = (itemId: number) =>
    db.transactionItems
      .filter((l) => l.catalogItemId === itemId && db.transactions.some((t) => t.id === l.transactionId && t.status !== 'CANCELLED'))
      .reduce((s, l) => s + l.quantity, 0)

  const price = draft ? parsePrice(draft.price) : null
  const priceError =
    draft && draft.price.trim() !== '' ? (price === null ? 'Escribe un precio válido' : moneyError(price, 'El precio', { minExclusive: true })) : null

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft || price === null || priceError) return
    const ok = await run(
      'saveCatalogItem',
      {
        id: draft.id,
        data: {
          businessId: business.id,
          name: draft.name,
          description: draft.description.trim() || null,
          category: draft.category.trim() || null,
          price,
          isAvailable: draft.isAvailable,
        },
      },
      draft.id ? 'Producto actualizado' : `"${draft.name.trim()}" agregado al catálogo`,
    )
    if (!ok) return
    if (addAnother && !draft.id) {
      setDraft({ ...toDraft(), category: draft.category })
      setRound((r) => r + 1)
    } else setDraft(null)
  }

  const toggle = async (item: CatalogItem, row: HTMLElement) => {
    const saved = await run(
      'saveCatalogItem',
      { id: item.id, data: { ...item, isAvailable: !item.isAvailable } },
      item.isAvailable ? `"${item.name}" ya no aparece al registrar compras` : `"${item.name}" vuelve a estar disponible`,
    )
    if (saved !== undefined) flash(row)
  }

  const remove = async (item: CatalogItem, row: HTMLElement) => {
    const ok = await confirmDialog({
      title: `¿Eliminar "${item.name}"?`,
      message: 'Deja de mostrarse. Las compras pasadas no cambian.',
      confirmLabel: 'Eliminar',
      tone: 'danger',
    })
    if (ok) void vanish(row, () => run('softDelete', { table: 'catalogItems', id: item.id }, 'Producto eliminado'))
  }

  return (
    <div className="page">
      <PageHeader
        title="Catálogo"
        subtitle={`Productos y precios de ${business.name}`}
        actions={
          <button className="btn btn-primary" onClick={() => setDraft(toDraft())}>
            <Plus size={16} /> Agregar producto
          </button>
        }
      />
      {all.length > 0 && (
        <div className="filters-row">
          <label className="search">
            <Search size={16} aria-hidden />
            <input
              type="search"
              placeholder="Buscar producto"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setLimit(PAGE)
              }}
              aria-label="Buscar producto"
            />
          </label>
          <div className="chips">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                className={`chip ${filter === f.id ? 'chip-active' : ''}`}
                onClick={() => {
                  setFilter(f.id)
                  setLimit(PAGE)
                }}
              >
                {f.label} <span className="chip-count">{counts[f.id]}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <Card>
        {all.length === 0 ? (
          <Empty>
            Agrega tus productos con su precio.
            <button className="btn btn-primary" onClick={() => setDraft(toDraft())}>
              <Plus size={16} /> Agregar el primer producto
            </button>
          </Empty>
        ) : items.length === 0 ? (
          <Empty>Ningún producto coincide con la búsqueda.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table table-stack">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="num">Precio</th>
                  <th className="num">Vendidos</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.slice(0, limit).map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>
                      {(item.category || item.description) && (
                        <div className="muted small">{[item.category, item.description].filter(Boolean).join(' · ')}</div>
                      )}
                    </td>
                    <td className="num" data-label="Precio">
                      {formatMoney(item.price)}
                    </td>
                    <td className="num" data-label="Vendidos">
                      {formatInt(sold(item.id))}
                    </td>
                    <td data-label="Estado">{item.isAvailable ? <Badge tone="success">Disponible</Badge> : <Badge>No disponible</Badge>}</td>
                    <td>
                      <div className="row gap end">
                        <button className="btn btn-ghost btn-sm" onClick={(e) => toggle(item, e.currentTarget)}>
                          {item.isAvailable ? 'Pausar' : 'Activar'}
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setDraft(toDraft(item))}>
                          Editar
                        </button>
                        <button className="btn btn-ghost btn-sm danger" onClick={(e) => remove(item, e.currentTarget)}>
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length > limit && (
              <div className="list-more">
                <span className="muted small">
                  Mostrando {formatInt(limit)} de {formatInt(items.length)}
                </span>
                <button className="btn btn-sm" onClick={() => setLimit((n) => n + PAGE)}>
                  Mostrar más
                </button>
              </div>
            )}
          </div>
        )}
      </Card>

      {draft && (
        <Modal title={draft.id ? 'Editar producto' : 'Nuevo producto'} onClose={() => setDraft(null)}>
          <form key={round} className="stack" onSubmit={save}>
            <Field label="Nombre">
              <input required maxLength={LIMITS.name} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus />
            </Field>
            <Field label="Precio en Bs" error={priceError}>
              <input
                required
                inputMode="decimal"
                placeholder="0,00"
                maxLength={14}
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: e.target.value })}
              />
            </Field>
            <Field label="Categoría (opcional)" hint="Agrupa productos, p. ej. para descuentos de cumpleaños por categoría">
              <input
                list="catalog-categories"
                maxLength={LIMITS.catalogCategory}
                placeholder="Ej.: Poleras"
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              />
              <datalist id="catalog-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label="Descripción (opcional)">
              <textarea rows={3} maxLength={LIMITS.description} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </Field>
            <label className="check">
              <input type="checkbox" checked={draft.isAvailable} onChange={(e) => setDraft({ ...draft, isAvailable: e.target.checked })} />
              Disponible para registrar compras
            </label>
            {!draft.id && (
              <label className="check">
                <input type="checkbox" checked={addAnother} onChange={(e) => setAddAnother(e.target.checked)} />
                Al guardar, seguir agregando otro producto
              </label>
            )}
            <div className="row end gap form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setDraft(null)}>
                Cancelar
              </button>
              <button className="btn btn-primary" type="submit" disabled={price === null || !!priceError}>
                {draft.id ? 'Guardar cambios' : 'Agregar producto'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
