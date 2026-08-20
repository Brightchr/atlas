import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Clock, Download, Dumbbell, ListChecks, Wrench } from 'lucide-react';
import { fetchAllExercises } from '@/lib/exercise-db/client';
import { GOAL_LABELS, LEVEL_LABELS, type TrainingGoal, type TrainingLevel } from '../profile';
import { CATALOG_WORKOUTS, type CatalogWorkout } from '../catalog';
import { importCatalogWorkout } from '../recommend';
import { WORKOUT_WHY } from '../writeups';

const levelTone: Record<TrainingLevel, string> = {
  beginner: 'bg-emerald-500/10 text-emerald-500',
  intermediate: 'bg-amber-500/10 text-amber-500',
  advanced: 'bg-rose-500/10 text-rose-500',
};

/** The coach's standing orders, derived from what the workout IS — every
 * catalog workout states how it's meant to be run, not just what's in it. */
function coachDirections(w: CatalogWorkout): string[] {
  const byGoal: Record<TrainingGoal, string[]> = {
    get_stronger: [
      'Every set heavy but crisp: stop with one clean rep left in the tank.',
      'Rest the FULL timer between sets — strength is built in the recovery, and cutting rest turns this into a different workout.',
      'Progress rule: when you hit every prescribed rep, add 2.5 kg (5 lb) next session. Miss reps two sessions running? Drop 10% and rebuild.',
    ],
    build_muscle: [
      'Work one to two reps shy of failure on every set — the last reps should be slow, not ugly.',
      'Control the lowering phase (~2 seconds down). The rep counts only if the muscle did it, not momentum.',
      'Progress rule: add a rep per set week to week; when you hit the top of the range everywhere, add weight and start again.',
    ],
    lose_weight: [
      'The pace IS the workout: keep rests honest — start the next set the moment the timer ends.',
      'Scale reps down before you scale effort down. Moving continuously beats grinding to a stop.',
      'Progress rule: each week, either shave rest by 5 seconds or add a rep — never both at once.',
    ],
    general: [
      'Smooth full-range reps at an effort of about 7 out of 10 — you should finish feeling worked, not wrecked.',
      'Consistency beats intensity here: the goal is showing up again in two days.',
      'Progress rule: when a weight feels easy for every set, nudge it up a little.',
    ],
  };
  const byLevel: Record<TrainingLevel, string> = {
    beginner:
      'Form first: watch each exercise’s how-to below before your first session, and take extra rest whenever form starts to slip.',
    intermediate:
      'You know the movements — the discipline now is logging every set and following the progression rule without skipping it.',
    advanced:
      'Autoregulate: on strong days push the top sets, on flat days hit the prescribed work and leave. The plan survives bad days by not fighting them.',
  };
  return [...byGoal[w.goal], byLevel[w.level]];
}

/** ~45s of work per set plus its rest. */
function estimateMinutes(w: CatalogWorkout): number {
  const seconds = w.exercises.reduce(
    (sum, e) => sum + e.sets * ((e.minutes ? e.minutes * 60 : 45) + e.restSec),
    0,
  );
  return Math.max(10, Math.round(seconds / 60 / 5) * 5);
}

/** A catalog workout's full profile: what it is, how the coach wants it run,
 * every exercise (each a door to its own how-to), and what you'll need —
 * so "Add" is an informed choice, never a blind one. */
