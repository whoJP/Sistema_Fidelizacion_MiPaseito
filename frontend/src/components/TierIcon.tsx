import type { CSSProperties } from 'react'
import { Award, Crown, Flame, Gem, Heart, Medal, Rocket, Shield, Sparkles, Star, Trophy, Zap, type LucideIcon } from 'lucide-react'
import type { Tier, TierIconKey } from '../types/domain'

export const TIER_ICONS: Record<TierIconKey, { icon: LucideIcon; label: string }> = {
  shield: { icon: Shield, label: 'Escudo' },
  medal: { icon: Medal, label: 'Medalla' },
  award: { icon: Award, label: 'Roseta' },
  star: { icon: Star, label: 'Estrella' },
  crown: { icon: Crown, label: 'Corona' },
  gem: { icon: Gem, label: 'Diamante' },
  trophy: { icon: Trophy, label: 'Trofeo' },
  flame: { icon: Flame, label: 'Llama' },
  zap: { icon: Zap, label: 'Rayo' },
  rocket: { icon: Rocket, label: 'Cohete' },
  heart: { icon: Heart, label: 'Corazón' },
  sparkles: { icon: Sparkles, label: 'Destellos' },
}

type TierLook = Pick<Tier, 'name' | 'icon'>

/** Color class of a level, from its name without accents (`tier-bronce`, `tier-oro`…). Unknown names stay neutral. */
export const tierTone = (name: string) => `tier-${name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()}`

/** Round metallic coin with the level's icon. */
export function TierIcon({ tier, size = 28, className = '' }: { tier: TierLook; size?: number; className?: string }) {
  const Icon = (TIER_ICONS[tier.icon] ?? TIER_ICONS.medal).icon
  return (
    <span className={`tier-icon ${tierTone(tier.name)} ${className}`} style={{ '--size': `${size}px` } as CSSProperties} aria-hidden>
      <Icon size={Math.round(size * 0.54)} strokeWidth={2.2} />
    </span>
  )
}

/** Level label: icon + name in the level's color. */
export function TierChip({ tier, small }: { tier: TierLook | null; small?: boolean }) {
  if (!tier) return <span className={`tier-chip ${small ? 'tier-chip-sm' : ''}`}>Sin nivel</span>
  const Icon = (TIER_ICONS[tier.icon] ?? TIER_ICONS.medal).icon
  return (
    <span className={`tier-chip ${tierTone(tier.name)} ${small ? 'tier-chip-sm' : ''}`}>
      <Icon size={small ? 12 : 14} strokeWidth={2.2} aria-hidden />
      {tier.name}
    </span>
  )
}
