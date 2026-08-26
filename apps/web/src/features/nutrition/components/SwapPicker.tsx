import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { MealPlanItem } from '@arcadia/shared';
import { catalogKcalPerServing, RECIPE_CATALOG, type CatalogRecipe } from '../recipeCatalog';
import { mealAffinity } from '../recipeTags';
import { RecipeThumb } from './RecipeArt';

/** "Show me something else here": alternatives for one planned slot. With no
 * search, suggests catalog recipes that fit the same meal, closest in
 * calories first; typing searches the whole catalog. */
export function SwapPicker({
  item,
  currentKcal,
  pending,
  onPick,
  onClose,
}: {
  item: MealPlanItem;
  currentKcal: number | null;
  pending: boolean;
  onPick: (entry: CatalogRecipe) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');

  const options = useMemo(() => {
    const query = q.trim().toLowerCase();
    const servings = item.servings ?? 1;
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
  }, [q, item, currentKcal]);

  return (
    <div className="mt-2 space-y-2 rounded-xl bg-elev p-2.5">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-xs font-semibold">
          Swap <span className="text-muted">{item.name}</span> for…
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close swap"
          className="rounded p-1 text-muted transition-colors hover:text-ink"
        >
          <X size={13} aria-hidden />
        </button>
      </div>
      <div className="relative">
        <Search
          size={13}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
          aria-hidden
        />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search all recipes — or pick a ${item.meal} below`}
          aria-label="Search swap options"
          className="w-full rounded-xl border border-line bg-surface py-2 pr-3 pl-8 text-sm outline-none placeholder:text-muted/70 focus:border-accent"
        />
      </div>
      {options.length === 0 && (
        <p className="px-1 text-xs text-muted">Nothing matches “{q.trim()}”.</p>
      )}
      <ul className="space-y-1">
        {options.map((entry) => {
          const kcal = catalogKcalPerServing(entry) * (item.servings ?? 1);
          const delta = currentKcal === null ? null : Math.round(kcal - currentKcal);
          return (
            <li key={entry.name}>
              <button
                type="button"
                disabled={pending}
                onClick={() => onPick(entry)}
                className="springy flex w-full items-center gap-2.5 rounded-xl border border-line bg-surface px-2.5 py-2 text-left text-sm shadow-sm hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50"
              >
                <RecipeThumb name={entry.name} className="h-9 w-9 rounded-lg text-base" />
                <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                <span className="shrink-0 text-xs text-muted tabular-nums">
                  {Math.round(kcal)} kcal
                  {delta !== null && delta !== 0 && (
                    <span className={delta > 0 ? 'text-amber-500' : 'text-accent'}>
                      {' '}
                      ({delta > 0 ? '+' : ''}
                      {delta})
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
