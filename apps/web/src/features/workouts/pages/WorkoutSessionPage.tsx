import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  ChevronDown,
  Flag,
  Pencil,
  Plus,
  Save,
  Timer,
  TimerOff,
  Trash2,
} from 'lucide-react';
import type { Exercise, SessionExercise, WorkoutSession } from '@arcadia/shared';
import {
  Button,
  buttonClasses,
  Card,
  ConfirmSheet,
  IconButton,
  Sheet,
  useBack,
} from '@/components/ui';
import { displayWeight, useUnits, weightUnit } from '@/lib/units';
import { useRestTimerEnabled, useSetRestTimerEnabled } from '@/lib/restTimer';
import { ExerciseCard, type SetValues } from '../components/ExerciseCard';
import { ExercisePicker } from '../components/ExercisePicker';
import { RestBar } from '../components/RestBar';
import {
  addExerciseToSession,
  deleteLoggedSet,
  discardSession,
  finishSession,
  getPreviousSets,
  getSession,
  getWorkout,
  logSet,
  moveSessionExercise,
  removeSessionExercise,
  renameSession,
  saveSessionAsRoutine,
  sessionDiffersFromRoutine,
  setSessionNotes,
  updateRoutineFromSession,
  updateSessionTimes,
} from '../repository';
import { DEFAULT_REST_SEC, formatClock, startRest, stopRest } from '../restTimer';
import { useWakeLock } from '../useWakeLock';

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

const field =
  'block min-h-11 rounded-xl border border-line bg-bg px-3 text-base text-ink outline-none focus:border-accent';

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
        className="flex max-w-full items-center gap-1.5 text-left"
        title="Rename this workout"
      >
        <h1 className="truncate text-lg font-bold">{name}</h1>
        <Pencil size={13} className="shrink-0 text-muted" aria-hidden />
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
      className="h-9 w-full rounded-lg border border-line bg-bg px-2 text-lg font-bold outline-none focus:border-accent"
    />
  );
}

/** Finishing saves the workout to history. By default it changes NOTHING
 * else: what you did today (an extra exercise, a skipped one) must never
 * rewrite the plan. Two opt-in switches, both off until you turn them on,
 * keep the old abilities for when you do mean it:
 *   - an extra/ad-hoc workout can be saved as a new routine;
 *   - a workout that drifted from its routine can update that routine. */
type FinishChoice = 'finish' | 'discard';

interface FinishOptions {
  /** Save this ad-hoc workout as a new routine under this name. */
  saveAsRoutine?: string;
  /** Make the routine match the exercises done in this workout. */
  updateRoutine?: boolean;
}

/** A labelled on/off row, 48px tall, for the optional finish switches. */
function ToggleRow({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line px-3 py-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 shrink-0 accent-(--accent)"
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
    </label>
  );
}

