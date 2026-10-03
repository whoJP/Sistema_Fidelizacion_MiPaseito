import { useState, type FormEvent } from 'react'
import { useDb } from '../../data/store'
import { plural } from '../../lib/format'
import type { Category } from '../../types/domain'
import { Card, Empty, Field, Modal, notify, run, vanish } from '../../components/ui'
import { confirmDialog } from '../../components/dialog'
import { LIMITS } from '../../domain/validation'
import { AdminHeader, FormActions, StatusBadge } from './shared'

type Draft = { id: number | null; name: string; parentId: number | null; status: Category['status'] }

export function AdminCategories() {
  const db = useDb()
  const [draft, setDraft] = useState<Draft | null>(null)
  const live = db.categories.filter((c) => c.deletedAt === null)
  const roots = live.filter((c) => c.parentId === null).sort((a, b) => a.name.localeCompare(b.name))
  const children = (id: number) => live.filter((c) => c.parentId === id).sort((a, b) => a.name.localeCompare(b.name))
  const usage = (id: number) => db.businessCategories.filter((bc) => bc.categoryId === id).length

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft) return
    const ok = await run(
      'saveCategory',
      { id: draft.id, data: { name: draft.name, parentId: draft.parentId, status: draft.status } },
      'Categoría guardada',
    )
    if (ok) setDraft(null)
  }

  const remove = async (c: Category, row: HTMLElement) => {
    if (children(c.id).length > 0) {
      notify('error', `Primero elimina o mueve las subcategorías de "${c.name}".`)
      return
    }
    const used = usage(c.id)
    const ok = await confirmDialog({
      title: `¿Eliminar "${c.name}"?`,
      message: used > 0 ? `${plural(used, 'establecimiento la usa', 'establecimientos la usan')}; dejarán de aparecer bajo esta categoría.` : undefined,
      confirmLabel: 'Eliminar',
      tone: 'danger',
    })
    if (ok) void vanish(row, () => run('softDelete', { table: 'categories', id: c.id }, 'Categoría eliminada'))
  }

  const row = (c: Category, depth: number) => (
    <li key={c.id} className="list-row" style={{ paddingLeft: depth * 24 }}>
      <span>
        {depth > 0 && <span className="muted">└ </span>}
        <strong>{c.name}</strong> <span className="muted small">{plural(usage(c.id), 'establecimiento', 'establecimientos')}</span>
      </span>
      <span className="row gap">
        <StatusBadge status={c.status} />
        {depth === 0 && (
          <button className="btn btn-ghost btn-sm" onClick={() => setDraft({ id: null, name: '', parentId: c.id, status: 'ACTIVE' })}>
            + Sub
          </button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={() => setDraft({ id: c.id, name: c.name, parentId: c.parentId, status: c.status })}>
          Editar
        </button>
        <button className="btn btn-ghost btn-sm danger" onClick={(e) => remove(c, e.currentTarget)}>
          Eliminar
        </button>
      </span>
    </li>
  )

  return (
    <div className="page">
      <AdminHeader
        title="Categorías"
        subtitle="Jerarquía dinámica: una categoría puede tener subcategorías."
        onCreate={() => setDraft({ id: null, name: '', parentId: null, status: 'ACTIVE' })}
      />
      <Card>
        {roots.length === 0 ? (
          <Empty>No hay categorías configuradas.</Empty>
        ) : (
          <ul className="list">{roots.flatMap((r) => [row(r, 0), ...children(r.id).map((c) => row(c, 1))])}</ul>
        )}
      </Card>

      {draft && (
        <Modal title={draft.id ? 'Editar categoría' : 'Nueva categoría'} onClose={() => setDraft(null)}>
          <form className="stack" onSubmit={save}>
            <Field label="Nombre">
              <input required maxLength={LIMITS.categoryName} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus />
            </Field>
            <Field label="Categoría padre">
              <select
                value={draft.parentId ?? ''}
                onChange={(e) => setDraft({ ...draft, parentId: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">Ninguna (categoría principal)</option>
                {roots
                  .filter((r) => r.id !== draft.id)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Estado">
              <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as Category['status'] })}>
                <option value="ACTIVE">Activa</option>
                <option value="INACTIVE">Inactiva</option>
              </select>
            </Field>
            <FormActions onCancel={() => setDraft(null)} />
          </form>
        </Modal>
      )}
    </div>
  )
}
