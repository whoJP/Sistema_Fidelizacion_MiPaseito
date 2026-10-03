import type { ReactNode } from 'react'
import { Plus } from 'lucide-react'
import type { Database } from '../../types/domain'
import { Badge, Field, MultiSelect, PageHeader } from '../../components/ui'

export interface ScopeValue {
  businessIds: number[]
  categoryIds: number[]
}

export function categoryLabel(db: Database, id: number): string {
  const c = db.categories.find((x) => x.id === id)
  if (!c) return '?'
  const parent = c.parentId ? db.categories.find((x) => x.id === c.parentId) : null
  return parent ? `${parent.name} › ${c.name}` : c.name
}

export function liveCategoryOptions(db: Database) {
  return db.categories
    .filter((c) => c.deletedAt === null)
    .map((c) => ({ id: c.id, label: categoryLabel(db, c.id) }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

export function liveBusinessOptions(db: Database) {
  return db.businesses
    .filter((b) => b.deletedAt === null)
    .map((b) => ({ id: b.id, label: b.name }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

export function ScopeEditor({ db, value, onChange }: { db: Database; value: ScopeValue; onChange: (v: ScopeValue) => void }) {
  const global = value.businessIds.length === 0 && value.categoryIds.length === 0
  return (
    <div className="scope">
      <div className="row between">
        <span className="field-label">Alcance</span>
        {global && <Badge tone="accent">Global: todo el Paseo</Badge>}
      </div>
      <Field label="Categorías">
        <MultiSelect options={liveCategoryOptions(db)} value={value.categoryIds} onChange={(categoryIds) => onChange({ ...value, categoryIds })} />
      </Field>
      <Field label="Establecimientos">
        <MultiSelect options={liveBusinessOptions(db)} value={value.businessIds} onChange={(businessIds) => onChange({ ...value, businessIds })} />
      </Field>
    </div>
  )
}

export function scopeSummary(db: Database, scope: ScopeValue): string {
  if (scope.businessIds.length === 0 && scope.categoryIds.length === 0) return 'Global'
  return [
    ...scope.categoryIds.map((id) => categoryLabel(db, id)),
    ...scope.businessIds.map((id) => db.businesses.find((b) => b.id === id)?.name ?? '?'),
  ].join(', ')
}

export const STATUS_TONE: Record<string, 'success' | 'neutral' | 'warning' | 'danger' | 'accent'> = {
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  DRAFT: 'warning',
  SUSPENDED: 'danger',
}

export const STATUS_TEXT: Record<string, string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  DRAFT: 'Borrador',
  SUSPENDED: 'Suspendido',
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? 'neutral'}>{STATUS_TEXT[status] ?? status}</Badge>
}

export function AdminHeader({ title, subtitle, onCreate, createLabel = 'Nuevo' }: { title: string; subtitle?: ReactNode; onCreate?: () => void; createLabel?: string }) {
  return (
    <PageHeader
      title={title}
      subtitle={subtitle}
      actions={
        onCreate && (
          <button className="btn btn-primary" onClick={onCreate}>
            <Plus size={16} /> {createLabel}
          </button>
        )
      }
    />
  )
}

export function FormActions({ onCancel, disabled = false }: { onCancel: () => void; disabled?: boolean }) {
  return (
    <div className="row end gap form-actions">
      <button type="button" className="btn btn-ghost" onClick={onCancel}>
        Cancelar
      </button>
      <button className="btn btn-primary" type="submit" disabled={disabled}>
        Guardar
      </button>
    </div>
  )
}
