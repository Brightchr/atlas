import { useState } from 'react';
import { Check } from 'lucide-react';
import type { Food, MealPlanItem, MealType } from '@arcadia/shared';
import { Button, Sheet, Stepper } from '@/components/ui';
import type { RecipeDetails } from '../../recipes';
import { mealLabel } from '../diary/meals';
import { FoodPicker } from '../FoodPicker';
import { RecipeThumb } from '../RecipeArt';
import { Segmented } from '../Segmented';
import { DAYS } from './planMath';

const MODES = [
  ['recipe', 'Recipe'],
  ['food', 'Food'],
] as const;

/** Add something to one slot of the plan (a day + a meal): one of your
 * recipes with a number of servings, or a plain food with grams.
 *
 * It stays open after each add so a whole meal can be filled in one go, and
 * lists what was added — the plan itself is hidden behind the sheet, so
 * without that list there would be no sign the tap did anything. Mounted
 * only while open, which resets all of this state for the next slot. */
export function AddToSlotSheet({
  day,
  meal,
  recipes,
  onAdd,
  onClose,
}: {
  day: number;
  meal: MealType;
  recipes: RecipeDetails[];
  /** Resolves once the item is saved (pass the mutation's `mutateAsync`). */
  onAdd: (item: Omit<MealPlanItem, 'id'>) => Promise<unknown>;
  onClose: () => void;
}) {
  // With no recipes yet there is nothing to pick from, so start on Food.
  const [mode, setMode] = useState<'recipe' | 'food'>(recipes.length > 0 ? 'recipe' : 'food');
  const [recipeId, setRecipeId] = useState(recipes[0]?.id ?? '');
  const [servings, setServings] = useState('1');
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [added, setAdded] = useState<string[]>([]);

  const add = async (
    item: Pick<MealPlanItem, 'kind' | 'refId' | 'name' | 'grams' | 'servings'>,
  ) => {
    setBusy(true);
    setFailed(false);
    try {
      await onAdd({ dayOfWeek: day, meal, ...item });
      setAdded((names) => [...names, item.name]);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const addFood = (food: Food, grams: number) =>
    void add({ kind: 'food', refId: food.id, name: food.name, grams, servings: null });

  const selected = recipes.find((r) => r.id === recipeId);
  const servingCount = Number(servings);
  const addRecipe = () => {
    if (!selected || !servingCount) return;
    void add({
      kind: 'recipe',
      refId: selected.id,
      name: selected.name,
      grams: null,
      servings: servingCount,
    });
  };

  const q = filter.trim().toLowerCase();
  const shown = q ? recipes.filter((r) => r.name.toLowerCase().includes(q)) : recipes;

  return (
    <Sheet
      title={`Add to ${DAYS[day]} ${meal}`}
      tall
      onClose={onClose}
      footer={
        <div className={`grid gap-2 ${mode === 'recipe' ? 'grid-cols-2' : ''}`}>
          <Button variant="secondary" size="lg" block onClick={onClose}>
            Done
          </Button>
          {mode === 'recipe' && (
            <Button
              size="lg"
              block
              disabled={!selected || !servingCount || busy}
              onClick={addRecipe}
            >
              Add recipe
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {recipes.length > 0 && (
          <Segmented label="What to add" options={MODES} value={mode} onChange={setMode} />
        )}

        {added.length > 0 && (
          <p role="status" className="flex items-start gap-1.5 text-sm text-emerald-500">
            <Check size={16} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              Added to {mealLabel(meal).toLowerCase()}: {added.join(', ')}
            </span>
          </p>
        )}
        {failed && <p className="text-sm text-rose-500">Couldn't add that. Try again.</p>}

        {mode === 'recipe' ? (
          <>
            <div className="mx-auto max-w-56">
              <Stepper
                label="Servings"
                value={servings}
                onChange={setServings}
                step={0.5}
                min={0.5}
                decimals
                placeholder="1"
              />
            </div>
            {/* Only worth a search box once the list is longer than a screen. */}
            {recipes.length > 6 && (
              <input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter your recipes"
                aria-label="Filter your recipes"
                className="h-11 w-full rounded-xl border border-line bg-bg px-3 text-base outline-none placeholder:text-muted/70 focus:border-accent"
              />
            )}
            {shown.length === 0 && (
              <p className="text-sm text-muted">Nothing matches “{filter.trim()}”.</p>
            )}
            <ul className="space-y-1.5">
              {shown.map((r) => {
                const on = r.id === recipeId;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => setRecipeId(r.id)}
                      className={`springy flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left ${
                        on ? 'border-accent bg-accent-soft' : 'border-line bg-bg hover:bg-elev'
                      }`}
                    >
                      <RecipeThumb name={r.name} className="h-10 w-10 rounded-lg text-lg" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{r.name}</span>
                        <span className="block text-sm text-muted tabular-nums">
                          {r.perServing.kcal} kcal / serving
                        </span>
                      </span>
                      {on && <Check size={18} className="shrink-0 text-accent" aria-hidden />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          // Shared with the recipe editor: search, pick, enter grams, Add.
          <FoodPicker onPick={addFood} pending={busy} />
        )}
      </div>
    </Sheet>
  );
}
