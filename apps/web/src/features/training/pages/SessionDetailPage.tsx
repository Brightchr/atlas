import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarCheck } from 'lucide-react';
import { getSession } from '@/features/workouts/repository';
import { useUnits } from '@/lib/units';

const KG_TO_LB = 2.2046226218;

/** Drill-down for one finished workout: every set, grouped by exercise. */
export function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const units = useUnits();
  const session = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => getSession(sessionId!),
    enabled: Boolean(sessionId),
  });

  if (session.isSuccess && !session.data) {
    return (
      <div className="mx-auto max-w-2xl p-6 text-center text-sm text-muted">
        Couldn't find this session.{' '}
        <Link to="/you" className="text-accent hover:underline">
          Back to progress
        </Link>
      </div>
    );
  }
  if (!session.data) return null;

  const s = session.data;
  const toDisplay = (kg: number) =>
    units === 'imperial' ? Math.round(kg * KG_TO_LB * 10) / 10 : kg;
  const unitLabel = units === 'imperial' ? 'lb' : 'kg';
  const byExercise = new Map<string, typeof s.sets>();
  for (const set of s.sets) {
    const list = byExercise.get(set.exerciseName) ?? [];
    list.push(set);
    byExercise.set(set.exerciseName, list);
  }
  const volume = s.sets.reduce((sum, x) => sum + (x.weightKg ?? 0) * (x.reps ?? 0), 0);
  const durationMin = s.finishedAt
    ? Math.max(1, Math.round((Date.parse(s.finishedAt) - Date.parse(s.startedAt)) / 60_000))
    : null;

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-6">
      <Link
        to="/you"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
      >
        <ArrowLeft size={15} aria-hidden />
        Progress
      </Link>

      <header className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
            <CalendarCheck size={18} strokeWidth={1.8} aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-bold">{s.workoutName}</h1>
            <p className="text-xs text-muted">
              {new Date(s.startedAt).toLocaleDateString([], {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
              {durationMin && ` · ${durationMin} min`} · {s.sets.length} sets ·{' '}
              {toDisplay(Math.round(volume)).toLocaleString()} {unitLabel} total
            </p>
          </div>
        </div>
      </header>

      {[...byExercise.entries()].map(([name, sets]) => (
        <section key={name} className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <Link
            to={`/exercises/${sets[0]!.exerciseId}`}
            className="text-sm font-semibold text-accent hover:underline"
          >
            {name}
          </Link>
          <ul className="mt-2 space-y-1">
            {sets.map((set) => (
              <li key={set.id} className="flex items-baseline justify-between text-sm">
                <span className="text-xs text-muted">Set {set.setNumber}</span>
                <span className="tabular-nums">
                  {set.durationSec
                    ? `${Math.round(set.durationSec / 60)} min`
                    : `${set.reps ?? '—'} reps${set.weightKg ? ` × ${toDisplay(set.weightKg)} ${unitLabel}` : ''}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