function FinishSheet({
  session,
  routineDiffers,
  volumeLabel,
  pending,
  onChoose,
  onClose,
}: {
  session: WorkoutSession;
  /** The session's exercises no longer match the routine it started from. */
  routineDiffers: boolean;
  volumeLabel: string;
  pending: boolean;
  onChoose: (choice: FinishChoice, options?: FinishOptions) => void;
  onClose: () => void;
}) {
  const elapsed = formatClock((Date.now() - Date.parse(session.startedAt)) / 1000);
  const nothingLogged = session.sets.length === 0;
  const adHoc = session.workoutId === null;
  const canSaveRoutine = adHoc && session.exercises.length > 0;
  const [saveRoutine, setSaveRoutine] = useState(false);
  const [routineName, setRoutineName] = useState(session.workoutName);
  const [updateRoutine, setUpdateRoutine] = useState(false);

  return (
    <Sheet title="Finish workout?" onClose={onClose}>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          ['Time', elapsed],
          ['Sets', String(session.sets.length)],
          ['Lifted', volumeLabel],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-elev px-2 py-3">
            <p className="truncate text-lg font-bold tabular-nums">{value}</p>
            <p className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</p>
          </div>
        ))}
      </div>

      {nothingLogged && (
        <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-300">
          Nothing was logged. Finishing keeps an empty entry in your history.
        </p>
      )}

      {canSaveRoutine && (
        <div className="mt-4 space-y-2">
          <ToggleRow
            checked={saveRoutine}
            onChange={setSaveRoutine}
            label="Also save as a routine"
            hint="Keeps these exercises as a routine you can put in your plan."
          />
          {saveRoutine && (
            <input
              value={routineName}
              onChange={(e) => setRoutineName(e.target.value)}
              aria-label="Routine name"
              className={`${field} w-full`}
            />
          )}
        </div>
      )}
      {!adHoc && routineDiffers && (
        <div className="mt-4">
          <ToggleRow
            checked={updateRoutine}
            onChange={setUpdateRoutine}
            label="Also update the routine"
            hint="Makes the routine match today's exercises. Leave off to keep your plan as it is."
          />
        </div>
      )}

      <div className="mt-5 grid gap-2">
        <Button
          size="xl"
          disabled={pending}
          onClick={() =>
            onChoose('finish', {
              saveAsRoutine: canSaveRoutine && saveRoutine ? routineName : undefined,
              updateRoutine: !adHoc && routineDiffers && updateRoutine,
            })
          }
        >
          <Flag size={20} aria-hidden />
          Finish workout
        </Button>
        {nothingLogged && (
          <Button size="lg" variant="danger" disabled={pending} onClick={() => onChoose('discard')}>
            <Trash2 size={18} aria-hidden />
            Discard instead
          </Button>
        )}
        <Button size="lg" variant="ghost" onClick={onClose}>
          Keep going
        </Button>
      </div>
    </Sheet>
  );
}

