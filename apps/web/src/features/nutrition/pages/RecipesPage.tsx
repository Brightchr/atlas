import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChefHat, Globe, Plus, Search } from 'lucide-react';
import { Pagination } from '@/components/Pagination';
import { Button } from '@/components/ui';
import { useCommunityRecipes } from '../communityRecipes';
import { NewRecipeSheet } from '../components/NewRecipeSheet';
import { CommunityCard, RecipeCard } from '../components/RecipeCards';
import { Segmented } from '../components/Segmented';
import { createRecipe, listRecipes } from '../recipes';

const VIEWS = [
  ['mine', 'My recipes'],
  ['community', 'Community'],
] as const;

// One column of compact rows on phones, two cards from `sm`, three from `lg`.
// grid-cols-1 matters on phones: it makes the single column minmax(0, 1fr),
// so long recipe names truncate instead of stretching the page sideways.
const GRID = 'grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3';

/** The search box both tabs use. Full width on phones; capped on wide
 * screens so it doesn't become a bar across the whole page. */
function SearchField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (next: string) => void;
  /** Used as both the placeholder and the screen-reader name. */
  label: string;
}) {
  return (
    <div className="relative min-w-0 flex-1 sm:max-w-sm">
      <Search
        size={16}
        className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        aria-label={label}
        // 16px text on phones stops iOS Safari zooming in on focus.
        className="h-11 w-full rounded-xl border border-line bg-surface pr-3 pl-10 text-base shadow-sm outline-none placeholder:text-muted/70 focus:border-accent md:h-9 md:text-sm"
      />
    </div>
  );
}

/** A dashed "nothing here" panel with an icon. */
function EmptyState({ Icon, children }: { Icon: typeof ChefHat; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-dashed border-line p-8 text-center">
      <Icon size={22} className="mx-auto mb-2 text-muted" aria-hidden />
      <p className="mx-auto max-w-md text-sm text-muted">{children}</p>
    </section>
  );
}

/** The community browser: every published recipe, searchable, rating-sorted.
 * Search, sort and page live here because only this tab uses them — and
 * because switching tabs unmounts it, which resets them. */
function CommunitySection() {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'top' | 'new'>('top');
  const [page, setPage] = useState(1);
  const browse = useCommunityRecipes(q.trim(), sort, page);

  return (
    <>
      <div className="flex items-center gap-2">
        <SearchField
          label="Search community recipes"
          value={q}
          onChange={(next) => {
            setQ(next);
            setPage(1); // a new search starts from its first page
          }}
        />
        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value as 'top' | 'new');
            setPage(1);
          }}
          aria-label="Sort recipes"
          className="h-11 shrink-0 rounded-xl border border-line bg-surface px-3 text-sm shadow-sm outline-none focus:border-accent md:h-9"
        >
          <option value="top">Top rated</option>
          <option value="new">Newest</option>
        </select>
      </div>

      {browse.isError && <p className="text-sm text-rose-500">Could not load community recipes.</p>}
      {browse.data?.recipes.length === 0 && (
        <EmptyState Icon={Globe}>
          {q.trim()
            ? `Nothing matches “${q.trim()}”.`
            : 'Nothing shared yet. Publish one of your recipes and start the library.'}
        </EmptyState>
      )}
      <ul className={GRID}>
        {browse.data?.recipes.map((r) => (
          <CommunityCard key={r.id} recipe={r} />
        ))}
      </ul>
      {browse.data && browse.data.pageCount > 1 && (
        <Pagination page={browse.data.page} pageCount={browse.data.pageCount} onChange={setPage} />
      )}
    </>
  );
}

/** Recipes: a searchable card grid in two tabs (yours, and the community's).
 * Cards open the recipe's own page — browse here, edit there. */
export function RecipesPage() {
  const [view, setView] = useState<'mine' | 'community'>('mine');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const recipesQuery = useQuery({ queryKey: ['recipes'], queryFn: listRecipes });
  const createMutation = useMutation({
    mutationFn: ({ name, servings }: { name: string; servings: number }) =>
      createRecipe(name, servings),
    onSuccess: (id) => {
      setCreating(false);
      void queryClient.invalidateQueries({ queryKey: ['recipes'] });
      // A new recipe is empty — jump straight into building it.
      void navigate(`/eat/recipes/${id}`);
    },
  });

  const total = recipesQuery.data?.length ?? 0;
  const recipes = useMemo(() => {
    const all = recipesQuery.data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    // Matches the recipe's name or any of its ingredients.
    return all.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.ingredients.some((i) => i.foodName.toLowerCase().includes(q)),
    );
  }, [recipesQuery.data, query]);

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      {/* The Eat pill bar right above already says "Recipes", so the title
          is for screen readers only and the tab switch is the header. */}
      <h1 className="sr-only">Recipes</h1>

      <div className="flex items-center justify-between gap-2">
        <Segmented
          label="Which recipes"
          options={VIEWS}
          value={view}
          onChange={setView}
          className="min-w-0 flex-1 sm:max-w-72"
        />
        {/* The screen's one primary action. Creating only applies to your
            own recipes, so it leaves with that tab. */}
        {view === 'mine' && (
          <Button
            className="shrink-0"
            onClick={() => {
              createMutation.reset(); // forget an earlier failure
              setCreating(true);
            }}
          >
            <Plus size={16} aria-hidden />
            New recipe
          </Button>
        )}
      </div>

      {view === 'community' && <CommunitySection />}

      {view === 'mine' && (
        <>
          {/* Not worth a search box for a handful of recipes. */}
          {total > 3 && (
            <div className="flex">
              <SearchField
                label="Search recipes or ingredients"
                value={query}
                onChange={setQuery}
              />
            </div>
          )}

          {recipesQuery.isError && (
            <p className="text-sm text-rose-500">Couldn't load your recipes.</p>
          )}
          {recipesQuery.isSuccess && total === 0 && (
            <EmptyState Icon={ChefHat}>
              No recipes yet. Group foods you eat together (a sandwich, a smoothie) with{' '}
              <span className="font-semibold text-ink">New recipe</span>, then log or plan them as
              one.
            </EmptyState>
          )}
          {total > 0 && recipes.length === 0 && (
            <p className="text-sm text-muted">Nothing matches “{query.trim()}”.</p>
          )}
          <ul className={GRID}>
            {recipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </ul>
        </>
      )}

      {creating && (
        <NewRecipeSheet
          pending={createMutation.isPending}
          failed={createMutation.isError}
          onCreate={(name, servings) => createMutation.mutate({ name, servings })}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  );
}
