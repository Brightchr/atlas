import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  ChevronRight,
  ClipboardList,
  Drumstick,
  Dumbbell,
  Flame,
  Search,
  UtensilsCrossed,
} from 'lucide-react';
import { fetchExercises } from '@/lib/wger/client';
import { getDiaryForDate } from '@/features/nutrition/repository';
import { listWorkouts } from '@/features/workouts/repository';
import { StatTile } from '@/components/StatTile';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const quickActions = [
  { to: '/exercises', label: 'Browse exercises', Icon: Search },
  { to: '/workouts', label: 'Start a workout', Icon: Dumbbell },
  { to: '/nutrition', label: 'Log a meal', Icon: UtensilsCrossed },
  { to: '/plans', label: 'View plans', Icon: ClipboardList },
];

export function DashboardPage() {
  const date = todayIso();

  const diaryQuery = useQuery({ queryKey: ['diary', date], queryFn: () => getDiaryForDate(date) });
  const workoutsQuery = useQuery({ queryKey: ['workouts'], queryFn: listWorkouts });
  const suggestedQuery = useQuery({
    queryKey: ['exercises', 'suggested'],
    queryFn: async () => {
      const page = await fetchExercises(0, 40);
      return page.exercises.filter((e) => e.imageUrls.length > 0).slice(0, 8);
    },
  });

  const totals = (diaryQuery.data ?? []).reduce(
    (acc, e) => ({ kcal: acc.kcal + e.macros.kcal, proteinG: acc.proteinG + e.macros.proteinG }),
    { kcal: 0, proteinG: 0 },
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">{greeting()}</h1>
          <p className="mt-1 text-sm text-muted">
            {new Date().toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-accent to-accent-2 p-6 text-accent-ink shadow-lg md:p-8">
        <div
          aria-hidden
          className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-accent-ink/10 blur-2xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-24 right-24 h-48 w-48 rounded-full border border-accent-ink/15"
        />
        <p className="text-xs font-semibold tracking-widest uppercase opacity-80">Arcadia Atlas</p>
        <h2 className="mt-2 max-w-md text-2xl font-bold md:text-3xl">
          Stay on top of your health
        </h2>
        <p className="mt-1.5 max-w-sm text-sm opacity-85">
          Workouts, meals and progress — tracked in one place, on every device.
        </p>
        <Link
          to="/workouts"
          className="mt-5 inline-flex items-center gap-2 rounded-xl border border-accent-ink/20 bg-accent-ink/10 px-4 py-2.5 text-sm font-semibold backdrop-blur-sm transition-colors hover:bg-accent-ink/20"
        >
          Start training
          <ArrowRight size={15} aria-hidden />
        </Link>
      </section>

      <section aria-label="Today at a glance" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Calories today"
          value={`${Math.round(totals.kcal)}`}
          Icon={Flame}
          tint="orange"
        />
        <StatTile
          label="Protein today"
          value={`${Math.round(totals.proteinG)} g`}
          Icon={Drumstick}
          tint="rose"
        />
        <StatTile
          label="Meals logged"
          value={`${diaryQuery.data?.length ?? 0}`}
          Icon={UtensilsCrossed}
          tint="emerald"
        />
        <StatTile
          label="Workouts saved"
          value={`${workoutsQuery.data?.length ?? 0}`}
          Icon={Dumbbell}
          tint="accent"
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Suggested exercises</h2>
          <Link to="/exercises" className="text-sm font-medium text-accent hover:underline">
            See all
          </Link>
        </div>
        {suggestedQuery.isError && (
          <p className="text-sm text-rose-500">Could not reach the exercise database.</p>
        )}
        <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
          {(suggestedQuery.data ?? []).map((exercise) => (
            <li key={exercise.id} className="w-44 shrink-0 snap-start md:w-auto">
              <Link
                to={`/exercises/${exercise.id}`}
                className="block h-full rounded-2xl border border-line bg-surface p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex h-28 items-center justify-center overflow-hidden rounded-xl bg-elev">
                  <img
                    src={exercise.imageUrls[0]}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-contain"
                  />
                </div>
                <p className="mt-2 truncate text-sm font-semibold">{exercise.name}</p>
                <p className="truncate text-xs text-muted">{exercise.category?.name}</p>
              </Link>
            </li>
          ))}
          {suggestedQuery.isLoading &&
            Array.from({ length: 4 }, (_, i) => (
              <li
                key={i}
                className="h-44 w-44 shrink-0 animate-pulse rounded-2xl bg-elev md:w-auto"
              />
            ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Quick actions</h2>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map(({ to, label, Icon }) => (
            <li key={label}>
              <Link
                to={to}
                className="flex items-center justify-between rounded-2xl border border-line bg-surface p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
                    <Icon size={17} strokeWidth={1.8} aria-hidden />
                  </span>
                  <span className="text-sm font-medium">{label}</span>
                </span>
                <ChevronRight size={16} className="text-muted" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
