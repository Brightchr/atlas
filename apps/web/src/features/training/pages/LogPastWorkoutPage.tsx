import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus } from 'lucide-react';
import { Button, Card, PageHeader } from '@/components/ui';
import { createPastSession, listWorkouts } from '@/features/workouts/repository';
import { localIsoDate } from '@/lib/dates';

// min-h-11 = 44px, and text-base (16px) stops iOS Safari zooming the page
// when a field is focused.
const field =
  'min-h-11 w-full rounded-xl border border-line bg-bg px-3 text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</span>
      {children}
    </label>
  );
}

/** Log a workout that happened without the app (or before you had it).
 * Creates a finished, dated session and hands over to the session editor to
 * fill in exercises and sets. */
export function LogPastWorkoutPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const workouts = useQuery({ queryKey: ['workouts'], queryFn: listWorkouts });

  const [name, setName] = useState('Workout');
  // localIsoDate() is today as yyyy-mm-dd in local time — exactly the format
  // <input type="date"> wants.
  const [date, setDate] = useState(() => localIsoDate());
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
    // Take the routine's name unless the user already typed their own.
    if (routine && (name === 'Workout' || !name.trim())) setName(routine.name);
  };

  return (
    <div className="mx-auto max-w-xl space-y-4 p-4 md:p-6">
      <PageHeader title="Log a past workout" back="/history" />
      <p className="text-sm text-muted">
        Set when it happened. You'll add the exercises and sets on the next screen.
      </p>

      <Card className="p-4">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <Field label="Routine">
            <select
              value={routineId}
              onChange={(e) => pickRoutine(e.target.value)}
              className={field}
            >
              <option value="">None — I'll add exercises myself</option>
              {(workouts.data ?? []).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} · {w.exercises.length} exercise{w.exercises.length === 1 ? '' : 's'}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Name">
            <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
          </Field>

          <Field label="Date">
            <input
              type="date"
              required
              value={date}
              max={localIsoDate()}
              onChange={(e) => setDate(e.target.value)}
              className={field}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Start">
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className={field}
              />
            </Field>
            <Field label="Minutes">
              <input
                type="number"
                inputMode="numeric"
                min="1"
                required
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className={field}
              />
            </Field>
          </div>

          {create.isError && (
            <p className="text-sm text-rose-500">Couldn't save that workout — try again.</p>
          )}

          <Button type="submit" size="lg" block disabled={create.isPending}>
            <CalendarPlus size={18} aria-hidden />
            Continue to exercises
          </Button>
        </form>
      </Card>
    </div>
  );
}
