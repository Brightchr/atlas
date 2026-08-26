import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft, Plus, Search, Sparkles, X } from 'lucide-react';
import type { MealType } from '@arcadia/shared';
import { buildWeekFromCatalogSelections } from '../mealPlan';
import {
  catalogPerServing,
  catalogRecipe,
  RECIPE_CATALOG,
  type CatalogRecipe,
} from '../recipeCatalog';
import { mealAffinity, parseRecipeTags, RECIPE_TAGS, type RecipeTag } from '../recipeTags';
import { RecipeBanner, RecipeThumb } from '../components/RecipeArt';

const SHELVES: [MealType, string][] = [
  ['breakfast', 'Breakfasts'],
  ['lunch', 'Lunches'],
  ['dinner', 'Dinners'],
  ['snack', 'Snacks'],
];

/** One pickable recipe. The whole card toggles selection. */
function BuilderCard({
  entry,
  picked,
  onToggle,
  shelf = false,
}: {
  entry: CatalogRecipe;
  picked: boolean;
  onToggle: () => void;
  shelf?: boolean;
}) {
  const per = catalogPerServing(entry);
  return (
    <button
      type="button"
      aria-pressed={picked}
      onClick={onToggle}
      className={`springy relative flex h-full flex-col rounded-2xl border bg-surface p-4 text-left shadow-sm hover:-translate-y-0.5 hover:shadow-md ${
        picked ? 'border-accent/70 ring-1 ring-accent/30' : 'border-line'
      } ${shelf ? 'w-56 shrink-0 snap-start' : 'w-full'}`}
    >
      <RecipeBanner name={entry.name} height="h-20" />
      <span
        aria-hidden
        className={`absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full shadow-sm ${
          picked ? 'bg-accent text-accent-ink' : 'bg-surface/90 text-ink backdrop-blur'
        }`}
      >
        {picked ? <Check size={14} /> : <Plus size={14} />}
      </span>
      <p className="line-clamp-2 text-sm font-semibold">{entry.name}</p>
      <div className="mt-1 mb-2 flex flex-wrap gap-1">
        {parseRecipeTags(entry.description)
          .slice(0, 2)
          .map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent"
            >
              {tag}
            </span>
          ))}
      </div>
      <p className="mt-auto text-xs text-muted tabular-nums">
        {per.kcal} kcal · {per.proteinG} g protein / serving
      </p>
    </button>
  );
}

/** Build a week by hand: browse the catalog photo-card style, pick what you
 * actually want to eat, and the picks are spread across the meals they fit. */
