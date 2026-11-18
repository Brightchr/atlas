import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Flag, Pencil, Plus, Save, Timer, TimerOff, Trash2, X } from 'lucide-react';
import type { Exercise, LoggedSet, SessionExercise, WorkoutSession } from '@arcadia/shared';
import {
  displayWeight,
  formatWeight,
  parseWeight,
  type UnitSystem,
  useUnits,
  weightUnit,
} from '@/lib/units';
import { useRestTimerEnabled, useSetRestTimerEnabled } from '@/lib/restTimer';
import { ExercisePicker } from '../components/ExercisePicker';
import {
  addExerciseToSession,
  deleteLoggedSet,
  discardSession,
  finishSession,
  getSession,
  getWorkout,
  logSet,
  removeSessionExercise,
  renameSession,
  saveSessionAsRoutine,
  sessionDiffersFromRoutine,
  setSessionNotes,
  updateRoutineFromSession,
  updateSessionTimes,
} from '../repository';

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const pad = (n: number) => String(n).padStart(2, '0');
/** Local-time pieces for <input type="date"> / <input type="time">. */
function toDateInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function toTimeInput(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function durationMinutes(session: WorkoutSession): number {
  if (!session.finishedAt) return 0;
  return Math.max(
    1,
    Math.round((Date.parse(session.finishedAt) - Date.parse(session.startedAt)) / 60_000),
  );
}

const primaryButton =
  'springy inline-flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-accent to-accent-2 px-5 py-2.5 font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50';
const secondaryButton =
  'springy inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors hover:bg-elev';
const iconButton =
  'springy inline-flex h-11 w-11 items-center justify-center rounded-xl border shadow-sm';

/** Set logger for one exercise in the session. */
function ExerciseLogger({
  exercise,
  sets,
  units,
  pending,
  onLog,
  onDeleteSet,
  onRemove,
}: {
  exercise: SessionExercise;
  sets: LoggedSet[];
  units: UnitSystem;
  pending: boolean;
  onLog: (args: {
    reps: number | null;
    weightKg: number | null;
    durationSec: number | null;
  }) => void;
  onDeleteSet: (id: string) => void;
  onRemove: () => void;
}) {
  const timed = exercise.targetDurationSec !== null;
  const targetSets = exercise.targetSets ?? 3;
  const [reps, setReps] = useState(String(exercise.targetReps ?? 10));
  const [weight, setWeight] = useState('');
  const [minutes, setMinutes] = useState(
    String(Math.round((exercise.targetDurationSec ?? 60) / 60)),
  );
  const done = sets.length;
  const target = timed ? 1 : targetSets;
  const complete = done >= target;

  const input =
    'w-20 rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent';

  return (
    <li
      className={`rounded-2xl border p-3 shadow-sm ${complete ? 'border-accent/40 bg-accent-soft/40' : 'border-line bg-surface'}`}
    >
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
              : `Target ${targetSets} × ${exercise.targetReps ?? '—'}`}
            {exercise.restSec ? ` · rest ${exercise.restSec}s` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${
              complete ? 'bg-accent text-accent-ink' : 'bg-elev text-muted'
            }`}
          >
            {done}/{target}
          </span>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${exercise.exerciseName} from this workout`}
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-elev hover:text-ink"
          >
            <X size={15} aria-hidden />
          </button>
        </div>
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

/** Tap-to-edit title. The routine's own name is never touched. */
function SessionTitle({ name, onRename }: { name: string; onRename: (n: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(name);
          setEditing(true);
        }}
        className="group inline-flex max-w-full items-center gap-2 text-left"
        title="Rename this workout"
      >
        <h1 className="truncate text-2xl font-bold">{name}</h1>
        <Pencil size={14} className="shrink-0 text-muted group-hover:text-ink" aria-hidden />
      </button>
    );
  }
  const commit = () => {
    setEditing(false);
    if (draft.trim() && draft.trim() !== name) onRename(draft.trim());
  };
  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') setEditing(false);
      }}
      aria-label="Workout name"
      className="w-full max-w-md rounded-xl border border-line bg-surface px-3 py-1.5 text-xl font-bold outline-none focus:border-accent"
    />
  );
}

