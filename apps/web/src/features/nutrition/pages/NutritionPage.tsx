import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Beef,
  ChevronDown,
  Copy,
  Droplet,
  Flame,
  Search,
  Trash2,
  UtensilsCrossed,
  Wheat,
} from 'lucide-react';
import type { Food, Macros, MealType } from '@arcadia/shared';
import { searchOpenFoodFacts, type FoodSnapshot } from '@/lib/off/client';
import {
  deleteDiaryEntry,
  duplicateDiaryEntry,
  getDiaryForDate,
  importFood,
  logFood,
  searchLocalFoods,
} from '../repository';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const MEALS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

const tiles = [
  { key: 'kcal', label: 'Calories', unit: '', Icon: Flame, tint: 'bg-orange-500/15 text-orange-500' },
  { key: 'proteinG', label: 'Protein', unit: 'g', Icon: Beef, tint: 'bg-rose-500/15 text-rose-500' },
  { key: 'carbsG', label: 'Carbs', unit: 'g', Icon: Wheat, tint: 'bg-amber-500/15 text-amber-500' },
  { key: 'fatG', label: 'Fat', unit: 'g', Icon: Droplet, tint: 'bg-sky-500/15 text-sky-500' },
] as const;

/** Full nutrient breakdown grid. `grams` scales from per-100g when given;
 * `caption` overrides the heading (for already-scaled values). */
