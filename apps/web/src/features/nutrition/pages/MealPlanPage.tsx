import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import type { Food, MealPlanItem, MealType } from '@arcadia/shared';
import { Button, ConfirmSheet } from '@/components/ui';
import { getSavedTargets } from '@/features/goals/repository';
import { localDayOfWeek } from '@/lib/dates';
import { getActiveMealPlan } from '../activeMealPlan';
import { AddToSlotSheet } from '../components/mealplan/AddToSlotSheet';
import { DayView } from '../components/mealplan/DayView';
import { MacroSummary } from '../components/mealplan/MacroSummary';
import { PlanActions } from '../components/mealplan/PlanActions';
import { PlanCard } from '../components/mealplan/PlanCard';
import {
  DAYS,
  itemMacros,
  summarizeWeek,
  sumMacros,
  type PlanLookup,
} from '../components/mealplan/planMath';
import { SwapSheet } from '../components/mealplan/SwapSheet';
import { WeekView } from '../components/mealplan/WeekView';
import { Segmented } from '../components/Segmented';
import {
  addMealPlanItem,
  listMealPlanItems,
  removeMealPlanItem,
  swapMealPlanItemForCatalogRecipe,
} from '../mealPlan';
import type { CatalogRecipe } from '../recipeCatalog';
import { listRecipes } from '../recipes';
import { getFoodsByIds } from '../repository';

const VIEWS = [
  ['week', 'Week'],
  ['day', 'Day'],
] as const;

/** The weekly meal plan. Two views of the same seven days: Week (overview,
 * swap a meal) and Day (edit one day).
 *
 * Layout: on wide screens the plan, its numbers and its actions sit in a
 * left column and the week/day fills the right; on phones they stack in that
 * order. Adding, swapping, removing and saving all happen in sheets on top,
 * so the page never jumps around.
 *
 * This component owns the plan data and which sheet is open; the pieces
 * under components/mealplan/ only draw what they are given. */
