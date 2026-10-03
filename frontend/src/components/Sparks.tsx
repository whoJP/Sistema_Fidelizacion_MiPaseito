import type { CSSProperties } from 'react'

/**
 * Burst of small faceted sparks from the center of its positioned parent. Plays once on mount;
 * remount it (change its `key`) to play again. Spread is deterministic so renders stay pure.
 */
export function Sparks({ count = 14, spread = 56, className = '' }: { count?: number; spread?: number; className?: string }) {
  return (
    <span className={`sparks ${className}`} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          style={
            {
              '--a': `${(i / count) * 360 + (i % 3) * 9}deg`,
              '--d': `${spread * (0.55 + ((i * 7) % 5) * 0.12)}px`,
              '--t': `${((i * 5) % 4) * 45}ms`,
              '--s': 0.55 + ((i * 3) % 4) * 0.18,
            } as CSSProperties
          }
        />
      ))}
    </span>
  )
}
