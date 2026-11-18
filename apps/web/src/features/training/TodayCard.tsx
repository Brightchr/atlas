import { Link, useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, BedDouble, Play, TimerReset } from 'lucide-react';
import type { TrainingPlan, Workout, WorkoutSession } from '@arcadia/shared';
import { getActivePlanId, listPlans } from '@/features/plans/repository';
import { getOpenSession, listWorkouts, startSession } from '@/features/workouts/repository';
import { localDayOfWeek } from '@/lib/dates';

export interface TodaysDay {
  plan: TrainingPlan;
  isRestDay: boolean;
  workout: Workout | undefined;
}

/** What the plan says about today, plus any session left open. Shared by the
 * dashboard hero and the Workout hub so the two never disagree. */
export function useTodayWorkout(): {
  openSession: WorkoutSession | null | undefined;
  todaysDay: TodaysDay | undefined;
  loaded: boolean;
  start: (workout: Workout) => void;
  starting: boolean;
} {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const plansQuery = useQuery({ queryKey: ['plans'], queryFn: listPlans });
  const activeQuery = useQuery({ queryKey: ['plans', 'active'], queryFn: getActivePlanId });
  const workoutsQuery = useQuery({ queryKey: ['workouts'], queryFn: listWorkouts });
  const openSession = useQuery({ queryKey: ['sessions', 'open'], queryFn: getOpenSession });

  const workoutsById = new Map((workoutsQuery.data ?? []).map((w) => [w.id, w]));
  const today = localDayOfWeek();
  // The ACTIVE plan decides the day; without one, any plan that schedules
  // something today still works (the pre-switcher behavior).
  const activeId = activeQuery.data ?? null;
  const orderedPlans = [...(plansQuery.data ?? [])].sort(
    (a, b) => Number(b.id === activeId) - Number(a.id === activeId),
  );
  const todaysDay = orderedPlans
    .filter((plan) => activeId === null || plan.id === activeId)
    .flatMap((plan) =>
      plan.days
        .filter((d) => d.dayOfWeek === today)
        .map((d) => ({
          plan,
          isRestDay: d.isRestDay,
          workout: d.workoutId ? workoutsById.get(d.workoutId) : undefined,
        })),
    )
    .find((d) => d.isRestDay || d.workout);

  const start = useMutation({
    mutationFn: startSession,
    onSuccess: (sessionId) => {
      void queryClient.invalidateQueries({ queryKey: ['sessions'] });
      void navigate(`/workouts/session/${sessionId}`);
    },
  });

  return {
    openSession: openSession.data,
    todaysDay,
    loaded: plansQuery.isSuccess && workoutsQuery.isSuccess && openSession.isSuccess,
    start: (w) => start.mutate(w),
    starting: start.isPending,
  };
}

/** Today's planned workout, startable in one tap, with an abandoned session
 * surfaced first wherever the card renders. */
export function TodayCard() {
  const { openSession, todaysDay, start, starting } = useTodayWorkout();

  if (openSession) {
    return (
      <section className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold">
            <TimerReset size={16} className="mr-1.5 inline text-amber-600" aria-hidden />
            Workout in progress: {openSession.workoutName}
            <span className="ml-2 text-sm font-normal text-muted">
              {openSession.sets.length} sets logged
            </span>
          </p>
          <Link
            to={`/workouts/session/${openSession.id}`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-linear-to-r from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-accent-ink shadow-sm hover:opacity-90"
          >
            Resume
            <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">Today</p>
      {todaysDay ? (
        todaysDay.isRestDay ? (
          <p className="mt-1 flex items-center gap-2 font-semibold">
            <BedDouble size={17} className="text-accent" aria-hidden />
            Rest day — recovery counts as training.
          </p>
        ) : (
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">
              <Link to={`/workouts/${todaysDay.workout!.id}`} className="hover:underline">
                {todaysDay.workout!.name}
              </Link>
              <span className="ml-2 text-sm font-normal text-muted">
                from “{todaysDay.plan.name}” · {todaysDay.workout!.exercises.length} exercises
              </span>
            </p>
            <button
              type="button"
              disabled={starting}
              onClick={() => start(todaysDay.workout!)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-linear-to-r from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Play size={14} aria-hidden />
              Start workout
            </button>
          </div>
        )
      ) : (
        <p className="mt-1 text-sm text-muted">
          Nothing planned for today —{' '}
          <Link to="/train/explore" className="font-medium text-accent hover:underline">
            get a recommended plan
          </Link>{' '}
          or{' '}
          <Link to="/train/schedule" className="font-medium text-accent hover:underline">
            build your own
          </Link>
          .
        </p>
      )}
    </section>
  );
}
