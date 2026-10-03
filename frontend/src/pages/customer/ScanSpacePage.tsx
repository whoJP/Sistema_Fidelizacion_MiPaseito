import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, CheckCircle2, MapPin } from 'lucide-react'
import { useDb } from '../../data/store'
import { visitCard } from '../../domain/engagement'
import { todayKey } from '../../domain/time'
import { formatInt } from '../../lib/format'
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
      <PageHeader title="Espacios" subtitle="Escanea su QR y suma, una vez al día" />
      <div className="scan-layout">
        <Card>
          {done ? (
            <div className="stack center pass-done">
              <span className="pass-icon is-success" aria-hidden>
                <CheckCircle2 size={32} />
              </span>
              <h3>¡Bienvenido a {done.space.name}!</h3>
              <p className="scan-gain">
                {[done.pointsEarned > 0 && `+${formatInt(done.pointsEarned)} pts`, done.statusEarned > 0 && `+${formatInt(done.statusEarned)} nivel`]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <p className="muted small">{done.visitCardCompleted ? '¡Tarjeta completa! Abre tu sobre en Inicio' : '+1 sello en tu tarjeta'}</p>
              {done.newBadges.length > 0 && <p className="small">Nueva insignia: {done.newBadges.join(', ')}</p>}
              <div className="row gap wrap">
                <Link className="btn btn-primary" to="/app">
                  Ir a Inicio
                </Link>
                <button className="btn" onClick={() => setDone(null)}>
                  Escanear otro
                </button>
              </div>
            </div>
          ) : (
            <ScanOrCode kind="space" onSubmit={submit} busy={busy} scanLabel="Apunta al QR del espacio" />
          )}
        </Card>

        <Card>
          <CardHead icon={MapPin} title="Dónde" action={<span className="small muted tabular">Sellos {card.stamps}/{card.size}</span>} />
          {spaces.length === 0 ? (
            <Empty>Pronto habrá espacios</Empty>
          ) : (
            <ul className="list">
              {spaces.map((s) => (
                <li key={s.id} className="list-row">
                  <div>
                    <strong>{s.name}</strong>
                    {s.location && <div className="muted small">{s.location}</div>}
                  </div>
                  {visitedToday.has(s.id) ? (
                    <span className="badge badge-success">
                      <Check size={12} aria-hidden /> Hoy
                    </span>
                  ) : (
                    <span className="small accent tabular">+{formatInt(s.pointsReward)} pts</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
