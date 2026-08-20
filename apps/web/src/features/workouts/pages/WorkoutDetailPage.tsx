import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Dumbbell, Play, Plus, Search, X } from 'lucide-react';
import type { Exercise, WorkoutExercise } from '@arcadia/shared';
import { filterExercises } from '@/lib/exercise-db/client';
import { useExerciseCatalog } from '@/features/exercises/api';
import {
  addExerciseToWorkout,
  getWorkout,
  removeWorkoutExercise,
  startSession,
  updateWorkoutExercise,
} from '../repository';

/** Inline catalog search for adding an exercise to this workout. */
function ExercisePicker({ onPick, onClose }: { onPick: (e: Exercise) => void; onClose: () => void }) {
  const [term, setTerm] = useState('');
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const catalog = useExerciseCatalog();
  const matches = term.trim().length >= 2 ? filterExercises(catalog.data ?? [], term).slice(0, 8) : [];

  // Picking clears the search and keeps the picker open, so adding five
  // exercises is one flow — the Hevy pattern — with an "Added ✓" flash as
  // feedback instead of a silent list mutation somewhere above.
  const pick = (exercise: Exercise) => {
    onPick(exercise);
    setLastAdded(exercise.name);
    setTerm('');
  };

  return (
    <div className="space-y-2 rounded-2xl border border-line bg-surface p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <input
            type="search"
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={lastAdded ? `Added ${lastAdded} ✓ — search for the next one…` : 'Search the exercise catalog…'}
            className="w-full rounded-xl border border-line bg-surface py-2 pr-3 pl-9 text-sm outline-none placeholder:text-muted/70 focus:border-accent"
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-elev hover:text-ink"
        >
          <X size={15} aria-hidden />
        </button>
      </div>
      <ul className="space-y-1">
        {matches.map((exercise) => (
          <li key={exercise.id}>
            <button
              type="button"
              onClick={() => pick(exercise)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-elev"
            >
              {exercise.imageUrls[0] ? (
                <img src={exercise.imageUrls[0]} alt="" loading="lazy" className="h-9 w-9 shrink-0 rounded-lg bg-white object-contain" />
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-elev text-muted">
                  <Dumbbell size={15} aria-hidden />
                </span>
              )}
              <span className="min-w-0 flex-1 truncate">{exercise.name}</span>
              <span className="shrink-0 text-xs text-muted">
                {exercise.primaryMuscles[0]?.commonName}
              </span>
            </button>
          </li>
        ))}
        {term.trim().length >= 2 && matches.length === 0 && (
          <li className="px-1 text-xs text-muted">No exercises match.</li>
        )}
      </ul>
    </div>
  );
}

/** One editable exercise slot: targets save on change. */
function ExerciseRow({
  exercise,
  imageUrl,
  onChange,
  onRemove,
}: {
  exercise: WorkoutExercise;
  imageUrl: string | undefined;
  onChange: (targets: Partial<WorkoutExercise>) => void;
  onRemove: () => void;
}) {
  const timed = exercise.targetDurationSec !== null;
  const numberInput =
    'w-16 rounded-lg border border-line bg-surface px-2 py-1.5 text-center text-sm outline-none focus:border-accent';

  return (
    <li className="rounded-2xl border border-line bg-surface p-3 shadow-sm">
      <div className="flex items-center gap-3">
        <Link to={`/exercises/${exercise.exerciseId}`} className="shrink-0">
          {imageUrl ? (
            <img src={imageUrl} alt="" loading="lazy" className="h-12 w-12 rounded-xl bg-white object-contain" />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-elev text-muted">
              <Dumbbell size={18} aria-hidden />
            </span>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            to={`/exercises/${exercise.exerciseId}`}
            className="block truncate font-semibold hover:text-accent"
          >
            {exercise.exerciseName}
          </Link>
          <p className="text-xs text-muted tabular-nums">
            {timed
              ? `${Math.round((exercise.targetDurationSec ?? 0) / 60)} min target`
              : `${exercise.targetSets} × ${exercise.targetReps ?? '—'}`}
            {exercise.restSec ? ` · ${exercise.restSec}s rest` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${exercise.exerciseName}`}
          className="shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-elev hover:text-ink"
        >
          <X size={15} aria-hidden />
        </button>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
        {timed ? (
          <label className="flex items-center gap-1.5">
            Minutes
            <input
              type="number"
              min="1"
              defaultValue={Math.round((exercise.targetDurationSec ?? 0) / 60)}
              onBlur={(e) =>
                Number(e.target.value) > 0 &&
                onChange({ targetDurationSec: Math.round(Number(e.target.value) * 60) })
              }
              className={numberInput}
            />
          </label>
        ) : (
          <>
            <label className="flex items-center gap-1.5">
              Sets
              <input
                type="number"
                min="1"
                defaultValue={exercise.targetSets}
                onBlur={(e) =>
                  Number(e.target.value) > 0 && onChange({ targetSets: Number(e.target.value) })
                }
                className={numberInput}
              />
            </label>
            <label className="flex items-center gap-1.5">
              Reps
              <input
                type="number"
                min="1"
                defaultValue={exercise.targetReps ?? ''}
                onBlur={(e) =>
                  Number(e.target.value) > 0 && onChange({ targetReps: Number(e.target.value) })
                }
                className={numberInput}
              />
            </label>
          </>
        )}
        <label className="flex items-center gap-1.5">
          Rest (s)
          <input
            type="number"
            min="0"
            step="15"
            defaultValue={exercise.restSec ?? ''}
            onBlur={(e) => onChange({ restSec: Number(e.target.value) || null })}
            className={numberInput}
          />
        </label>
      </div>
    </li>
  );
}

export function WorkoutDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [picking, setPicking] = useState(false);

  const workoutQuery = useQuery({ queryKey: ['workouts', id], queryFn: () => getWorkout(id!) });
  const catalog = useExerciseCatalog();
  const imagesById = new Map((catalog.data ?? []).map((e) => [e.id, e.imageUrls[0]]));

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['workouts'] });
  };
  const addMutation = useMutation({
    mutationFn: (exercise: Exercise) =>
      addExerciseToWorkout(id!, { exerciseId: exercise.id, exerciseName: exercise.name }),
    onSuccess: invalidate,
  });
  const removeMutation = useMutation({ mutationFn: removeWorkoutExercise, onSuccess: invalidate });
  const updateMutation = useMutation({
    mutationFn: (args: { exerciseId: string; targets: Partial<WorkoutExercise> }) =>
      updateWorkoutExercise(args.exerciseId, args.targets),
    onSuccess: invalidate,
  });
  const startMutation = useMutation({
    mutationFn: () => startSession(workoutQuery.data!),
    onSuccess: (sessionId) => {
      void queryClient.invalidateQueries({ queryKey: ['sessions'] });
      void navigate(`/workouts/session/${sessionId}`);
    },
  });

  if (workoutQuery.isLoading) return <p className="p-4 text-muted md:p-6">Loading…</p>;
  const workout = workoutQuery.data;
  if (!workout) {
    return (
      <div className="space-y-3 p-4 md:p-6">
        <p className="text-rose-500">Could not find this workout.</p>
        <Link to="/train/library" className="font-medium text-accent hover:underline">
          Back to workouts
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <Link
        to="/train/library"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
      >
        <ArrowLeft size={15} aria-hidden />
        Workouts
      </Link>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{workout.name}</h1>
          <p className="text-sm text-muted">
            {workout.exercises.length} exercise{workout.exercises.length === 1 ? '' : 's'}
            {workout.notes ? ` · ${workout.notes}` : ''}
          </p>
        </div>
        <button
          type="button"
          disabled={workout.exercises.length === 0 || startMutation.isPending}
          onClick={() => startMutation.mutate()}
          className="inline-flex items-center gap-2 rounded-xl bg-linear-to-r from-accent to-accent-2 px-5 py-2.5 font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Play size={16} aria-hidden />
          Start workout
        </button>
      </header>

      <ul className="space-y-2">
        {workout.exercises.map((exercise) => (
          <ExerciseRow
            key={exercise.id}
            exercise={exercise}
            imageUrl={imagesById.get(exercise.exerciseId)}
            onChange={(targets) => updateMutation.mutate({ exerciseId: exercise.id, targets })}
            onRemove={() => removeMutation.mutate(exercise.id)}
          />
        ))}
      </ul>

      {picking ? (
        <ExercisePicker
          onPick={(exercise) => addMutation.mutate(exercise)}
          onClose={() => setPicking(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-2 text-sm font-semibold shadow-sm transition-colors hover:bg-elev"
        >
          <Plus size={15} aria-hidden />
          Add exercise
        </button>
      )}

      <p className="text-xs text-muted/70">
        Changes to sets, reps and rest save automatically. Tap an exercise for photos and how-to.
      </p>
    </div>
  );
}