export function CatalogWorkoutPage() {
  const { key } = useParams<{ key: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const workout = CATALOG_WORKOUTS.find((w) => w.key === key);

  const exerciseIndex = useQuery({
    queryKey: ['exercise-name-index'],
    queryFn: async () => new Map((await fetchAllExercises()).map((e) => [e.name, e])),
    staleTime: Infinity,
  });

  const add = useMutation({
    mutationFn: (w: CatalogWorkout) => importCatalogWorkout(w),
    onSuccess: (localId) => {
      void queryClient.invalidateQueries({ queryKey: ['workouts'] });
      navigate(`/workouts/${localId}`);
    },
  });

  if (!workout) {
    return (
      <div className="mx-auto max-w-3xl p-6 text-center text-sm text-muted">
        This workout isn't in the catalog.{' '}
        <Link to="/train/explore" className="text-accent hover:underline">
          Back to Explore
        </Link>
      </div>
    );
  }

  const index = exerciseIndex.data;
  const equipment = new Set<string>();
  if (index) {
    for (const item of workout.exercises) {
      for (const eq of index.get(item.name)?.equipment ?? []) {
        if (eq.name !== 'Body only') equipment.add(eq.name);
      }
    }
  }
  const muscles = new Set<string>();
  if (index) {
    for (const item of workout.exercises) {
      const m = index.get(item.name)?.primaryMuscles[0]?.commonName;
      if (m) muscles.add(m);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <Link
        to="/train/explore"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
      >
        <ArrowLeft size={15} aria-hidden />
        Explore
      </Link>

      <header className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-1.5 flex flex-wrap gap-1.5">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${levelTone[workout.level]}`}>
                {LEVEL_LABELS[workout.level]}
              </span>
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
                {GOAL_LABELS[workout.goal]}
              </span>
            </div>
            <h1 className="text-2xl font-bold">{workout.name}</h1>
            <p className="mt-1 text-sm text-muted">{workout.description}</p>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
              <span className="inline-flex items-center gap-1">
                <Dumbbell size={12} aria-hidden />
                {workout.exercises.length} exercises
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock size={12} aria-hidden />~{estimateMinutes(workout)} min
              </span>
              {muscles.size > 0 && <span>{[...muscles].slice(0, 4).join(' · ')}</span>}
            </p>
          </div>
          <button
            type="button"
            disabled={add.isPending}
            onClick={() => add.mutate(workout)}
            className="springy inline-flex items-center gap-1.5 rounded-xl bg-linear-to-r from-accent to-accent-2 px-4 py-2.5 text-sm font-semibold text-accent-ink shadow-sm hover:opacity-90 disabled:opacity-50"
          >
            <Download size={15} aria-hidden />
            Add to my workouts
          </button>
        </div>
      </header>

      {WORKOUT_WHY[workout.key] && (
        <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <h2 className="mb-1.5 text-sm font-semibold">Why it's built this way</h2>
          <p className="text-sm leading-relaxed text-muted">{WORKOUT_WHY[workout.key]}</p>
        </section>
      )}

      <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <ListChecks size={15} className="text-accent" aria-hidden />
          How this workout is meant to be run
        </h2>
        <ul className="space-y-2">
          {coachDirections(workout).map((line, i) => (
            <li key={i} className="flex gap-2.5 text-sm">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-bold text-accent">
                {i + 1}
              </span>
              <span className="text-muted">{line}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold">The exercises</h2>
        <p className="mb-2 text-xs text-muted">
          Tap any exercise for photos and step-by-step form instructions.
        </p>
        <ul className="divide-y divide-line">
          {workout.exercises.map((item, i) => {
            const exercise = index?.get(item.name);
            return (
              <li key={`${item.name}-${i}`}>
                <Link
                  to={exercise ? `/exercises/${exercise.id}` : '#'}
                  className="springy flex items-center gap-3 rounded-xl px-1 py-2.5 hover:bg-elev"
                >
                  {exercise?.imageUrls[0] ? (
                    <img
                      src={exercise.imageUrls[0]}
                      alt=""
                      loading="lazy"
                      className="h-11 w-11 shrink-0 rounded-lg bg-white object-contain"
                    />
                  ) : (
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-elev text-muted">
                      <Dumbbell size={16} aria-hidden />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted">
                      {exercise?.primaryMuscles[0]?.commonName ?? '—'}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted">
                    {item.minutes
                      ? `${item.sets} × ${item.minutes} min`
                      : `${item.sets} × ${item.reps}`}
                    {` · rest ${item.restSec}s`}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        {equipment.size > 0 && (
          <p className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-line pt-3 text-xs text-muted">
            <Wrench size={12} aria-hidden />
            You'll need:
            {[...equipment].map((eq) => (
              <span key={eq} className="rounded-full bg-elev px-1.5 py-0.5 font-medium">
                {eq}
              </span>
            ))}
          </p>
        )}
      </section>
    </div>
  );
}
