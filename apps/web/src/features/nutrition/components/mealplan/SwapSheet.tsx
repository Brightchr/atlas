import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { MealPlanItem } from '@arcadia/shared';
import { Sheet } from '@/components/ui';
import { catalogKcalPerServing, RECIPE_CATALOG, type CatalogRecipe } from '../../recipeCatalog';
import { mealAffinity } from '../../recipeTags';
import { RecipeThumb } from '../RecipeArt';

/** "Show me something else here": alternatives for one planned slot. With no
 * search, suggests catalog recipes that fit the same meal, closest in
 * calories first; typing searches the whole catalog.
 *
 * Opens as a sheet so the week underneath stays put — as an inline expander
 * it pushed every later meal down the page. */
export function SwapSheet({
  item,
  currentKcal,
  pending,
  failed,
  onPick,
  onClose,
}: {
  item: MealPlanItem;
  currentKcal: number | null;
  pending: boolean;
  failed: boolean;
  onPick: (entry: CatalogRecipe) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const servings = item.servings ?? 1;

  const options = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = RECIPE_CATALOG.filter((r) => r.name.toLowerCase() !== item.name.toLowerCase());
    list = query
      ? list.filter((r) => r.name.toLowerCase().includes(query))
      : list.filter((r) => mealAffinity(r.name) === item.meal);
    if (currentKcal !== null) {
      list = [...list].sort(
        (a, b) =>
          Math.abs(catalogKcalPerServing(a) * servings - currentKcal) -
          Math.abs(catalogKcalPerServing(b) * servings - currentKcal),
      );
    }
    return list.slice(0, 6);
  }, [q, item, servings, currentKcal]);

  return (
    <Sheet title="Swap meal" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-muted">
          Replacing <span className="font-semibold text-ink">{item.name}</span>
          {currentKcal !== null && ` (${Math.round(currentKcal)} kcal)`}. The day, meal and servings
          stay the same.
        </p>
        <div className="relative">
          <Search
            size={18}
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search all recipes, or pick a ${item.meal} below`}
            aria-label="Search swap options"
            className="h-11 w-full rounded-xl border border-line bg-bg pr-3 pl-11 text-base outline-none placeholder:text-muted/70 focus:border-accent"
          />
        </div>
        {failed && <p className="text-sm text-rose-500">Couldn't swap that meal. Try again.</p>}
        {options.length === 0 && (
          <p className="text-sm text-muted">
            {q.trim() ? `Nothing matches “${q.trim()}”.` : 'No suggestions. Try searching.'}
          </p>
        )}
        <ul className="space-y-1.5">
          {options.map((entry) => {
            const kcal = catalogKcalPerServing(entry) * servings;
            const delta = currentKcal === null ? null : Math.round(kcal - currentKcal);
            return (
              <li key={entry.name}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onPick(entry)}
                  className="springy flex min-h-14 w-full items-center gap-3 rounded-xl border border-line bg-bg px-3 py-2 text-left hover:bg-elev disabled:opacity-50"
                >
                  <RecipeThumb name={entry.name} className="h-10 w-10 rounded-lg text-lg" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {entry.name}
                  </span>
                  <span className="shrink-0 text-right text-sm text-muted tabular-nums">
                    {Math.round(kcal)} kcal
                    {/* Difference to what is planned now: amber = more
                        calories than today, accent = fewer. */}
                    {delta !== null && delta !== 0 && (
                      <span
                        className={`block text-xs ${delta > 0 ? 'text-amber-500' : 'text-accent'}`}
                      >
                        {delta > 0 ? '+' : ''}
                        {delta}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Sheet>
  );
}
