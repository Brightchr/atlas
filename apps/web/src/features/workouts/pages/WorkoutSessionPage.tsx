import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Flag, Timer, TimerOff, X } from 'lucide-react';
import type { LoggedSet, WorkoutExercise } from '@arcadia/shared';
import { formatWeight, parseWeight, useUnits, weightUnit, type UnitSystem } from '@/lib/units';
import { useRestTimerEnabled, useSetRestTimerEnabled } from '@/lib/restTimer';
import {
  deleteLoggedSet,
  finishSession,
  getSession,
  getWorkout,
  logSet,
} from '../repository';

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Set logger for one exercise in the session. */
function ExerciseLogger({
  exercise,
  sets,
  units,
  pending,
  onLog,
  onDeleteSet,
}: {
  exercise: WorkoutExercise;
  sets: LoggedSet[];
  units: UnitSystem;
  pending: boolean;
  onLog: (args: { reps: number | null; weightKg: number | null; durationSec: number | null }) => void;
  onDeleteSet: (id: string) => void;
}) {
  const timed = exercise.targetDurationSec !== null;
  const [reps, setReps] = useState(String(exercise.targetReps ?? 10));
  const [weight, setWeight] = useState('');
  const [minutes, setMinutes] = useState(String(Math.round((exercise.targetDurationSec ?? 60) / 60)));
  const done = sets.length;
  const target = timed ? 1 : exercise.targetSets;
  const complete = done >= target;

  const input =
    'w-20 rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent';

  return (
    <li className={`rounded-2xl border p-3 shadow-sm ${complete ? 'border-accent/40 bg-accent-soft/40' : 'border-line bg-surface'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <Link
            to={`/exercises/${exercise.exerciseId}`}
            className="block truncate font-semibold hover:text-accent"
          >
            {exercise.exerciseName}
          </Link>
          <p className="text-xs text-muted tabular-nums">
            {timed
              ? `Target ${Math.round((exercise.targetDurationSec ?? 0) / 60)} min`
              : `Target ${exercise.targetSets} × ${exercise.targetReps ?? '—'}`}
            {exercise.restSec ? ` · rest ${exercise.restSec}s` : ''}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${
            complete ? 'bg-accent text-accent-ink' : 'bg-elev text-muted'
          }`}
        >
          {done}/{target}
        </span>
      </div>

      {sets.length > 0 && (
        <ul className="mt-2 space-y-1">
          {sets.map((set) => (
            <li key={set.id} className="flex items-center gap-2 text-sm tabular-nums">
              <Check size={13} className="shrink-0 text-accent" aria-hidden />
              <span className="min-w-0 flex-1">
                Set {set.setNumber}:{' '}
                {set.durationSec !== null
                  ? `${Math.round(set.durationSec / 60)} min`
                  : `${set.reps ?? '—'} reps${set.weightKg ? ` @ ${formatWeight(set.weightKg, units)}` : ''}`}
              </span>
              <button
                type="button"
                onClick={() => onDeleteSet(set.id)}
                aria-label={`Delete set ${set.setNumber}`}
                className="shrink-0 rounded p-1 text-muted transition-colors hover:bg-elev hover:text-ink"
              >
                <X size={12} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {timed ? (
          <label className="flex items-center gap-1.5 text-xs text-muted">
            Minutes
            <input
              type="number"
              min="1"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className={input}
            />
          </label>
        ) : (
          <>
            <label className="flex items-center gap-1.5 text-xs text-muted">
              Reps
              <input
                type="number"
                min="1"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                className={input}
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-muted">
              {weightUnit(units)}
              <input
                type="number"
                min="0"
                step="0.5"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="—"
                className={input}
              />
            </label>
          </>
        )}
        <button
          type="button"
          disabled={pending || (timed ? !Number(minutes) : !Number(reps))}
          onClick={() =>
            onLog(
              timed
                ? { reps: null, weightKg: null, durationSec: Math.round(Number(minutes) * 60) }
                : {
                    reps: Number(reps),
                    weightKg: Number(weight) ? parseWeight(Number(weight), units) : null,
                    durationSec: null,
                  },
            )
          }
          className="rounded-xl bg-linear-to-r from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Log set
        </button>
      </div>
    </li>
  );
}

export function WorkoutSessionPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const units = useUnits();

  const sessionQuery = useQuery({
    queryKey: ['sessions', sessionId],
    queryFn: () => getSession(sessionId!),
  });
  const workoutQuery = useQuery({
    queryKey: ['workouts', sessionQuery.data?.workoutId],
    queryFn: () => getWorkout(sessionQuery.data!.workoutId!),
    enabled: Boolean(sessionQuery.data?.workoutId),
  });

  // Tick once a second for the elapsed clock and the rest countdown.
  const [now, setNow] = useState(() => Date.now());
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const restRemaining = restEndsAt === null ? 0 : Math.ceil((restEndsAt - now) / 1000);

  const restTimerEnabled = useRestTimerEnabled();
  const setRestTimerEnabled = useSetRestTimerEnabled();
  const toggleRestTimer = () => {
    if (restTimerEnabled) setRestEndsAt(null); // silence a running countdown too
    setRestTimerEnabled.mutate(!restTimerEnabled);
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['sessions'] });
  const logMutation = useMutation({
    mutationFn: logSet,
    onSuccess: (_data, variables) => {
      void invalidate();
      // Kick off the rest countdown for the exercise that was just logged —
      // unless the user has switched the timer off (a remembered preference).
      if (!restTimerEnabled) return;
      const rest = workoutQuery.data?.exercises.find(
        (e) => e.exerciseId === variables.exerciseId,
      )?.restSec;
      if (rest) setRestEndsAt(Date.now() + rest * 1000);
    },
  });
  const deleteMutation = useMutation({ mutationFn: deleteLoggedSet, onSuccess: invalidate });
  const finishMutation = useMutation({
    mutationFn: () => finishSession(sessionId!),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      void navigate('/workouts');
    },
  });

  if (sessionQuery.isLoading) return <p className="p-4 text-muted md:p-6">Loading…</p>;
  const session = sessionQuery.data;
  if (!session) {
    return (
      <div className="space-y-3 p-4 md:p-6">
        <p className="text-rose-500">Could not find this session.</p>
        <Link to="/train/library" className="font-medium text-accent hover:underline">
          Back to workouts
        </Link>
      </div>
    );
  }

  const exercises = workoutQuery.data?.exercises ?? [];
  const elapsed = formatElapsed(now - new Date(session.startedAt).getTime());
  const totalSets = session.sets.length;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 pb-24 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{session.workoutName}</h1>
          <p className="flex items-center gap-1.5 text-sm text-muted tabular-nums">
            <Timer size={14} aria-hidden />
            {session.finishedAt ? 'Finished' : elapsed} · {totalSets} set{totalSets === 1 ? '' : 's'} logged
          </p>
        </div>
        {!session.finishedAt && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-pressed={restTimerEnabled}
              title={
                restTimerEnabled
                  ? 'Rest timer on — tap to stop it auto-starting (remembered)'
                  : 'Rest timer off — tap to turn it back on'
              }
              onClick={toggleRestTimer}
              className={`springy inline-flex h-11 w-11 items-center justify-center rounded-xl border shadow-sm ${
                restTimerEnabled
                  ? 'border-accent/40 bg-accent-soft text-accent'
                  : 'border-line bg-surface text-muted hover:text-ink'
              }`}
            >
              {restTimerEnabled ? (
                <Timer size={17} aria-hidden />
              ) : (
                <TimerOff size={17} aria-hidden />
              )}
            </button>
            <button
              type="button"
              disabled={finishMutation.isPending}
              onClick={() => finishMutation.mutate()}
              className="springy inline-flex items-center gap-2 rounded-xl bg-linear-to-r from-accent to-accent-2 px-5 py-2.5 font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Flag size={15} aria-hidden />
              Finish workout
            </button>
          </div>
        )}
      </header>

      <ul className="space-y-2">
        {exercises.map((exercise) => (
          <ExerciseLogger
            key={exercise.id}
            exercise={exercise}
            sets={session.sets.filter((s) => s.exerciseId === exercise.exerciseId)}
            units={units}
            pending={logMutation.isPending}
            onLog={({ reps, weightKg, durationSec }) =>
              logMutation.mutate({
                sessionId: session.id,
                exerciseId: exercise.exerciseId,
                exerciseName: exercise.exerciseName,
                setNumber:
                  session.sets.filter((s) => s.exerciseId === exercise.exerciseId).length + 1,
                reps,
                weightKg,
                durationSec,
              })
            }
            onDeleteSet={(setId) => deleteMutation.mutate(setId)}
          />
        ))}
        {exercises.length === 0 && (
          <p className="text-sm text-muted">
            The workout template behind this session is gone — you can still finish the session.
          </p>
        )}
      </ul>

      {/* Floating rest countdown */}
      {restEndsAt !== null && restRemaining > 0 && (
        <div className="fixed inset-x-4 bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+4.5rem))] z-30 mx-auto flex max-w-sm items-center justify-between gap-3 rounded-2xl border border-accent/40 bg-surface px-4 py-3 shadow-lg md:bottom-6">
        <span className="flex items-center gap-2 font-semibold tabular-nums">
            <Timer size={16} className="text-accent" aria-hidden />
            Rest {formatElapsed(restRemaining * 1000)}
          </span>
          <button
            type="button"
            onClick={() => setRestEndsAt(null)}
            className="rounded-xl border border-line px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-elev"
          >
            Skip
          </button>
        </div>
      )}
    </div>
  );
}
