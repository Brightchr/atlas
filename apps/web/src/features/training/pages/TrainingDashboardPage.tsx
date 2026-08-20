import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ClipboardList, Flame, Sparkles } from 'lucide-react';
import { listPlans } from '@/features/plans/repository';
import { getSessionDates } from '@/features/goals/repository';
import { listWorkouts } from '@/features/workouts/repository';
import { GOAL_LABELS, LEVEL_LABELS, useTrainingProfile } from '../profile';
import { recommendWorkouts } from '../recommend';
import { TodayCard } from '../TodayCard';

export function TrainingDashboardPage() {
  const plansQuery = useQuery({ queryKey: ['plans'], queryFn: listPlans });
  const workoutsQuery = useQuery({ queryKey: ['workouts'], queryFn: listWorkouts });
  const sessionsQuery = useQuery({
    queryKey: ['sessions', 'dates'],
    queryFn: () => getSessionDates(7),
  });
  const profile = useTrainingProfile();

  const stats = [
    { label: 'Workouts this week', value: sessionsQuery.data?.length ?? 0, Icon: Flame },
    { label: 'Workout plans', value: plansQuery.data?.length ?? 0, Icon: CalendarDays },
    { label: 'Saved workouts', value: (workoutsQuery.data ?? []).length, Icon: ClipboardList },
  ];

  const picks = profile.data ? recommendWorkouts(profile.data, 3) : [];

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-bold">Today</h1>
        <p className="text-sm text-muted">
          {profile.data
            ? `Training to ${GOAL_LABELS[profile.data.goal].toLowerCase()} · ${LEVEL_LABELS[profile.data.level]}`
            : 'Your session for the day, ready to start.'}
        </p>
      </header>

      <TodayCard />

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

      {picks.length > 0 && (
        <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-accent" aria-hidden />
              <h2 className="text-sm font-semibold">Picked for your goal</h2>
            </div>
            <Link to="/train/explore" className="text-xs font-medium text-accent hover:underline">
              Explore all
            </Link>
          </div>
          <ul className="divide-y divide-line">
            {picks.map((w) => (
              <li key={w.key} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{w.name}</p>
                  <p className="truncate text-xs text-muted">{w.description}</p>
                </div>
                <span className="shrink-0 text-xs text-muted">{w.exercises.length} exercises</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
