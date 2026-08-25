import { CalendarCheck, Flame, HeartPulse, Scale, Weight } from 'lucide-react';
import type { FriendStats } from '@arcadia/shared';
import { displayWeight, formatWeight, useUnits } from '@/lib/units';

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

/** The glanceable stat strip on a friend's card. Framing rules from the UX
 * research: effort metrics only, x-of-personal-goal instead of raw compare,
 * weight ONLY as a delta (never a number) and only when its owner shared it,
 * and no red/negative styling anywhere — quiet beats shaming. */
export function StatChips({ stats, updatedAt }: { stats: FriendStats; updatedAt: string | null }) {
  const units = useUnits();
  const chip = 'inline-flex items-center gap-1 rounded-full bg-elev px-2 py-0.5 text-[11px] font-semibold tabular-nums';
  const delta = stats.weightDeltaKg;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={chip}>
        <CalendarCheck size={11} aria-hidden className="text-accent" />
        {stats.week.workouts}
        {stats.weeklyTargetDays ? `/${stats.weeklyTargetDays}` : ''} workouts
      </span>
      {stats.streakDays > 1 && (
        <span className={chip}>
          <Flame size={11} aria-hidden className="text-orange-500" />
          {stats.streakDays}-day streak
        </span>
      )}
      {stats.week.volumeKg > 0 && (
        <span className={chip}>
          <Weight size={11} aria-hidden className="text-indigo-400" />
          {Math.round(displayWeight(stats.week.volumeKg, units)).toLocaleString()} lifted
        </span>
      )}
      {stats.week.cardioMin > 0 && (
        <span className={chip}>
          <HeartPulse size={11} aria-hidden className="text-sky-500" />
          {stats.week.cardioMin} min cardio
        </span>
      )}
      {delta !== undefined && Math.abs(delta) >= 0.1 && (
        <span className={chip}>
          <Scale size={11} aria-hidden className="text-teal-500" />
          {delta < 0 ? '−' : '+'}
          {formatWeight(Math.abs(delta), units)}
        </span>
      )}
      {stats.lastWorkout && (
        <span className="text-[11px] text-muted">
          {stats.lastWorkout.name} · {timeAgo(stats.lastWorkout.at)}
        </span>
      )}
      {updatedAt && Date.now() - Date.parse(updatedAt) > 3 * 86_400_000 && (
        <span className="text-[11px] text-muted/70">updated {timeAgo(updatedAt)}</span>
      )}
    </div>
  );
}

/** Round initial avatar — consistent color from the username. */
export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const tones = [
    'bg-indigo-500/20 text-indigo-400',
    'bg-teal-500/20 text-teal-500',
    'bg-orange-500/20 text-orange-500',
    'bg-sky-500/20 text-sky-500',
    'bg-rose-500/20 text-rose-500',
    'bg-emerald-500/20 text-emerald-500',
  ];
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const tone = tones[hash % tones.length];
  const dims = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm';
  return (
    <span
      aria-hidden
      className={`flex ${dims} shrink-0 items-center justify-center rounded-full font-bold uppercase ${tone}`}
    >
      {name.slice(0, 1)}
    </span>
  );
}
