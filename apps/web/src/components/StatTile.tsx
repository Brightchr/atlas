import type { LucideIcon } from 'lucide-react';

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
}

/** Headline-number tile: big value, muted label, tinted icon chip. */
export function StatTile({ label, value, Icon, tint }: StatTileProps) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <div>
        <p className="font-display text-2xl font-bold tracking-tight tabular-nums">{value}</p>
        <p className="mt-0.5 text-sm text-muted">{label}</p>
      </div>
      <span className={`flex h-11 w-11 items-center justify-center rounded-full ${tints[tint]}`}>
        <Icon size={20} strokeWidth={1.8} aria-hidden />
      </span>
    </div>
  );
}
