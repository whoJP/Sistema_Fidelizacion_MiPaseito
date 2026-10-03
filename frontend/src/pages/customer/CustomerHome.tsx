import { useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Clock, Flame, Gift, MapPin, Sparkles, Ticket } from 'lucide-react'
import { useDb } from '../../data/store'
import {
  activePromotions,
  activeTiers,
  attendedEventIds,
  badgeHint,
  earnedBadges,
  evaluateMission,
  isGlobalScope,
  liveMissions,
  nextTier,
  pendingBadges,
  pointsBalance,
  promotionScope,
  quotePurchase,
  recentWeeks,
  rewardBlocker,
  rewardTitle,
  scopeBusinesses,
  statusTotal,
  tierForStatus,
  upcomingEvents,
  visibleRewards,
  weeklyStreak,
} from '../../domain/loyalty'
import {
  daysUntil,
  floorLabel,
  formatDayMonth,
  formatDaysLeft,
  formatInt,
  formatMoney,
  formatNumber,
} from '../../lib/format'
import { useUser } from '../../session'
import type { Database, Promotion, Tier } from '../../types/domain'
import { ClubGem } from '../../components/BrandMark'
import { Medallion } from '../../components/BadgeMedal'
import { EventCard } from '../../components/EventCard'
import { MemberCard } from '../../components/MemberCard'
import { Notices } from '../../components/Notices'
import { CountUp, Empty, MoreLink, PageHeader, Progress, ProgressRing, prefersReducedMotion } from '../../components/ui'

const tierClass = (name: string) => name.toLowerCase()

function SectionHead({ title, to, label }: { title: string; to?: string; label?: string }) {
  return (
    <div className="section-head">
      <h2>{title}</h2>
      {to && label && <MoreLink to={to}>{label}</MoreLink>}
    </div>
  )
}

function LevelPanel({ tiers, tier, next, status }: { tiers: Tier[]; tier: Tier | null; next: Tier | null; status: number }) {
  const index = tier ? tiers.findIndex((t) => t.id === tier.id) : -1
  const floor = tier?.minimumStatus ?? 0
  const step = next ? (status - floor) / Math.max(1, next.minimumStatus - floor) : 0
  const fill = tiers.length > 1 ? Math.min(1, Math.max(0, (Math.max(0, index) + step) / (tiers.length - 1))) : 1

  return (
    <section className="level" aria-label="Tu nivel">
      <div className="level-head">
        <span className={`tier-chip tier-${tierClass(tier?.name ?? 'none')}`}>{tier?.name ?? 'Sin nivel'}</span>
        <h2>{next ? `Camino a ${next.name}` : 'Estás en el nivel más alto'}</h2>
        <p>
          {next ? (
            <>
              Te faltan <b className="tabular">{formatInt(next.minimumStatus - status)}</b> puntos de nivel. Se ganan con cada compra y no se
              gastan al canjear.
            </>
          ) : (
            'Tus compras rinden con el multiplicador más alto del programa.'
          )}
        </p>
      </div>

      <ol className="level-track" style={{ '--n': tiers.length, '--fill': fill } as CSSProperties}>
        {tiers.map((t, i) => (
          <li
            key={t.id}
            className={`level-step level-${tierClass(t.name)} ${i <= index ? 'is-reached' : ''} ${i === index ? 'is-current' : ''}`}
            style={{ '--i': i } as CSSProperties}
          >
            <span className="level-gem">
              <ClubGem size={16} />
            </span>
            <span className="level-name">{t.name}</span>
            <span className="level-min tabular">{formatInt(t.minimumStatus)}</span>
          </li>
        ))}
      </ol>

      <div className="level-perks">
        <span className="level-perk">
          <Sparkles size={16} aria-hidden /> Hoy tus compras rinden <b>×{formatNumber(tier?.pointsMultiplier ?? 1)}</b>
        </span>
        {next && next.pointsMultiplier > (tier?.pointsMultiplier ?? 1) && (
          <span className="level-perk level-perk-next">
            En {next.name} rinden <b>×{formatNumber(next.pointsMultiplier)}</b>
          </span>
        )}
      </div>
    </section>
  )
}

