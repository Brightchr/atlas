import { Link, useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, BedDouble, CalendarPlus, CheckCircle2, Play, Plus } from 'lucide-react';
import type { Workout } from '@arcadia/shared';
import { Button, buttonClasses, Card } from '@/components/ui';
import { formatDuration } from '@/features/workouts/components/ExerciseCard';
import { startEmptySession } from '@/features/workouts/repository';
import { scheduledLabel, useTodayWorkout } from './TodayCard';

/** The exercises of a routine, one per line with its target — so you know
 * what you are walking into before you press Start. */
function ExerciseList({ workout }: { workout: Workout }) {
  return (
    <ol className="mt-4 divide-y divide-line border-y border-line">
      {workout.exercises.map((e, i) => (
        <li key={e.id} className="flex min-h-11 items-center gap-3 py-2">
          <span className="w-5 shrink-0 text-sm font-semibold text-muted tabular-nums">
            {i + 1}
          </span>
          <span className="min-w-0 flex-1 truncate font-medium">{e.exerciseName}</span>
          <span className="shrink-0 text-sm text-muted tabular-nums">
            {e.targetSets} ×{' '}
            {e.targetDurationSec !== null
              ? formatDuration(e.targetDurationSec)
              : (e.targetReps ?? '—')}
          </span>
        </li>
      ))}
    </ol>
  );
}

const eyebrow = 'text-xs font-semibold tracking-widest uppercase';

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? 'a week ago' : `${weeks} weeks ago`;
}

/** The top of the Today screen: the workout your PLAN says is next, with its
 * exercises and one Start button. The app is plan-first — there is no blank
 * "empty workout" here. Anything outside the plan is an extra: logged to
 * history for today, never written back into the plan. */
export function TodayWorkout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { openSession, nextUp, hasPlan, restToday, lastSession, loaded, start, starting } =
    useTodayWorkout();

  // An extra is just a session with no routine behind it; `?add=1` opens the
  // exercise picker straight away so it is two taps to the first set.
  const logExtra = useMutation({
    mutationFn: () => startEmptySession('Extra work'),
    onSuccess: (id) => {
      void queryClient.invalidateQueries({ queryKey: ['sessions'] });
      void navigate(`/workouts/session/${id}?add=1`);
    },
  });

  if (openSession) {
    return (
      <Card className="glow-ring p-5">
        <p className={`${eyebrow} text-accent`}>In progress</p>
        <h2 className="mt-2 truncate text-xl font-bold">{openSession.workoutName}</h2>
        <p className="text-sm text-muted">
          {openSession.sets.length} set{openSession.sets.length === 1 ? '' : 's'} logged so far
        </p>
        <Link
          to={`/workouts/session/${openSession.id}`}
          className={buttonClasses('primary', 'xl', 'mt-4 w-full')}
        >
          Resume workout
          <ArrowRight size={20} aria-hidden />
        </Link>
      </Card>
    );
  }

  // Reserve the card's space while the local database answers, so the food
  // card below does not jump.
  if (!loaded) {
    return (
      <div className="h-56 animate-pulse rounded-2xl border border-line bg-surface" aria-hidden />
    );
  }

  // Under the card: the two ways to log something outside the plan, and a
  // reminder of the last workout.
  const extraButton = (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          size="lg"
          disabled={logExtra.isPending}
          onClick={() => logExtra.mutate()}
        >
          <Plus size={18} aria-hidden />
          Log extra exercise
        </Button>
        <Link to="/history/log" className={buttonClasses('secondary', 'lg')}>
          <CalendarPlus size={18} aria-hidden />
          Log past workout
        </Link>
      </div>
      {lastSession && (
        <p className="px-1 text-xs text-muted">
          Last workout:{' '}
          <Link to={`/history/${lastSession.id}`} className="font-medium text-ink hover:underline">
            {lastSession.workoutName}
          </Link>{' '}
          · {timeAgo(lastSession.startedAt)}
        </p>
      )}
    </>
  );

  if (!nextUp) {
    return (
      <div className="space-y-2">
        <Card className="glow-ring p-5">
          <p className={`${eyebrow} text-accent`}>Your plan</p>
          <h2 className="mt-2 text-xl font-bold">
            {hasPlan ? 'Your plan has no workouts yet' : 'Start with a plan'}
          </h2>
          <p className="mt-1 text-sm text-muted">
            A plan lines up your routines for the week, so this screen can tell you exactly what to
            do each day.
          </p>
          <div className="mt-4 grid gap-2">
            <Link to="/train/schedule" className={buttonClasses('primary', 'xl')}>
              Build your plan
            </Link>
            <Link to="/train/explore?browse=plans" className={buttonClasses('secondary', 'lg')}>
              Pick a ready-made plan
            </Link>
          </div>
        </Card>
        {extraButton}
      </div>
    );
  }

  const { workout, plan, dayOfWeek, doneToday } = nextUp;
  const when = scheduledLabel(dayOfWeek);
  return (
    <div className="space-y-2">
      <Card className="glow-ring p-5">
        {doneToday ? (
          <p className={`${eyebrow} flex items-center gap-1.5 text-emerald-500`}>
            <CheckCircle2 size={15} aria-hidden />
            Done for today
          </p>
        ) : (
          <p className={`${eyebrow} flex items-center gap-1.5 text-accent`}>
            {when === 'today' ? (
              'Today’s workout'
            ) : restToday ? (
              <>
                <BedDouble size={15} aria-hidden />
                Rest day · next in your plan
              </>
            ) : (
              'Next in your plan'
            )}
          </p>
        )}
        <h2 className="mt-2 truncate text-xl font-bold">
          {doneToday && 'Next: '}
          {/* The name opens the routine, as it always has. */}
          <Link to={`/workouts/${workout.id}`} className="hover:underline">
            {workout.name}
          </Link>
        </h2>
        <p className="truncate text-sm text-muted">
          {plan.name} · planned for {when}
        </p>

        <ExerciseList workout={workout} />

        <Button
          size="xl"
          block
          variant={doneToday || restToday ? 'secondary' : 'primary'}
          className="mt-4"
          disabled={starting}
          onClick={() => start(workout)}
        >
          <Play size={20} aria-hidden />
          {doneToday || restToday ? 'Start it anyway' : 'Start workout'}
        </Button>
      </Card>
      {extraButton}
    </div>
  );
}
