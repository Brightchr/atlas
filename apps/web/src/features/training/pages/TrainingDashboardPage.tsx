import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BedDouble, CalendarDays, ClipboardList, Dumbbell, Flame } from 'lucide-react';
import { TrainingTabs } from '@/components/TrainingTabs';
import { listPlans } from '@/features/plans/repository';
import { getSessionDates } from '@/features/goals/repository';
import { listWorkouts } from '@/features/workouts/repository';

/** Today as a 0 = Monday … 6 = Sunday index. */
const todayIndex = () => (new Date().getDay() + 6) % 7;

export function TrainingDashboardPage() {
  const plansQuery = useQuery({ queryKey: ['plans'], queryFn: listPlans });
  const workoutsQuery = useQuery({ queryKey: ['workouts'], queryFn: listWorkouts });
  const sessionsQuery = useQuery({
    queryKey: ['sessions', 'dates'],
    queryFn: () => getSessionDates(7),
  });

  const workouts = workoutsQuery.data ?? [];
  const workoutsById = new Map(workouts.map((w) => [w.id, w]));

  // What does today look like across plans? First plan with an assignment wins.
  const today = todayIndex();
  const todaysDay = (plansQuery.data ?? [])
    .flatMap((plan) =>
      plan.days
        .filter((d) => d.dayOfWeek === today)
        .map((d) => ({ plan, isRestDay: d.isRestDay, workout: d.workoutId ? workoutsById.get(d.workoutId) : undefined })),
    )
    .find((d) => d.isRestDay || d.workout);

  const stats = [
    { label: 'Workouts this week', value: sessionsQuery.data?.length ?? 0, Icon: Flame },
    { label: 'Workout plans', value: plansQuery.data?.length ?? 0, Icon: CalendarDays },
    { label: 'Saved workouts', value: workouts.length, Icon: ClipboardList },
  ];

  const sections = [
    {
      to: '/plans',
      Icon: CalendarDays,
      title: 'Plans',
      blurb: 'Map workouts to weekdays — share them or import from the community.',
    },
    {
      to: '/workouts',
      Icon: ClipboardList,
      title: 'Workouts',
      blurb: 'Build and log your workouts, sets and reps.',
    },
    {
      to: '/exercises',
      Icon: Dumbbell,
      title: 'Exercises',
      blurb: 'Browse the catalog — filter by muscle, equipment or what you own.',
    },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-bold">Training</h1>
        <p className="text-sm text-muted">Plans, workouts and the exercise catalog in one place.</p>
      </header>

      <TrainingTabs />

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
                {todaysDay.workout!.name}
                <span className="ml-2 text-sm font-normal text-muted">
                  from “{todaysDay.plan.name}” · {todaysDay.workout!.exercises.length} exercises
                </span>
              </p>
              <Link
                to="/workouts"
                className="inline-flex items-center gap-1.5 rounded-xl bg-linear-to-r from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90"
              >
                Go train
                <ArrowRight size={14} aria-hidden />
              </Link>
            </div>
          )
        ) : (
          <p className="mt-1 text-sm text-muted">
            Nothing planned for today —{' '}
            <Link to="/plans" className="font-medium text-accent hover:underline">
              set up a weekly plan
            </Link>{' '}
            to see your day here.
          </p>
        )}
      </section>

      <section className="grid grid-cols-3 gap-3">
        {stats.map(({ label, value, Icon }) => (
          <div key={label} className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Icon size={16} strokeWidth={1.8} aria-hidden />
            </span>
            <p className="mt-2 font-display text-2xl font-bold tracking-tight tabular-nums">
              {value}
            </p>
            <p className="text-xs text-muted">{label}</p>
          </div>
        ))}
      </section>

      <section className="grid items-start gap-3 md:grid-cols-3">
        {sections.map(({ to, Icon, title, blurb }) => (
          <Link
            key={to}
            to={to}
            className="block rounded-2xl border border-line bg-surface p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Icon size={16} strokeWidth={1.8} aria-hidden />
            </span>
            <p className="mt-2 font-semibold">{title}</p>
            <p className="text-sm text-muted">{blurb}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
