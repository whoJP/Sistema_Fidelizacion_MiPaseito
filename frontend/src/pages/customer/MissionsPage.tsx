import { CalendarClock, CheckCircle2, Gift, MapPin } from 'lucide-react'
import { useDb } from '../../data/store'
import { evaluateMission, isGlobalScope, liveMissions, missionScope } from '../../domain/loyalty'
import { formatDate, formatInt, formatMoney, MISSION_TYPE_LABELS } from '../../lib/format'
import { useUser } from '../../session'
import { Badge, Card, Empty, PageHeader, ProgressRing } from '../../components/ui'
import type { Mission } from '../../types/domain'

const prize = ({ rewardPoints, rewardStatus, rewardSpins }: Pick<Mission, 'rewardPoints' | 'rewardStatus' | 'rewardSpins'>) =>
  [
    rewardPoints > 0 && `+${formatInt(rewardPoints)} pts`,
    rewardStatus > 0 && `+${formatInt(rewardStatus)} nivel`,
    rewardSpins > 0 && (rewardSpins === 1 ? '1 giro' : `${rewardSpins} giros`),
  ]
    .filter(Boolean)
    .join(' · ')

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
      <PageHeader title="Misiones" subtitle="Cumple el reto, el premio llega solo" />

      {active.length === 0 && done.length === 0 && <Empty>Pronto habrá misiones</Empty>}

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
              <div className="mission-strip">
                <span className="mission-reward">
                  <Gift size={14} aria-hidden /> {prize(mission)}
                </span>
                <span className="mission-meta">
                  {scope && (
                    <span>
                      <MapPin size={13} aria-hidden /> {scope}
                    </span>
                  )}
                  <span>
                    <CalendarClock size={13} aria-hidden /> {formatDate(mission.endsAt)}
                  </span>
                </span>
              </div>
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
                      <div className="muted small">{formatDate(completedAt!)}</div>
                    </div>
                  </div>
                  <span className="small">{prize(mission)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  )
}
