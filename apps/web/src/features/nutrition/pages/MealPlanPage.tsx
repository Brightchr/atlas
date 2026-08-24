import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpenText, Cookie, Moon, NotebookPen, Plus, ShoppingCart, Sun, Sunrise, X } from 'lucide-react';
import type { Food, Macros, MealPlanItem, MealType } from '@arcadia/shared';
import { getSavedTargets } from '@/features/goals/repository';
import { FoodPicker } from '../components/FoodPicker';
import {
  addMealPlanItem,
  addPlanWeekToShoppingList,
  listMealPlanItems,
  logPlanDayToDiary,
  removeMealPlanItem,
} from '../mealPlan';
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

export function MealPlanPage() {
  const [day, setDay] = useState(todayIndex);
  const [openSlot, setOpenSlot] = useState<MealType | null>(null);
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
  const logDayMutation = useMutation({
    mutationFn: () => logPlanDayToDiary(day, new Date().toISOString().slice(0, 10)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['diary'] });
      void queryClient.invalidateQueries({ queryKey: ['goals'] });
    },
  });
  const shoppingMutation = useMutation({
    mutationFn: addPlanWeekToShoppingList,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['shopping'] }),
  });

  const recipes = recipesQuery.data ?? [];
  const foods = foodsQuery.data ?? new Map<string, Food>();
  const dayItems = (planQuery.data ?? []).filter((i) => i.dayOfWeek === day);

  const dayTotals = dayItems.reduce(
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

  const hasAnyItems = (planQuery.data ?? []).length > 0;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-bold">Meal plan</h1>
        <p className="text-sm text-muted">
          Plan breakfast to snacks for each day — then log a day to your diary in one tap or turn
          the week into a shopping list.
        </p>
      </header>


      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {DAYS.map((label, i) => (
          <button
            key={label}
            type="button"
            aria-pressed={day === i}
            onClick={() => {
              setDay(i);
              setOpenSlot(null);
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
            <section key={meal} className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2.5">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tint}`}>
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
                <ul className="mt-2 space-y-1">
                  {slotItems.map((item) => {
                    const m = itemMacros(item, foods, recipes);
                    return (
                      <li key={item.id} className="flex items-center gap-2 text-sm">
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
                          onClick={() => removeMutation.mutate(item.id)}
                          aria-label={`Remove ${item.name}`}
                          className="shrink-0 rounded p-1 text-muted transition-colors hover:bg-elev hover:text-ink"
                        >
                          <X size={13} aria-hidden />
                        </button>
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

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={dayItems.length === 0 || logDayMutation.isPending}
          onClick={() => logDayMutation.mutate()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-linear-to-r from-accent to-accent-2 px-4 py-2.5 text-sm font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <NotebookPen size={15} aria-hidden />
          Log {DAYS[day]} to today's diary
        </button>
        <button
          type="button"
          disabled={!hasAnyItems || shoppingMutation.isPending}
          onClick={() => shoppingMutation.mutate()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors hover:bg-elev disabled:opacity-50"
        >
          <ShoppingCart size={15} aria-hidden />
          Add week's ingredients to shopping list
        </button>
      </div>
      {logDayMutation.isSuccess && (
        <p className="text-sm text-accent">Planned meals logged to today's diary ✓</p>
      )}
      {shoppingMutation.isSuccess && (
        <p className="text-sm text-accent">
          {shoppingMutation.data} ingredient{shoppingMutation.data === 1 ? '' : 's'} added to your
          shopping list ✓
        </p>
      )}
    </div>
  );
}
