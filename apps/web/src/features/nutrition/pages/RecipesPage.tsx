import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChefHat, Plus, Search, X } from 'lucide-react';
import { createRecipe, listRecipes, type RecipeDetails } from '../recipes';

function macroChip(tone: string, children: React.ReactNode) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${tone}`}>
      {children}
    </span>
  );
}

/** One recipe as a browse card — the whole card opens the recipe; editing
 * lives on the detail page. */
function RecipeCard({ recipe }: { recipe: RecipeDetails }) {
  const navigate = useNavigate();
  const preview =
    recipe.ingredients.length === 0
      ? 'No ingredients yet — open to build it.'
      : recipe.ingredients
          .slice(0, 3)
          .map((i) => i.foodName)
          .join(' · ') + (recipe.ingredients.length > 3 ? ` +${recipe.ingredients.length - 3} more` : '');

  return (
    <li>
      <button
        type="button"
        onClick={() => void navigate(`/eat/recipes/${recipe.id}`)}
        className="springy flex h-full w-full flex-col rounded-2xl border border-line bg-surface p-4 text-left shadow-sm hover:-translate-y-0.5 hover:shadow-md"
      >
        <div className="mb-2 flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
            <ChefHat size={16} strokeWidth={1.8} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold">{recipe.name}</p>
            <p className="text-xs text-muted">
              Makes {recipe.servings} · {recipe.ingredients.length} ingredient
              {recipe.ingredients.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <p className="mb-3 grow text-xs text-muted">{preview}</p>
        <div className="flex flex-wrap gap-1.5">
          {macroChip('bg-orange-500/10 text-orange-500', `${recipe.perServing.kcal} kcal`)}
          {macroChip('bg-rose-500/10 text-rose-500', `${recipe.perServing.proteinG} g protein`)}
          {macroChip('bg-amber-500/10 text-amber-600', `${recipe.perServing.carbsG} g carbs`)}
          {macroChip('bg-sky-500/10 text-sky-600', `${recipe.perServing.fatG} g fat`)}
        </div>
      </button>
    </li>
  );
}

/** Recipes: a searchable card grid. Cards drill into the recipe's own page —
 * same browse-then-open pattern as Explore. */
export function RecipesPage() {
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [servings, setServings] = useState('1');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const recipesQuery = useQuery({ queryKey: ['recipes'], queryFn: listRecipes });
  const createMutation = useMutation({
    mutationFn: () => createRecipe(name.trim(), Number(servings) || 1),
    onSuccess: (id) => {
      setName('');
      setServings('1');
      setCreating(false);
      void queryClient.invalidateQueries({ queryKey: ['recipes'] });
      // A new recipe is empty — jump straight into building it.
      if (typeof id === 'string') void navigate(`/eat/recipes/${id}`);
    },
  });

  const recipes = useMemo(() => {
    const all = recipesQuery.data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.ingredients.some((i) => i.foodName.toLowerCase().includes(q)),
    );
  }, [recipesQuery.data, query]);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Recipes</h1>
          <p className="text-sm text-muted">
            Group foods you eat together — a sandwich, a smoothie — then log or plan them as one.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(!creating)}
          className="springy inline-flex items-center gap-1.5 rounded-xl bg-linear-to-r from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-accent-ink shadow-sm hover:opacity-90"
        >
          <Plus size={15} aria-hidden />
          New recipe
        </button>
      </header>

      {creating && (
        <section className="rounded-2xl border border-accent/40 bg-surface p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && name.trim() && createMutation.mutate()}
              placeholder="Recipe name — e.g. Turkey sandwich"
              className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 py-2.5 shadow-sm outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
            <label className="flex items-center gap-1.5 text-xs text-muted">
              Makes
              <input
                type="number"
                min="1"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
                aria-label="Servings the recipe makes"
                className="w-16 rounded-xl border border-line bg-surface px-3 py-2.5 shadow-sm outline-none focus:border-accent"
              />
              serving{Number(servings) === 1 ? '' : 's'}
            </label>
            <button
              type="button"
              disabled={!name.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
              className="rounded-xl bg-linear-to-r from-accent to-accent-2 px-5 py-2.5 font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              aria-label="Cancel"
              className="rounded-xl p-2 text-muted hover:bg-elev hover:text-ink"
            >
              <X size={15} aria-hidden />
            </button>
          </div>
        </section>
      )}

      {(recipesQuery.data?.length ?? 0) > 3 && (
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search recipes or ingredients…"
            aria-label="Search recipes"
            className="w-full rounded-2xl border border-line bg-surface py-2.5 pr-3 pl-10 text-sm shadow-sm outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>
      )}

      {recipesQuery.data?.length === 0 && !creating && (
        <section className="rounded-2xl border border-dashed border-line p-8 text-center">
          <ChefHat size={22} className="mx-auto mb-2 text-muted" aria-hidden />
          <p className="text-sm text-muted">
            No recipes yet — hit <span className="font-semibold">New recipe</span> and build your
            first one.
          </p>
        </section>
      )}
      {recipes.length === 0 && (recipesQuery.data?.length ?? 0) > 0 && (
        <p className="text-sm text-muted">Nothing matches “{query.trim()}”.</p>
      )}
      <ul className="grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {recipes.map((recipe) => (
          <RecipeCard key={recipe.id} recipe={recipe} />
        ))}
      </ul>
    </div>
  );
}
