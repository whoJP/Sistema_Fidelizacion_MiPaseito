import { useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { useDb } from '../../data/store'
import { formatMoney } from '../../lib/format'
import type { CatalogItem } from '../../types/domain'
import { Badge, Card, Empty, Field, Modal, PageHeader, run } from '../../components/ui'
import { useWorkplace } from './useWorkplace'

type Draft = { id: number | null; name: string; description: string; price: string; isAvailable: boolean }

const toDraft = (item?: CatalogItem): Draft => ({
  id: item?.id ?? null,
  name: item?.name ?? '',
  description: item?.description ?? '',
  price: item?.price?.toString() ?? '',
  isAvailable: item?.isAvailable ?? true,
})

export function CatalogPage() {
  const db = useDb()
  const { business } = useWorkplace()
  const [draft, setDraft] = useState<Draft | null>(null)
  const items = db.catalogItems.filter((i) => i.businessId === business.id && i.deletedAt === null)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft) return
    const price = draft.price.trim() === '' ? null : Number(draft.price.replace(',', '.'))
    if (price !== null && Number.isNaN(price)) return
    const ok = await run(
      'saveCatalogItem',
      {
        id: draft.id,
        data: {
          businessId: business.id,
          name: draft.name,
          description: draft.description.trim() || null,
          price,
          isAvailable: draft.isAvailable,
        },
      },
      'Catálogo actualizado',
    )
    if (ok) setDraft(null)
  }

  return (
    <div className="page">
      <PageHeader
        title="Catálogo"
        subtitle={`${business.name} · informativo, sin inventario ni pedidos`}
        actions={
          <button className="btn btn-primary" onClick={() => setDraft(toDraft())}>
            <Plus size={16} /> Agregar
          </button>
        }
      />
      <Card>
        {items.length === 0 ? (
          <Empty>Agrega productos, servicios, platos o bebidas para mostrarlos en el directorio.</Empty>
        ) : (
          <ul className="list">
            {items.map((item) => (
              <li key={item.id} className="list-row">
                <div>
                  <strong>{item.name}</strong>
                  {item.description && <div className="muted small">{item.description}</div>}
                </div>
                <div className="row gap">
                  {!item.isAvailable && <Badge>No disponible</Badge>}
                  <span>{item.price !== null ? formatMoney(item.price) : '—'}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => setDraft(toDraft(item))}>
                    Editar
                  </button>
                  <button
                    className="btn btn-ghost btn-sm danger"
                    onClick={() => confirm(`¿Eliminar "${item.name}"?`) && run('softDelete', { table: 'catalogItems', id: item.id }, 'Eliminado')}
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {draft && (
        <Modal title={draft.id ? 'Editar ítem' : 'Nuevo ítem'} onClose={() => setDraft(null)}>
          <form className="stack" onSubmit={save}>
            <Field label="Nombre">
              <input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field label="Descripción (opcional)">
              <textarea rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </Field>
            <Field label="Precio en Bs (opcional)">
              <input inputMode="decimal" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} />
            </Field>
            <label className="check">
              <input type="checkbox" checked={draft.isAvailable} onChange={(e) => setDraft({ ...draft, isAvailable: e.target.checked })} />
              Disponible
            </label>
            <div className="row end gap">
              <button type="button" className="btn btn-ghost" onClick={() => setDraft(null)}>
                Cancelar
              </button>
              <button className="btn btn-primary" type="submit">
                Guardar
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
