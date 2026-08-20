import { Link } from 'react-router';
import { Check, Play, X } from 'lucide-react';
import type { AdherenceDay } from '@/features/training/stats';

const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

function DayCell({ day }: { day: AdherenceDay }) {
  const base = 'mx-auto flex h-9 w-9 items-center justify-center rounded-xl';
  switch (day.status) {
    case 'done':
      return (
        <span className={`${base} border border-emerald-500 bg-emerald-500/15`}>
          <Check size={14} className="text-emerald-500" strokeWidth={3} aria-hidden />
        </span>
      );
    case 'missed':
      return (
        <span className={`${base} border border-rose-400 bg-rose-400/15`}>
          <X size={13} className="text-rose-400" strokeWidth={3} aria-hidden />
        </span>
      );
    case 'today':
      return (
        <span className={`${base} border-2 border-accent bg-accent-soft`}>
          <Play size={13} className="text-accent" aria-hidden />
        </span>
      );
    case 'planned':
      return (
        <span className={`${base} border border-dashed border-line bg-elev`}>
          <span className="text-[11px] font-semibold text-muted">·</span>
        </span>
      );
    default:
      return (
        <span className={`${base} bg-elev`}>
          <span className="text-[11px] text-muted">—</span>
        </span>
      );
  }
}

/** This week at a glance: done, missed, today, still-planned. Links into the
 * Schedule tab where the full month and rescheduling live. */
export function WeekStrip({ days, done, missed }: { days: AdherenceDay[]; done: number; missed: number }) {
  return (
    <Link
      to="/train/schedule"
      className="springy block rounded-2xl border border-line bg-surface p-4 shadow-sm hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-sm font-semibold">This week</span>
        <span className="text-xs text-muted">
          {done} done{missed > 0 && <span className="text-rose-400"> · {missed} missed</span>}
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day, i) => (
          <div key={day.date} className="text-center">
            <p
              className={`mb-1 text-[9px] font-bold ${day.status === 'today' ? 'text-accent' : 'text-muted'}`}
            >
              {DAY_LABELS[i]}
            </p>
            <DayCell day={day} />
          </div>
        ))}
      </div>
    </Link>
  );
}