/** What happens to the routine when the session ends. */
type FinishChoice = 'finish' | 'save-routine' | 'update-routine' | 'discard';

function FinishSheet({
  session,
  routineDiffers,
  volumeLabel,
  pending,
  onChoose,
  onClose,
}: {
  session: WorkoutSession;
  routineDiffers: boolean;
  volumeLabel: string;
  pending: boolean;
  onChoose: (choice: FinishChoice, routineName?: string) => void;
  onClose: () => void;
}) {
  const [routineName, setRoutineName] = useState(session.workoutName);
  const adHoc = session.workoutId === null;
  const elapsed = formatElapsed(Date.now() - Date.parse(session.startedAt));
  const nothingLogged = session.sets.length === 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="finish-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md space-y-4 rounded-2xl border border-line bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 id="finish-title" className="text-lg font-bold">
            Finish workout?
          </h2>
          <p className="mt-1 text-sm text-muted tabular-nums">
            {elapsed} · {session.sets.length} set{session.sets.length === 1 ? '' : 's'} ·{' '}
            {volumeLabel}
          </p>
        </div>

        {nothingLogged && (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            Nothing was logged. Finishing keeps an empty entry in your history.
          </p>
        )}

        {adHoc && session.exercises.length > 0 && (
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold tracking-wide text-muted uppercase">
              Save as a routine
            </span>
            <input
              value={routineName}
              onChange={(e) => setRoutineName(e.target.value)}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </label>
        )}

        <div className="grid gap-2">
          {adHoc && session.exercises.length > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={() => onChoose('save-routine', routineName)}
              className={primaryButton}
            >
              <Save size={15} aria-hidden />
              Save routine & finish
            </button>
          )}
          {!adHoc && routineDiffers && (
            <button
              type="button"
              disabled={pending}
              onClick={() => onChoose('update-routine')}
              className={primaryButton}
            >
              <Save size={15} aria-hidden />
              Update routine & finish
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() => onChoose('finish')}
            className={adHoc || routineDiffers ? secondaryButton : primaryButton}
          >
            <Flag size={15} aria-hidden />
            {!adHoc && routineDiffers ? 'Keep routine as is & finish' : 'Finish'}
          </button>
          {nothingLogged && (
            <button
              type="button"
              disabled={pending}
              onClick={() => onChoose('discard')}
              className="springy inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-rose-500 transition-colors hover:bg-rose-500/10"
            >
              <Trash2 size={15} aria-hidden />
              Discard instead
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full text-center text-xs font-medium text-muted hover:text-ink"
        >
          Keep going
        </button>
      </div>
    </div>
  );
}

/** Live logging for an open session, and the editor for a finished one
 * (reached from History): same screen, with the clock swapped for date and
 * duration fields. Exercises belong to the session — adding or removing one
 * here never changes the routine it came from. */
export function WorkoutSessionPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const units = useUnits();

  const sessionQuery = useQuery({
    queryKey: ['sessions', sessionId],
    queryFn: () => getSession(sessionId!),
  });
  const session = sessionQuery.data;
  const routineQuery = useQuery({
    queryKey: ['workouts', session?.workoutId],
    queryFn: () => getWorkout(session!.workoutId!),
    enabled: Boolean(session?.workoutId),
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

  const [picking, setPicking] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Edit-mode fields (finished sessions only).
  const [dateInput, setDateInput] = useState('');
  const [timeInput, setTimeInput] = useState('');
  const [durationInput, setDurationInput] = useState('');
  useEffect(() => {
    if (!session?.finishedAt) return;
    setDateInput(toDateInput(session.startedAt));
    setTimeInput(toTimeInput(session.startedAt));
    setDurationInput(String(durationMinutes(session)));
  }, [session?.id, session?.startedAt, session?.finishedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['sessions'] });
  const logMutation = useMutation({
    mutationFn: logSet,
    onSuccess: (_data, variables) => {
      void invalidate();
      if (!restTimerEnabled || session?.finishedAt) return;
      const rest = session?.exercises.find((e) => e.exerciseId === variables.exerciseId)?.restSec;
      if (rest) setRestEndsAt(Date.now() + rest * 1000);
    },
  });
  const deleteSetMutation = useMutation({ mutationFn: deleteLoggedSet, onSuccess: invalidate });
  const addMutation = useMutation({
    mutationFn: (exercise: Exercise) =>
      addExerciseToSession(sessionId!, { exerciseId: exercise.id, exerciseName: exercise.name }),
    onSuccess: invalidate,
  });
  const removeMutation = useMutation({ mutationFn: removeSessionExercise, onSuccess: invalidate });
  const renameMutation = useMutation({
    mutationFn: (name: string) => renameSession(sessionId!, name),
    onSuccess: invalidate,
  });
  const notesMutation = useMutation({
    mutationFn: (notes: string) => setSessionNotes(sessionId!, notes),
    onSuccess: invalidate,
  });
  const discardMutation = useMutation({
    mutationFn: () => discardSession(sessionId!),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      void navigate(session?.finishedAt ? '/history' : '/train', { replace: true });
    },
  });
  const finishMutation = useMutation({
    mutationFn: async ({ choice, routineName }: { choice: FinishChoice; routineName?: string }) => {
      if (choice === 'discard') {
        await discardSession(sessionId!);
        return null;
      }
      if (choice === 'save-routine') await saveSessionAsRoutine(sessionId!, routineName ?? '');
      if (choice === 'update-routine') await updateRoutineFromSession(sessionId!);
      await finishSession(sessionId!);
      return sessionId!;
    },
    onSuccess: (id) => {
      void queryClient.invalidateQueries();
      void navigate(id ? `/history/${id}` : '/train', { replace: true });
    },
  });
  const saveTimesMutation = useMutation({
    mutationFn: () => {
      const [y, m, d] = dateInput.split('-').map(Number);
      const [hh, mm] = timeInput.split(':').map(Number);
      const startedAt = new Date(y!, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0);
      return updateSessionTimes(sessionId!, {
        startedAt,
        durationMin: Number(durationInput) || 1,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries();
      void navigate(`/history/${sessionId}`, { replace: true });
    },
  });

  if (sessionQuery.isLoading) return <p className="p-4 text-muted md:p-6">Loading…</p>;
  if (!session) {
    return (
      <div className="space-y-3 p-4 md:p-6">
        <p className="text-rose-500">Could not find this session.</p>
        <Link to="/train" className="font-medium text-accent hover:underline">
          Back to workouts
        </Link>
      </div>
    );
  }

  const editing = session.finishedAt !== null;
  const elapsed = formatElapsed(now - Date.parse(session.startedAt));
  const totalSets = session.sets.length;
  const volumeKg = session.sets.reduce((sum, s) => sum + (s.weightKg ?? 0) * (s.reps ?? 0), 0);
  const volumeLabel =
    volumeKg > 0
      ? `${Math.round(displayWeight(volumeKg, units)).toLocaleString()} ${weightUnit(units)} lifted`
      : 'no load';
  const routineDiffers = Boolean(
    routineQuery.data && sessionDiffersFromRoutine(session, routineQuery.data),
  );
  // Backdated sets land on the session's own date, not "now".
  const completedAt = editing ? session.startedAt : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 pb-24 md:p-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <SessionTitle name={session.workoutName} onRename={(n) => renameMutation.mutate(n)} />
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted tabular-nums">
              <Timer size={14} aria-hidden />
              {editing
                ? new Date(session.startedAt).toLocaleDateString([], {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })
                : elapsed}{' '}
              · {totalSets} set{totalSets === 1 ? '' : 's'}
              {session.workoutId === null && ' · empty workout'}
            </p>
          </div>

          {editing ? (
            <button
              type="button"
              disabled={saveTimesMutation.isPending}
              onClick={() => saveTimesMutation.mutate()}
              className={primaryButton}
            >
              <Save size={15} aria-hidden />
              Save
            </button>
          ) : (
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
                className={`${iconButton} ${
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
                onClick={() => setFinishing(true)}
                className={primaryButton}
              >
                <Flag size={15} aria-hidden />
                Finish
              </button>
            </div>
          )}
        </div>

        {editing && (
          <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface p-3 shadow-sm">
            <label className="space-y-1 text-xs text-muted">
              Date
              <input
                type="date"
                value={dateInput}
                max={toDateInput(new Date().toISOString())}
                onChange={(e) => setDateInput(e.target.value)}
                className="block rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              />
            </label>
            <label className="space-y-1 text-xs text-muted">
              Start
              <input
                type="time"
                value={timeInput}
                onChange={(e) => setTimeInput(e.target.value)}
                className="block rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              />
            </label>
            <label className="space-y-1 text-xs text-muted">
              Duration (min)
              <input
                type="number"
                min="1"
                value={durationInput}
                onChange={(e) => setDurationInput(e.target.value)}
                className="block w-24 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              />
            </label>
          </div>
        )}
      </header>

      <ul className="space-y-2">
        {session.exercises.map((exercise) => (
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
                completedAt,
              })
            }
            onDeleteSet={(setId) => deleteSetMutation.mutate(setId)}
            onRemove={() => removeMutation.mutate(exercise.id)}
          />
        ))}
        {session.exercises.length === 0 && (
          <li className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
            No exercises yet. Add one to get going.
          </li>
        )}
      </ul>

      {picking ? (
        <ExercisePicker
          onPick={(exercise) => addMutation.mutate(exercise)}
          onClose={() => setPicking(false)}
        />
      ) : (
        <button type="button" onClick={() => setPicking(true)} className={secondaryButton}>
          <Plus size={15} aria-hidden />
          Add exercise
        </button>
      )}

      <label className="block space-y-1.5">
        <span className="text-xs font-semibold tracking-wide text-muted uppercase">Notes</span>
        <textarea
          key={session.id}
          defaultValue={session.notes ?? ''}
          onBlur={(e) => {
            if ((e.target.value.trim() || null) !== session.notes)
              notesMutation.mutate(e.target.value);
          }}
          rows={2}
          placeholder="How did it go?"
          className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none placeholder:text-muted/70 focus:border-accent"
        />
      </label>

      <div className="flex items-center justify-between gap-3 pt-2">
        {confirmDiscard ? (
          <span className="flex items-center gap-2 text-sm">
            <span className="text-muted">
              {editing ? 'Delete this workout?' : 'Discard this workout?'}
            </span>
            <button
              type="button"
              disabled={discardMutation.isPending}
              onClick={() => discardMutation.mutate()}
              className="rounded-lg bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-600"
            >
              {editing ? 'Delete' : 'Discard'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDiscard(false)}
              className="rounded-lg px-2.5 py-1 text-xs font-semibold text-muted hover:bg-elev"
            >
              Keep
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDiscard(true)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-rose-500"
          >
            <Trash2 size={13} aria-hidden />
            {editing ? 'Delete workout' : 'Discard workout'}
          </button>
        )}
      </div>

      {/* Floating rest countdown */}
      {!editing && restEndsAt !== null && restRemaining > 0 && (
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

      {finishing && (
        <FinishSheet
          session={session}
          routineDiffers={routineDiffers}
          volumeLabel={volumeLabel}
          pending={finishMutation.isPending}
          onChoose={(choice, routineName) => finishMutation.mutate({ choice, routineName })}
          onClose={() => setFinishing(false)}
        />
      )}
    </div>
  );
}
