import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { CalendarPlus, ChevronRight, Dumbbell } from 'lucide-react';
import { Pagination } from '@/components/Pagination';
import { PageHeader, SectionLabel, buttonClasses } from '@/components/ui';
import { displayWeight, useUnits, weightUnit } from '@/lib/units';
import { countFinishedSessions, listSessionHistory, type SessionSummary } from '../stats';

const PAGE_SIZE = 30;

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function monthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString([], { month: 'long', year: 'numeric' });
}

/** One finished workout. The whole card is the link, so the tap target is the
 * full width of the screen and well over 56px tall. */
function SessionRow({ s }: { s: SessionSummary }) {
  const units = useUnits();
  const when = new Date(s.startedAt);
  // "Tue, Nov 4 · 52 min · 18 sets" — pieces that don't apply are left out.
  const meta = [
    when.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }),
    s.durationMin !== null ? `${s.durationMin} min` : null,
    `${s.setCount} set${s.setCount === 1 ? '' : 's'}`,
    s.volumeKg > 0
      ? `${Math.round(displayWeight(s.volumeKg, units)).toLocaleString()} ${weightUnit(units)}`
      : null,
  ].filter(Boolean);
  // "Squat · Bench · Row +2": what the workout actually was, at a glance.
  const more = s.exerciseCount - s.exerciseNames.length;
  const preview = s.exerciseNames.join(' · ') + (more > 0 ? ` +${more}` : '');

  return (
    <li>
      <Link
        to={`/history/${s.id}`}
        className="springy flex min-h-16 items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-sm hover:bg-elev"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-semibold">{s.workoutName}</span>
          <span className="block truncate text-sm text-muted tabular-nums">{meta.join(' · ')}</span>
          {preview && <span className="block truncate text-xs text-muted">{preview}</span>}
        </span>
        <ChevronRight size={20} className="shrink-0 text-muted" aria-hidden />
      </Link>
    </li>
  );
}

/** Every finished workout, newest first, grouped by month. The place to see
 * what you've done — and to log something you did without the app. */
export function HistoryPage() {
  const [page, setPage] = useState(1);
  const total = useQuery({ queryKey: ['sessions', 'count'], queryFn: countFinishedSessions });
  const history = useQuery({
    queryKey: ['sessions', 'history', page],
    queryFn: () => listSessionHistory(PAGE_SIZE, (page - 1) * PAGE_SIZE),
  });
  const pageCount = Math.max(1, Math.ceil((total.data ?? 0) / PAGE_SIZE));

  // The list arrives newest-first, so sessions of the same month are already
  // next to each other: start a new group whenever the month changes.
  const groups: { key: string; label: string; items: SessionSummary[] }[] = [];
  for (const s of history.data ?? []) {
    const key = monthKey(s.startedAt);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(s);
    else groups.push({ key, label: monthLabel(s.startedAt), items: [s] });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <PageHeader
        title="History"
        subtitle={
          total.data === undefined
            ? undefined
            : `${total.data} workout${total.data === 1 ? '' : 's'} logged`
        }
        actions={
          <Link to="/history/log" className={buttonClasses('secondary')}>
            <CalendarPlus size={18} aria-hidden />
            Log past workout
          </Link>
        }
      />

      {history.isSuccess && groups.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line p-8 text-center">
          <Dumbbell size={28} className="mx-auto text-muted" aria-hidden />
          <p className="mt-3 font-semibold">Nothing here yet</p>
          <p className="mt-1 text-sm text-muted">Finished workouts show up here, newest first.</p>
          <Link to="/train" className={buttonClasses('primary', 'md', 'mt-4')}>
            Start your first workout
          </Link>
        </div>
      )}

      {groups.map((group) => (
        <section key={group.key} className="space-y-2">
          <SectionLabel>{group.label}</SectionLabel>
          <ul className="grid gap-2 lg:grid-cols-2">
            {group.items.map((s) => (
              <SessionRow key={s.id} s={s} />
            ))}
          </ul>
        </section>
      ))}

      <Pagination
        page={page}
        pageCount={pageCount}
        onChange={(p) => {
          setPage(p);
          // The page itself never scrolls — the app shell's <main> element is
          // the scroll container — so window.scrollTo would do nothing here.
          document.querySelector('main')?.scrollTo({ top: 0 });
        }}
      />
    </div>
  );
}
