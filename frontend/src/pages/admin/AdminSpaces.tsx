import { useState, type FormEvent } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Printer, QrCode, RefreshCw } from 'lucide-react'
import { useDb } from '../../data/store'
import { SPACE_QR_PREFIX } from '../../data/actions'
import { todayKey } from '../../domain/time'
import { formatInt } from '../../lib/format'
import type { Space, SpaceStatus } from '../../types/domain'
import { Card, Empty, Field, Modal, run, vanish } from '../../components/ui'
import { confirmDialog } from '../../components/dialog'
import { LIMITS } from '../../domain/validation'
import { AdminHeader, FormActions, StatusBadge } from './shared'

interface Draft {
  id: number | null
  name: string
  description: string
  location: string
  pointsReward: string
  statusReward: string
  status: SpaceStatus
}

const toDraft = (s?: Space): Draft => ({
  id: s?.id ?? null,
  name: s?.name ?? '',
  description: s?.description ?? '',
  location: s?.location ?? '',
  pointsReward: String(s?.pointsReward ?? 15),
  statusReward: String(s?.statusReward ?? 25),
  status: s?.status ?? 'ACTIVE',
})

function SpacePoster({ space }: { space: Space }) {
  const regenerate = async () => {
    const ok = await confirmDialog({
      title: '¿Generar un código nuevo?',
      message: 'El QR impreso deja de funcionar. Imprime el nuevo.',
      confirmLabel: 'Generar código nuevo',
      tone: 'danger',
    })
    if (ok) await run('regenerateSpaceCode', { spaceId: space.id }, 'Código nuevo generado')
  }

  return (
    <div className="stack">
      <div className="space-poster print-area">
        <span className="space-poster-kicker">Paseo Club</span>
        <h2 className="space-poster-name">{space.name}</h2>
        {space.location && <p className="space-poster-location">{space.location}</p>}
        <div className="space-poster-qr">
          <QRCodeSVG value={`${SPACE_QR_PREFIX}${space.code}`} size={240} level="M" bgColor="#f3eee0" fgColor="#010102" />
        </div>
        <p className="space-poster-cta">
          Escanéalo y suma <b>{formatInt(space.pointsReward)} puntos</b>. Una vez al día.
        </p>
        <code className="token token-lg">{space.code}</code>
      </div>
      <div className="row end gap">
        <button type="button" className="btn btn-ghost btn-sm danger" onClick={regenerate}>
          <RefreshCw size={14} aria-hidden /> Generar código nuevo
        </button>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          <Printer size={16} aria-hidden /> Imprimir
        </button>
      </div>
    </div>
  )
}

export function AdminSpaces() {
  const db = useDb()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [posterId, setPosterId] = useState<number | null>(null)
  const spaces = db.spaces.filter((s) => s.deletedAt === null).sort((a, b) => a.name.localeCompare(b.name))
  const poster = posterId === null ? null : (spaces.find((s) => s.id === posterId) ?? null)
  const today = todayKey()
  const visits = (spaceId: number) => db.spaceCheckIns.filter((c) => c.spaceId === spaceId)

  const remove = async (s: Space, row: HTMLElement) => {
    const ok = await confirmDialog({
      title: `¿Eliminar "${s.name}"?`,
      message: 'Su QR deja de funcionar. Lo ya entregado se conserva.',
      confirmLabel: 'Eliminar',
      tone: 'danger',
    })
    if (ok) void vanish(row, () => run('softDelete', { table: 'spaces', id: s.id }, 'Espacio eliminado'))
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft) return
    const saved = await run(
      'saveSpace',
      {
        id: draft.id,
        data: {
          name: draft.name,
          description: draft.description.trim() || null,
          location: draft.location.trim() || null,
          pointsReward: Math.trunc(Number(draft.pointsReward) || 0),
          statusReward: Math.trunc(Number(draft.statusReward) || 0),
          status: draft.status,
        },
      },
      'Espacio guardado',
    )
    if (!saved) return
    setDraft(null)
    if (!draft.id) setPosterId(saved.id)
  }

  return (
    <div className="page">
      <AdminHeader
        title="Espacios"
        subtitle="QR fijo · una visita al día por cliente"
        onCreate={() => setDraft(toDraft())}
      />
      <Card>
        {spaces.length === 0 ? (
          <Empty>Aún no hay espacios. Crea el primero e imprime su QR.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table table-stack">
              <thead>
                <tr>
                  <th>Espacio</th>
                  <th>Por visita</th>
                  <th className="num">Visitas hoy</th>
                  <th className="num">Visitas totales</th>
                  <th>Código</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {spaces.map((s) => {
                  const all = visits(s.id)
                  return (
                    <tr key={s.id}>
                      <td>
                        <strong>{s.name}</strong>
                        {s.location && <div className="muted small">{s.location}</div>}
                      </td>
                      <td className="small" data-label="Por visita">
                        {formatInt(s.pointsReward)} puntos · {formatInt(s.statusReward)} de nivel
                      </td>
                      <td className="num" data-label="Visitas hoy">
                        {formatInt(all.filter((c) => c.day === today).length)}
                      </td>
                      <td className="num" data-label="Visitas totales">
                        {formatInt(all.length)}
                      </td>
                      <td data-label="Código">
                        <code className="small">{s.code}</code>
                      </td>
                      <td data-label="Estado">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="row end gap">
                        <button className="btn btn-ghost btn-sm" onClick={() => setPosterId(s.id)}>
                          <QrCode size={14} aria-hidden /> QR
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setDraft(toDraft(s))}>
                          Editar
                        </button>
                        <button className="btn btn-ghost btn-sm danger" onClick={(e) => remove(s, e.currentTarget)}>
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {poster && (
        <Modal title={`QR · ${poster.name}`} onClose={() => setPosterId(null)}>
          <SpacePoster space={poster} />
        </Modal>
      )}

      {draft && (
        <Modal title={draft.id ? 'Editar espacio' : 'Nuevo espacio'} onClose={() => setDraft(null)}>
          <form className="stack" onSubmit={save}>
            <div className="grid-2">
              <Field label="Nombre">
                <input required maxLength={LIMITS.name} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </Field>
              <Field label="Estado">
                <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as SpaceStatus })}>
                  <option value="ACTIVE">Activo (recibe visitas)</option>
                  <option value="INACTIVE">Inactivo</option>
                </select>
              </Field>
            </div>
            <Field label="Ubicación (opcional)" hint="Ej.: Planta alta, junto al patio de comidas.">
              <input maxLength={LIMITS.location} value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
            </Field>
            <Field label="Descripción (opcional)">
              <textarea rows={2} maxLength={LIMITS.description} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </Field>
            <div className="grid-2">
              <Field label="Puntos por visita">
                <input type="number" min={0} max={1000} step={1} required value={draft.pointsReward} onChange={(e) => setDraft({ ...draft, pointsReward: e.target.value })} />
              </Field>
              <Field label="Puntos de nivel por visita">
                <input type="number" min={0} max={1000} step={1} required value={draft.statusReward} onChange={(e) => setDraft({ ...draft, statusReward: e.target.value })} />
              </Field>
            </div>
            <FormActions onCancel={() => setDraft(null)} />
          </form>
        </Modal>
      )}
    </div>
  )
}
