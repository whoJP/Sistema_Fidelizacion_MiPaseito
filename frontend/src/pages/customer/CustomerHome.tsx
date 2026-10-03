import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Award, CalendarDays, Copy, RefreshCw, Sparkles, Target } from 'lucide-react'
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
import { formatDate, formatDateTime, formatInt, formatMoney } from '../../lib/format'
import { useUser } from '../../session'
import { Badge, Card, CardHead, MoreLink, PageHeader, Progress, Stat, notify } from '../../components/ui'

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
    <Card className="qr-card card-gold">
      <h2>Tu código de cliente</h2>
      <p className="muted small">Muéstralo al pagar o al ingresar a un evento para sumar puntos.</p>
      <div className="qr-box">
        {qr ? (
          <QRCodeSVG value={qr.token} size={176} level="M" bgColor="#f3eee0" fgColor="#010102" />
        ) : (
          <span className="muted small">Generando…</span>
        )}
      </div>
      {qr && (
        <>
          <code className="token" title={qr.token}>
            {qr.token}
          </code>
          <div className="qr-meta">
            <span>
              Se renueva en <span className="qr-timer">{mm}:{ss}</span>
            </span>
            <button className="btn btn-ghost btn-sm" onClick={renew}>
              <RefreshCw size={14} aria-hidden /> Renovar
            </button>
          </div>
          <button className="btn btn-sm" onClick={() => navigator.clipboard?.writeText(qr.token).then(() => notify('success', 'Código copiado'))}>
            <Copy size={14} aria-hidden /> Copiar código
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
                <strong className="wallet-points">
                  {formatInt(points)}
                  <span className="wallet-unit">puntos</span>
                </strong>
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
                    Te faltan <b>{formatInt(next.minimumStatus - status)}</b> para {next.name}
                  </span>
                ) : (
                  <span>Nivel máximo alcanzado</span>
                )}
              </div>
              <Progress
                value={status - (tier?.minimumStatus ?? 0)}
                max={next ? next.minimumStatus - (tier?.minimumStatus ?? 0) : 1}
              />
              {tier && tier.pointsMultiplier !== 1 && <span className="small">Tu nivel multiplica tus puntos ×{tier.pointsMultiplier}</span>}
            </div>
          </Card>

          <div className="stats-row">
            <Stat
              label="Racha semanal"
              value={`${streak.current} ${streak.current === 1 ? 'semana' : 'semanas'}`}
              hint={streak.activeThisWeek ? `Esta semana ya cuenta. Mejor racha: ${streak.best}` : `Compra esta semana para mantenerla. Mejor: ${streak.best}`}
            />
            <Stat label="Canjes pendientes" value={pending.length} hint={<MoreLink to="/app/rewards">Ver recompensas</MoreLink>} />
            <Stat label="Insignias" value={badges.length} hint={<MoreLink to="/app/profile">Ver perfil</MoreLink>} />
          </div>
        </div>

        <CustomerQr />
      </div>

      <div className="bento">
        {promotions.length > 0 && (
          <Card className="span-7">
            <CardHead icon={Sparkles} title="Promociones activas" />
            <ul className="list">
              {promotions.map((p) => {
                const scope = promotionScope(db, p.id)
                const where = isGlobalScope(scope)
                  ? 'Todo el Paseo'
                  : scopeBusinesses(db, scope)
                      .map((b) => b.name)
                      .join(', ')
                return (
                  <li key={p.id} className="list-row">
                    <div>
                      <strong>{p.name}</strong>
                      <div className="muted small">
                        {where} · hasta {formatDate(p.endsAt)}
                      </div>
                    </div>
                    <Badge tone="accent">{p.type === 'POINTS_MULTIPLIER' ? `Puntos ×${p.value}` : `+${formatInt(p.value)} puntos`}</Badge>
                  </li>
                )
              })}
            </ul>
          </Card>
        )}

        <Card className={promotions.length > 0 ? 'span-5' : 'span-7'}>
          <CardHead icon={Target} title="Misiones en curso" action={<MoreLink to="/app/missions">Ver todas</MoreLink>} />
          {missions.length === 0 ? (
            <p className="muted">No tienes misiones pendientes.</p>
          ) : (
            <ul className="list">
              {missions.map(({ mission, progress }) => (
                <li key={mission.id} className="mission-mini">
                  <div className="row between">
                    <strong>{mission.name}</strong>
                    <span className="small muted tabular">
                      {mission.type === 'TOTAL_PURCHASE_AMOUNT'
                        ? `${formatMoney(progress)} de ${formatMoney(mission.goal)}`
                        : `${formatInt(progress)} de ${formatInt(mission.goal)}`}
                    </span>
                  </div>
                  <Progress value={progress} max={mission.goal} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        {events.length > 0 && (
          <Card className={promotions.length > 0 ? 'span-7' : 'span-5'}>
            <CardHead icon={CalendarDays} title="Próximos eventos" action={<MoreLink to="/app/profile">Ver todos</MoreLink>} />
            <ul className="list">
              {events.map((e) => (
                <li key={e.id} className="list-row">
                  <div>
                    <strong>{e.name}</strong> {isEventOpen(e) && <Badge tone="success">En curso</Badge>}
                    <div className="muted small">
                      {formatDateTime(e.startsAt)}
                      {e.location ? ` · ${e.location}` : ''}
                    </div>
                  </div>
                  <Badge tone="accent">{e.pointsReward > 0 ? `+${formatInt(e.pointsReward)} puntos + insignia` : 'Insignia'}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card className={events.length > 0 && promotions.length > 0 ? 'span-5' : events.length > 0 || promotions.length > 0 ? 'span-12' : 'span-5'}>
          <CardHead icon={Award} title="Mis insignias" action={<MoreLink to="/app/profile">Ver perfil</MoreLink>} />
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
      </div>
    </div>
  )
}
