import { useState, type FormEvent } from 'react'
import { UserRound } from 'lucide-react'
import { ApiError, api, type IdentifiedCustomer } from '../../data/api'
import { useDb } from '../../data/store'
import { isEventOpen } from '../../domain/loyalty'
import { formatDateTime, formatInt, fromLocalInput, fullName, toLocalInput } from '../../lib/format'
import type { EventStatus, PaseoEvent } from '../../types/domain'
import { Badge, Card, Empty, Field, Modal, notify, run, vanish } from '../../components/ui'
import { confirmDialog } from '../../components/dialog'
import { ScanOrCode } from '../../components/ScanOrCode'
import { WindowFields, draftWindowError } from '../../components/WindowFields'
import { AdminHeader, FormActions } from './shared'

interface Draft {
  id: number | null
  name: string
  description: string
  location: string
  startsAt: string
  endsAt: string
  pointsReward: string
  status: EventStatus
}

const toDraft = (e?: PaseoEvent): Draft => ({
  id: e?.id ?? null,
  name: e?.name ?? '',
  description: e?.description ?? '',
  location: e?.location ?? '',
  startsAt: toLocalInput(e?.startsAt ?? new Date().toISOString()),
  endsAt: toLocalInput(e?.endsAt ?? new Date(Date.now() + 4 * 3600_000).toISOString()),
  pointsReward: String(e?.pointsReward ?? 100),
  status: e?.status ?? 'DRAFT',
})

const STATUS: Record<EventStatus, { text: string; tone: 'success' | 'warning' | 'neutral' }> = {
  ACTIVE: { text: 'Publicado', tone: 'success' },
  DRAFT: { text: 'Borrador', tone: 'warning' },
  INACTIVE: { text: 'Oculto', tone: 'neutral' },
}

function timing(e: PaseoEvent, now: Date): string {
  if (isEventOpen(e, now)) return 'En curso'
  return new Date(e.startsAt) > now ? 'Próximo' : 'Finalizado'
}

