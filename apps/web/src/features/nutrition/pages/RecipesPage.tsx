import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChefHat, Plus, Trash2, UtensilsCrossed, X } from 'lucide-react';
import type { MealType } from '@arcadia/shared';
import { FoodPicker } from '../components/FoodPicker';
import {
  addIngredient,
  createRecipe,
  deleteRecipe,
  listRecipes,
  logRecipeToDiary,
  removeIngredient,
  type RecipeDetails,
} from '../recipes';

const MEALS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

function RecipeCard({ recipe }: { recipe: RecipeDetails }) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [meal, setMeal] = useState<MealType>('lunch');
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['recipes'] });
    void queryClient.invalidateQueries({ queryKey: ['diary'] });
  };

  const addMutation = useMutation({
    mutationFn: ({ food, grams }: { food: Parameters<typeof addIngredient>[1]; grams: number }) =>
      addIngredient(recipe.id, food, grams),
    onSuccess: invalidate,
  });
  const removeMutation = useMutation({ mutationFn: removeIngredient, onSuccess: invalidate });
  const deleteMutation = useMutation({ mutationFn: deleteRecipe, onSuccess: invalidate });
  const [logServings, setLogServings] = useState('1');
  const logMutation = useMutation({
    mutationFn: () =>
      logRecipeToDiary(recipe, {
        date: new Date().toISOString().slice(0, 10),
        meal,
        servings: Number(logServings) || 1,
      }),
    onSuccess: invalidate,
  });

  return (
    <li className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{recipe.name}</p>
          <p className="text-xs text-muted tabular-nums">
            Per serving: {recipe.perServing.kcal} kcal · {recipe.perServing.proteinG} g protein ·{' '}
            {recipe.perServing.carbsG} g carbs · {recipe.perServing.fatG} g fat
            {recipe.servings > 1 && ` · makes ${recipe.servings}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => deleteMutation.mutate(recipe.id)}
          aria-label={`Delete ${recipe.name}`}
          className="shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-elev hover:text-ink"
        >
          <Trash2 size={15} aria-hidden />
        </button>
      </div>

      {recipe.ingredients.length === 0 ? (
        <p className="mt-2 text-sm text-muted/70">No ingredients yet — add some below.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {recipe.ingredients.map((ingredient) => (
            <li key={ingredient.id} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{ingredient.foodName}</span>
              <span className="shrink-0 text-xs text-muted tabular-nums">{ingredient.grams} g</span>
              <button
                type="button"
                onClick={() => removeMutation.mutate(ingredient.id)}
                aria-label={`Remove ${ingredient.foodName}`}
                className="shrink-0 rounded p-1 text-muted transition-colors hover:bg-elev hover:text-ink"
              >
                <X size={13} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 border-t border-line pt-3">
        {adding ? (
          <FoodPicker
            pending={addMutation.isPending}
            onPick={(food, grams) => addMutation.mutate({ food, grams })}
          />
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors hover:bg-elev"
            >
              <Plus size={13} aria-hidden />
              Ingredient
            </button>
            {recipe.ingredients.length > 0 && (
              <>
                <span className="flex-1" />
                <select
                  value={meal}
                  onChange={(e) => setMeal(e.target.value as MealType)}
                  aria-label="Meal to log to"
                  className="rounded-xl border border-line bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-accent"
                >
                  {MEALS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0.25"
                  step="0.25"
                  value={logServings}
                  onChange={(e) => setLogServings(e.target.value)}
                  aria-label="Servings to log"
                  className="w-16 rounded-xl border border-line bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-accent"
                />
                <button
                  type="button"
                  disabled={logMutation.isPending || !(Number(logServings) > 0)}
                  onClick={() => logMutation.mutate()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-linear-to-r from-accent to-accent-2 px-3 py-1.5 text-xs font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  <UtensilsCrossed size={13} aria-hidden />
                  Log {Number(logServings) === 1 ? '1 serving' : `${logServings} servings`}
                </button>
              </>
            )}
          </div>
        )}
        {adding && (
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="mt-2 text-xs font-medium text-muted transition-colors hover:text-ink"
          >
            Done adding
          </button>
        )}
        {logMutation.isSuccess && <p className="mt-2 text-xs text-accent">Logged to today ✓</p>}
      </div>
    </li>
  );
}

export function RecipesPage() {
  const [name, setName] = useState('');
  const [servings, setServings] = useState('1');
  const queryClient = useQueryClient();

  const recipesQuery = useQuery({ queryKey: ['recipes'], queryFn: listRecipes });
  const createMutation = useMutation({
    mutationFn: () => createRecipe(name.trim(), Number(servings) || 1),
    onSuccess: () => {
      setName('');
      setServings('1');
      void queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-bold">Recipes</h1>
        <p className="text-sm text-muted">
          Group foods you eat together — a sandwich, a smoothie — then log or plan them as one.
        </p>
      </header>


      <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <div className="mb-2.5 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
            <ChefHat size={17} strokeWidth={1.8} aria-hidden />
          </span>
          <p className="text-sm font-semibold">New recipe</p>
        </div>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && name.trim() && createMutation.mutate()}
            placeholder="e.g. Turkey sandwich"
            className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 py-2.5 shadow-sm outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <input
            type="number"
            min="1"
            value={servings}
            onChange={(e) => setServings(e.target.value)}
            aria-label="Servings the recipe makes"
            title="Servings the recipe makes"
            className="w-20 rounded-xl border border-line bg-surface px-3 py-2.5 shadow-sm outline-none focus:border-accent"
          />
          <button
            type="button"
            disabled={!name.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate()}
            className="rounded-xl bg-linear-to-r from-accent to-accent-2 px-5 py-2.5 font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </section>

      {recipesQuery.data?.length === 0 && (
        <p className="text-muted">No recipes yet — create one above and add its ingredients.</p>
      )}
      <ul className="grid items-start gap-3 md:grid-cols-2">
        {recipesQuery.data?.map((recipe) => (
          <RecipeCard key={recipe.id} recipe={recipe} />
        ))}
      </ul>
    </div>
  );
}
