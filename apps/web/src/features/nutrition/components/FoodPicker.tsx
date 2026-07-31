import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import type { Food } from '@arcadia/shared';
import { rankFoodsByRelevance } from '@/lib/foodRank';
import { searchOpenFoodFacts } from '@/lib/off/client';
import { importFood, searchLocalFoods } from '../repository';

interface FoodPickerProps {
  /** Called with the (locally imported) food once the user confirms grams. */
  onPick: (food: Food, grams: number) => void;
  pending?: boolean;
}

/** Compact food search used by recipes and the meal plan: searches saved foods
 * and Open Food Facts, then asks for a gram amount. Picking an OFF result
 * imports it into the local foods table first (same flow as the diary). */
export function FoodPicker({ onPick, pending }: FoodPickerProps) {
  const [term, setTerm] = useState('');
  const [selected, setSelected] = useState<Food | null>(null);
  const [grams, setGrams] = useState('100');
  const searching = term.trim().length >= 2;

  const localResults = useQuery({
    queryKey: ['foods', 'local', term],
    queryFn: () => searchLocalFoods(term),
    enabled: searching,
  });
  const offResults = useQuery({
    queryKey: ['foods', 'off', term, 1],
    queryFn: () => searchOpenFoodFacts(term),
    enabled: searching,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
  const importMutation = useMutation({
    mutationFn: importFood,
    onSuccess: (food) => setSelected(food),
  });

  if (selected) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{selected.name}</span>
        <input
          type="number"
          min="1"
          value={grams}
          onChange={(e) => setGrams(e.target.value)}
          aria-label="Grams"
          className="w-20 rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <span className="text-xs text-muted">g</span>
        <button
          type="button"
          disabled={!Number(grams) || pending}
          onClick={() => {
            onPick(selected, Number(grams));
            setSelected(null);
            setTerm('');
            setGrams('100');
          }}
          className="rounded-xl bg-linear-to-r from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Add
        </button>
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="rounded-xl px-2 py-2 text-sm text-muted transition-colors hover:text-ink"
        >
          Cancel
        </button>
      </div>
    );
  }

  const localFoods = rankFoodsByRelevance(localResults.data ?? [], term);
  const localBarcodes = new Set(localFoods.map((f) => f.barcode).filter(Boolean));
  const offFoods = rankFoodsByRelevance(
    (offResults.data?.foods ?? []).filter((s) => !localBarcodes.has(s.barcode)),
    term,
  );

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search
          size={15}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
          aria-hidden
        />
        <input
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search foods to add…"
          className="w-full rounded-xl border border-line bg-surface py-2 pr-3 pl-9 text-sm outline-none placeholder:text-muted/70 focus:border-accent"
        />
      </div>
      {searching && (
        <ul className="max-h-56 space-y-1 overflow-y-auto">
          {(localResults.isLoading || offResults.isLoading) && (
            <li className="px-1 py-0.5 text-xs text-muted">Searching…</li>
          )}
          {localFoods.map((food) => (
            <li key={food.id}>
              <button
                type="button"
                onClick={() => setSelected(food)}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-elev"
              >
                <span className="min-w-0 truncate">{food.name}</span>
                <span className="shrink-0 text-xs text-muted tabular-nums">
                  {Math.round(food.per100g.kcal)} kcal/100g
                </span>
              </button>
            </li>
          ))}
          {offFoods.map((snapshot) => (
            <li key={snapshot.barcode}>
              <button
                type="button"
                disabled={importMutation.isPending}
                onClick={() => importMutation.mutate(snapshot)}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-elev disabled:opacity-50"
              >
                <span className="min-w-0 truncate">
                  {snapshot.name}
                  {snapshot.brand && <span className="text-muted"> · {snapshot.brand}</span>}
                </span>
                <span className="shrink-0 text-xs text-muted tabular-nums">
                  {Math.round(snapshot.per100g.kcal)} kcal/100g
                </span>
              </button>
            </li>
          ))}
          {!localResults.isLoading &&
            !offResults.isLoading &&
            localFoods.length === 0 &&
            offFoods.length === 0 && <li className="px-1 text-xs text-muted">No foods found.</li>}
        </ul>
      )}
    </div>
  );
}
