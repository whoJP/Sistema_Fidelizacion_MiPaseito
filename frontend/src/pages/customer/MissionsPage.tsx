import { CheckCircle2 } from 'lucide-react'
import { useDb } from '../../data/store'
import { evaluateMission, isGlobalScope, liveMissions, missionScope } from '../../domain/loyalty'
import { formatDate, formatInt, formatMoney, MISSION_TYPE_LABELS } from '../../lib/format'
import { useUser } from '../../session'
import { Badge, Card, Empty, PageHeader, ProgressRing } from '../../components/ui'

const prize = (points: number, status: number) =>
  [points > 0 && `+${formatInt(points)} puntos`, status > 0 && `+${formatInt(status)} de nivel`].filter(Boolean).join(' · ')

export function MissionsPage() {
  const db = useDb()
  const user = useUser()

  const missions = liveMissions(db).map((mission) => {
    const row = db.missionProgress.find((p) => p.missionId === mission.id && p.userId === user.id)
    const completedAt = row?.completedAt ?? null
    const progress = completedAt ? mission.goal : Math.min(evaluateMission(db, mission, user.id), mission.goal)
    return { mission, progress, completedAt }
  })
  const active = missions.filter((m) => !m.completedAt)
  const done = missions.filter((m) => m.completedAt)

  const scopeLabel = (missionId: number) => {
    const scope = missionScope(db, missionId)
    if (isGlobalScope(scope)) return null
    const names = [
      ...scope.categoryIds.map((id) => db.categories.find((c) => c.id === id)?.name),
      ...scope.businessIds.map((id) => db.businesses.find((b) => b.id === id)?.name),
    ].filter(Boolean)
    return names.join(', ')
  }

  return (
    <div className="page">
      <PageHeader title="Misiones" subtitle="Completa retos y gana puntos extra. El premio se acredita solo al cumplir el objetivo." />

      {active.length === 0 && done.length === 0 && <Empty>No hay misiones activas por ahora.</Empty>}

      <div className="missions-grid">
        {active.map(({ mission, progress }) => {
          const scope = scopeLabel(mission.id)
          const money = mission.type === 'TOTAL_PURCHASE_AMOUNT'
          return (
            <Card key={mission.id} className="mission">
              <div className="mission-top">
                <ProgressRing value={progress} max={mission.goal} />
                <div className="mission-heading">
                  <Badge tone="accent">{MISSION_TYPE_LABELS[mission.type]}</Badge>
                  <h3>{mission.name}</h3>
                  <p className="mission-count">
                    <strong>{money ? formatMoney(progress) : formatInt(progress)}</strong>
                    <span> de {money ? formatMoney(mission.goal) : formatInt(mission.goal)}</span>
                  </p>
                </div>
              </div>
              {mission.description && <p className="mission-desc">{mission.description}</p>}
              <dl className="mission-facts">
                <div>
                  <dt>Premio</dt>
                  <dd className="gold">{prize(mission.rewardPoints, mission.rewardStatus)}</dd>
                </div>
                {scope && (
                  <div>
                    <dt>Aplica en</dt>
                    <dd>{scope}</dd>
                  </div>
                )}
                <div>
                  <dt>Vence</dt>
                  <dd>{formatDate(mission.endsAt)}</dd>
                </div>
              </dl>
            </Card>
          )
        })}
      </div>

      {done.length > 0 && (
        <>
          <h2 className="section-title">Completadas</h2>
          <Card>
            <ul className="list">
              {done.map(({ mission, completedAt }) => (
                <li key={mission.id} className="list-row">
                  <div className="row gap">
                    <CheckCircle2 className="success" size={20} />
                    <div>
                      <strong>{mission.name}</strong>
                      <div className="muted small">Completada el {formatDate(completedAt!)}</div>
                    </div>
                  </div>
                  <span className="small">{prize(mission.rewardPoints, mission.rewardStatus)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  )
}
