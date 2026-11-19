import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronRight,
  Dumbbell,
  ShoppingCart,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';
import { Card } from '@/components/ui';
import { buildSuggestions } from '@/features/exercises/suggestions';
import { getRecentLoggedSets, getSessionDates, listGoals } from '@/features/goals/repository';
import { listMealPlanItems } from '@/features/nutrition/mealPlan';
import { listShoppingItems } from '@/features/shopping/repository';
import { localDayOfWeek, localIsoDate } from '@/lib/dates';
import { fetchAllExercises } from '@/lib/exercise-db/client';

function Nudge({
  to,
  Icon,
  title,
  hint,
}: {
  to: string;
  Icon: LucideIcon;
  title: string;
  hint: string;
}) {
  return (
    <Link
      to={to}
      className="flex min-h-14 items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-2 transition-colors hover:bg-elev"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
        <Icon size={17} strokeWidth={1.8} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{title}</span>
        <span className="block truncate text-xs text-muted">{hint}</span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-muted" aria-hidden />
    </Link>
  );
}

/** Reminders that only appear when there is something to act on: meals the
 * meal plan has for today, and groceries still on the shopping list. Each is
 * a door to the page that handles it. Renders nothing when both are empty. */
export function PlannedNudges() {
  const mealPlan = useQuery({ queryKey: ['mealPlan'], queryFn: listMealPlanItems });
  const shopping = useQuery({ queryKey: ['shopping'], queryFn: listShoppingItems });

  const today = localDayOfWeek();
  const planned = (mealPlan.data ?? []).filter((m) => m.dayOfWeek === today).length;
  const toBuy = (shopping.data ?? []).filter((i) => i.status === 'needed').length;
  if (planned === 0 && toBuy === 0) return null;

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {planned > 0 && (
        <Nudge
          to="/eat/meal-plan"
          Icon={UtensilsCrossed}
          title={`${planned} meal${planned === 1 ? '' : 's'} planned today`}
          hint="Open the meal plan to log them in one tap"
        />
      )}
      {toBuy > 0 && (
        <Nudge
          to="/eat/shopping"
          Icon={ShoppingCart}
          title={`${toBuy} item${toBuy === 1 ? '' : 's'} on your shopping list`}
          hint="Groceries waiting to be bought"
        />
      )}
    </div>
  );
}

/** Exercises picked for you from your goals and what you have (not) trained
 * lately, each with the reason it was picked. Same logic as before the
 * redesign (`buildSuggestions`); only the frame is new. */
export function SuggestedExercises() {
  const suggested = useQuery({
    queryKey: ['suggestions'],
    queryFn: async () => {
      const [catalog, recentSets, goals, sessionDates] = await Promise.all([
        fetchAllExercises(),
        getRecentLoggedSets(21).catch(() => []),
        listGoals().catch(() => []),
        getSessionDates(2).catch((): string[] => []),
      ]);
      const trainedToday = sessionDates.includes(localIsoDate());
      return buildSuggestions({ catalog, recentSets, goals, trainedToday });
    },
  });

  // Nothing to suggest and nothing loading: leave the space to other cards.
  if (suggested.isSuccess && suggested.data.length === 0) return null;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Suggested for you</h2>
        <Link to="/progress/goals" className="text-xs font-medium text-accent hover:underline">
          Tune via goals
        </Link>
      </div>
      {suggested.isError && (
        <p className="mt-2 text-sm text-rose-500">Could not reach the exercise database.</p>
      )}
      {/* A swipeable strip on phones, a four-across grid on wider screens. */}
      <ul className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
        {(suggested.data ?? []).map(({ exercise, reason }) => (
          <li key={exercise.id} className="w-36 shrink-0 snap-start md:w-auto md:min-w-0">
            <Link
              to={`/exercises/${exercise.id}`}
              className="block h-full rounded-xl border border-line bg-bg p-2.5 transition-colors hover:bg-elev"
            >
              <div className="flex h-20 items-center justify-center overflow-hidden rounded-lg bg-elev">
                {exercise.imageUrls[0] ? (
                  <img
                    src={exercise.imageUrls[0]}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <Dumbbell size={24} className="text-muted" strokeWidth={1.5} aria-hidden />
                )}
              </div>
              <p className="mt-2 truncate text-sm font-semibold">{exercise.name}</p>
              <p className="truncate text-xs font-medium text-accent">{reason}</p>
            </Link>
          </li>
        ))}
        {suggested.isLoading &&
          Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="h-36 w-36 shrink-0 animate-pulse rounded-xl bg-elev md:w-auto" />
          ))}
      </ul>
    </Card>
  );
}
