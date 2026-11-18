import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarPlus } from 'lucide-react';
import { createPastSession, listWorkouts } from '@/features/workouts/repository';

const pad = (n: number) => String(n).padStart(2, '0');
const todayInput = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const field =
  'w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink shadow-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20';

/** Log a workout that happened without the app (or before you had it).
 * Creates a finished, dated session and hands over to the session editor to
 * fill in exercises and sets. */
export function LogPastWorkoutPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const workouts = useQuery({ queryKey: ['workouts'], queryFn: listWorkouts });

  const [name, setName] = useState('Workout');
  const [date, setDate] = useState(todayInput);
  const [time, setTime] = useState('18:00');
  const [duration, setDuration] = useState('60');
  const [routineId, setRoutineId] = useState('');

  const create = useMutation({
    mutationFn: () => {
      const [y, m, d] = date.split('-').map(Number);
      const [hh, mm] = time.split(':').map(Number);
      const routine = (workouts.data ?? []).find((w) => w.id === routineId) ?? null;
      return createPastSession({
        name: name.trim() || routine?.name || 'Workout',
        startedAt: new Date(y!, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0),
        durationMin: Number(duration) || 60,
        workout: routine,
      });
    },
    onSuccess: (id) => {
      void queryClient.invalidateQueries({ queryKey: ['sessions'] });
      void navigate(`/workouts/session/${id}`, { replace: true });
    },
  });

  const pickRoutine = (id: string) => {
    setRoutineId(id);
    const routine = (workouts.data ?? []).find((w) => w.id === id);
    if (routine && (name === 'Workout' || !name.trim())) setName(routine.name);
  };

  return (
    <div className="mx-auto max-w-xl space-y-4 p-4 md:p-6">
      <Link
        to="/history"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
      >
        <ArrowLeft size={15} aria-hidden />
        History
      </Link>

      <header>
        <h1 className="text-2xl font-bold">Log a past workout</h1>
        <p className="text-sm text-muted">
          Set when it happened. You'll add the exercises and sets on the next screen.
        </p>
      </header>

      <form
        className="space-y-4 rounded-2xl border border-line bg-surface p-4 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold tracking-wide text-muted uppercase">Routine</span>
          <select value={routineId} onChange={(e) => pickRoutine(e.target.value)} className={field}>
            <option value="">None — I'll add exercises myself</option>
            {(workouts.data ?? []).map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} · {w.exercises.length} exercise{w.exercises.length === 1 ? '' : 's'}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold tracking-wide text-muted uppercase">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
        </label>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold tracking-wide text-muted uppercase">Date</span>
            <input
              type="date"
              required
              value={date}
              max={todayInput()}
              onChange={(e) => setDate(e.target.value)}
              className={field}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold tracking-wide text-muted uppercase">Start</span>
            <input
              type="time"
              required
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={field}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold tracking-wide text-muted uppercase">
              Minutes
            </span>
            <input
              type="number"
              min="1"
              required
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className={field}
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={create.isPending}
          className="springy inline-flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-accent to-accent-2 px-5 py-2.5 font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <CalendarPlus size={16} aria-hidden />
          Continue to exercises
        </button>
      </form>
    </div>
  );
}
