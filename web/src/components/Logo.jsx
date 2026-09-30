// The ShrimpCount mark: the ring the app draws around every counted larva, with a small confirming dot - the same
// visual language used on every review screen, turned into a brandmark. Flat ink, one accent colour, no mascot.
export default function Logo({ size = 36, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} role="img" aria-label="ShrimpCount">
      <rect width="100" height="100" rx="22" fill="#16181c" stroke="#2A3237" stroke-width="2" />
      <circle cx="46" cy="48" r="23" fill="none" stroke="#fff" strokeWidth="8" />
      <circle cx="70" cy="70" r="9" fill="#FF8A6A" />
    </svg>
  )
}
