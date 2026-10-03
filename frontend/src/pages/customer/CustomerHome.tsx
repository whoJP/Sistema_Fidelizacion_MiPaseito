import { useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Clock, Flame, Gift, MapPin, ScanLine, Sparkles, Store, Ticket, Trophy } from 'lucide-react'
import { useDb } from '../../data/store'
import { promotionReason, spinAvailability, statusRanking } from '../../domain/engagement'
import {
  activePromotions,
  activeTiers,
  attendedEventIds,
  badgeHint,
  earnedBadges,
  evaluateMission,
  getSetting,
  isGlobalScope,
  liveMissions,
  nextTier,
  pendingBadges,
  personalPromotions,
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
import { localHour } from '../../domain/time'
import { useUser } from '../../session'
import type { Database, Promotion, Tier } from '../../types/domain'
import { ClubGem } from '../../components/BrandMark'
import { Medallion } from '../../components/BadgeMedal'
import { EventCard } from '../../components/EventCard'
import { MemberCard } from '../../components/MemberCard'
import { TierChip, TierIcon } from '../../components/TierIcon'
import { Notices } from '../../components/Notices'
import { BirthdayCard, KycBanner } from '../../components/BirthdayCard'
import { VisitCard } from '../../components/VisitCard'
import { CountUp, Empty, MoreLink, PageHeader, Progress, ProgressRing, prefersReducedMotion } from '../../components/ui'

function greeting() {
  const hour = localHour(new Date().toISOString())
  return hour >= 5 && hour < 12 ? 'Buenos días' : hour >= 12 && hour < 19 ? 'Buenas tardes' : 'Buenas noches'
}

function SectionHead({ title, to, label }: { title: string; to?: string; label?: string }) {
  return (
    <div className="section-head">
      <h2>{title}</h2>
      {to && label && <MoreLink to={to}>{label}</MoreLink>}
    </div>
  )
}

function LevelPanel({
  tiers,
  tier,
  next,
  status,
  statusPerBs,
}: {
  tiers: Tier[]
  tier: Tier | null
  next: Tier | null
  status: number
  statusPerBs: number
}) {
  const missingBs = next && statusPerBs > 0 ? Math.ceil((next.minimumStatus - status) / statusPerBs) : null
  const index = tier ? tiers.findIndex((t) => t.id === tier.id) : -1
  const floor = tier?.minimumStatus ?? 0
  const step = next ? (status - floor) / Math.max(1, next.minimumStatus - floor) : 0
  const fill = tiers.length > 1 ? Math.min(1, Math.max(0, (Math.max(0, index) + step) / (tiers.length - 1))) : 1

  return (
    <section className="level" aria-label="Tu nivel">
      <div className="level-head">
        <TierChip tier={tier} />
        <h2>{next ? `Camino a ${next.name}` : 'Nivel máximo'}</h2>
        {next && (
          <p>
            Faltan <b className="tabular">{formatInt(next.minimumStatus - status)}</b> pts de nivel
            {missingBs !== null && (
              <>
                {' '}
                · ≈ <b className="tabular">{formatMoney(missingBs)}</b>
              </>
            )}
          </p>
        )}
      </div>

      <ol className="level-track" style={{ '--n': tiers.length, '--fill': fill } as CSSProperties}>
        {tiers.map((t, i) => (
          <li
            key={t.id}
            className={`level-step ${i <= index ? 'is-reached' : ''} ${i === index ? 'is-current' : ''}`}
            style={{ '--i': i } as CSSProperties}
          >
            <TierIcon tier={t} size={i === index ? 48 : 40} className="level-gem" />
            <span className="level-name">{t.name}</span>
            <span className="level-min tabular">{formatInt(t.minimumStatus)}</span>
          </li>
        ))}
      </ol>

      <div className="level-perks">
        <span className="level-perk">
          <Sparkles size={16} aria-hidden /> Tus compras <b>×{formatNumber(tier?.pointsMultiplier ?? 1)}</b>
        </span>
        {next && next.pointsMultiplier > (tier?.pointsMultiplier ?? 1) && (
          <span className="level-perk level-perk-next">
            {next.name} <b>×{formatNumber(next.pointsMultiplier)}</b>
          </span>
        )}
      </div>
    </section>
  )
}

function PromoTicket({ db, promo, userId, reason }: { db: Database; promo: Promotion; userId: number; reason?: string }) {
  const scope = promotionScope(db, promo.id)
  const global = isGlobalScope(scope)
  const places = scopeBusinesses(db, scope)
  const categories = scope.categoryIds.flatMap((id) => db.categories.find((c) => c.id === id)?.name ?? [])
  const multiplier = promo.type === 'POINTS_MULTIPLIER'
  const quote = places[0] ? quotePurchase(db, userId, places[0].id, 100) : null
  const bonus = quote?.promotionBonuses.find((b) => b.promotion.id === promo.id)?.points ?? 0
  const where = global ? 'Todo el Paseo' : categories.length > 0 ? categories.join(' y ') : places.length === 1 ? 'Solo en' : 'En estos locales'

  return (
    <article className="promo">
      <div className="promo-stub">
        <span className="promo-big">{multiplier ? `×${formatNumber(promo.value)}` : `+${formatInt(promo.value)}`}</span>
        <span className="promo-unit">{multiplier ? 'puntos' : 'puntos extra'}</span>
      </div>
      <div className="promo-body">
        {reason && <span className="promo-reason">{reason}</span>}
        <h3>{promo.name}</h3>
        {quote && bonus > 0 && (
          <div className="promo-eq">
            <span>{formatMoney(100)}</span>
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
                <Link key={b.id} to={`/app/directory/${b.id}`} className="place" aria-label={b.name} title={b.name}>
                  <span className="place-logo">{b.logoUrl ? <img src={b.logoUrl} alt="" /> : b.name.charAt(0)}</span>
                  <span className="place-text">
                    {b.name}
                    {b.floor && <small>{floorLabel(b.floor)}</small>}
                  </span>
                </Link>
              ))}
              {places.length > 3 && <span className="place-more">+{formatInt(places.length - 3)}</span>}
            </div>
          )}
        </div>
        <div className={`promo-foot ${daysUntil(promo.endsAt) <= 3 ? 'is-urgent' : ''}`}>
          <Clock size={14} aria-hidden /> {formatDayMonth(promo.endsAt)}
          {promo.singleUse && ' · 1 compra'}
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
  const forYou = personalPromotions(db, user.id).filter((p) => p.origin !== 'VISIT_CARD')
  const spins = spinAvailability(db, user.id)
  const spinReady = (!spins.dailyUsed && spins.canAffordDaily) || spins.extraUnlock !== null || spins.freeAvailable > 0
  const myRank = statusRanking(db).find((r) => r.user.id === user.id)
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
      <PageHeader title={`${greeting()}, ${user.firstName}`} />
      <Notices />
      <KycBanner db={db} userId={user.id} />
      <BirthdayCard db={db} user={user} />

      <div className="home-hero">
        <MemberCard ref={cardRef} user={user} tier={tier} points={points} revealed={revealed} onToggle={() => setRevealed((v) => !v)} />
        <LevelPanel tiers={tiers} tier={tier} next={next} status={status} statusPerBs={getSetting(db, 'STATUS_BASE_RATE')} />
      </div>

      <nav className="shortcuts" aria-label="Accesos rápidos">
        <Link to="/app/spin" className={`shortcut ${spinReady ? 'is-ready' : ''}`}>
          <span className="shortcut-icon" aria-hidden>
            <ClubGem size={24} />
          </span>
          <span>Ruleta</span>
          {spinReady && <span className="shortcut-flag">{spins.freeAvailable > 0 || spins.extraUnlock ? 'Gratis' : 'Listo'}</span>}
        </Link>
        <Link to="/app/scan" className="shortcut">
          <span className="shortcut-icon" aria-hidden>
            <ScanLine size={22} />
          </span>
          <span>Espacios</span>
        </Link>
        <Link to="/app/ranking" className="shortcut">
          <span className="shortcut-icon" aria-hidden>
            <Trophy size={22} />
          </span>
          <span>Ranking</span>
          {myRank && <span className="shortcut-flag is-quiet">#{myRank.position}</span>}
        </Link>
        <Link to="/app/directory" className="shortcut">
          <span className="shortcut-icon" aria-hidden>
            <Store size={22} />
          </span>
          <span>Locales</span>
        </Link>
      </nav>

      <VisitCard db={db} userId={user.id} />

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
            {streak.activeThisWeek ? `Récord: ${formatInt(streak.best)}` : streak.current > 0 ? 'Compra esta semana' : 'Empieza esta semana'}
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
            <span>{pending.length > 0 ? (pending.length === 1 ? 'canje listo' : 'canjes listos') : 'a tu alcance'}</span>
          </span>
          {featured && (
            <span className="ticket">
              <Ticket size={16} aria-hidden />
              <span className="ticket-text">
                <b>{rewardTitle(db, featured)}</b>
                <small>
                  {firstPending
                    ? featuredPlace?.name
                    : featured === bestReward
                      ? `${formatInt(featured.pointsCost)} pts`
                      : `Faltan ${formatInt(featured.pointsCost - points)} pts`}
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
            <span>{badges.length === 1 ? 'insignia' : 'insignias'}</span>
          </span>
          {nextBadge ? (
            <span className="tile-next">
              <b>{nextBadge.badge.name}</b>
              <small>{badgeHint(db, nextBadge.badge, nextBadge.current, nextBadge.goal)}</small>
              {nextBadge.badge.type !== 'SPECIAL_DATE' && <Progress value={nextBadge.current} max={nextBadge.goal} />}
            </span>
          ) : (
            <span className="tile-note">Colección completa</span>
          )}
        </Link>
      </div>

      {forYou.length > 0 && (
        <section className="home-section">
          <SectionHead title="Para ti" />
          <div className="promos">
            {forYou.map((p) => (
              <PromoTicket key={p.id} db={db} promo={p} userId={user.id} reason={promotionReason(p)} />
            ))}
          </div>
        </section>
      )}

      {promotions.length > 0 && (
        <section className="home-section">
          <SectionHead title="Promociones" />
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
            <SectionHead title="Eventos" to="/app/badges" label="Ver todos" />
            <div className="events">
              {events.map((e) => (
                <EventCard key={e.id} event={e} onShowCode={showCode} />
              ))}
            </div>
          </section>
        )}

        <section className="home-section">
          <SectionHead title="Misiones" to="/app/missions" label="Ver todas" />
          {missions.length === 0 ? (
            <Empty>Sin misiones pendientes</Empty>
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
        <SectionHead title="Insignias" to="/app/badges" label="Ver todas" />
        {badges.length === 0 ? (
          <Empty>Tu primera insignia te espera</Empty>
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
