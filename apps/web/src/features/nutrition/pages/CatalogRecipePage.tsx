import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Beef, BookmarkPlus, ChevronLeft, Droplet, Flame, UtensilsCrossed, Wheat } from 'lucide-react';
import { catalogPerServing, catalogRecipe } from '../recipeCatalog';
import { descriptionBlurb, parseRecipeTags } from '../recipeTags';
import { importRecipeFromCatalog, listRecipes } from '../recipes';
import { RecipeHero } from '../components/RecipeArt';

const MACRO_TILES = [
  { key: 'kcal', label: 'Calories', unit: 'kcal', Icon: Flame, tint: 'bg-orange-500/15 text-orange-500' },
  { key: 'proteinG', label: 'Protein', unit: 'g', Icon: Beef, tint: 'bg-rose-500/15 text-rose-500' },
  { key: 'carbsG', label: 'Carbs', unit: 'g', Icon: Wheat, tint: 'bg-amber-500/15 text-amber-500' },
  { key: 'fatG', label: 'Fat', unit: 'g', Icon: Droplet, tint: 'bg-sky-500/15 text-sky-500' },
] as const;

/** A bundled catalog recipe, viewable before it's yours — linked from meal
 * plan previews and the builder so "what actually is this dish?" never
 * requires committing to anything. Saving imports it as a local recipe. */
export function CatalogRecipePage() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const entry = name ? catalogRecipe(decodeURIComponent(name)) : undefined;

  // Already in the user's recipes? Then the local page is the better home.
  const recipesQuery = useQuery({ queryKey: ['recipes'], queryFn: listRecipes });
  const localCopy = recipesQuery.data?.find(
    (r) => r.name.toLowerCase() === entry?.name.toLowerCase(),
  );

  const save = useMutation({
    mutationFn: () => importRecipeFromCatalog(entry!),
    onSuccess: (id) => {
      void queryClient.invalidateQueries({ queryKey: ['recipes'] });
      void queryClient.invalidateQueries({ queryKey: ['foods'] });
      void navigate(`/eat/recipes/${id}`);
    },
  });

  if (!entry) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 p-4 md:p-6">
        <p className="text-sm text-muted">This recipe isn't in the catalog.</p>
        <button
          type="button"
          onClick={() => void navigate(-1)}
          className="text-sm font-medium text-accent hover:underline"
        >
          ← Back
        </button>
      </div>
    );
  }

  const per = catalogPerServing(entry);
  const tags = parseRecipeTags(entry.description);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => void navigate(-1)}
          className="inline-flex items-center gap-1 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-elev"
        >
          <ChevronLeft size={14} aria-hidden />
          Back
        </button>
        {localCopy ? (
          <button
            type="button"
            onClick={() => void navigate(`/eat/recipes/${localCopy.id}`)}
            className="rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-elev"
          >
            Open in my recipes →
          </button>
        ) : (
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate()}
            className="springy inline-flex items-center gap-1.5 rounded-xl bg-linear-to-r from-accent to-accent-2 px-3.5 py-1.5 text-xs font-semibold text-accent-ink shadow-sm hover:opacity-90 disabled:opacity-50"
          >
            <BookmarkPlus size={13} aria-hidden />
            {save.isPending ? 'Saving…' : 'Save to my recipes'}
          </button>
        )}
      </div>

      <RecipeHero name={entry.name} />

      <header>
        <h1 className="text-2xl font-bold">{entry.name}</h1>
        <p className="text-sm text-muted">
          Makes {entry.servings} serving{entry.servings === 1 ? '' : 's'} ·{' '}
          {entry.ingredients.length} ingredient{entry.ingredients.length === 1 ? '' : 's'}
        </p>
        {tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        <p className="mt-1.5 text-sm text-muted">{descriptionBlurb(entry.description)}</p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Per serving">
        {MACRO_TILES.map(({ key, label, unit, Icon, tint }) => (
          <div key={key} className="rounded-2xl border border-line bg-surface p-3.5 shadow-sm">
            <span className={`mb-2 flex h-9 w-9 items-center justify-center rounded-full ${tint}`}>
              <Icon size={16} strokeWidth={1.8} aria-hidden />
            </span>
            <p className="font-display text-xl font-bold tracking-tight tabular-nums">
              {per[key]}
              <span className="text-sm font-semibold text-muted"> {unit}</span>
            </p>
            <p className="text-xs text-muted">{label} / serving</p>
          </div>
        ))}
      </section>

      {entry.instructions && (
        <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold">How to make it</h2>
          <ol className="space-y-1.5">
            {entry.instructions
              .split(/(?<=\.)\s+/)
              .filter((s) => s.trim())
              .map((step, i) => (
                <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-bold text-accent tabular-nums">
                    {i + 1}
                  </span>
                  <span className="min-w-0">{step.trim()}</span>
                </li>
              ))}
          </ol>
        </section>
      )}

      <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold">Ingredients</h2>
        <ul className="divide-y divide-line">
          {entry.ingredients.map((ingredient, i) => (
            <li key={i} className="flex items-center gap-3 py-2 text-sm">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-elev text-muted">
                <UtensilsCrossed size={14} strokeWidth={1.8} aria-hidden />
              </span>
              <span className="min-w-0 flex-1 truncate">{ingredient.food.name}</span>
              <span className="shrink-0 text-xs text-muted tabular-nums">{ingredient.grams} g</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
