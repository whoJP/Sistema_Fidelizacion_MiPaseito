import type { ReactNode } from 'react'
import { CalendarHeart, Crown, ShoppingBag, Store, Tag, Target, Ticket, type LucideIcon } from 'lucide-react'
import type { BadgeType } from '../types/domain'

const ICONS: Record<BadgeType | 'EVENT', LucideIcon> = {
  EVENT: Ticket,
  SPECIAL_DATE: CalendarHeart,
  TIER_REACHED: Crown,
  PURCHASE_COUNT: ShoppingBag,
  CATEGORY_PURCHASES: Tag,
  DISTINCT_BUSINESSES: Store,
  MISSIONS_COMPLETED: Target,
}

export function BadgeMedal({
  kind,
  name,
  description,
  earned,
  footer,
}: {
  kind: BadgeType | 'EVENT'
  name: string
  description: string | null
  earned: boolean
  footer: ReactNode
}) {
  const Icon = ICONS[kind]
  return (
    <div className={`medal ${earned ? 'medal-on' : ''}`}>
      <span className="medal-icon" aria-hidden>
        <Icon size={22} />
      </span>
      <strong>{name}</strong>
      {description && <span className="small">{description}</span>}
      <span className="small medal-foot">{footer}</span>
    </div>
  )
}
