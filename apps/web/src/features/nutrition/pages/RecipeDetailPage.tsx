import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Beef, ChevronLeft, Droplet, Flame, Plus, Trash2, UtensilsCrossed, Wheat, X } from 'lucide-react';
import type { MealType } from '@arcadia/shared';
import { FoodPicker } from '../components/FoodPicker';
import {
  addIngredient,
  deleteRecipe,
  listRecipes,
  logRecipeToDiary,
  removeIngredient,
} from '../recipes';

const MEALS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

const MACRO_TILES = [
  { key: 'kcal', label: 'Calories', unit: 'kcal', Icon: Flame, tint: 'bg-orange-500/15 text-orange-500' },
  { key: 'proteinG', label: 'Protein', unit: 'g', Icon: Beef, tint: 'bg-rose-500/15 text-rose-500' },
  { key: 'carbsG', label: 'Carbs', unit: 'g', Icon: Wheat, tint: 'bg-amber-500/15 text-amber-500' },
  { key: 'fatG', label: 'Fat', unit: 'g', Icon: Droplet, tint: 'bg-sky-500/15 text-sky-500' },
] as const;

/** One recipe's home: per-serving numbers up top, then the ingredient list
 * and the log-to-diary flow. The list page stays a clean browse; all editing
 * lives here. */
export function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [meal, setMeal] = useState<MealType>('lunch');
  const [servings, setServings] = useState('1');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const recipesQuery = useQuery({ queryKey: ['recipes'], queryFn: listRecipes });
  const recipe = recipesQuery.data?.find((r) => r.id === id);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['recipes'] });
    void queryClient.invalidateQueries({ queryKey: ['diary'] });
  };
  const addMutation = useMutation({
    mutationFn: ({ food, grams }: { food: Parameters<typeof addIngredient>[1]; grams: number }) =>
      addIngredient(recipe!.id, food, grams),
    onSuccess: invalidate,
  });
  const removeMutation = useMutation({ mutationFn: removeIngredient, onSuccess: invalidate });
  const deleteMutation = useMutation({
    mutationFn: deleteRecipe,
    onSuccess: () => {
      invalidate();
      void navigate('/eat/recipes');
    },
  });
  const logMutation = useMutation({
    mutationFn: () =>
      logRecipeToDiary(recipe!, {
        date: new Date().toISOString().slice(0, 10),
        meal,
        servings: Number(servings) || 1,
      }),
    onSuccess: invalidate,
  });

  if (recipesQuery.isLoading) {
    return <div className="mx-auto max-w-3xl p-4 text-sm text-muted md:p-6">Loading…</div>;
  }
  if (!recipe) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 p-4 md:p-6">
        <p className="text-sm text-muted">Recipe not found — it may have been deleted.</p>
        <Link to="/eat/recipes" className="text-sm font-medium text-accent hover:underline">
          ← Back to recipes
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <Link
          to="/eat/recipes"
          className="flex items-center gap-1 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-elev"
        >
          <ChevronLeft size={14} aria-hidden />
          Recipes
        </Link>
      </div>

      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{recipe.name}</h1>
          <p className="text-sm text-muted">
            Makes {recipe.servings} serving{recipe.servings === 1 ? '' : 's'} ·{' '}
            {recipe.ingredients.length} ingredient{recipe.ingredients.length === 1 ? '' : 's'}
          </p>
        </div>
        {confirmingDelete ? (
          <span className="flex shrink-0 items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => deleteMutation.mutate(recipe.id)}
              className="rounded-lg bg-rose-500/10 px-2.5 py-1.5 font-semibold text-rose-600"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="rounded-lg px-2 py-1.5 text-muted hover:text-ink"
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            aria-label={`Delete ${recipe.name}`}
            className="shrink-0 rounded-lg p-2 text-muted transition-colors hover:bg-elev hover:text-ink"
          >
            <Trash2 size={16} aria-hidden />
          </button>
        )}
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Per serving">
        {MACRO_TILES.map(({ key, label, unit, Icon, tint }) => (
          <div key={key} className="rounded-2xl border border-line bg-surface p-3.5 shadow-sm">
            <span className={`mb-2 flex h-9 w-9 items-center justify-center rounded-full ${tint}`}>
              <Icon size={16} strokeWidth={1.8} aria-hidden />
            </span>
            <p className="font-display text-xl font-bold tracking-tight tabular-nums">
              {recipe.perServing[key]}
              <span className="text-sm font-semibold text-muted"> {unit}</span>
            </p>
            <p className="text-xs text-muted">{label} / serving</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Ingredients</h2>
          {!adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors hover:bg-elev"
            >
              <Plus size={13} aria-hidden />
              Add ingredient
            </button>
          )}
        </div>
        {recipe.ingredients.length === 0 && !adding && (
          <p className="text-sm text-muted/70">No ingredients yet — add the first one.</p>
        )}
        <ul className="divide-y divide-line">
          {recipe.ingredients.map((ingredient) => (
            <li key={ingredient.id} className="flex items-center gap-3 py-2 text-sm">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-elev text-muted">
                <UtensilsCrossed size={14} strokeWidth={1.8} aria-hidden />
              </span>
              <span className="min-w-0 flex-1 truncate">{ingredient.foodName}</span>
              <span className="shrink-0 text-xs text-muted tabular-nums">{ingredient.grams} g</span>
              <button
                type="button"
                onClick={() => removeMutation.mutate(ingredient.id)}
                aria-label={`Remove ${ingredient.foodName}`}
                className="shrink-0 rounded p-1.5 text-muted transition-colors hover:bg-elev hover:text-ink"
              >
                <X size={14} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        {adding && (
          <div className="mt-2 space-y-2">
            <FoodPicker
              pending={addMutation.isPending}
              onPick={(food, grams) => addMutation.mutate({ food, grams })}
            />
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="text-xs font-medium text-muted transition-colors hover:text-ink"
            >
              Done adding
            </button>
          </div>
        )}
      </section>

      {recipe.ingredients.length > 0 && (
        <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold">Log to today's diary</h2>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={meal}
              onChange={(e) => setMeal(e.target.value as MealType)}
              aria-label="Meal to log to"
              className="rounded-xl border border-line bg-surface px-3 py-2 text-sm capitalize outline-none focus:border-accent"
            >
              {MEALS.map((m) => (
                <option key={m} value={m} className="capitalize">
                  {m}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="0.25"
              step="0.25"
              value={servings}
              onChange={(e) => setServings(e.target.value)}
              aria-label="Servings to log"
              className="w-20 rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <span className="text-sm text-muted">
              serving{Number(servings) === 1 ? '' : 's'} ·{' '}
              <span className="tabular-nums">
                {Math.round(recipe.perServing.kcal * (Number(servings) || 0))} kcal
              </span>
            </span>
            <button
              type="button"
              disabled={logMutation.isPending || !(Number(servings) > 0)}
              onClick={() => logMutation.mutate()}
              className="rounded-xl bg-linear-to-r from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Log it
            </button>
          </div>
          {logMutation.isSuccess && <p className="mt-2 text-xs text-accent">Logged to today ✓</p>}
        </section>
      )}
    </div>
  );
}