function multiplierCopy(value: number): string {
  if (value === 2) return 'Tus compras suman el doble de puntos.'
  if (value === 3) return 'Tus compras suman el triple de puntos.'
  return `Tus compras suman un ${formatInt(Math.round((value - 1) * 100))}% más de puntos.`
}

function PromoTicket({ db, promo, userId }: { db: Database; promo: Promotion; userId: number }) {
  const scope = promotionScope(db, promo.id)
  const global = isGlobalScope(scope)
  const places = scopeBusinesses(db, scope)
  const categories = scope.categoryIds.flatMap((id) => db.categories.find((c) => c.id === id)?.name ?? [])
  const multiplier = promo.type === 'POINTS_MULTIPLIER'
  const quote = places[0] ? quotePurchase(db, userId, places[0].id, 100) : null
  const bonus = quote?.promotionBonuses.find((b) => b.promotion.id === promo.id)?.points ?? 0
  const where = global
    ? 'En todos los locales del Paseo'
    : categories.length > 0
      ? `En ${categories.join(' y ').toLowerCase()}`
      : places.length === 1
        ? 'Solo en'
        : 'En estos locales'

  return (
    <article className="promo">
      <div className="promo-stub">
        <span className="promo-big">{multiplier ? `×${formatNumber(promo.value)}` : `+${formatInt(promo.value)}`}</span>
        <span className="promo-unit">{multiplier ? 'puntos' : 'puntos extra'}</span>
      </div>
      <div className="promo-body">
        <h3>{promo.name}</h3>
        <p className="promo-what">{multiplier ? multiplierCopy(promo.value) : `Sumas ${formatInt(promo.value)} puntos extra en cada compra.`}</p>
        {quote && bonus > 0 && (
          <div className="promo-eq">
            <span>Compra de {formatMoney(100)}</span>
            <ArrowRight size={14} aria-hidden />
            <b>{formatInt(quote.basePoints + bonus)} puntos</b>
            <s aria-label={`en lugar de ${formatInt(quote.basePoints)}`}>{formatInt(quote.basePoints)}</s>
          </div>
        )}
        <div className="promo-where">
          <span className="promo-where-label">
            <MapPin size={15} aria-hidden /> {where}
          </span>
          {!global && places.length > 0 && (
            <div className="promo-places">
              {places.slice(0, 3).map((b) => (
                <Link key={b.id} to={`/app/directory/${b.id}`} className="place">
                  <span className="place-logo">{b.logoUrl ? <img src={b.logoUrl} alt="" /> : b.name.charAt(0)}</span>
                  <span className="place-text">
                    {b.name}
                    {b.floor && <small>{floorLabel(b.floor)}</small>}
                  </span>
                </Link>
              ))}
              {places.length > 3 && <span className="place-more">y {formatInt(places.length - 3)} más</span>}
            </div>
          )}
        </div>
        <div className={`promo-foot ${daysUntil(promo.endsAt) <= 3 ? 'is-urgent' : ''}`}>
          <Clock size={14} aria-hidden /> Hasta el {formatDayMonth(promo.endsAt)}
          <span>{formatDaysLeft(promo.endsAt)}</span>
        </div>
      </div>
    </article>
  )
}

