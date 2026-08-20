import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  ChevronRight,
  Dumbbell,
  Search,
  ShoppingCart,
  Target,
  UtensilsCrossed,
} from 'lucide-react';
import { fetchAllExercises } from '@/lib/exercise-db/client';
import { buildSuggestions } from '@/features/exercises/suggestions';
import {
  getRecentLoggedSets,
  getSavedTargets,
  getSessionDates,
  listGoals,
} from '@/features/goals/repository';
import { listMealPlanItems } from '@/features/nutrition/mealPlan';
import { getDiaryForDate } from '@/features/nutrition/repository';
import { listShoppingItems } from '@/features/shopping/repository';
import { useTrainingProfile } from '@/features/training/profile';
import { adherenceStats, weeklyTrainingStats } from '@/features/training/stats';
import { StatTile } from '@/components/StatTile';
import { RingTile } from '@/components/Ring';
import { WeekStrip } from '@/components/WeekStrip';
import { TodayCard } from '@/features/training/TodayCard';

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
  { to: '/train/library', label: 'Start a workout', Icon: Dumbbell },
  { to: '/eat', label: 'Log a meal', Icon: UtensilsCrossed },
  { to: '/you/goals', label: 'Set a goal', Icon: Target },
];

export function DashboardPage() {
  const date = todayIso();

  const diaryQuery = useQuery({ queryKey: ['diary', date], queryFn: () => getDiaryForDate(date) });
  const suggestedQuery = useQuery({
    queryKey: ['suggestions'],
    queryFn: async () => {
      const [catalog, recentSets, goals, sessionDates] = await Promise.all([
        fetchAllExercises(),
        getRecentLoggedSets(21).catch(() => []),
        listGoals().catch(() => []),
        getSessionDates(2).catch((): string[] => []),
      ]);
      const trainedToday = sessionDates.includes(new Date().toISOString().slice(0, 10));
      return buildSuggestions({ catalog, recentSets, goals, trainedToday });
    },
  });

  const totals = (diaryQuery.data ?? []).reduce(
    (acc, e) => ({ kcal: acc.kcal + e.macros.kcal, proteinG: acc.proteinG + e.macros.proteinG }),
    { kcal: 0, proteinG: 0 },
  );

  // The connective tissue: targets, weekly training vs the user's own goal,
  // today's planned meals, and what's waiting on the shopping list.
  const targetsQuery = useQuery({ queryKey: ['targets'], queryFn: getSavedTargets });
  const profile = useTrainingProfile();
  const weekSessions = useQuery({
    queryKey: ['sessions', 'week'],
    queryFn: () => getSessionDates(7),
  });
  const mealPlanQuery = useQuery({ queryKey: ['meal-plan'], queryFn: listMealPlanItems });
  const shoppingQuery = useQuery({ queryKey: ['shopping'], queryFn: listShoppingItems });
  const adherence = useQuery({ queryKey: ['stats', 'adherence'], queryFn: () => adherenceStats(4) });
  const volumeQuery = useQuery({
    queryKey: ['stats', 'weekly'],
    queryFn: () => weeklyTrainingStats(8),
  });
  const thisWeek = adherence.data?.weeks[adherence.data.weeks.length - 1];
  const weekDone = thisWeek?.days.filter((d) => d.status === 'done').length ?? 0;
  const weekMissed = thisWeek?.days.filter((d) => d.status === 'missed').length ?? 0;
  const volumeBars = volumeQuery.data ?? [];
  const maxVolume = Math.max(1, ...volumeBars.map((w) => w.volumeKg));

  const targets = targetsQuery.data ?? null;
  const trainedDays = weekSessions.data?.length ?? 0;
  const daysTarget = profile.data?.daysPerWeek ?? null;
  const todayDow = (new Date().getDay() + 6) % 7;
  const plannedMealsToday = (mealPlanQuery.data ?? []).filter((m) => m.dayOfWeek === todayDow);
  const toBuy = (shoppingQuery.data ?? []).filter((i) => i.status === 'needed').length;

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
          to="/train/library"
          className="mt-5 inline-flex items-center gap-2 rounded-xl border border-accent-ink/20 bg-accent-ink/10 px-4 py-2.5 text-sm font-semibold backdrop-blur-sm transition-colors hover:bg-accent-ink/20"
        >
          Start training
          <ArrowRight size={15} aria-hidden />
        </Link>
      </section>

      <TodayCard />

      {thisWeek && <WeekStrip days={thisWeek.days} done={weekDone} missed={weekMissed} />}

      <section aria-label="Today at a glance" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <RingTile
          progress={targets ? totals.kcal / targets.kcal : 0}
          centerLabel={targets ? `${Math.round((totals.kcal / targets.kcal) * 100)}%` : '—'}
          title={`${Math.round(totals.kcal).toLocaleString()} kcal`}
          subtitle={targets ? `of ${targets.kcal.toLocaleString()}` : 'set targets in Goals'}
          color="#fb923c"
          alertOnOver
          to="/eat"
        />
        <RingTile
          progress={targets ? totals.proteinG / targets.proteinG : 0}
          centerLabel={targets ? `${Math.round((totals.proteinG / targets.proteinG) * 100)}%` : '—'}
          title={`${Math.round(totals.proteinG)} g protein`}
          subtitle={targets ? `of ${targets.proteinG} g` : 'set targets in Goals'}
          color="#fb7185"
          to="/eat"
        />
        <RingTile
          progress={daysTarget ? trainedDays / daysTarget : 0}
          centerLabel={daysTarget ? `${trainedDays}/${daysTarget}` : `${trainedDays}`}
          title="Workouts"
          subtitle="this week"
          to="/you"
        />
        <StatTile
          label="Meals today"
          value={`${(['breakfast', 'lunch', 'dinner'] as const).filter((m) => (diaryQuery.data ?? []).some((e) => e.meal === m)).length}/3`}
          hint={`${(diaryQuery.data ?? []).filter((e) => e.meal === 'snack').length} snacks`}
          Icon={UtensilsCrossed}
          tint="emerald"
          to="/eat"
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Link
          to="/eat"
          className="springy flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 shadow-sm hover:-translate-y-0.5 hover:shadow-md"
        >
          <Search size={16} className="text-muted" aria-hidden />
          <span className="grow text-sm text-muted">Log food — search or log again…</span>
          <ChevronRight size={16} className="text-muted" aria-hidden />
        </Link>
        <Link
          to="/you"
          className="springy block rounded-2xl border border-line bg-surface px-4 py-3 shadow-sm hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-xs font-semibold">Volume · 8 weeks</span>
            <span className="text-[11px] text-muted">tap for charts</span>
          </div>
          <div className="flex h-8 items-end gap-1">
            {volumeBars.map((w, i) => (
              <span
                key={w.week}
                className={`grow rounded-t ${i === volumeBars.length - 1 ? 'bg-linear-to-t from-accent to-accent-2' : 'bg-elev'}`}
                style={{ height: `${Math.max(12, (w.volumeKg / maxVolume) * 100)}%` }}
              />
            ))}
          </div>
        </Link>
      </section>

      {(plannedMealsToday.length > 0 || toBuy > 0) && (
        <section className="grid gap-3 sm:grid-cols-2">
          {plannedMealsToday.length > 0 && (
            <Link
              to="/eat/meal-plan"
              className="flex items-center justify-between rounded-2xl border border-line bg-surface p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
                  <UtensilsCrossed size={17} strokeWidth={1.8} aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-semibold">
                    {plannedMealsToday.length} meal{plannedMealsToday.length > 1 ? 's' : ''} planned
                    today
                  </span>
                  <span className="block text-xs text-muted">
                    Open the meal plan to log them in one tap
                  </span>
                </span>
              </span>
              <ChevronRight size={16} className="text-muted" aria-hidden />
            </Link>
          )}
          {toBuy > 0 && (
            <Link
              to="/eat/shopping"
              className="flex items-center justify-between rounded-2xl border border-line bg-surface p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500/15 text-sky-500">
                  <ShoppingCart size={17} strokeWidth={1.8} aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-semibold">
                    {toBuy} item{toBuy > 1 ? 's' : ''} on your shopping list
                  </span>
                  <span className="block text-xs text-muted">Groceries waiting to be bought</span>
                </span>
              </span>
              <ChevronRight size={16} className="text-muted" aria-hidden />
            </Link>
          )}
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Suggested for you</h2>
          <Link to="/you/goals" className="text-sm font-medium text-accent hover:underline">
            Tune via goals
          </Link>
        </div>
        {suggestedQuery.isError && (
          <p className="text-sm text-rose-500">Could not reach the exercise database.</p>
        )}
        <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
          {(suggestedQuery.data ?? []).map(({ exercise, reason }) => (
            <li key={exercise.id} className="w-44 shrink-0 snap-start md:w-auto">
              <Link
                to={`/exercises/${exercise.id}`}
                className="block h-full rounded-2xl border border-line bg-surface p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex h-28 items-center justify-center overflow-hidden rounded-xl bg-elev">
                  {exercise.imageUrls[0] ? (
                    <img
                      src={exercise.imageUrls[0]}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <Dumbbell size={28} className="text-muted" strokeWidth={1.5} aria-hidden />
                  )}
                </div>
                <p className="mt-2 truncate text-sm font-semibold">{exercise.name}</p>
                <p className="truncate text-xs font-medium text-accent">{reason}</p>
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
