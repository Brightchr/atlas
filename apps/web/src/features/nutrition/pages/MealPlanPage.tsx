import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftRight,
  BookOpenText,
  ChevronRight,
  Cookie,
  Moon,
  NotebookPen,
  Plus,
  ShoppingCart,
  Sparkles,
  Sun,
  Sunrise,
  X,
} from 'lucide-react';
import type { Food, Macros, MealPlanItem, MealType } from '@arcadia/shared';
import { getSavedTargets } from '@/features/goals/repository';
import { FoodPicker } from '../components/FoodPicker';
import { RecipeThumb } from '../components/RecipeArt';
import { SwapPicker } from '../components/SwapPicker';
import {
  addMealPlanItem,
  addPlanRangeToShoppingList,
  getShoppingCadenceDays,
  listMealPlanItems,
  logPlanDayToDiary,
  removeMealPlanItem,
  setShoppingCadenceDays,
  swapMealPlanItemForCatalogRecipe,
} from '../mealPlan';
import type { CatalogRecipe } from '../recipeCatalog';
import { applyMealPlanTemplate } from '../mealPlan';
import { MEAL_PLAN_TEMPLATES, type MealPlanTemplate } from '../mealPlanCatalog';
import { listRecipes, type RecipeDetails } from '../recipes';
import { getFoodsByIds, scaleMacros } from '../repository';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MEALS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

const MEAL_META: Record<MealType, { Icon: typeof Sunrise; tint: string }> = {
  breakfast: { Icon: Sunrise, tint: 'bg-amber-500/15 text-amber-500' },
  lunch: { Icon: Sun, tint: 'bg-orange-500/15 text-orange-500' },
  dinner: { Icon: Moon, tint: 'bg-indigo-500/15 text-indigo-400' },
  snack: { Icon: Cookie, tint: 'bg-teal-500/15 text-teal-600' },
};

/** Today as a 0 = Monday … 6 = Sunday index (JS Date has 0 = Sunday). */
const todayIndex = () => (new Date().getDay() + 6) % 7;

function itemMacros(
  item: MealPlanItem,
  foods: Map<string, Food>,
  recipes: RecipeDetails[],
): Macros | null {
  if (item.kind === 'food') {
    const food = foods.get(item.refId);
    return food && item.grams ? scaleMacros(food.per100g, item.grams) : null;
  }
  const recipe = recipes.find((r) => r.id === item.refId);
  if (!recipe) return null;
  const s = item.servings ?? 1;
  return {
    kcal: Math.round(recipe.perServing.kcal * s),
    proteinG: +(recipe.perServing.proteinG * s).toFixed(1),
    carbsG: +(recipe.perServing.carbsG * s).toFixed(1),
    fatG: +(recipe.perServing.fatG * s).toFixed(1),
  };
}

function amountLabel(item: MealPlanItem): string {
  if (item.kind === 'food') return `${item.grams ?? 0} g`;
  const s = item.servings ?? 1;
  return `${s} serving${s === 1 ? '' : 's'}`;
}

