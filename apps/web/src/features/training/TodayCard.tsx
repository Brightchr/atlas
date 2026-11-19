import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TrainingPlan, Workout, WorkoutSession } from '@arcadia/shared';
import { getActivePlanId, listPlans } from '@/features/plans/repository';
import { getOpenSession, listWorkouts, startSession } from '@/features/workouts/repository';
import { localDayOfWeek, localIsoDate } from '@/lib/dates';
import { pickNextUp } from './nextUp';
import { listSessionHistory, type SessionSummary } from './stats';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** The next workout in the plan (see nextUp.ts for how it is chosen). */
export interface NextUp {
  plan: TrainingPlan;
  workout: Workout;
  /** The weekday the plan pencils this workout in for (Monday = 0). */
  dayOfWeek: number;
  /** A plan workout was already finished today; this one is for next time. */
  doneToday: boolean;
}

/** The open session (if any) and the plan's next workout. Shared by the Home
 * hero and the Workout tab so the two never disagree. */
export function useTodayWorkout(): {
  openSession: WorkoutSession | null | undefined;
  nextUp: NextUp | undefined;
  hasPlan: boolean;
  /** The plan marks today as rest (or simply has nothing on it). */
  restToday: boolean;
  /** The most recent finished workout, for the "last workout" line. */
  lastSession: SessionSummary | undefined;
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
  const history = useQuery({
    queryKey: ['sessions', 'history', 'recent'],
    queryFn: () => listSessionHistory(20),
  });

  const workoutsById = new Map((workoutsQuery.data ?? []).map((w) => [w.id, w]));
  // The ACTIVE plan decides; without one, the first plan with a workout in it.
  const plans = plansQuery.data ?? [];
  const usable = (p: TrainingPlan) =>
    p.days.some((d) => !d.isRestDay && d.workoutId && workoutsById.has(d.workoutId));
  const plan = plans.find((p) => p.id === activeQuery.data && usable(p)) ?? plans.find(usable);

  let nextUp: NextUp | undefined;
  if (plan) {
    const days = plan.days
      .filter((d) => !d.isRestDay && d.workoutId && workoutsById.has(d.workoutId))
      .map((d) => ({ dayOfWeek: d.dayOfWeek, workoutId: d.workoutId! }))
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek);
    const finished = history.data ?? [];
    const next = pickNextUp(days, finished, localDayOfWeek());
    if (next) {
      const inPlan = new Set(days.map((d) => d.workoutId));
      const todayKey = localIsoDate();
      nextUp = {
        plan,
        workout: workoutsById.get(next.workoutId)!,
        dayOfWeek: next.dayOfWeek,
        doneToday: finished.some(
          (s) =>
            s.workoutId !== null &&
            inPlan.has(s.workoutId) &&
            localIsoDate(new Date(s.startedAt)) === todayKey,
        ),
      };
    }
  }

  const start = useMutation({
    mutationFn: startSession,
    onSuccess: (sessionId) => {
      void queryClient.invalidateQueries({ queryKey: ['sessions'] });
      void navigate(`/workouts/session/${sessionId}`);
    },
  });

  return {
    openSession: openSession.data,
    nextUp,
    hasPlan: Boolean(plan),
    restToday:
      Boolean(plan) &&
      !plan!.days.some(
        (d) => d.dayOfWeek === localDayOfWeek() && !d.isRestDay && Boolean(d.workoutId),
      ),
    lastSession: history.data?.[0],
    loaded:
      plansQuery.isSuccess && workoutsQuery.isSuccess && openSession.isSuccess && history.isSuccess,
    start: (w) => start.mutate(w),
    starting: start.isPending,
  };
}

/** "Today", "Tomorrow" or the weekday the plan has this workout on. */
export function scheduledLabel(dayOfWeek: number): string {
  const today = localDayOfWeek();
  if (dayOfWeek === today) return 'today';
  if (dayOfWeek === (today + 1) % 7) return 'tomorrow';
  return DAY_NAMES[dayOfWeek]!;
}
