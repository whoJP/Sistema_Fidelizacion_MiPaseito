import { useEffect, useState, type FormEvent } from 'react'
import { ImageOff } from 'lucide-react'
import { ApiError, api } from '../../data/api'
import { useDb } from '../../data/store'
import { LIMITS } from '../../domain/validation'
import { formatDateTime, formatLongDayKey, fullName } from '../../lib/format'
import type { KycRequest, KycStatus } from '../../types/domain'
import { Badge, Card, Empty, Field, Modal, PageHeader, run, vanish } from '../../components/ui'

const STATUS_LABEL: Record<KycStatus, string> = { PENDING: 'Por revisar', APPROVED: 'Aprobadas', REJECTED: 'Rechazadas' }

const REJECT_REASONS = ['La foto no se lee bien.', 'La fecha no coincide con el carnet.', 'El documento no corresponde al titular de la cuenta.']

const ageOn = (birthDate: string, at: string) => {
  const [y, m, d] = birthDate.split('-').map(Number)
  const [ty, tm, td] = at.slice(0, 10).split('-').map(Number)
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0)
}

/** The photo is fetched on demand and never stored in the snapshot. */
function IdPhoto({ requestId }: { requestId: number }) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    let created: string | null = null
    api
      .kycDocumentUrl(requestId)
      .then((u) => {
        created = u
        if (alive) setUrl(u)
        else URL.revokeObjectURL(u)
      })
      .catch((err) => alive && setError(err instanceof ApiError ? err.message : 'No se pudo cargar la foto'))
    return () => {
      alive = false
      if (created) URL.revokeObjectURL(created)
    }
  }, [requestId])

  if (error) {
    return (
      <div className="kyc-photo is-empty">
        <ImageOff size={28} aria-hidden />
        <span className="small">{error}</span>
      </div>
    )
  }
  if (!url) return <div className="kyc-photo is-loading" aria-label="Cargando foto" />
  return (
    <a className="kyc-photo" href={url} target="_blank" rel="noreferrer">
      <img src={url} alt="Foto del carnet enviada por el cliente" />
    </a>
  )
}

export function AdminKyc() {
  const db = useDb()
  const [filter, setFilter] = useState<KycStatus>('PENDING')
  const [rejecting, setRejecting] = useState<KycRequest | null>(null)
  const [note, setNote] = useState('')
  const requests = db.kycRequests
    .filter((r) => r.status === filter)
    .sort((a, b) => (filter === 'PENDING' ? a.createdAt.localeCompare(b.createdAt) : (b.reviewedAt ?? '').localeCompare(a.reviewedAt ?? '')))
  const customer = (r: KycRequest) => db.users.find((u) => u.id === r.userId)

  const approve = (r: KycRequest, trigger: Element) =>
    void vanish(trigger, () => run('reviewKyc', { requestId: r.id, decision: 'APPROVED', note: '' }, 'Cumpleaños verificado'))

  const reject = async (e: FormEvent) => {
    e.preventDefault()
    if (!rejecting) return
    const ok = await run('reviewKyc', { requestId: rejecting.id, decision: 'REJECTED', note }, 'Solicitud rechazada')
    if (ok) {
      setRejecting(null)
      setNote('')
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Verificaciones"
        subtitle="Aprobar activa el cumpleaños y borra la foto"
      />
      <div className="chips">
        {(Object.keys(STATUS_LABEL) as KycStatus[]).map((s) => (
          <button key={s} className={`chip ${filter === s ? 'chip-active' : ''}`} onClick={() => setFilter(s)}>
            {STATUS_LABEL[s]}
            {s === 'PENDING' && ` (${db.kycRequests.filter((r) => r.status === 'PENDING').length})`}
          </button>
        ))}
      </div>

      {requests.length === 0 ? (
        <Card>
          <Empty>{filter === 'PENDING' ? 'No hay verificaciones pendientes.' : 'Nada por aquí todavía.'}</Empty>
        </Card>
      ) : (
        <div className="kyc-list">
          {requests.map((r) => {
            const user = customer(r)
            return (
              <Card key={r.id} className="kyc-item">
                {r.status === 'PENDING' && <IdPhoto requestId={r.id} />}
                <div className="stack-sm">
                  <div className="row between wrap gap">
                    <strong>{user ? fullName(user) : 'Cliente'}</strong>
                    {r.status !== 'PENDING' && <Badge tone={r.status === 'APPROVED' ? 'success' : 'danger'}>{STATUS_LABEL[r.status].slice(0, -1)}</Badge>}
                  </div>
                  {user && <span className="muted small">{user.email}</span>}
                  <dl className="kyc-facts small">
                    <div>
                      <dt>Fecha declarada</dt>
                      <dd>
                        {formatLongDayKey(r.birthDate)} de {r.birthDate.slice(0, 4)} · {ageOn(r.birthDate, r.createdAt)} años
                      </dd>
                    </div>
                    <div>
                      <dt>Enviada</dt>
                      <dd>{formatDateTime(r.createdAt)}</dd>
                    </div>
                    {r.reviewedAt && (
                      <div>
                        <dt>Revisada</dt>
                        <dd>{formatDateTime(r.reviewedAt)}</dd>
                      </div>
                    )}
                    {r.reviewNote && (
                      <div>
                        <dt>Nota</dt>
                        <dd>{r.reviewNote}</dd>
                      </div>
                    )}
                  </dl>
                  {r.status === 'PENDING' && (
                    <div className="row gap">
                      <button className="btn btn-primary btn-sm" onClick={(e) => approve(r, e.currentTarget)}>
                        Aprobar
                      </button>
                      <button className="btn btn-ghost btn-sm danger" onClick={() => setRejecting(r)}>
                        Rechazar
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {rejecting && (
        <Modal title="Rechazar verificación" onClose={() => setRejecting(null)}>
          <form className="stack" onSubmit={reject}>
            <Field label="Motivo para el cliente" hint="Lo verá en su notificación. Podrá volver a enviarlo.">
              <textarea rows={3} required minLength={5} maxLength={LIMITS.note} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <div className="chips">
              {REJECT_REASONS.map((reason) => (
                <button key={reason} type="button" className="chip chip-suggest" onClick={() => setNote(reason)}>
                  {reason}
                </button>
              ))}
            </div>
            <div className="row end gap">
              <button type="button" className="btn btn-ghost" onClick={() => setRejecting(null)}>
                Cancelar
              </button>
              <button className="btn btn-primary danger" type="submit">
                Rechazar
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
