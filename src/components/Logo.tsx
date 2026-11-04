/** PinFlow mark: pushpin on a rose gradient tile. */
export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" aria-hidden>
      <defs>
        <linearGradient id="pf-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff5c8a" />
          <stop offset="1" stopColor="#e60023" />
        </linearGradient>
      </defs>
      <rect width="256" height="256" rx="64" fill="url(#pf-bg)" />
      <path d="M40 176c30 22 60 22 88 0s58-22 88 0" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="12" strokeLinecap="round" />
      <g fill="#fff">
        <rect x="96" y="44" width="64" height="18" rx="9" />
        <path d="M108 62h40l6 50c14 6 24 16 26 30H76c2-14 12-24 26-30z" />
        <path d="M128 142l-8 0 4 66 4 12 4-12 4-66z" />
      </g>
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2">
      <Logo size={28} />
      <span className="font-display text-xl font-semibold tracking-tight">
        Pin<span className="italic text-accent">flow</span>
      </span>
    </span>
  );
}
