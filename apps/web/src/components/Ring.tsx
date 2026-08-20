import { Link } from 'react-router';

interface RingTileProps {
  /** 0..1+; the arc caps at full, the color flips when over. */
  progress: number;
  centerLabel: string;
  title: string;
  subtitle: string;
  to: string;
  /** CSS color for the arc; defaults to the theme accent. */
  color?: string;
  /** Overshoot (e.g. calories past target) renders the arc in the alert color. */
  alertOnOver?: boolean;
}

/** Progress ring tile — the redesign's monitoring primitive. Always a link:
 * every number on the dashboard is a door to the screen that explains it. */
export function RingTile({
  progress,
  centerLabel,
  title,
  subtitle,
  to,
  color = 'var(--accent)',
  alertOnOver = false,
}: RingTileProps) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));
  const over = alertOnOver && progress > 1;
  return (
    <Link
      to={to}
      className="springy block rounded-2xl border border-line bg-surface p-3 text-center shadow-sm hover:-translate-y-0.5 hover:shadow-md"
    >
      <svg width="64" height="64" viewBox="0 0 64 64" className="mx-auto block" aria-hidden>
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--elev)" strokeWidth="7" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={over ? '#f87171' : color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          transform="rotate(-90 32 32)"
          style={{ transition: 'stroke-dashoffset 0.6s var(--spring)' }}
        />
        <text
          x="32"
          y="36"
          textAnchor="middle"
          fontSize="13"
          fontWeight="700"
          fill="var(--ink)"
          fontFamily="inherit"
        >
          {centerLabel}
        </text>
      </svg>
      <p className="mt-1.5 text-xs font-semibold">{title}</p>
      <p className="text-[11px] text-muted">{subtitle}</p>
    </Link>
  );
}