export function MealPlanPage() {
  const [view, setView] = useState<'week' | 'day'>('week');
  // The day shown in the Day view (0 = Monday). Starts on today.
  const [day, setDay] = useState(() => localDayOfWeek());
  // Which sheet is open. Items are remembered by id so each sheet always
  // shows the freshest copy from the query (and closes if the item is gone).
  const [adding, setAdding] = useState<{ day: number; meal: MealType } | null>(null);
  const [swapId, setSwapId] = useState<string | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const planQuery = useQuery({ queryKey: ['mealPlan'], queryFn: listMealPlanItems });
  const recipesQuery = useQuery({ queryKey: ['recipes'], queryFn: listRecipes });
  const targetsQuery = useQuery({ queryKey: ['targets'], queryFn: getSavedTargets });
  // What the week is based on (a template, a saved plan, or nothing).
  const activePlanQuery = useQuery({
    queryKey: ['mealPlan', 'active'],
    queryFn: getActiveMealPlan,
  });

  // Plan items only store a food's id; load those foods to get their macros.
  const foodIds = useMemo(
    () => [...new Set((planQuery.data ?? []).filter((i) => i.kind === 'food').map((i) => i.refId))],
    [planQuery.data],
  );
  const foodsQuery = useQuery({
    queryKey: ['mealPlan', 'foods', foodIds],
    queryFn: () => getFoodsByIds(foodIds),
    enabled: foodIds.length > 0,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['mealPlan'] });
  const addMutation = useMutation({ mutationFn: addMealPlanItem, onSuccess: invalidate });
  const removeMutation = useMutation({
    mutationFn: removeMealPlanItem,
    onSuccess: () => {
      setRemoveId(null);
      void invalidate();
    },
  });
  // Swapping one slot for a catalog recipe (keeps day, meal and servings).
  const swapMutation = useMutation({
    mutationFn: ({ id, entry, servings }: { id: string; entry: CatalogRecipe; servings: number }) =>
      swapMealPlanItemForCatalogRecipe(id, entry, servings),
    onSuccess: () => {
      setSwapId(null);
      void invalidate();
      // The swap imports the catalog recipe, so the recipe list changed too.
      void queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
  });

  const items = useMemo(() => planQuery.data ?? [], [planQuery.data]);
  // useMemo keeps `lookup` the same object between renders so the week
  // summary below is only recalculated when the data actually changes.
  const lookup: PlanLookup = useMemo(
    () => ({
      foods: foodsQuery.data ?? new Map<string, Food>(),
      recipes: recipesQuery.data ?? [],
    }),
    [foodsQuery.data, recipesQuery.data],
  );
  const week = useMemo(() => summarizeWeek(items, lookup), [items, lookup]);

  const targets = targetsQuery.data;
  const activePlan = activePlanQuery.data ?? null;
  const hasItems = items.length > 0;
  const dayItems = items.filter((i) => i.dayOfWeek === day);
  const swapItem = items.find((i) => i.id === swapId) ?? null;
  const removeItem = items.find((i) => i.id === removeId) ?? null;

  // "Log to diary" copies today's plan in the Week view and the day on
  // screen in the Day view.
  const logDay = view === 'week' ? localDayOfWeek() : day;

  const openSwap = (item: MealPlanItem) => {
    swapMutation.reset(); // forget an earlier failure before reopening
    setSwapId(item.id);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 truncate text-2xl font-bold">
          {view === 'week' ? 'This week' : DAYS[day]}
        </h1>
        <Segmented
          label="View"
          options={VIEWS}
          value={view}
          onChange={setView}
          className="w-40 shrink-0"
        />
      </header>

      {planQuery.isError && <p className="text-sm text-rose-500">Couldn't load your meal plan.</p>}

      {/* Phones: one flex column. The left group is `display: contents`
          there, so its cards join the same column and `order-*` can put the
          numbers first, then the week, then the actions and the plan card.
          Wide screens: a real two-column grid — left group 2/5, week 3/5 —
          where those order classes no longer apply inside the left block. */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-5 lg:items-start">
        <div className="contents min-w-0 lg:col-span-2 lg:block lg:space-y-4">
          <PlanCard
            activePlan={activePlan}
            hasItems={hasItems}
            // An empty week leads with "get a plan"; otherwise switching
            // plans is the rarest thing here and goes last on phones.
            className={hasItems ? 'order-5' : 'order-first'}
          />

          {view === 'week' && week && (
            <MacroSummary
              title="Average planned day"
              note={`${week.days} of 7 days planned`}
              macros={week.average}
              targets={targets}
              className="order-1"
            />
          )}
          {view === 'day' && (
            <MacroSummary
              title={`${DAYS[day]} totals`}
              macros={sumMacros(dayItems, lookup)}
              targets={targets}
              className="order-1"
            />
          )}

          {/* Every action here needs something planned, so the card only
              appears once the week has at least one item. */}
          {hasItems && (
            <PlanActions
              logDay={logDay}
              logLabel={view === 'week' ? 'today' : DAYS[day]!}
              canLog={items.some((i) => i.dayOfWeek === logDay)}
              defaultPlanName={activePlan?.kind === 'custom' ? activePlan.name : ''}
            />
          )}
        </div>

        <div className="order-2 min-w-0 lg:col-span-3">
          {view === 'day' && (
            <DayView
              day={day}
              onDayChange={setDay}
              items={dayItems}
              lookup={lookup}
              onAdd={(meal) => setAdding({ day, meal })}
              onSwap={openSwap}
              onRemove={(item) => setRemoveId(item.id)}
            />
          )}
          {view === 'week' && hasItems && (
            <WeekView
              items={items}
              lookup={lookup}
              perDay={week?.perDay}
              targets={targets}
              onOpenDay={(d) => {
                setDay(d);
                setView('day');
              }}
              onAdd={(d, meal) => setAdding({ day: d, meal })}
              onSwap={openSwap}
            />
          )}
          {view === 'week' && !hasItems && planQuery.isSuccess && (
            <section className="rounded-2xl border border-dashed border-line p-8 text-center">
              <CalendarDays size={22} className="mx-auto mb-2 text-muted" aria-hidden />
              <p className="text-sm text-muted">
                Your week is empty. Start from a plan, or fill in a day yourself.
              </p>
              <Button variant="secondary" className="mt-3" onClick={() => setView('day')}>
                Plan a day by hand
              </Button>
            </section>
          )}
        </div>
      </div>

      {adding && (
        <AddToSlotSheet
          day={adding.day}
          meal={adding.meal}
          recipes={lookup.recipes}
          // mutateAsync returns a promise, so the sheet can show "Added"
          // (or an error) when each save finishes.
          onAdd={(item) => addMutation.mutateAsync(item)}
          onClose={() => setAdding(null)}
        />
      )}

      {swapItem && (
        <SwapSheet
          item={swapItem}
          currentKcal={itemMacros(swapItem, lookup)?.kcal ?? null}
          pending={swapMutation.isPending}
          failed={swapMutation.isError}
          onPick={(entry) =>
            swapMutation.mutate({ id: swapItem.id, entry, servings: swapItem.servings ?? 1 })
          }
          onClose={() => setSwapId(null)}
        />
      )}

      {removeItem && (
        <ConfirmSheet
          title="Remove from plan?"
          body={
            <>
              <span className="font-semibold text-ink">{removeItem.name}</span> will be removed from{' '}
              {DAYS[removeItem.dayOfWeek]} {removeItem.meal}. Your recipes and diary are not
              affected.
            </>
          }
          confirmLabel="Remove"
          pending={removeMutation.isPending}
          onConfirm={() => removeMutation.mutate(removeItem.id)}
          onClose={() => setRemoveId(null)}
        />
      )}
    </div>
  );
}
