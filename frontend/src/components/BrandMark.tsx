/** Faceted gem of Paseo Club. The body takes `currentColor`; the cuts use `--gem-cut` so they read as engraved. */
export function ClubGem({ size = 22 }: { size?: number }) {
  return (
    <svg className="club-gem" width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path d="M7 5h10l4.5 4.5L12 20.5 2.5 9.5z" fill="currentColor" />
      <path d="M7 5l2.6 4.5H2.5zM12 5l2.4 4.5H9.6z" fill="#fff" opacity="0.3" />
      <path d="M14.4 9.5h7.1L12 20.5z" fill="#000" opacity="0.2" />
      <path
        d="M2.5 9.5h19M7 5l2.6 4.5L12 5l2.4 4.5L17 5M9.6 9.5 12 20.5l2.4-11"
        fill="none"
        stroke="var(--gem-cut, #010102)"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <span className="brand-mark brand-mark-gem" style={{ width: size, height: size }} aria-hidden>
      <ClubGem size={Math.round(size * 0.56)} />
    </span>
  )
}
