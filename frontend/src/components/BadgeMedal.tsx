import type { CSSProperties, ReactNode } from 'react'
import { CalendarHeart, Crown, ShoppingBag, Store, Tag, Target, Ticket, type LucideIcon } from 'lucide-react'
import type { BadgeType } from '../types/domain'

type MedalKind = BadgeType | 'EVENT'

const ICONS: Record<MedalKind, LucideIcon> = {
  EVENT: Ticket,
  SPECIAL_DATE: CalendarHeart,
  TIER_REACHED: Crown,
  PURCHASE_COUNT: ShoppingBag,
  CATEGORY_PURCHASES: Tag,
  DISTINCT_BUSINESSES: Store,
  MISSIONS_COMPLETED: Target,
}

/** Metal of the coin: levels are silver, events and special dates copper, the rest gold. */
const METAL: Record<MedalKind, 'gold' | 'silver' | 'copper'> = {
  EVENT: 'copper',
  SPECIAL_DATE: 'copper',
  TIER_REACHED: 'silver',
  PURCHASE_COUNT: 'gold',
  CATEGORY_PURCHASES: 'gold',
  DISTINCT_BUSINESSES: 'gold',
  MISSIONS_COMPLETED: 'gold',
}

export function Medallion({ kind, earned, size = 64 }: { kind: MedalKind; earned: boolean; size?: number }) {
  const Icon = ICONS[kind]
  return (
    <span className={`medallion medallion-${earned ? METAL[kind] : 'locked'}`} style={{ '--size': `${size}px` } as CSSProperties} aria-hidden>
      <span className="medallion-coin">
        <Icon size={Math.round(size * 0.34)} />
      </span>
    </span>
  )
}

export function BadgeMedal({
  kind,
  name,
  description,
  earned,
  footer,
}: {
  kind: MedalKind
  name: string
  description: string | null
  earned: boolean
  footer: ReactNode
}) {
  return (
    <div className={`medal ${earned ? 'medal-on' : ''}`}>
      <Medallion kind={kind} earned={earned} size={68} />
      <strong>{name}</strong>
      {description && <span className="small">{description}</span>}
      <span className="small medal-foot">{footer}</span>
    </div>
  )
}
