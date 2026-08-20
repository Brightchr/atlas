import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router';

/* Opacity-based tints read correctly on both light and dark surfaces. */
const tints = {
  accent: 'bg-accent-soft text-accent',
  orange: 'bg-orange-500/15 text-orange-500',
  rose: 'bg-rose-500/15 text-rose-500',
  emerald: 'bg-emerald-500/15 text-emerald-500',
  sky: 'bg-sky-500/15 text-sky-500',
} as const;

interface StatTileProps {
  label: string;
  value: string;
  Icon: LucideIcon;
  tint: keyof typeof tints;
  /** Optional context under the value, e.g. "of 2,400 kcal". */
  hint?: string;
  /** 0..1 fills a progress bar under the tile; >1 renders it in the alert color. */
  progress?: number;
  /** Makes the tile a drill-down link to its detail screen. */
  to?: string;
}

/** Headline-number tile: big value, muted label, tinted icon chip — with an
 * optional target progress bar so numbers read against a goal, not in a
 * vacuum, and an optional drill-down link so every number leads somewhere. */
export function StatTile({ label, value, Icon, tint, hint, progress, to }: StatTileProps) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display text-2xl font-bold tracking-tight tabular-nums">
            {value}
            {hint && <span className="ml-1.5 text-xs font-medium text-muted">{hint}</span>}
          </p>
          <p className="mt-0.5 text-sm text-muted">{label}</p>
        </div>
        <span className={`flex h-11 w-11 items-center justify-center rounded-full ${tints[tint]}`}>
          <Icon size={20} strokeWidth={1.8} aria-hidden />
        </span>
      </div>
      {progress !== undefined && (
        <span className="mt-2.5 block h-1.5 overflow-hidden rounded-full bg-elev">
          <span
            className={`block h-full rounded-full ${
              progress > 1 ? 'bg-rose-500' : 'bg-linear-to-r from-accent to-accent-2'
            }`}
            style={{ width: `${Math.min(100, Math.round(progress * 100))}%` }}
          />
        </span>
      )}
    </>
  );

  const frame = 'rounded-2xl border border-line bg-surface p-4 shadow-sm';
  if (to) {
    return (
      <Link to={to} className={`block ${frame} transition-all hover:-translate-y-0.5 hover:shadow-md`}>
        {body}
      </Link>
    );
  }
  return <div className={frame}>{body}</div>;
}
