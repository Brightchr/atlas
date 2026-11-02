import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { CalendarPlus, ChevronRight, Dumbbell, Timer } from 'lucide-react';
import { Pagination } from '@/components/Pagination';
import { useUnits } from '@/lib/units';
import { countFinishedSessions, listSessionHistory, type SessionSummary } from '../stats';

const PAGE_SIZE = 30;
const KG_TO_LB = 2.2046226218;

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function monthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString([], { month: 'long', year: 'numeric' });
}

function SessionRow({
  s,
  unitLabel,
  toDisplay,
}: {
  s: SessionSummary;
  unitLabel: string;
  toDisplay: (kg: number) => number;
}) {
  const when = new Date(s.startedAt);
  return (
    <li>
      <Link
        to={`/history/${s.id}`}
        className="springy flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
      >
        <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-accent-soft text-accent">
          <span className="text-[10px] font-semibold tracking-wide uppercase">
            {when.toLocaleDateString([], { weekday: 'short' })}
          </span>
          <span className="text-base leading-none font-bold tabular-nums">{when.getDate()}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{s.workoutName}</span>
          <span className="block truncate text-xs text-muted">
            {s.exerciseNames.length > 0
              ? s.exerciseNames.join(' · ') +
                (s.exerciseCount > 3 ? ` +${s.exerciseCount - 3}` : '')
              : 'No exercises logged'}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted tabular-nums">
            {s.durationMin !== null && (
              <span className="inline-flex items-center gap-1">
                <Timer size={12} aria-hidden />
                {s.durationMin} min
              </span>
            )}
            <span>
              {s.setCount} set{s.setCount === 1 ? '' : 's'}
            </span>
            {s.volumeKg > 0 && (
              <span>
                {toDisplay(s.volumeKg).toLocaleString()} {unitLabel}
              </span>
            )}
          </span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-muted" aria-hidden />
      </Link>
    </li>
  );
}

/** Every finished workout, newest first, grouped by month. The place to see
 * what you've done — and to log something you did without the app. */
export function HistoryPage() {
  const units = useUnits();
  const [page, setPage] = useState(1);
  const total = useQuery({ queryKey: ['sessions', 'count'], queryFn: countFinishedSessions });
  const history = useQuery({
    queryKey: ['sessions', 'history', page],
    queryFn: () => listSessionHistory(PAGE_SIZE, (page - 1) * PAGE_SIZE),
  });
  const toDisplay = (kg: number) =>
    units === 'imperial' ? Math.round(kg * KG_TO_LB) : Math.round(kg);
  const unitLabel = units === 'imperial' ? 'lb' : 'kg';
  const pageCount = Math.max(1, Math.ceil((total.data ?? 0) / PAGE_SIZE));

  const groups: { key: string; label: string; items: SessionSummary[] }[] = [];
  for (const s of history.data ?? []) {
    const key = monthKey(s.startedAt);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(s);
    else groups.push({ key, label: monthLabel(s.startedAt), items: [s] });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">History</h1>
          <p className="text-sm text-muted">
            {total.data === undefined
              ? ' '
              : `${total.data} workout${total.data === 1 ? '' : 's'} logged`}
          </p>
        </div>
        <Link
          to="/history/log"
          className="springy inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-semibold shadow-sm transition-colors hover:bg-elev"
        >
          <CalendarPlus size={15} aria-hidden />
          Log past workout
        </Link>
      </header>

      {history.isSuccess && groups.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line p-8 text-center">
          <Dumbbell size={28} className="mx-auto text-muted" aria-hidden />
          <p className="mt-3 font-semibold">Nothing here yet</p>
          <p className="mt-1 text-sm text-muted">Finished workouts show up here, newest first.</p>
          <Link
            to="/train"
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-linear-to-r from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-accent-ink shadow-sm hover:opacity-90"
          >
            Start your first workout
          </Link>
        </div>
      )}

      {groups.map((group) => (
        <section key={group.key} className="space-y-2">
          <h2 className="px-1 text-xs font-semibold tracking-wide text-muted uppercase">
            {group.label}
          </h2>
          <ul className="space-y-2">
            {group.items.map((s) => (
              <SessionRow key={s.id} s={s} unitLabel={unitLabel} toDisplay={toDisplay} />
            ))}
          </ul>
        </section>
      ))}

      <Pagination
        page={page}
        pageCount={pageCount}
        onChange={(p) => {
          setPage(p);
          window.scrollTo({ top: 0 });
        }}
      />
    </div>
  );
}
