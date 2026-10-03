import type { CSSProperties } from 'react'

const MOTES = 9

/** Slow gold dust behind the customer screens. Decorative, transform/opacity only. */
export function Ambient() {
  return (
    <div className="ambient" aria-hidden>
      <span className="ambient-orb" />
      <span className="ambient-orb ambient-orb-b" />
      {Array.from({ length: MOTES }, (_, i) => (
        <span
          key={i}
          className="mote"
          style={
            {
              '--x': `${(i * 37 + 11) % 100}%`,
              '--dur': `${16 + ((i * 7) % 5) * 4}s`,
              '--delay': `${-((i * 11) % 17)}s`,
              '--size': `${2 + (i % 3)}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}