function StatsGrid({
  per100g,
  grams,
  caption,
}: {
  per100g: Macros;
  grams?: number;
  caption?: string;
}) {
  const f = grams === undefined ? 1 : grams / 100;
  const fmt = (v: number | undefined, unit: string, digits = 1) =>
    v === undefined ? '—' : `${(v * f).toFixed(digits)} ${unit}`;
  const rows: [string, string][] = [
    ['Calories', v(per100g.kcal)],
    ['Protein', fmt(per100g.proteinG, 'g')],
    ['Carbs', fmt(per100g.carbsG, 'g')],
    ['· of which sugar', fmt(per100g.sugarG, 'g')],
    ['Fat', fmt(per100g.fatG, 'g')],
    ['· of which saturated', fmt(per100g.saturatedFatG, 'g')],
    ['Fiber', fmt(per100g.fiberG, 'g')],
    ['Sodium', per100g.sodiumG === undefined ? '—' : `${(per100g.sodiumG * f * 1000).toFixed(0)} mg`],
  ];
  function v(kcal: number) {
    return `${Math.round(kcal * f)} kcal`;
  }
  return (
    <div className="rounded-xl bg-elev p-3">
      <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
        Nutrition facts {caption ?? (grams === undefined ? 'per 100 g' : `for ${grams} g`)}
      </p>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-muted">{label}</dt>
            <dd className="font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** One search result (local food or OFF snapshot): tap to expand full stats + log form. */
function FoodResult({
  snapshot,
  sourceTag,
  onLog,
  pending,
}: {
  snapshot: FoodSnapshot | Food;
  sourceTag: string;
  onLog: (grams: number, meal: MealType) => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [grams, setGrams] = useState('100');
  const [meal, setMeal] = useState<MealType>('snack');

  return (
    <li className="rounded-2xl border border-line bg-surface shadow-sm transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-3 text-left"
      >
        {snapshot.imageUrl ? (
          <img src={snapshot.imageUrl} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-xl bg-white object-contain" />
        ) : (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-elev text-muted">
            <UtensilsCrossed size={20} strokeWidth={1.8} aria-hidden />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{snapshot.name}</span>
          <span className="block truncate text-xs text-muted">
            {snapshot.brand ? `${snapshot.brand} · ` : ''}
            {Math.round(snapshot.per100g.kcal)} kcal /100g
            <span className="ml-1 text-accent">{sourceTag}</span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
          Log
          <ChevronDown size={13} aria-hidden className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-line p-3">
          <StatsGrid per100g={snapshot.per100g} />
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min="1"
              max="5000"
              value={grams}
              onChange={(e) => setGrams(e.target.value)}
              className="w-24 rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
              aria-label="Grams"
            />
            <span className="text-sm text-muted">g as</span>
            <select
              value={meal}
              onChange={(e) => setMeal(e.target.value as MealType)}
              className="rounded-xl border border-line bg-surface px-3 py-2 text-sm capitalize outline-none focus:border-accent"
            >
              {MEALS.map((m) => (
                <option key={m} value={m} className="capitalize">
                  {m}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={pending || !Number(grams)}
              onClick={() => onLog(Number(grams), meal)}
              className="rounded-xl bg-linear-to-r from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Log it
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

export function NutritionPage() {
  const date = todayIso();
  const [term, setTerm] = useState('');
  const [openEntry, setOpenEntry] = useState<string | null>(null);
  const searching = term.trim().length >= 2;
  const queryClient = useQueryClient();

  const diaryQuery = useQuery({ queryKey: ['diary', date], queryFn: () => getDiaryForDate(date) });

  const localResults = useQuery({
    queryKey: ['foods', 'local', term],
    queryFn: () => searchLocalFoods(term),
    enabled: searching,
  });
  const offResults = useQuery({
    queryKey: ['foods', 'off', term],
    queryFn: () => searchOpenFoodFacts(term),
    enabled: searching,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['diary'] });
    void queryClient.invalidateQueries({ queryKey: ['goals'] });
  };
  const logMutation = useMutation({
    mutationFn: async (args: { snapshot: FoodSnapshot | Food; grams: number; meal: MealType }) => {
      const food = 'id' in args.snapshot ? args.snapshot : await importFood(args.snapshot);
      await logFood({ date, meal: args.meal, food, grams: args.grams });
    },
    onSuccess: () => {
      setTerm('');
      invalidate();
    },
  });
  const deleteMutation = useMutation({ mutationFn: deleteDiaryEntry, onSuccess: invalidate });
  const duplicateMutation = useMutation({ mutationFn: duplicateDiaryEntry, onSuccess: invalidate });

  const totals = (diaryQuery.data ?? []).reduce(
    (acc, e) => ({
      kcal: acc.kcal + e.macros.kcal,
      proteinG: acc.proteinG + e.macros.proteinG,
      carbsG: acc.carbsG + e.macros.carbsG,
      fatG: acc.fatG + e.macros.fatG,
      sugarG: acc.sugarG + (e.macros.sugarG ?? 0),
      fiberG: acc.fiberG + (e.macros.fiberG ?? 0),
      sodiumG: acc.sodiumG + (e.macros.sodiumG ?? 0),
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, sugarG: 0, fiberG: 0, sodiumG: 0 },
  );

  const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name);
  const localSorted = [...(localResults.data ?? [])].sort(byName);
  const localBarcodes = new Set(localSorted.map((f) => f.barcode).filter(Boolean));
  const offSorted = (offResults.data ?? [])
    .filter((s) => !localBarcodes.has(s.barcode))
    .sort(byName);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-bold">Nutrition</h1>
        <p className="text-sm text-muted">Today’s meals, calories and full nutrition stats.</p>
      </header>

      {/* Prominent, self-explanatory logging entry point */}
      <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <div className="mb-2.5 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Search size={17} strokeWidth={1.8} aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold">Log a food</p>
            <p className="text-xs text-muted">
              Search thousands of products — tap a result for full nutrition facts, then log it to a
              meal.
            </p>
          </div>
        </div>
        <input
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Try “oats”, “nutella”, or any brand…"
          className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 shadow-sm outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </section>

      {searching ? (
        <section className="space-y-2">
          {(localResults.isLoading || offResults.isLoading) && <p className="text-muted">Searching…</p>}
          {offResults.isError && (
            <p className="text-sm text-rose-500">
              Food database unreachable — showing your saved foods only.
            </p>
          )}
          {logMutation.isError && <p className="text-sm text-rose-500">{logMutation.error.message}</p>}
          <ul className="space-y-2">
            {localSorted.map((food) => (
              <FoodResult
                key={food.id}
                snapshot={food}
                sourceTag="saved"
                pending={logMutation.isPending}
                onLog={(grams, meal) => logMutation.mutate({ snapshot: food, grams, meal })}
              />
            ))}
            {offSorted.map((snapshot) => (
              <FoodResult
                key={snapshot.barcode}
                snapshot={snapshot}
                sourceTag="Open Food Facts"
                pending={logMutation.isPending}
                onLog={(grams, meal) => logMutation.mutate({ snapshot, grams, meal })}
              />
            ))}
          </ul>
          {!localResults.isLoading &&
            !offResults.isLoading &&
            localSorted.length === 0 &&
            offSorted.length === 0 && <p className="text-muted">No foods found.</p>}
        </section>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {tiles.map(({ key, label, unit, Icon, tint }) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-2xl border border-line bg-surface p-4 shadow-sm"
              >
                <div>
                  <p className="font-display text-2xl font-bold tracking-tight tabular-nums">
                    {Math.round(totals[key])}
                    {unit && <span className="text-base font-semibold text-muted"> {unit}</span>}
                  </p>
                  <p className="mt-0.5 text-sm text-muted">{label}</p>
                </div>
                <span className={`flex h-11 w-11 items-center justify-center rounded-full ${tint}`}>
                  <Icon size={20} strokeWidth={1.8} aria-hidden />
                </span>
              </div>
            ))}
          </section>

          {totals.kcal > 0 && (
            <p className="text-sm text-muted tabular-nums">
              Also today: {totals.sugarG.toFixed(1)} g sugar · {totals.fiberG.toFixed(1)} g fiber ·{' '}
              {(totals.sodiumG * 1000).toFixed(0)} mg sodium
            </p>
          )}

          {diaryQuery.data?.length === 0 && (
            <p className="text-muted">Nothing logged today — search a food above to start.</p>
          )}

          <ul className="space-y-2">
            {diaryQuery.data?.map((entry) => (
              <li key={entry.id} className="rounded-2xl border border-line bg-surface shadow-sm">
                <button
                  type="button"
                  onClick={() => setOpenEntry(openEntry === entry.id ? null : entry.id)}
                  aria-expanded={openEntry === entry.id}
                  className="flex w-full items-center gap-3 p-3 text-left"
                >
                  {entry.imageUrl ? (
                    <img src={entry.imageUrl} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-xl bg-white object-contain" />
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-elev text-muted">
                      <UtensilsCrossed size={17} strokeWidth={1.8} aria-hidden />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{entry.foodName}</span>
                    <span className="block text-sm text-muted capitalize">
                      {entry.meal} · {entry.grams} g
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">{entry.macros.kcal} kcal</span>
                  <ChevronDown
                    size={15}
                    aria-hidden
                    className={`shrink-0 text-muted transition-transform ${openEntry === entry.id ? 'rotate-180' : ''}`}
                  />
                </button>
                {openEntry === entry.id && (
                  <div className="space-y-3 border-t border-line p-3">
                    <StatsGrid per100g={entry.macros} caption={`for ${entry.grams} g logged`} />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => duplicateMutation.mutate(entry.id)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-medium transition-colors hover:bg-elev"
                      >
                        <Copy size={14} aria-hidden />
                        Log again
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMutation.mutate(entry.id)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-medium text-rose-500 transition-colors hover:bg-rose-500/10"
                      >
                        <Trash2 size={14} aria-hidden />
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="pt-2 text-xs text-muted/70">
        Food data from{' '}
        <a href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer" className="underline">
          Open Food Facts
        </a>{' '}
        (ODbL).
      </p>
    </div>
  );
}