export function PlanBuilderPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [tag, setTag] = useState<RecipeTag | 'all'>('all');
  const [picked, setPicked] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);

  const buildMutation = useMutation({
    mutationFn: () =>
      buildWeekFromCatalogSelections(
        picked.map((name) => catalogRecipe(name)).filter((e): e is CatalogRecipe => Boolean(e)),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['mealPlan'] });
      void queryClient.invalidateQueries({ queryKey: ['recipes'] });
      void queryClient.invalidateQueries({ queryKey: ['foods'] });
      void navigate('/eat/meal-plan');
    },
  });

  const pool = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = RECIPE_CATALOG;
    if (tag !== 'all') list = list.filter((r) => r.description.includes(tag));
    if (query) list = list.filter((r) => r.name.toLowerCase().includes(query));
    return list;
  }, [q, tag]);

  const searching = q.trim().length > 0;
  const toggle = (name: string) =>
    setPicked((p) => (p.includes(name) ? p.filter((n) => n !== name) : [...p, name]));

  const affectedMeals = [...new Set(picked.map((n) => mealAffinity(n)))];
  const untouchedMeals = SHELVES.map(([meal]) => meal).filter((m) => !affectedMeals.includes(m));

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void navigate('/eat/meal-plan')}
          aria-label="Back to meal plan"
          className="rounded-xl border border-line bg-surface p-2 shadow-sm transition-colors hover:bg-elev"
        >
          <ChevronLeft size={16} aria-hidden />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Build a meal plan</h1>
          <p className="text-sm text-muted">
            Pick meals you actually want to eat — they'll repeat across your week, each in the meal
            it fits.
          </p>
        </div>
      </header>

      <div className="relative">
        <Search
          size={15}
          className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted"
          aria-hidden
        />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search 100+ recipes…"
          aria-label="Search recipes"
          className="w-full rounded-2xl border border-line bg-surface py-2.5 pr-3 pl-10 text-sm shadow-sm outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </div>

      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        {(['all', ...RECIPE_TAGS] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={tag === value}
            onClick={() => setTag(value)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              tag === value
                ? 'bg-accent text-accent-ink shadow-sm'
                : 'border border-line bg-surface text-muted shadow-sm hover:bg-elev hover:text-ink'
            }`}
          >
            {value === 'all' ? 'All' : value}
          </button>
        ))}
      </div>

      {pool.length === 0 && (
        <p className="text-sm text-muted">Nothing matches — try a different search or tag.</p>
      )}

      {searching ? (
        <ul className="grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pool.map((entry) => (
            <li key={entry.name}>
              <BuilderCard
                entry={entry}
                picked={picked.includes(entry.name)}
                onToggle={() => toggle(entry.name)}
              />
            </li>
          ))}
        </ul>
      ) : (
        SHELVES.map(([meal, title]) => {
          const shelf = pool.filter((r) => mealAffinity(r.name) === meal);
          if (shelf.length === 0) return null;
          return (
            <section key={meal}>
              <div className="mb-2 flex items-baseline gap-2">
                <h2 className="text-sm font-semibold">{title}</h2>
                <span className="text-xs text-muted">{shelf.length}</span>
              </div>
              <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
                {shelf.map((entry) => (
                  <BuilderCard
                    key={entry.name}
                    entry={entry}
                    picked={picked.includes(entry.name)}
                    onToggle={() => toggle(entry.name)}
                    shelf
                  />
                ))}
              </div>
            </section>
          );
        })
      )}

      {picked.length > 0 && (
        <div className="sticky bottom-24 z-10 md:bottom-4">
          <div className="space-y-2 rounded-2xl border border-line bg-surface/90 p-3 shadow-lg backdrop-blur-xl">
            {confirming && (
              <p className="text-xs text-muted">
                This replaces every{' '}
                <span className="font-semibold text-ink">{affectedMeals.join(', ')}</span> in your
                week
                {untouchedMeals.length > 0 && (
                  <> — {untouchedMeals.join(', ')} stay{untouchedMeals.length === 1 ? 's' : ''} as
                  planned</>
                )}
                .
              </p>
            )}
            <div className="flex items-center gap-2">
              <span className="flex -space-x-2">
                {picked.slice(0, 4).map((name) => (
                  <RecipeThumb
                    key={name}
                    name={name}
                    className="h-9 w-9 rounded-full border-2 border-surface text-base"
                  />
                ))}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {picked.length} meal{picked.length === 1 ? '' : 's'} picked
              </span>
              <button
                type="button"
                onClick={() => {
                  setPicked([]);
                  setConfirming(false);
                }}
                aria-label="Clear picks"
                className="rounded-xl p-2 text-muted transition-colors hover:bg-elev hover:text-ink"
              >
                <X size={15} aria-hidden />
              </button>
              {confirming ? (
                <button
                  type="button"
                  disabled={buildMutation.isPending}
                  onClick={() => buildMutation.mutate()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-linear-to-r from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  <Sparkles size={15} aria-hidden />
                  {buildMutation.isPending ? 'Building…' : 'Confirm'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-linear-to-r from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-accent-ink shadow-sm hover:opacity-90"
                >
                  <Sparkles size={15} aria-hidden />
                  Build my week
                </button>
              )}
            </div>
            {buildMutation.isError && (
              <p className="text-xs text-rose-500">Could not build the plan — try again.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