function sumMacros(items: MealPlanItem[], foods: Map<string, Food>, recipes: RecipeDetails[]) {
  return items.reduce(
    (acc, item) => {
      const m = itemMacros(item, foods, recipes);
      return m
        ? {
            kcal: acc.kcal + m.kcal,
            proteinG: acc.proteinG + m.proteinG,
            carbsG: acc.carbsG + m.carbsG,
            fatG: acc.fatG + m.fatG,
          }
        : acc;
    },
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

/** Inline add flow for one slot: pick a plain food (with grams) or a recipe
 * (with servings). */
function SlotAdder({
  recipes,
  onAddFood,
  onAddRecipe,
  onClose,
}: {
  recipes: RecipeDetails[];
  onAddFood: (food: Food, grams: number) => void;
  onAddRecipe: (recipe: RecipeDetails, servings: number) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<'food' | 'recipe'>(recipes.length > 0 ? 'recipe' : 'food');
  const [recipeId, setRecipeId] = useState(recipes[0]?.id ?? '');
  const [servings, setServings] = useState('1');

  return (
    <div className="mt-2 space-y-2 rounded-xl bg-elev p-2.5">
      <div className="flex items-center gap-1.5">
        {recipes.length > 0 && (
          <button
            type="button"
            aria-pressed={mode === 'recipe'}
            onClick={() => setMode('recipe')}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
              mode === 'recipe' ? 'bg-accent text-accent-ink' : 'text-muted hover:text-ink'
            }`}
          >
            <BookOpenText size={12} aria-hidden />
            Recipe
          </button>
        )}
        <button
          type="button"
          aria-pressed={mode === 'food'}
          onClick={() => setMode('food')}
          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
            mode === 'food' ? 'bg-accent text-accent-ink' : 'text-muted hover:text-ink'
          }`}
        >
          Food
        </button>
        <span className="flex-1" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded p-1 text-muted transition-colors hover:text-ink"
        >
          <X size={13} aria-hidden />
        </button>
      </div>

      {mode === 'recipe' ? (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={recipeId}
            onChange={(e) => setRecipeId(e.target.value)}
            aria-label="Recipe"
            className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          >
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.perServing.kcal} kcal/serving)
              </option>
            ))}
          </select>
          <input
            type="number"
            min="0.5"
            step="0.5"
            value={servings}
            onChange={(e) => setServings(e.target.value)}
            aria-label="Servings"
            className="w-20 rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            type="button"
            disabled={!recipeId || !Number(servings)}
            onClick={() => {
              const recipe = recipes.find((r) => r.id === recipeId);
              if (recipe) onAddRecipe(recipe, Number(servings));
            }}
            className="rounded-xl bg-linear-to-r from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Add
          </button>
        </div>
      ) : (
        <FoodPicker onPick={onAddFood} />
      )}
    </div>
  );
}

/** One meal of one day in the week overview: art strip, primary item, the
 * rest as "+ item" lines — tap to jump into that day's editor. */
function WeekMealCard({
  meal,
  items,
  foods,
  recipes,
  onOpen,
  onSwap,
}: {
  meal: MealType;
  items: MealPlanItem[];
  foods: Map<string, Food>;
  recipes: RecipeDetails[];
  onOpen: () => void;
  onSwap?: () => void;
}) {
  const kcal = Math.round(sumMacros(items, foods, recipes).kcal);
  const primary = items[0];

  return (
    <div
      onClick={onOpen}
      className="springy flex w-full cursor-pointer items-stretch overflow-hidden rounded-2xl border border-line bg-surface text-left shadow-sm hover:-translate-y-0.5 hover:shadow-md"
    >
      <span
        aria-hidden
        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        className="flex w-6 shrink-0 items-center justify-center bg-elev/60 py-2 text-[10px] font-semibold tracking-wider text-muted uppercase"
      >
        {meal}
      </span>
      {primary ? (
        <>
          <RecipeThumb name={primary.name} className="w-16 self-stretch rounded-none text-2xl" />
          <span className="min-w-0 flex-1 px-3 py-2.5">
            <span className="block truncate text-sm font-semibold">{primary.name}</span>
            {items.slice(1).map((i) => (
              <span key={i.id} className="block truncate text-xs text-muted">
                + {i.name}
              </span>
            ))}
          </span>
          <span className="flex shrink-0 items-center gap-1 pr-2 text-xs text-muted tabular-nums">
            {kcal > 0 && <span>{kcal} kcal</span>}
            {onSwap && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSwap();
                }}
                aria-label={`Swap ${primary.name}`}
                className="rounded-lg border border-line bg-surface p-1.5 shadow-sm transition-colors hover:bg-elev hover:text-ink"
              >
                <ArrowLeftRight size={13} aria-hidden />
              </button>
            )}
          </span>
        </>
      ) : (
        <span className="flex flex-1 items-center gap-1.5 px-3 py-3 text-sm text-muted/70">
          <Plus size={14} aria-hidden />
          Add {meal}
          <ChevronRight size={14} className="ml-auto" aria-hidden />
        </span>
      )}
    </div>
  );
}

