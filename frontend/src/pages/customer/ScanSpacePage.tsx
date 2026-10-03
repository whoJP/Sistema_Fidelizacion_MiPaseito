import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, MapPin } from 'lucide-react'
import { useDb } from '../../data/store'
import { visitCard } from '../../domain/engagement'
import { todayKey } from '../../domain/time'
import { formatInt, plural } from '../../lib/format'
import { useUser } from '../../session'
import type { CommandResult } from '../../data/commands'
import { ScanOrCode } from '../../components/ScanOrCode'
import { Card, CardHead, Empty, PageHeader, run } from '../../components/ui'

export function ScanSpacePage() {
  const db = useDb()
  const user = useUser()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<CommandResult<'checkInSpace'> | null>(null)

  const today = todayKey()
  const spaces = db.spaces.filter((s) => s.deletedAt === null && s.status === 'ACTIVE')
  const visitedToday = new Set(db.spaceCheckIns.filter((c) => c.userId === user.id && c.day === today).map((c) => c.spaceId))
  const card = visitCard(db, user.id)

  const submit = async (code: string) => {
    if (busy) return false
    setBusy(true)
    const r = await run('checkInSpace', { code })
    setBusy(false)
    if (r) setDone(r)
    return !!r
  }

  return (
    <div className="page">
      <PageHeader
        title="Visita un espacio"
        subtitle="En la Galería de Arte y otros espacios del Paseo hay un QR fijo. Escanéalo una vez al día en cada espacio y suma puntos y puntos de nivel."
      />
      <div className="scan-layout">
        <Card>
          {done ? (
            <div className="stack center pass-done">
              <span className="pass-icon is-success" aria-hidden>
                <CheckCircle2 size={32} />
              </span>
              <h3>¡Bienvenido a {done.space.name}!</h3>
              <p className="muted">
                Sumaste{' '}
                {[done.pointsEarned > 0 && `${formatInt(done.pointsEarned)} puntos`, done.statusEarned > 0 && `${formatInt(done.statusEarned)} puntos de nivel`]
                  .filter(Boolean)
                  .join(' y ')}
                .{' '}
                {done.visitCardCompleted ? 'Además completaste tu tarjeta de visitas: tienes un sobre esperándote en Inicio.' : 'Tu tarjeta de visitas ganó un sello.'}
              </p>
              {done.newBadges.length > 0 && <p className="small">Nueva insignia: {done.newBadges.join(', ')}</p>}
              <div className="row gap wrap">
                <Link className="btn btn-primary" to="/app">
                  Ver mi tarjeta
                </Link>
                <button className="btn" onClick={() => setDone(null)}>
                  Escanear otro
                </button>
              </div>
            </div>
          ) : (
            <ScanOrCode kind="space" onSubmit={submit} busy={busy} scanLabel="Apunta la cámara al QR del espacio" />
          )}
        </Card>

        <Card>
          <CardHead icon={MapPin} title="Espacios del Paseo" />
          {spaces.length === 0 ? (
            <Empty>Pronto habrá espacios para visitar.</Empty>
          ) : (
            <ul className="list">
              {spaces.map((s) => (
                <li key={s.id} className="list-row">
                  <div>
                    <strong>{s.name}</strong>
                    <div className="muted small">{[s.location, s.description].filter(Boolean).join(' · ')}</div>
                  </div>
                  {visitedToday.has(s.id) ? (
                    <span className="badge badge-success">Visitado hoy</span>
                  ) : (
                    <span className="small accent tabular">
                      +{formatInt(s.pointsReward)} puntos
                      {s.statusReward > 0 && <> · +{formatInt(s.statusReward)} de nivel</>}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="muted small">
            Tu tarjeta de visitas lleva {plural(card.stamps, 'sello', 'sellos')} de {card.size}.
          </p>
        </Card>
      </div>
    </div>
  )
}
