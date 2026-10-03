import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { Award, CalendarDays, Flame, Gift, RefreshCw, Sparkles, Target } from 'lucide-react'
import { api } from '../../data/api'
import { useDb } from '../../data/store'
import {
  activePromotions,
  attendedEventIds,
  earnedBadges,
  evaluateMission,
  isEventOpen,
  liveMissions,
  upcomingEvents,
  nextTier,
  pointsBalance,
  promotionScope,
  scopeBusinesses,
  isGlobalScope,
  statusTotal,
  tierForStatus,
  weeklyStreak,
} from '../../domain/loyalty'
import { formatDate, formatDateTime, formatInt } from '../../lib/format'
import { useUser } from '../../session'
import { Badge, Card, PageHeader, Progress, notify } from '../../components/ui'

/** Personal QR signed by the server; it expires after a few minutes and renews itself. */
function CustomerQr() {
  const [qr, setQr] = useState<{ token: string; expiresAt: number } | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const renew = () =>
    api
      .qrToken()
      .then(({ token, expiresAt }) => setQr({ token, expiresAt: Date.parse(expiresAt) }))
      .catch(() => notify('error', 'No se pudo generar tu código, reintenta'))

  useEffect(() => {
    void renew()
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const remaining = qr ? Math.max(0, qr.expiresAt - now) : 0
  useEffect(() => {
    if (qr && remaining === 0) void renew()
  }, [qr, remaining])

  const mm = Math.floor(remaining / 60000)
  const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0')

  return (
    <Card className="qr-card">
      <h2>Tu código de cliente</h2>
      <p className="muted small">Muéstralo al pagar o al ingresar a un evento para sumar puntos.</p>
      <div className="qr-box">{qr ? <QRCodeSVG value={qr.token} size={168} level="M" /> : <span className="muted small">Generando…</span>}</div>
      {qr && (
        <>
          <code className="token" title={qr.token}>
            {qr.token}
          </code>
          <div className="row between small muted">
            <span>
              Se renueva en {mm}:{ss}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={renew}>
              <RefreshCw size={14} /> Renovar
            </button>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(qr.token).then(() => notify('success', 'Código copiado'))}>
            Copiar código
          </button>
        </>
      )}
    </Card>
  )
}

export function CustomerHome() {
  const db = useDb()
  const user = useUser()

  const points = pointsBalance(db, user.id)
  const status = statusTotal(db, user.id)
  const tier = tierForStatus(db, status)
  const next = nextTier(db, status)
  const streak = weeklyStreak(db, user.id)
  const promotions = activePromotions(db)
  const missions = liveMissions(db)
    .map((m) => {
      const row = db.missionProgress.find((p) => p.missionId === m.id && p.userId === user.id)
      return { mission: m, progress: row?.completedAt ? m.goal : evaluateMission(db, m, user.id), done: !!row?.completedAt }
    })
    .filter((m) => !m.done)
    .sort((a, b) => b.progress / b.mission.goal - a.progress / a.mission.goal)
    .slice(0, 3)
  const pending = db.redemptions.filter((r) => r.userId === user.id && r.status === 'PENDING')
  const attended = attendedEventIds(db, user.id)
  const events = upcomingEvents(db)
    .filter((e) => !attended.has(e.id))
    .slice(0, 3)
  const badges = earnedBadges(db, user.id)

  return (
    <div className="page">
      <PageHeader title={`Hola, ${user.firstName}`} subtitle="Este es tu resumen en Paseo Points." />

      <div className="home-grid">
        <div className="stack">
          <Card className="wallet">
            <div className="wallet-top">
              <div>
                <span className="wallet-label">Puntos disponibles</span>
                <strong className="wallet-points">{formatInt(points)}</strong>
              </div>
              <span className={`tier-chip tier-${(tier?.name ?? 'none').toLowerCase()}`}>{tier?.name ?? 'Sin nivel'}</span>
            </div>
            <div className="wallet-status">
              <div className="row between">
                <span>
                  Puntos de nivel <b>{formatInt(status)}</b>
                </span>
                {next ? (
                  <span>
                    Te faltan {formatInt(next.minimumStatus - status)} para <b>{next.name}</b>
                  </span>
                ) : (
                  <span>Nivel máximo alcanzado</span>
                )}
              </div>
              <Progress
                value={status - (tier?.minimumStatus ?? 0)}
                max={next ? next.minimumStatus - (tier?.minimumStatus ?? 0) : 1}
              />
              {tier && tier.pointsMultiplier !== 1 && (
                <span className="small">Tu nivel multiplica tus puntos ×{tier.pointsMultiplier}</span>
              )}
            </div>
          </Card>

          <div className="grid-2">
            <Card>
              <div className="row gap">
                <Flame className={streak.activeThisWeek ? 'accent' : 'muted'} />
                <div>
                  <strong className="big">{streak.current} semanas</strong>
                  <div className="muted small">Racha actual · mejor: {streak.best}</div>
                </div>
              </div>
              <p className="small muted">
                {streak.activeThisWeek ? '¡Esta semana ya cuenta!' : 'Compra esta semana para mantener tu racha.'}
              </p>
            </Card>
            <Card>
              <div className="row gap">
                <Gift className="accent" />
                <div>
                  <strong className="big">{pending.length}</strong>
                  <div className="muted small">Canjes pendientes</div>
                </div>
              </div>
              <Link className="small" to="/app/rewards">
                Ver recompensas →
              </Link>
            </Card>
          </div>

          {promotions.length > 0 && (
            <Card>
              <h2 className="row gap">
                <Sparkles size={18} className="accent" /> Promociones activas
              </h2>
              <ul className="list">
                {promotions.map((p) => {
                  const scope = promotionScope(db, p.id)
                  const where = isGlobalScope(scope)
                    ? 'Todo el Paseo'
                    : scopeBusinesses(db, scope).map((b) => b.name).join(', ')
                  return (
                    <li key={p.id} className="list-row">
                      <div>
                        <strong>{p.name}</strong>
                        <div className="muted small">
                          {where} · hasta {formatDate(p.endsAt)}
                        </div>
                      </div>
                      <Badge tone="accent">
                        {p.type === 'POINTS_MULTIPLIER' ? `Puntos ×${p.value}` : `+${formatInt(p.value)} puntos`}
                      </Badge>
                    </li>
                  )
                })}
              </ul>
            </Card>
          )}

          {events.length > 0 && (
            <Card>
              <div className="row between">
                <h2 className="row gap">
                  <CalendarDays size={18} className="accent" /> Próximos eventos
                </h2>
                <Link className="small" to="/app/profile">
                  Ver todos →
                </Link>
              </div>
              <ul className="list">
                {events.map((e) => (
                  <li key={e.id} className="list-row">
                    <div>
                      <strong>{e.name}</strong>{' '}
                      {isEventOpen(e) && <Badge tone="success">En curso</Badge>}
                      <div className="muted small">
                        {formatDateTime(e.startsAt)}
                        {e.location ? ` · ${e.location}` : ''}
                      </div>
                    </div>
                    <Badge tone="accent">
                      {e.pointsReward > 0 ? `+${formatInt(e.pointsReward)} puntos + insignia` : 'Insignia'}
                    </Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <div className="row between">
              <h2 className="row gap">
                <Award size={18} className="accent" /> Mis insignias
              </h2>
              <Link className="small" to="/app/profile">
                Ver perfil →
              </Link>
            </div>
            {badges.length === 0 ? (
              <p className="muted">Compra, asiste a eventos y completa misiones para ganar insignias.</p>
            ) : (
              <div className="chips">
                {badges.slice(0, 6).map((b) => (
                  <span key={b.key} className="chip chip-static">
                    {b.name}
                  </span>
                ))}
                {badges.length > 6 && <span className="muted small">y {badges.length - 6} más</span>}
              </div>
            )}
          </Card>

          <Card>
            <div className="row between">
              <h2 className="row gap">
                <Target size={18} className="accent" /> Misiones en curso
              </h2>
              <Link className="small" to="/app/missions">
                Ver todas →
              </Link>
            </div>
            {missions.length === 0 ? (
              <p className="muted">No tienes misiones pendientes.</p>
            ) : (
              <ul className="list">
                {missions.map(({ mission, progress }) => (
                  <li key={mission.id} className="mission-mini">
                    <div className="row between">
                      <strong>{mission.name}</strong>
                      <span className="small muted">
                        {formatInt(progress)}/{formatInt(mission.goal)}
                      </span>
                    </div>
                    <Progress value={progress} max={mission.goal} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <CustomerQr />
      </div>
    </div>
  )
}
