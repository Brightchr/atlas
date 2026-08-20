import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, Flame } from 'lucide-react';
import { PlansPage } from '@/features/plans/pages/PlansPage';
import { adherenceStats, type DayStatus } from '../stats';

const cellTone: Record<DayStatus, string> = {
  done: 'bg-emerald-500/30 border border-emerald-500/60',
  missed: 'bg-rose-400/25 border border-rose-400/60',
  today: 'bg-accent-soft border-2 border-accent',
  planned: 'bg-elev border border-dashed border-line',
  off: 'bg-elev',
};

/** Train → Schedule: how the plan is actually going — adherence, done vs
 * missed per week, streak — with the weekly plan editors below. */
export function SchedulePage() {
  const stats = useQuery({ queryKey: ['stats', 'adherence'], queryFn: () => adherenceStats(4) });
  const s = stats.data;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-bold">Schedule</h1>
        <p className="text-sm text-muted">
          Your plan versus reality — every green cell is a workout that happened.
        </p>
      </header>

      <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-3xl font-bold tabular-nums">
              {s?.adherencePct === null || s === undefined ? '—' : `${s.adherencePct}%`}
            </p>
            <p className="text-xs text-muted">adherence · last 4 weeks</p>
          </div>
          <div className="text-right text-sm">
            <p>
              <span className="font-semibold text-emerald-500">{s?.done ?? 0}</span> done ·{' '}
              <span className="font-semibold text-rose-400">{s?.missed ?? 0}</span> missed
            </p>
            <p className="mt-0.5 flex items-center justify-end gap-1 text-xs text-muted">
              <Flame size={12} className="text-accent" aria-hidden />
              streak: {s?.streak ?? 0} session{(s?.streak ?? 0) === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        {s && (
          <div className="mt-4 space-y-1.5">
            {s.weeks.map((week, i) => (
              <div key={week.monday} className="grid grid-cols-[44px_repeat(7,minmax(0,1fr))] items-center gap-1.5">
                <span className={`text-[9px] font-bold ${i === s.weeks.length - 1 ? 'text-accent' : 'text-muted'}`}>
                  {i === s.weeks.length - 1
                    ? 'NOW'
                    : new Date(week.monday).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </span>
                {week.days.map((day) => (
                  <span
                    key={day.date}
                    title={`${day.date}: ${day.status}`}
                    className={`h-5 rounded-lg ${cellTone[day.status]}`}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
          <CalendarCheck size={12} aria-hidden />
          A missed day isn't a failed week — adjust the plan below and keep the streak honest.
        </p>
      </section>

      <PlansPage embedded />
    </div>
  );
}