export function MealPlanPage() {
  const [view, setView] = useState<'week' | 'day'>('week');
  const [day, setDay] = useState(todayIndex);
  const [openSlot, setOpenSlot] = useState<MealType | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const planQuery = useQuery({ queryKey: ['mealPlan'], queryFn: listMealPlanItems });
  const recipesQuery = useQuery({ queryKey: ['recipes'], queryFn: listRecipes });
  const targetsQuery = useQuery({ queryKey: ['targets'], queryFn: getSavedTargets });

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
  const removeMutation = useMutation({ mutationFn: removeMealPlanItem, onSuccess: invalidate });
  // Swapping one slot for a catalog recipe (keeps day, meal and servings).
  const [swapId, setSwapId] = useState<string | null>(null);
  const swapMutation = useMutation({
    mutationFn: ({ id, entry, servings }: { id: string; entry: CatalogRecipe; servings: number }) =>
      swapMealPlanItemForCatalogRecipe(id, entry, servings),
    onSuccess: () => {
      setSwapId(null);
      void invalidate();
      void queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
  });
  const logDay = view === 'week' ? todayIndex() : day;
  const logDayMutation = useMutation({
    mutationFn: () => logPlanDayToDiary(logDay, new Date().toISOString().slice(0, 10)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['diary'] });
      void queryClient.invalidateQueries({ queryKey: ['goals'] });
    },
  });
  // The grocery cadence: how many days each shopping trip should cover.
  const cadenceQuery = useQuery({
    queryKey: ['settings', 'shopping_cadence'],
    queryFn: getShoppingCadenceDays,
  });
  const cadence = cadenceQuery.data ?? 7;
  const [customCadence, setCustomCadence] = useState(false);
  const setCadence = useMutation({
    mutationFn: setShoppingCadenceDays,
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['settings', 'shopping_cadence'] }),
  });
  const shoppingMutation = useMutation({
    mutationFn: () => addPlanRangeToShoppingList(cadence),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['shopping'] }),
  });

  // Starter templates: browse → confirm → the week is replaced.
  const [browsing, setBrowsing] = useState(false);
  const [templateGoal, setTemplateGoal] = useState<'all' | 'lose' | 'gain' | 'maintain'>('all');
  const [confirmingTemplate, setConfirmingTemplate] = useState<MealPlanTemplate | null>(null);
  const applyTemplate = useMutation({
    mutationFn: (template: MealPlanTemplate) => applyMealPlanTemplate(template),
    onSuccess: () => {
      setConfirmingTemplate(null);
      setBrowsing(false);
      void queryClient.invalidateQueries({ queryKey: ['mealPlan'] });
      void queryClient.invalidateQueries({ queryKey: ['recipes'] });
      void queryClient.invalidateQueries({ queryKey: ['foods'] });
    },
  });
  const visibleTemplates = MEAL_PLAN_TEMPLATES.filter(
    (t) => templateGoal === 'all' || t.goal === templateGoal,
  );

  const recipes = recipesQuery.data ?? [];
  const foods = foodsQuery.data ?? new Map<string, Food>();
  const allItems = planQuery.data ?? [];
  const dayItems = allItems.filter((i) => i.dayOfWeek === day);
  const dayTotals = sumMacros(dayItems, foods, recipes);
  const hasAnyItems = allItems.length > 0;

  // Week summary: the average planned day, ignoring empty days.
  const weekSummary = useMemo(() => {
    const items = planQuery.data ?? [];
    const foodMap = foodsQuery.data ?? new Map<string, Food>();
    const recipeList = recipesQuery.data ?? [];
    const perDay = DAYS.map((_, i) =>
      sumMacros(
        items.filter((it) => it.dayOfWeek === i),
        foodMap,
        recipeList,
      ),
    );
    const planned = perDay.filter((d) => d.kcal > 0);
    if (planned.length === 0) return null;
    const avg = (pick: (m: Macros) => number) =>
      Math.round(planned.reduce((s, d) => s + pick(d), 0) / planned.length);
    return {
      days: planned.length,
      kcal: avg((m) => m.kcal),
      proteinG: avg((m) => m.proteinG),
      carbsG: avg((m) => m.carbsG),
      fatG: avg((m) => m.fatG),
      perDay,
    };
  }, [planQuery.data, foodsQuery.data, recipesQuery.data]);

  const openDaySlot = (d: number, meal: MealType | null) => {
    setDay(d);
    setView('day');
    setOpenSlot(meal);
    setSwapId(null);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{view === 'week' ? 'This week' : DAYS[day]}</h1>
          <p className="text-sm text-muted">
            Plan breakfast to snacks for each day — then log a day to your diary in one tap or turn
            the week into a shopping list.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="grid grid-cols-2 rounded-xl border border-line bg-surface p-1 text-xs font-semibold shadow-sm">
            {(
              [
                ['week', 'Week'],
                ['day', 'Day'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                onClick={() => {
                  setView(value);
                  setOpenSlot(null);
                  setSwapId(null);
                }}
                className={`rounded-lg px-3 py-1.5 transition-colors ${
                  view === value ? 'bg-accent text-accent-ink shadow-sm' : 'text-muted hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setBrowsing(!browsing)}
            className="springy inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-2 text-sm font-semibold shadow-sm transition-colors hover:bg-elev"
          >
            <BookOpenText size={15} aria-hidden />
            Starter plans
          </button>
          <button
            type="button"
            onClick={() => void navigate('/eat/meal-plan/build')}
            className="springy inline-flex items-center gap-1.5 rounded-xl bg-linear-to-r from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-accent-ink shadow-sm hover:opacity-90"
          >
            <Sparkles size={15} aria-hidden />
            Build a plan
          </button>
        </div>
      </header>

      {browsing && (
        <section className="space-y-3 rounded-2xl border border-accent/40 bg-surface p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              Pick a starting point — it fills your whole week (you can edit every slot after).
            </p>
            <span className="flex gap-1">
              {(
                [
                  ['all', 'All'],
                  ['lose', 'Weight loss'],
                  ['gain', 'Weight gain'],
                  ['maintain', 'Maintain'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTemplateGoal(value)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                    templateGoal === value
                      ? 'bg-accent text-accent-ink'
                      : 'bg-elev text-muted hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </span>
          </div>
          <ul className="grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleTemplates.map((t) => (
              <li
                key={t.key}
                className={`flex flex-col rounded-2xl border p-3.5 shadow-sm ${
                  t.key === 'comeback-phase1'
                    ? 'border-accent/60 ring-1 ring-accent/25'
                    : 'border-line'
                } bg-surface`}
              >
                <p className="font-semibold">{t.name}</p>
                <p className="text-xs text-muted">
                  ~{t.kcalPerDay.toLocaleString()} kcal · {t.proteinPerDay} g protein / day
                </p>
                <div className="my-1.5 flex flex-wrap gap-1">
                  {t.style.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="grow text-xs text-muted">{t.tagline}</p>
                {confirmingTemplate?.key === t.key ? (
                  <span className="mt-2 flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={applyTemplate.isPending}
                      onClick={() => applyTemplate.mutate(t)}
                      className="rounded-lg bg-rose-500/15 px-2.5 py-1.5 text-xs font-semibold text-rose-500 disabled:opacity-50"
                    >
                      {applyTemplate.isPending ? 'Building…' : 'Replace my week'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingTemplate(null)}
                      className="rounded-lg px-2 py-1.5 text-xs text-muted hover:text-ink"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingTemplate(t)}
                    className="mt-2 self-start rounded-lg bg-linear-to-r from-accent to-accent-2 px-3 py-1.5 text-xs font-semibold text-accent-ink shadow-sm hover:opacity-90"
                  >
                    Use this plan
                  </button>
                )}
                {t.note && confirmingTemplate?.key === t.key && (
                  <p className="mt-2 rounded-lg bg-elev p-2 text-[11px] leading-snug text-muted">
                    {t.note}
                  </p>
                )}
              </li>
            ))}
          </ul>
          {applyTemplate.isError && (
            <p className="text-sm text-rose-500">Could not apply the plan — try again.</p>
          )}
        </section>
      )}

      {view === 'week' && !hasAnyItems && !browsing && (
        <section className="rounded-2xl border border-dashed border-line p-8 text-center">
          <BookOpenText size={22} className="mx-auto mb-2 text-muted" aria-hidden />
          <p className="text-sm text-muted">
            Nothing planned yet — hit <span className="font-semibold">Build a plan</span> to pick
            meals you love, grab a <span className="font-semibold">starter plan</span>, or switch
            to <span className="font-semibold">Day</span> and build by hand.
          </p>
        </section>
      )}

      {view === 'week' && weekSummary && (
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-semibold">Average planned day</p>
            <p className="text-xs text-muted">
              {weekSummary.days} of 7 days planned
            </p>
          </div>
          <p className="text-sm text-muted tabular-nums">
            {weekSummary.kcal}
            {targetsQuery.data ? ` / ${Math.round(targetsQuery.data.kcal)}` : ''} kcal ·{' '}
            {weekSummary.proteinG}
            {targetsQuery.data ? ` / ${Math.round(targetsQuery.data.proteinG)}` : ''} g protein ·{' '}
            {weekSummary.carbsG} g carbs · {weekSummary.fatG} g fat
          </p>
          {targetsQuery.data && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-elev">
              <div
                className={`h-full rounded-full transition-[width] duration-500 ${
                  weekSummary.kcal > targetsQuery.data.kcal
                    ? 'bg-rose-500'
                    : 'bg-linear-to-r from-accent to-accent-2'
                }`}
                style={{
                  width: `${Math.min(100, Math.round((weekSummary.kcal / targetsQuery.data.kcal) * 100))}%`,
                }}
              />
            </div>
          )}
        </div>
      )}

      {view === 'week' && hasAnyItems && (
        <div className="space-y-5">
          {DAYS.map((label, i) => {
            const isToday = i === todayIndex();
            const kcal = Math.round(weekSummary?.perDay[i]?.kcal ?? 0);
            return (
              <section key={label}>
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h2 className="font-display text-lg font-bold tracking-tight">
                    {label}
                    {isToday && (
                      <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 align-middle text-[10px] font-semibold text-accent">
                        Today
                      </span>
                    )}
                  </h2>
                  {kcal > 0 && (
                    <span className="text-xs text-muted tabular-nums">
                      {kcal}
                      {targetsQuery.data ? ` / ${Math.round(targetsQuery.data.kcal)}` : ''} kcal
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {MEALS.map((meal) => {
                    const mealItems = allItems.filter(
                      (it) => it.dayOfWeek === i && it.meal === meal,
                    );
                    const primary = mealItems[0];
                    return (
                      <div key={meal}>
                        <WeekMealCard
                          meal={meal}
                          items={mealItems}
                          foods={foods}
                          recipes={recipes}
                          onOpen={() => openDaySlot(i, null)}
                          onSwap={
                            primary
                              ? () => setSwapId(swapId === primary.id ? null : primary.id)
                              : undefined
                          }
                        />
                        {primary && swapId === primary.id && (
                          <SwapPicker
                            item={primary}
                            currentKcal={itemMacros(primary, foods, recipes)?.kcal ?? null}
                            pending={swapMutation.isPending}
                            onPick={(entry) =>
                              swapMutation.mutate({
                                id: primary.id,
                                entry,
                                servings: primary.servings ?? 1,
                              })
                            }
                            onClose={() => setSwapId(null)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {view === 'day' && (
        <>
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
            {DAYS.map((label, i) => (
              <button
                key={label}
                type="button"
                aria-pressed={day === i}
                onClick={() => {
                  setDay(i);
                  setOpenSlot(null);
                  setSwapId(null);
                }}
                className={`shrink-0 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
                  day === i
                    ? 'bg-linear-to-r from-accent to-accent-2 text-accent-ink shadow-sm'
                    : 'border border-line bg-surface text-muted shadow-sm hover:bg-elev hover:text-ink'
                }`}
              >
                {label.slice(0, 3)}
                {i === todayIndex() && <span className="sr-only"> (today)</span>}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
            <p className="text-sm font-semibold">{DAYS[day]} totals</p>
            <p className="text-sm text-muted tabular-nums">
              {Math.round(dayTotals.kcal)}
              {targetsQuery.data ? ` / ${Math.round(targetsQuery.data.kcal)}` : ''} kcal ·{' '}
              {Math.round(dayTotals.proteinG)}
              {targetsQuery.data ? ` / ${Math.round(targetsQuery.data.proteinG)}` : ''} g protein ·{' '}
              {Math.round(dayTotals.carbsG)} g carbs · {Math.round(dayTotals.fatG)} g fat
            </p>
            {targetsQuery.data && (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-elev">
                <div
                  className={`h-full rounded-full transition-[width] duration-500 ${
                    dayTotals.kcal > targetsQuery.data.kcal
                      ? 'bg-rose-500'
                      : 'bg-linear-to-r from-accent to-accent-2'
                  }`}
                  style={{
                    width: `${Math.min(100, Math.round((dayTotals.kcal / targetsQuery.data.kcal) * 100))}%`,
                  }}
                />
              </div>
            )}
          </div>

          <div className="space-y-3">
            {MEALS.map((meal) => {
              const slotItems = dayItems.filter((i) => i.meal === meal);
              const { Icon, tint } = MEAL_META[meal];
              return (
                <section
                  key={meal}
                  className="rounded-2xl border border-line bg-surface p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2.5">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tint}`}
                      >
                        <Icon size={16} strokeWidth={1.8} aria-hidden />
                      </span>
                      <h2 className="text-sm font-semibold capitalize">{meal}</h2>
                    </span>
                    <button
                      type="button"
                      onClick={() => setOpenSlot(openSlot === meal ? null : meal)}
                      className="inline-flex items-center gap-1 rounded-xl border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold shadow-sm transition-colors hover:bg-elev"
                    >
                      <Plus size={13} aria-hidden />
                      Add
                    </button>
                  </div>

                  {slotItems.length === 0 && openSlot !== meal && (
                    <p className="mt-1.5 text-sm text-muted/70">Nothing planned.</p>
                  )}
                  {slotItems.length > 0 && (
                    <ul className="mt-2 space-y-1.5">
                      {slotItems.map((item) => {
                        const m = itemMacros(item, foods, recipes);
                        return (
                          <li key={item.id}>
                            <div className="flex items-center gap-2.5 text-sm">
                              <RecipeThumb
                                name={item.name}
                                className="h-9 w-9 rounded-lg text-base"
                              />
                              <span className="min-w-0 flex-1 truncate">
                                {item.name}
                                <span className="text-muted"> · {amountLabel(item)}</span>
                              </span>
                              {m && (
                                <span className="shrink-0 text-xs text-muted tabular-nums">
                                  {m.kcal} kcal
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => setSwapId(swapId === item.id ? null : item.id)}
                                aria-label={`Swap ${item.name}`}
                                className="shrink-0 rounded p-1 text-muted transition-colors hover:bg-elev hover:text-ink"
                              >
                                <ArrowLeftRight size={13} aria-hidden />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeMutation.mutate(item.id)}
                                aria-label={`Remove ${item.name}`}
                                className="shrink-0 rounded p-1 text-muted transition-colors hover:bg-elev hover:text-ink"
                              >
                                <X size={13} aria-hidden />
                              </button>
                            </div>
                            {swapId === item.id && (
                              <SwapPicker
                                item={item}
                                currentKcal={m?.kcal ?? null}
                                pending={swapMutation.isPending}
                                onPick={(entry) =>
                                  swapMutation.mutate({
                                    id: item.id,
                                    entry,
                                    servings: item.servings ?? 1,
                                  })
                                }
                                onClose={() => setSwapId(null)}
                              />
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {openSlot === meal && (
                    <SlotAdder
                      recipes={recipes}
                      onClose={() => setOpenSlot(null)}
                      onAddFood={(food, grams) =>
                        addMutation.mutate({
                          dayOfWeek: day,
                          meal,
                          kind: 'food',
                          refId: food.id,
                          name: food.name,
                          grams,
                          servings: null,
                        })
                      }
                      onAddRecipe={(recipe, servings) =>
                        addMutation.mutate({
                          dayOfWeek: day,
                          meal,
                          kind: 'recipe',
                          refId: recipe.id,
                          name: recipe.name,
                          grams: null,
                          servings,
                        })
                      }
                    />
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={
            allItems.filter((i) => i.dayOfWeek === logDay).length === 0 || logDayMutation.isPending
          }
          onClick={() => logDayMutation.mutate()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-linear-to-r from-accent to-accent-2 px-4 py-2.5 text-sm font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <NotebookPen size={15} aria-hidden />
          Log {view === 'week' ? 'today' : DAYS[day]} to today's diary
        </button>
        <span className="inline-flex items-center gap-1.5">
          <label htmlFor="shop-cadence" className="text-xs font-medium text-muted">
            I shop
          </label>
          <select
            id="shop-cadence"
            value={customCadence || ![3, 7, 14, 30].includes(cadence) ? 'custom' : String(cadence)}
            onChange={(e) => {
              if (e.target.value === 'custom') {
                setCustomCadence(true);
              } else {
                setCustomCadence(false);
                setCadence.mutate(Number(e.target.value));
              }
            }}
            className="rounded-xl border border-line bg-surface px-2.5 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="3">every 3 days</option>
            <option value="7">weekly</option>
            <option value="14">bi-weekly</option>
            <option value="30">monthly</option>
            <option value="custom">custom…</option>
          </select>
          {(customCadence || ![3, 7, 14, 30].includes(cadence)) && (
            <>
              <input
                type="number"
                min="1"
                max="90"
                value={cadence}
                onChange={(e) => setCadence.mutate(Number(e.target.value) || 1)}
                aria-label="Days between shopping trips"
                className="w-16 rounded-xl border border-line bg-surface px-2 py-2 text-sm outline-none focus:border-accent"
              />
              <span className="text-xs text-muted">days</span>
            </>
          )}
        </span>
        <button
          type="button"
          disabled={!hasAnyItems || shoppingMutation.isPending}
          onClick={() => shoppingMutation.mutate()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors hover:bg-elev disabled:opacity-50"
        >
          <ShoppingCart size={15} aria-hidden />
          Add next {cadence} day{cadence === 1 ? '' : 's'} to shopping list
        </button>
      </div>
      {logDayMutation.isSuccess && (
        <p className="text-sm text-accent">Planned meals logged to today's diary ✓</p>
      )}
      {shoppingMutation.isSuccess && (
        <p className="text-sm text-accent">
          {shoppingMutation.data} ingredient{shoppingMutation.data === 1 ? '' : 's'} added — covers
          you until your next trip in {cadence} day{cadence === 1 ? '' : 's'} ✓
        </p>
      )}
    </div>
  );
}
