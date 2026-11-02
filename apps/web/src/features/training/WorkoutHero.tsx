import { Link, useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, BedDouble, CalendarPlus, History, Play, Plus, TimerReset } from 'lucide-react';
import { startEmptySession } from '@/features/workouts/repository';
import { listSessionHistory } from './stats';
import { useTodayWorkout } from './TodayCard';

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? 'a week ago' : `${weeks} weeks ago`;
}

const heroButton =
  'springy inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold backdrop-blur-sm transition-colors';
const heroPrimary = `${heroButton} bg-accent-ink text-accent shadow-sm hover:opacity-90`;
const heroSecondary = `${heroButton} border border-accent-ink/20 bg-accent-ink/10 hover:bg-accent-ink/20`;

/** The dashboard's pinned top card: the workout you're in, the one the plan
 * says is today, or a blank one — all one tap away. This is the product's
 * core loop, so it owns the hero slot; promotions sit below it. */
export function WorkoutHero() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { openSession, todaysDay, start, starting } = useTodayWorkout();
  const last = useQuery({
    queryKey: ['sessions', 'history', 'last'],
    queryFn: () => listSessionHistory(1),
  });
  const startEmpty = useMutation({
    mutationFn: () => startEmptySession(),
    onSuccess: (id) => {
      void queryClient.invalidateQueries({ queryKey: ['sessions'] });
      void navigate(`/workouts/session/${id}`);
    },
  });
  const lastSession = last.data?.[0];
  const planned = todaysDay && !todaysDay.isRestDay ? todaysDay.workout : undefined;

  let eyebrow = 'Workout';
  let title: string;
  let subtitle: string;
  if (openSession) {
    eyebrow = 'In progress';
    title = openSession.workoutName;
    subtitle = `${openSession.sets.length} set${openSession.sets.length === 1 ? '' : 's'} logged — pick up where you left off.`;
  } else if (planned) {
    eyebrow = 'Today';
    title = planned.name;
    subtitle = `From “${todaysDay!.plan.name}” · ${planned.exercises.length} exercise${planned.exercises.length === 1 ? '' : 's'}`;
  } else if (todaysDay?.isRestDay) {
    eyebrow = 'Today';
    title = 'Rest day';
    subtitle = 'Recovery counts. Log something anyway if you moved.';
  } else {
    title = 'Ready when you are';
    subtitle = 'Start an empty workout and add exercises as you go.';
  }

  return (
    <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-accent to-accent-2 p-5 text-accent-ink shadow-lg md:p-7">
      <div
        aria-hidden
        className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-accent-ink/10 blur-2xl"
      />
      <div
        aria-hidden
        className="absolute -bottom-24 right-24 h-48 w-48 rounded-full border border-accent-ink/15"
      />
      <div className="relative">
        <p className="flex items-center gap-1.5 text-xs font-semibold tracking-widest uppercase opacity-80">
          {openSession ? (
            <TimerReset size={14} aria-hidden />
          ) : todaysDay?.isRestDay && !planned ? (
            <BedDouble size={14} aria-hidden />
          ) : (
            <Play size={14} aria-hidden />
          )}
          {eyebrow}
        </p>
        <h2 className="mt-1.5 max-w-md truncate text-2xl font-bold md:text-3xl">{title}</h2>
        <p className="mt-1 max-w-md text-sm opacity-85">{subtitle}</p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {openSession ? (
            <Link to={`/workouts/session/${openSession.id}`} className={heroPrimary}>
              Resume
              <ArrowRight size={15} aria-hidden />
            </Link>
          ) : planned ? (
            <button
              type="button"
              disabled={starting}
              onClick={() => start(planned)}
              className={`${heroPrimary} disabled:opacity-60`}
            >
              <Play size={15} aria-hidden />
              Start {planned.name.length > 18 ? 'workout' : planned.name}
            </button>
          ) : null}
          {!openSession && (
            <button
              type="button"
              disabled={startEmpty.isPending}
              onClick={() => startEmpty.mutate()}
              className={`${planned ? heroSecondary : heroPrimary} disabled:opacity-60`}
            >
              <Plus size={15} aria-hidden />
              Start empty workout
            </button>
          )}
          <Link to="/history/log" className={heroSecondary}>
            <CalendarPlus size={15} aria-hidden />
            Log past
          </Link>
          <Link to="/history" className={heroSecondary} aria-label="Workout history">
            <History size={15} aria-hidden />
            <span className="hidden sm:inline">History</span>
          </Link>
        </div>

        <p className="mt-4 text-xs opacity-75">
          {lastSession
            ? `Last workout: ${lastSession.workoutName} · ${timeAgo(lastSession.startedAt)}`
            : last.isSuccess
              ? 'No workouts logged yet — the first one goes here.'
              : ' '}
        </p>
      </div>
    </section>
  );
}