function CheckInModal({ event, onClose }: { event: PaseoEvent; onClose: () => void }) {
  const db = useDb()
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState<{ customer: IdentifiedCustomer; points: number; badges: string[] } | null>(null)
  const attendees = db.eventAttendances
    .filter((a) => a.eventId === event.id)
    .sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt))

  const checkIn = async (value: string) => {
    if (!value.trim() || busy) return false
    setBusy(true)
    try {
      const customer = await api.identifyCustomer(value.trim())
      const r = await run('checkInEvent', { eventId: event.id, customerId: customer.id })
      if (!r) return false
      setLast({ customer, points: r.pointsEarned, badges: r.newBadges })
      return true
    } catch (err) {
      notify('error', err instanceof ApiError ? err.message : 'Error inesperado')
      return false
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={`Registrar ingreso · ${event.name}`} onClose={onClose} wide>
      <div className="stack">
        {isEventOpen(event) ? (
          <ScanOrCode kind="customer" onSubmit={checkIn} busy={busy} scanLabel="Apunta la cámara al QR de socio del cliente" />
        ) : (
          <p className="muted">Los ingresos solo se registran mientras el evento está en curso ({formatDateTime(event.startsAt)} - {formatDateTime(event.endsAt)}).</p>
        )}

        {last && (
          <Card className="card-success">
            <p>
              <strong>{fullName(last.customer)}</strong> ingresó
              {last.points > 0 && <> y ganó {formatInt(last.points)} puntos</>}.
            </p>
            {last.badges.length > 0 && (
              <div className="chips">
                {last.badges.map((b) => (
                  <Badge key={b} tone="success">
                    Nueva insignia: {b}
                  </Badge>
                ))}
              </div>
            )}
          </Card>
        )}

        <h3>Asistentes ({attendees.length})</h3>
        {attendees.length === 0 ? (
          <p className="muted small">Todavía no hay ingresos registrados.</p>
        ) : (
          <ul className="list">
            {attendees.map((a) => {
              const u = db.users.find((x) => x.id === a.userId)
              return (
                <li key={a.userId} className="list-row">
                  <span className="row gap">
                    <UserRound size={16} /> {u ? fullName(u) : 'Cliente'}
                  </span>
                  <span className="muted small">{formatDateTime(a.checkedInAt)}</span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Modal>
  )
}

export function AdminEvents() {
  const db = useDb()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [checkIn, setCheckIn] = useState<PaseoEvent | null>(null)
  const now = new Date()
  const events = db.events.filter((e) => e.deletedAt === null).sort((a, b) => b.startsAt.localeCompare(a.startsAt))
  const editing = (draft?.id && db.events.find((e) => e.id === draft.id)) || null
  const windowProblem = draft && draftWindowError(draft, editing, true)

  const remove = async (e: PaseoEvent, row: HTMLElement) => {
    const ok = await confirmDialog({
      title: `¿Eliminar "${e.name}"?`,
      message: 'Los clientes que asistieron conservan sus puntos, pero dejarán de ver la insignia.',
      confirmLabel: 'Eliminar',
      tone: 'danger',
    })
    if (ok) void vanish(row, () => run('softDelete', { table: 'events', id: e.id }, 'Evento eliminado'))
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft || windowProblem) return
    const startsAt = fromLocalInput(draft.startsAt)
    const endsAt = fromLocalInput(draft.endsAt)
    if (!startsAt || !endsAt) return
    const ok = await run(
      'saveEvent',
      {
        id: draft.id,
        data: {
          name: draft.name,
          description: draft.description,
          location: draft.location,
          startsAt,
          endsAt,
          pointsReward: Number(draft.pointsReward),
          status: draft.status,
        },
      },
      'Evento guardado',
    )
    if (ok) setDraft(null)
  }

  return (
    <div className="page">
      <AdminHeader
        title="Eventos"
        subtitle="Quien asiste a un evento publicado gana sus puntos y la insignia del evento. El ingreso se registra escaneando el QR del cliente."
        onCreate={() => setDraft(toDraft())}
        createLabel="Nuevo evento"
      />
      <Card>
        {events.length === 0 ? (
          <Empty>No hay eventos.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table table-stack">
              <thead>
                <tr>
                  <th>Evento</th>
                  <th>Fecha</th>
                  <th className="num">Puntos</th>
                  <th className="num">Asistentes</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {events.map((e) => {
                  const when = timing(e, now)
                  return (
                    <tr key={e.id}>
                      <td>
                        <strong>{e.name}</strong>
                        <div className="muted small">{[e.location, e.description].filter(Boolean).join(' · ')}</div>
                      </td>
                      <td className="small" data-label="Fecha">
                        <div>
                          {formatDateTime(e.startsAt)} - {formatDateTime(e.endsAt)}
                          <div>
                            <Badge tone={when === 'En curso' ? 'success' : 'neutral'}>{when}</Badge>
                          </div>
                        </div>
                      </td>
                      <td className="num" data-label="Puntos">
                        {formatInt(e.pointsReward)}
                      </td>
                      <td className="num" data-label="Asistentes">
                        {formatInt(db.eventAttendances.filter((a) => a.eventId === e.id).length)}
                      </td>
                      <td data-label="Estado">
                        <Badge tone={STATUS[e.status].tone}>{STATUS[e.status].text}</Badge>
                      </td>
                      <td className="row end gap">
                        <button className="btn btn-primary btn-sm" onClick={() => setCheckIn(e)}>
                          {when === 'En curso' && e.status === 'ACTIVE' ? 'Registrar ingreso' : 'Asistentes'}
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setDraft(toDraft(e))}>
                          Editar
                        </button>
                        <button className="btn btn-ghost btn-sm danger" onClick={(ev) => remove(e, ev.currentTarget)}>
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

      {checkIn && <CheckInModal event={db.events.find((e) => e.id === checkIn.id) ?? checkIn} onClose={() => setCheckIn(null)} />}

      {draft && (
        <Modal title={draft.id ? 'Editar evento' : 'Nuevo evento'} onClose={() => setDraft(null)} wide>
          <form className="stack" onSubmit={save}>
            <Field label="Nombre del evento" hint="También es el nombre de la insignia que recibirán los asistentes.">
              <input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field label="Descripción corta">
              <textarea rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </Field>
            <div className="grid-2">
              <Field label="Lugar" hint="Ej. Plaza central, Piso 2">
                <input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
              </Field>
              <Field label="Puntos por asistir">
                <input type="number" min={0} step={1} required value={draft.pointsReward} onChange={(e) => setDraft({ ...draft, pointsReward: e.target.value })} />
              </Field>
            </div>
            <WindowFields value={draft} onChange={(w) => setDraft({ ...draft, ...w })} previous={editing} required />
            <Field label="Estado" hint="Solo los eventos publicados se muestran a los clientes y permiten registrar ingresos.">
              <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as EventStatus })}>
                <option value="DRAFT">Borrador</option>
                <option value="ACTIVE">Publicado</option>
                <option value="INACTIVE">Oculto</option>
              </select>
            </Field>
            <FormActions onCancel={() => setDraft(null)} disabled={!!windowProblem} />
          </form>
        </Modal>
      )}
    </div>
  )
}