/** Reorder, how-to and remove for one exercise, as a sheet of big rows. */
function ExerciseMenu({
  exercise,
  isFirst,
  isLast,
  onMove,
  onRemove,
  onClose,
}: {
  exercise: SessionExercise;
  isFirst: boolean;
  isLast: boolean;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const row = buttonClasses('secondary', 'lg', 'w-full justify-start');
  return (
    <Sheet title={exercise.exerciseName} onClose={onClose}>
      <div className="grid gap-2">
        {/* Safe to leave now: the workout and its rest timer follow you in
            the bar above the tabs. */}
        <Link to={`/exercises/${exercise.exerciseId}`} className={row}>
          <BookOpen size={18} aria-hidden />
          How to do it
        </Link>
        <button type="button" disabled={isFirst} onClick={() => onMove(-1)} className={row}>
          <ArrowUp size={18} aria-hidden />
          Move earlier
        </button>
        <button type="button" disabled={isLast} onClick={() => onMove(1)} className={row}>
          <ArrowDown size={18} aria-hidden />
          Move later
        </button>
        <button
          type="button"
          onClick={onRemove}
          className={buttonClasses('danger', 'lg', 'w-full justify-start')}
        >
          <Trash2 size={18} aria-hidden />
          Remove from this workout
        </button>
      </div>
    </Sheet>
  );
}

/** Live logging for an open session, and the editor for a finished one
 * (reached from History): same screen, with the clock swapped for date and
 * duration fields. Exercises belong to the session — adding or removing one
 * here never changes the routine it came from.
 *
 * On a phone this screen is "workout mode": the app shell hides its top bar
 * and tabs (see AppLayout), the header and Finish stay pinned, the screen
 * stays awake, and the rest timer sits under the thumb. */
export function WorkoutSessionPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const units = useUnits();
  const backToHistory = useBack('/history');

  const sessionQuery = useQuery({
    queryKey: ['sessions', sessionId],
    queryFn: () => getSession(sessionId!),
  });
  const session = sessionQuery.data;
  // The routine this session started from, to tell whether it drifted.
  const routineQuery = useQuery({
    queryKey: ['workouts', session?.workoutId],
    queryFn: () => getWorkout(session!.workoutId!),
    enabled: Boolean(session?.workoutId),
  });
  // Last time's numbers for every exercise in this session. Its key is NOT
  // under ['sessions'], so logging a set doesn't refetch it: history can't
  // change while this session is still open.
  const exerciseIds = (session?.exercises ?? []).map((e) => e.exerciseId);
  const previousQuery = useQuery({
    queryKey: ['previous-sets', sessionId, exerciseIds.join(',')],
    queryFn: () => getPreviousSets(exerciseIds, sessionId!),
    enabled: exerciseIds.length > 0,
  });

  const live = Boolean(session) && session!.finishedAt === null;
  useWakeLock(live);

  // Tick once a second for the elapsed clock.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [live]);

  const restTimerEnabled = useRestTimerEnabled();
  const setRestTimerEnabled = useSetRestTimerEnabled();
  const toggleRestTimer = () => {
    if (restTimerEnabled) stopRest(); // silence a running countdown too
    setRestTimerEnabled.mutate(!restTimerEnabled);
  };

  // Which exercise is open. null = "the current one" (first unfinished);
  // an id = the user opened that one; 'none' = they collapsed everything.
  const [openId, setOpenId] = useState<string | null>(null);
  // `?add=1` (from "Log extra exercise") opens the picker straight away.
  const [searchParams] = useSearchParams();
  const [picking, setPicking] = useState(searchParams.get('add') === '1');
  const [finishing, setFinishing] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [menuFor, setMenuFor] = useState<SessionExercise | null>(null);
  const [removing, setRemoving] = useState<SessionExercise | null>(null);

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
      // Hand control back to "the current exercise", so finishing one
      // exercise's sets opens the next unfinished one automatically.
      setOpenId(null);
      if (!restTimerEnabled || !session || session.finishedAt) return;
      const exercise = session.exercises.find((e) => e.exerciseId === variables.exerciseId);
      // Exercises added mid-workout have no rest time of their own.
      startRest(session.id, exercise?.restSec ?? DEFAULT_REST_SEC);
    },
  });
  const deleteSetMutation = useMutation({ mutationFn: deleteLoggedSet, onSuccess: invalidate });
  const addMutation = useMutation({
    mutationFn: (exercise: Exercise) =>
      addExerciseToSession(sessionId!, { exerciseId: exercise.id, exerciseName: exercise.name }),
    onSuccess: invalidate,
  });
  const removeMutation = useMutation({
    mutationFn: removeSessionExercise,
    onSuccess: () => {
      setRemoving(null);
      void invalidate();
    },
  });
  const moveMutation = useMutation({
    mutationFn: ({ id, direction }: { id: string; direction: -1 | 1 }) =>
      moveSessionExercise(id, direction),
    onSuccess: invalidate,
  });
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
      stopRest();
      void queryClient.invalidateQueries();
      void navigate(session?.finishedAt ? '/history' : '/', { replace: true });
    },
  });
  const finishMutation = useMutation({
    mutationFn: async ({ choice, options }: { choice: FinishChoice; options?: FinishOptions }) => {
      if (choice === 'discard') {
        await discardSession(sessionId!);
        return null;
      }
      // Both only run when the user switched them on in the finish sheet.
      if (options?.saveAsRoutine !== undefined) {
        await saveSessionAsRoutine(sessionId!, options.saveAsRoutine);
      }
      if (options?.updateRoutine) await updateRoutineFromSession(sessionId!);
      await finishSession(sessionId!);
      return sessionId!;
    },
    onSuccess: (id) => {
      stopRest();
      void queryClient.invalidateQueries();
      void navigate(id ? `/history/${id}` : '/', { replace: true });
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
        <Link to="/" className={buttonClasses('secondary')}>
          Back to Today
        </Link>
      </div>
    );
  }

  const editing = session.finishedAt !== null;
  const totalSets = session.sets.length;
  const volumeKg = session.sets.reduce((sum, s) => sum + (s.weightKg ?? 0) * (s.reps ?? 0), 0);
  const volumeLabel =
    volumeKg > 0
      ? `${Math.round(displayWeight(volumeKg, units)).toLocaleString()} ${weightUnit(units)}`
      : '—';
  const routineDiffers = Boolean(
    routineQuery.data && sessionDiffersFromRoutine(session, routineQuery.data),
  );
  // Backdated sets land on the session's own date, not "now".
  const completedAt = editing ? session.startedAt : undefined;

  const setsFor = (exercise: SessionExercise) =>
    session.sets.filter((s) => s.exerciseId === exercise.exerciseId);
  const isDone = (exercise: SessionExercise) => {
    const target = exercise.targetSets ?? (exercise.targetDurationSec !== null ? 1 : 3);
    return setsFor(exercise).length >= target;
  };
  const current = session.exercises.find((e) => !isDone(e));
  const expandedId = openId ?? current?.id ?? null;
  const doneCount = session.exercises.filter(isDone).length;

  const log = (exercise: SessionExercise, values: SetValues) =>
    logMutation.mutate({
      sessionId: session.id,
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.exerciseName,
      completedAt,
      ...values,
    });

  return (
    <div className="mx-auto max-w-3xl">
      {/* Pinned header: leave (minimise), what and how long, Finish. */}
      <header className="sticky top-0 z-20 flex items-center gap-1 border-b border-line bg-bg/90 px-2 py-2 backdrop-blur-xl md:px-4">
        {editing ? (
          <IconButton label="Back" onClick={backToHistory}>
            <ChevronDown size={24} className="rotate-90" aria-hidden />
          </IconButton>
        ) : (
          <IconButton
            label="Minimise workout (it keeps running)"
            onClick={() => void navigate('/')}
          >
            <ChevronDown size={24} aria-hidden />
          </IconButton>
        )}
        <div className="min-w-0 flex-1">
          <SessionTitle name={session.workoutName} onRename={(n) => renameMutation.mutate(n)} />
          <p className="truncate text-sm text-muted tabular-nums">
            {editing ? (
              new Date(session.startedAt).toLocaleDateString([], {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })
            ) : (
              <span className="font-semibold text-ink">
                {formatClock((now - Date.parse(session.startedAt)) / 1000)}
              </span>
            )}{' '}
            · {totalSets} set{totalSets === 1 ? '' : 's'}
            {session.exercises.length > 0 && ` · ${doneCount}/${session.exercises.length} done`}
          </p>
        </div>

        {editing ? (
          <Button disabled={saveTimesMutation.isPending} onClick={() => saveTimesMutation.mutate()}>
            <Save size={16} aria-hidden />
            Save
          </Button>
        ) : (
          <>
            <IconButton
              label={
                restTimerEnabled
                  ? 'Rest timer on: tap to stop it starting after each set'
                  : 'Rest timer off: tap to turn it back on'
              }
              aria-pressed={restTimerEnabled}
              variant={restTimerEnabled ? 'soft' : 'ghost'}
              onClick={toggleRestTimer}
            >
              {restTimerEnabled ? (
                <Timer size={20} aria-hidden />
              ) : (
                <TimerOff size={20} aria-hidden />
              )}
            </IconButton>
            <Button disabled={finishMutation.isPending} onClick={() => setFinishing(true)}>
              <Flag size={16} aria-hidden />
              Finish
            </Button>
          </>
        )}
      </header>

      {/* pb-48 keeps the last card clear of the rest bar. */}
      <div className="space-y-3 p-3 pb-48 md:p-6 md:pb-40">
        {editing && (
          <Card className="flex flex-wrap items-end gap-3 p-3">
            <label className="space-y-1 text-sm text-muted">
              Date
              <input
                type="date"
                value={dateInput}
                max={toDateInput(new Date().toISOString())}
                onChange={(e) => setDateInput(e.target.value)}
                className={field}
              />
            </label>
            <label className="space-y-1 text-sm text-muted">
              Start
              <input
                type="time"
                value={timeInput}
                onChange={(e) => setTimeInput(e.target.value)}
                className={field}
              />
            </label>
            <label className="space-y-1 text-sm text-muted">
              Duration (min)
              <input
                type="text"
                inputMode="numeric"
                value={durationInput}
                onChange={(e) => setDurationInput(e.target.value.replace(/[^0-9]/g, ''))}
                className={`${field} w-24`}
              />
            </label>
          </Card>
        )}

        <ul className="space-y-2">
          {session.exercises.map((exercise) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              sets={setsFor(exercise)}
              previous={previousQuery.data?.[exercise.exerciseId] ?? []}
              units={units}
              expanded={expandedId === exercise.id}
              pending={logMutation.isPending}
              onToggle={() => setOpenId(expandedId === exercise.id ? 'none' : exercise.id)}
              onLog={(values) => log(exercise, values)}
              onUnlog={(setId) => deleteSetMutation.mutate(setId)}
              onMenu={() => setMenuFor(exercise)}
            />
          ))}
          {session.exercises.length === 0 && (
            <li className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">
              No exercises yet. Add your first one to get going.
            </li>
          )}
        </ul>

        <Button
          variant={session.exercises.length === 0 ? 'primary' : 'secondary'}
          size="lg"
          block
          onClick={() => setPicking(true)}
        >
          <Plus size={18} aria-hidden />
          Add exercise
        </Button>

        <label className="block space-y-1.5 pt-2">
          <span className="px-1 text-xs font-semibold tracking-wide text-muted uppercase">
            Notes
          </span>
          <textarea
            key={session.id}
            defaultValue={session.notes ?? ''}
            onBlur={(e) => {
              if ((e.target.value.trim() || null) !== session.notes)
                notesMutation.mutate(e.target.value);
            }}
            rows={2}
            placeholder="How did it go?"
            className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-base outline-none placeholder:text-muted/70 focus:border-accent"
          />
        </label>

        <Button variant="ghost" block onClick={() => setConfirmDiscard(true)}>
          <Trash2 size={16} aria-hidden />
          {editing ? 'Delete workout' : 'Discard workout'}
        </Button>
      </div>

      {!editing && <RestBar sessionId={session.id} />}

      {picking && (
        <Sheet title="Add exercise" tall onClose={() => setPicking(false)}>
          <ExercisePicker
            onPick={(exercise) => addMutation.mutate(exercise)}
            onClose={() => setPicking(false)}
          />
        </Sheet>
      )}

      {menuFor && (
        <ExerciseMenu
          exercise={menuFor}
          isFirst={session.exercises[0]?.id === menuFor.id}
          isLast={session.exercises[session.exercises.length - 1]?.id === menuFor.id}
          onMove={(direction) => {
            moveMutation.mutate({ id: menuFor.id, direction });
            setMenuFor(null);
          }}
          onRemove={() => {
            // Nothing logged: nothing to lose, so no second question.
            if (setsFor(menuFor).length === 0) removeMutation.mutate(menuFor.id);
            else setRemoving(menuFor);
            setMenuFor(null);
          }}
          onClose={() => setMenuFor(null)}
        />
      )}

      {removing && (
        <ConfirmSheet
          title={`Remove ${removing.exerciseName}?`}
          body={`This also deletes the ${setsFor(removing).length} set${
            setsFor(removing).length === 1 ? '' : 's'
          } you logged for it in this workout.`}
          confirmLabel="Remove exercise"
          pending={removeMutation.isPending}
          onConfirm={() => removeMutation.mutate(removing.id)}
          onClose={() => setRemoving(null)}
        />
      )}

      {confirmDiscard && (
        <ConfirmSheet
          title={editing ? 'Delete this workout?' : 'Discard this workout?'}
          body={
            totalSets > 0
              ? `Everything logged in it (${totalSets} set${totalSets === 1 ? '' : 's'}) will be deleted. This cannot be undone.`
              : 'It will be removed. This cannot be undone.'
          }
          confirmLabel={editing ? 'Delete workout' : 'Discard workout'}
          pending={discardMutation.isPending}
          onConfirm={() => discardMutation.mutate()}
          onClose={() => setConfirmDiscard(false)}
        />
      )}

      {finishing && (
        <FinishSheet
          session={session}
          routineDiffers={routineDiffers}
          volumeLabel={volumeLabel}
          pending={finishMutation.isPending}
          onChoose={(choice, options) => finishMutation.mutate({ choice, options })}
          onClose={() => setFinishing(false)}
        />
      )}
    </div>
  );
}