export function CustomerHome() {
  const db = useDb()
  const user = useUser()
  const [revealed, setRevealed] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const showCode = () => {
    setRevealed(true)
    cardRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' })
  }

  const points = pointsBalance(db, user.id)
  const status = statusTotal(db, user.id)
  const tier = tierForStatus(db, status)
  const next = nextTier(db, status)
  const tiers = activeTiers(db)

  const streak = weeklyStreak(db, user.id)
  const weeks = recentWeeks(db, user.id, 8)

  const pending = db.redemptions.filter((r) => r.userId === user.id && r.status === 'PENDING')
  const firstPending = pending[0] ? db.rewards.find((r) => r.id === pending[0].rewardId) : undefined
  const rewards = visibleRewards(db).sort((a, b) => a.pointsCost - b.pointsCost)
  const affordable = rewards.filter((r) => rewardBlocker(db, r, user.id) === null)
  const bestReward = affordable[affordable.length - 1]
  const nextReward = rewards.find((r) => rewardBlocker(db, r, user.id) === 'POINTS')
  const featured = firstPending ?? bestReward ?? nextReward
  const featuredPlace = featured && db.businesses.find((b) => b.id === featured.businessId)

  const badges = earnedBadges(db, user.id)
  const nextBadge = pendingBadges(db, user.id)[0]

  const promotions = activePromotions(db)
  const missions = liveMissions(db)
    .map((m) => {
      const row = db.missionProgress.find((p) => p.missionId === m.id && p.userId === user.id)
      return { mission: m, progress: row?.completedAt ? m.goal : evaluateMission(db, m, user.id), done: !!row?.completedAt }
    })
    .filter((m) => !m.done)
    .sort((a, b) => b.progress / b.mission.goal - a.progress / a.mission.goal)
    .slice(0, 3)
  const attended = attendedEventIds(db, user.id)
  const events = upcomingEvents(db)
    .filter((e) => !attended.has(e.id))
    .slice(0, 3)

  return (
    <div className="page home">
      <PageHeader title={`Hola, ${user.firstName}`} subtitle="Tu tarjeta, tus beneficios y lo que pasa hoy en el Paseo." />
      <Notices />

      <div className="home-hero">
        <MemberCard ref={cardRef} user={user} tierName={tier?.name ?? null} points={points} revealed={revealed} onToggle={() => setRevealed((v) => !v)} />
        <LevelPanel tiers={tiers} tier={tier} next={next} status={status} />
      </div>

      <div className="tiles">
        <Link to="/app/activity" className={`tile tile-streak ${streak.activeThisWeek ? 'is-safe' : 'is-at-risk'}`}>
          <span className="tile-go" aria-hidden>
            <ArrowUpRight size={16} />
          </span>
          <span className="tile-icon flame" aria-hidden>
            <Flame size={22} />
          </span>
          <span className="tile-figure">
            <strong>
              <CountUp value={streak.current} />
            </strong>
            <span>{streak.current === 1 ? 'semana seguida' : 'semanas seguidas'}</span>
          </span>
          <ol className="weeks" aria-label={`Compraste en ${weeks.filter((w) => w.active).length} de las últimas ${weeks.length} semanas`}>
            {weeks.map((w, i) => (
              <li key={w.key} className={`${w.active ? 'on' : ''} ${i === weeks.length - 1 ? 'now' : ''}`} style={{ '--i': i } as CSSProperties} />
            ))}
          </ol>
          <span className="tile-note">
            {streak.activeThisWeek
              ? `Esta semana ya cuenta. Tu mejor racha: ${formatInt(streak.best)}.`
              : streak.current > 0
                ? 'Compra esta semana para no perderla.'
                : 'Compra esta semana y empieza tu racha.'}
          </span>
        </Link>

        <Link to="/app/rewards" className={`tile tile-redeem ${pending.length > 0 ? 'has-pending' : ''}`}>
          <span className="tile-go" aria-hidden>
            <ArrowUpRight size={16} />
          </span>
          <span className="tile-icon" aria-hidden>
            <Gift size={22} />
          </span>
          <span className="tile-figure">
            <strong>
              <CountUp value={pending.length > 0 ? pending.length : affordable.length} />
            </strong>
            <span>
              {pending.length > 0
                ? pending.length === 1
                  ? 'canje listo para usar'
                  : 'canjes listos para usar'
                : affordable.length === 1
                  ? 'recompensa a tu alcance'
                  : 'recompensas a tu alcance'}
            </span>
          </span>
          {featured && (
            <span className="ticket">
              <Ticket size={16} aria-hidden />
              <span className="ticket-text">
                <b>{rewardTitle(db, featured)}</b>
                <small>
                  {featuredPlace?.name}
                  {firstPending
                    ? ', muestra tu QR en caja'
                    : featured === bestReward
                      ? `, ${formatInt(featured.pointsCost)} puntos`
                      : `, te faltan ${formatInt(featured.pointsCost - points)} puntos`}
                </small>
              </span>
            </span>
          )}
        </Link>

        <Link to="/app/badges" className="tile tile-badges">
          <span className="tile-go" aria-hidden>
            <ArrowUpRight size={16} />
          </span>
          <span className="medal-stack" aria-hidden>
            {badges.length === 0 ? (
              <Medallion kind="PURCHASE_COUNT" earned={false} size={40} />
            ) : (
              badges.slice(0, 3).map((b) => <Medallion key={b.key} kind={b.kind} earned size={40} />)
            )}
          </span>
          <span className="tile-figure">
            <strong>
              <CountUp value={badges.length} />
            </strong>
            <span>{badges.length === 1 ? 'insignia ganada' : 'insignias ganadas'}</span>
          </span>
          {nextBadge ? (
            <span className="tile-next">
              <span>
                Próxima: <b>{nextBadge.badge.name}</b>
              </span>
              <small>{badgeHint(db, nextBadge.badge, nextBadge.current, nextBadge.goal)}</small>
              {nextBadge.badge.type !== 'SPECIAL_DATE' && <Progress value={nextBadge.current} max={nextBadge.goal} />}
            </span>
          ) : (
            <span className="tile-note">Tienes todas las insignias disponibles.</span>
          )}
        </Link>
      </div>

      {promotions.length > 0 && (
        <section className="home-section">
          <SectionHead title="Promociones activas" />
          <div className="promos">
            {promotions.map((p) => (
              <PromoTicket key={p.id} db={db} promo={p} userId={user.id} />
            ))}
          </div>
        </section>
      )}

      <div className={`home-split ${events.length === 0 ? 'is-single' : ''}`}>
        {events.length > 0 && (
          <section className="home-section">
            <SectionHead title="Próximos eventos" to="/app/badges" label="Ver todos" />
            <div className="events">
              {events.map((e) => (
                <EventCard key={e.id} event={e} onShowCode={showCode} />
              ))}
            </div>
          </section>
        )}

        <section className="home-section">
          <SectionHead title="Misiones en curso" to="/app/missions" label="Ver todas" />
          {missions.length === 0 ? (
            <Empty>No tienes misiones pendientes.</Empty>
          ) : (
            <ul className="mission-list">
              {missions.map(({ mission, progress }) => (
                <li key={mission.id}>
                  <Link to="/app/missions" className="mission-row">
                    <ProgressRing value={progress} max={mission.goal} size={54} />
                    <span className="mission-row-text">
                      <strong>{mission.name}</strong>
                      <span className="tabular">
                        {mission.type === 'TOTAL_PURCHASE_AMOUNT'
                          ? `${formatMoney(progress)} de ${formatMoney(mission.goal)}`
                          : `${formatInt(progress)} de ${formatInt(mission.goal)}`}
                      </span>
                    </span>
                    {mission.rewardPoints > 0 && (
                      <span className="mission-prize">
                        +{formatInt(mission.rewardPoints)}
                        <small>puntos</small>
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="home-section">
        <SectionHead title="Mis insignias" to="/app/badges" label="Ver colección" />
        {badges.length === 0 ? (
          <Empty>Compra, asiste a eventos y completa misiones para ganar tus primeras insignias.</Empty>
        ) : (
          <ul className="shelf">
            {badges.slice(0, 8).map((b, i) => (
              <li key={b.key} className="shelf-item" style={{ '--i': i } as CSSProperties} title={b.description ?? undefined}>
                <Medallion kind={b.kind} earned size={76} />
                <strong>{b.name}</strong>
                <span>{formatDayMonth(b.earnedAt)}</span>
              </li>
            ))}
            {badges.length > 8 && (
              <li className="shelf-item shelf-more">
                <Link to="/app/badges">
                  <span className="shelf-more-count">+{formatInt(badges.length - 8)}</span>
                  <strong>Ver todas</strong>
                </Link>
              </li>
            )}
          </ul>
        )}
      </section>
    </div>
  )
}
