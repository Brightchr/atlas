import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Beef,
  ChevronDown,
  Cookie,
  Copy,
  Droplet,
  Flame,
  Moon,
  PlusCircle,
  ScanBarcode,
  Search,
  Sun,
  Sunrise,
  Trash2,
  UtensilsCrossed,
  Wheat,
  X,
} from 'lucide-react';
import type { Food, Macros, MealType } from '@arcadia/shared';
import {
  fetchFoodSuggestions,
  fetchServing,
  lookupBarcode,
  searchOpenFoodFacts,
  type FoodSnapshot,
} from '@/lib/off/client';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';
import { rankFoodsByRelevance } from '@/lib/foodRank';
import { Pagination } from '@/components/Pagination';
import { getSavedTargets } from '@/features/goals/repository';
import { plannedKcalByMeal } from '../mealPlan';
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

const MEAL_META: Record<MealType, { Icon: typeof Sunrise; tint: string }> = {
  breakfast: { Icon: Sunrise, tint: 'bg-amber-500/15 text-amber-500' },
  lunch: { Icon: Sun, tint: 'bg-orange-500/15 text-orange-500' },
  dinner: { Icon: Moon, tint: 'bg-indigo-500/15 text-indigo-400' },
  snack: { Icon: Cookie, tint: 'bg-teal-500/15 text-teal-600' },
};

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

/** One search result (local food or OFF snapshot): tap to expand full stats +
 * log form. Facts show food-label style — per serving when the product
 * declares one — and the amount is logged in servings or grams. */
function FoodResult({
  snapshot,
  sourceTag,
  onLog,
  pending,
  defaultMeal,
}: {
  snapshot: FoodSnapshot | Food;
  sourceTag: string;
  onLog: (grams: number, meal: MealType, serving?: { name: string | null; grams: number }) => void;
  pending: boolean;
  /** Pre-targeted meal (set by a meal section's Add button). */
  defaultMeal?: MealType;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<string | null>(null);
  const [unit, setUnit] = useState<'serving' | 'g' | null>(null);
  const [mealChoice, setMealChoice] = useState<MealType | null>(null);
  const meal = mealChoice ?? defaultMeal ?? 'snack';

  // OFF's search index has no serving data — fetch it once the card expands.
  // (USDA rows already carry theirs; their codes mean nothing to OFF.)
  const servingQuery = useQuery({
    queryKey: ['foods', 'serving', snapshot.barcode],
    queryFn: () => fetchServing(snapshot.barcode!),
    enabled:
      open &&
      snapshot.servingGrams === null &&
      snapshot.barcode !== null &&
      snapshot.source === 'off',
    staleTime: Infinity,
    retry: 1,
  });
  const servingGrams = snapshot.servingGrams ?? servingQuery.data?.grams ?? null;
  const servingName = snapshot.servingName ?? servingQuery.data?.name ?? null;

  // Defaults follow the data: 1 serving when the product declares one, 100 g
  // otherwise — but never override something the user already typed.
  const effectiveUnit = unit ?? (servingGrams ? 'serving' : 'g');
  const effectiveAmount = amount ?? (servingGrams ? '1' : '100');
  const gramsToLog =
    effectiveUnit === 'serving' && servingGrams
      ? Number(effectiveAmount) * servingGrams
      : Number(effectiveAmount);

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
            {snapshot.servingGrams
              ? `${Math.round((snapshot.per100g.kcal * snapshot.servingGrams) / 100)} kcal / ${snapshot.servingName ?? 'serving'}`
              : `${Math.round(snapshot.per100g.kcal)} kcal /100g`}
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
          {servingGrams ? (
            <StatsGrid
              per100g={snapshot.per100g}
              grams={servingGrams}
              caption={`per serving${servingName ? ` — ${servingName}` : ` (${servingGrams} g)`}`}
            />
          ) : (
            <StatsGrid per100g={snapshot.per100g} />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min="0.25"
              step={effectiveUnit === 'serving' ? 0.25 : 1}
              max="5000"
              value={effectiveAmount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-20 rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
              aria-label="Amount"
            />
            <select
              value={effectiveUnit}
              onChange={(e) => setUnit(e.target.value as 'serving' | 'g')}
              aria-label="Unit"
              className="rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            >
              {servingGrams && (
                <option value="serving">serving{Number(effectiveAmount) === 1 ? '' : 's'} ({servingGrams} g)</option>
              )}
              <option value="g">g</option>
            </select>
            <span className="text-sm text-muted">as</span>
            <select
              value={meal}
              onChange={(e) => setMealChoice(e.target.value as MealType)}
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
              disabled={pending || !Number.isFinite(gramsToLog) || gramsToLog <= 0}
              onClick={() =>
                onLog(
                  Math.round(gramsToLog * 10) / 10,
                  meal,
                  servingGrams ? { name: servingName, grams: servingGrams } : undefined,
                )
              }
              className="rounded-xl bg-linear-to-r from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Log it
            </button>
          </div>
          {effectiveUnit === 'serving' && servingGrams && Number(effectiveAmount) > 0 && (
            <p className="text-xs text-muted tabular-nums">
              = {Math.round(gramsToLog)} g · {Math.round((snapshot.per100g.kcal * gramsToLog) / 100)}{' '}
              kcal
            </p>
          )}
        </div>
      )}
    </li>
  );
}

/** Create a food straight from its label: per-serving numbers plus the
 * serving size, stored per-100g so it scales anywhere. The created food is
 * saved to your library, shows up in every future search, and logs by
 * servings ("2 servings of peanut butter") like any other food. */
function CreateFoodCard({ onCreated }: { onCreated: (food: Food) => void }) {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [servingGrams, setServingGrams] = useState('');
  const [servingName, setServingName] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [sugar, setSugar] = useState('');
  const [fiber, setFiber] = useState('');
  const [sodiumMg, setSodiumMg] = useState('');

  const grams = Number(servingGrams);
  const valid = name.trim().length > 0 && grams > 0 && Number(kcal) >= 0 && kcal !== '';

  const create = useMutation({
    mutationFn: async () => {
      // Label numbers are per serving; storage is per 100 g.
      const per100 = (v: string) =>
        v === '' ? undefined : Math.round((Number(v) / grams) * 100 * 100) / 100;
      return importFood({
        name: name.trim(),
        brand: brand.trim() || null,
        barcode: null,
        source: 'user',
        per100g: {
          kcal: Math.round((Number(kcal) / grams) * 100),
          proteinG: per100(protein) ?? 0,
          carbsG: per100(carbs) ?? 0,
          fatG: per100(fat) ?? 0,
          sugarG: per100(sugar),
          fiberG: per100(fiber),
          sodiumG: sodiumMg === '' ? undefined : per100(String(Number(sodiumMg) / 1000)),
        },
        imageUrl: null,
        servingName: servingName.trim() || `1 serving (${grams} g)`,
        servingGrams: grams,
      });
    },
    onSuccess: (food) => onCreated(food),
  });

  const field =
    'w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none placeholder:text-muted/70 focus:border-accent';
  const label = 'block text-xs font-medium text-muted';

  return (
    <div className="space-y-3">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <label className={label}>
          Name *
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Crunchy peanut butter" className={field} />
        </label>
        <label className={label}>
          Brand
          <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="optional" className={field} />
        </label>
        <label className={label}>
          Serving size (g) * — from the label
          <input type="number" min="1" value={servingGrams} onChange={(e) => setServingGrams(e.target.value)} placeholder="e.g. 32" className={field} />
        </label>
        <label className={label}>
          Serving name
          <input value={servingName} onChange={(e) => setServingName(e.target.value)} placeholder="e.g. 2 tbsp" className={field} />
        </label>
      </div>
      <p className="text-xs font-semibold text-muted">Per serving, straight off the label:</p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <label className={label}>
          Calories *
          <input type="number" min="0" value={kcal} onChange={(e) => setKcal(e.target.value)} className={field} />
        </label>
        <label className={label}>
          Protein (g)
          <input type="number" min="0" step="0.1" value={protein} onChange={(e) => setProtein(e.target.value)} className={field} />
        </label>
        <label className={label}>
          Carbs (g)
          <input type="number" min="0" step="0.1" value={carbs} onChange={(e) => setCarbs(e.target.value)} className={field} />
        </label>
        <label className={label}>
          Fat (g)
          <input type="number" min="0" step="0.1" value={fat} onChange={(e) => setFat(e.target.value)} className={field} />
        </label>
        <label className={label}>
          Sugar (g)
          <input type="number" min="0" step="0.1" value={sugar} onChange={(e) => setSugar(e.target.value)} placeholder="optional" className={field} />
        </label>
        <label className={label}>
          Fiber (g)
          <input type="number" min="0" step="0.1" value={fiber} onChange={(e) => setFiber(e.target.value)} placeholder="optional" className={field} />
        </label>
        <label className={label}>
          Sodium (mg)
          <input type="number" min="0" value={sodiumMg} onChange={(e) => setSodiumMg(e.target.value)} placeholder="optional" className={field} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!valid || create.isPending}
          onClick={() => create.mutate()}
          className="springy rounded-xl bg-linear-to-r from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-accent-ink shadow-sm hover:opacity-90 disabled:opacity-50"
        >
          Create food
        </button>
        {create.isError && <span className="text-xs text-rose-500">{create.error.message}</span>}
        <span className="text-xs text-muted">
          Blending ingredients into one thing, like a smoothie?{' '}
          <Link to="/eat/recipes" className="text-accent hover:underline">
            Build it as a recipe
          </Link>{' '}
          — it totals the stats for you.
        </span>
      </div>
    </div>
  );
}

export function NutritionPage() {
  const date = todayIso();
  const [term, setTerm] = useState('');
  const [foodPage, setFoodPage] = useState(1);
  const [openEntry, setOpenEntry] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createdFood, setCreatedFood] = useState<Food | null>(null);
  // A meal section's Add button pre-targets that meal for the next log.
  const [mealTarget, setMealTarget] = useState<MealType | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Barcode scanning: modal → lookup (FatSecret, then OFF) → one result card.
  const [scanning, setScanning] = useState(false);
  const [scannedFood, setScannedFood] = useState<FoodSnapshot | null>(null);
  const barcodeMutation = useMutation({
    mutationFn: lookupBarcode,
    onSuccess: (snapshot) => setScannedFood(snapshot),
  });

  // Autocomplete: debounced so a typing burst costs one request, not ten.
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedTerm(term.trim()), 250);
    return () => clearTimeout(t);
  }, [term]);
  const suggestionsQuery = useQuery({
    queryKey: ['foods', 'suggest', debouncedTerm],
    queryFn: () => fetchFoodSuggestions(debouncedTerm),
    enabled: debouncedTerm.length >= 2,
    staleTime: 10 * 60 * 1000,
  });
  const suggestions = (suggestionsQuery.data ?? []).filter(
    (s) => s.toLowerCase() !== term.trim().toLowerCase(),
  );
  const addToMeal = (meal: MealType) => {
    setMealTarget(meal);
    searchRef.current?.focus();
    searchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const todayDow = (new Date().getDay() + 6) % 7;
  const searching = term.trim().length >= 2;
  const queryClient = useQueryClient();

  const diaryQuery = useQuery({ queryKey: ['diary', date], queryFn: () => getDiaryForDate(date) });
  const targetsQuery = useQuery({ queryKey: ['targets'], queryFn: getSavedTargets });
  // What today's meal plan expects per meal — the yardstick that makes an
  // extra snack or an oversized dinner visible at a glance.
  const plannedQuery = useQuery({
    queryKey: ['meal-plan', 'planned-kcal', todayDow],
    queryFn: () => plannedKcalByMeal(todayDow),
  });

  const localResults = useQuery({
    queryKey: ['foods', 'local', term],
    queryFn: () => searchLocalFoods(term),
    enabled: searching,
  });
  const offResults = useQuery({
    queryKey: ['foods', 'off', term, foodPage],
    queryFn: () => searchOpenFoodFacts(term, foodPage),
    enabled: searching,
    staleTime: 10 * 60 * 1000,
    retry: 1,
    placeholderData: keepPreviousData,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['diary'] });
    void queryClient.invalidateQueries({ queryKey: ['goals'] });
  };
  const logMutation = useMutation({
    mutationFn: async (args: {
      snapshot: FoodSnapshot | Food;
      grams: number;
      meal: MealType;
      serving?: { name: string | null; grams: number };
    }) => {
      let food: Food;
      if ('id' in args.snapshot) {
        food = args.snapshot;
      } else {
        // Serving details fetched in the result card ride along into the
        // import so the saved food remembers them.
        const enriched = args.serving
          ? { ...args.snapshot, servingName: args.serving.name, servingGrams: args.serving.grams }
          : args.snapshot;
        food = await importFood(enriched);
      }
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

  // Rank by name relevance to the query; ties keep Open Food Facts' own
  // relevance order (alphabetical sorting buried the obvious match).
  const localSorted = rankFoodsByRelevance(localResults.data ?? [], term);
  const localBarcodes = new Set(localSorted.map((f) => f.barcode).filter(Boolean));
  const offSorted = rankFoodsByRelevance(
    (offResults.data?.foods ?? []).filter((s) => !localBarcodes.has(s.barcode)),
    term,
  );

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-bold">Nutrition</h1>
        <p className="text-sm text-muted">Today’s meals, calories and full nutrition stats.</p>
      </header>


      {/* Prominent, self-explanatory logging entry point — search-first, like Explore. */}
      <div>
        <div className="flex gap-2">
          <div className="relative grow">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              ref={searchRef}
              type="search"
              value={term}
              onChange={(e) => {
                setTerm(e.target.value);
                setFoodPage(1);
              }}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder={
                mealTarget
                  ? `Add to ${mealTarget} — search foods…`
                  : 'Log a food — try “oats”, “nutella”, or any brand…'
              }
              aria-label="Search foods to log"
              className="w-full rounded-2xl border border-line bg-surface py-3 pr-10 pl-11 text-sm shadow-sm outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
            {searching && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setTerm('')}
                className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1 text-muted hover:bg-elev hover:text-ink"
              >
                <X size={15} aria-hidden />
              </button>
            )}
            {/* Suggestions — pointerdown beats the input's blur, so a tap
                always lands before the dropdown unmounts. */}
            {searchFocused && searching && suggestions.length > 0 && (
              <ul className="absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-2xl border border-line bg-surface py-1 shadow-xl shadow-black/10">
                {suggestions.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        setTerm(s);
                        setFoodPage(1);
                      }}
                      className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm transition-colors hover:bg-elev"
                    >
                      <Search size={13} className="shrink-0 text-muted" aria-hidden />
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setScannedFood(null);
              barcodeMutation.reset();
              setScanning(true);
            }}
            title="Scan a barcode"
            aria-label="Scan a barcode"
            className="flex w-12 shrink-0 items-center justify-center rounded-2xl border border-line bg-surface text-muted shadow-sm transition-colors hover:bg-elev hover:text-ink"
          >
            <ScanBarcode size={19} strokeWidth={1.8} aria-hidden />
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2.5">
          {mealTarget && (
            <button
              type="button"
              onClick={() => setMealTarget(null)}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent capitalize"
            >
              Logging to {mealTarget} — tap to clear ✕
            </button>
          )}
          <button
            type="button"
            aria-expanded={creating}
            onClick={() => setCreating(!creating)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
          >
            <PlusCircle size={13} aria-hidden />
            Can't find it? Create a food from its label
          </button>
        </div>
        {creating && (
          <section className="mt-3 rounded-2xl border border-accent/40 bg-surface p-4 shadow-sm">
            <CreateFoodCard
              onCreated={(food) => {
                setCreating(false);
                setCreatedFood(food);
                void queryClient.invalidateQueries({ queryKey: ['foods', 'local'] });
              }}
            />
          </section>
        )}
      </div>

      {scanning && (
        <BarcodeScannerModal
          onClose={() => setScanning(false)}
          onDetected={(code) => {
            setScanning(false);
            barcodeMutation.mutate(code);
          }}
        />
      )}

      {barcodeMutation.isPending && <p className="text-sm text-muted">Looking up barcode…</p>}
      {barcodeMutation.isSuccess && scannedFood === null && (
        <p className="text-sm text-muted">
          No product found for that barcode — try searching by name instead.
        </p>
      )}
      {barcodeMutation.isError && (
        <p className="text-sm text-rose-500">Barcode lookup failed — check your connection.</p>
      )}
      {scannedFood && (
        <section className="space-y-1.5">
          <p className="text-xs font-semibold text-accent">Scanned — log it:</p>
          <ul>
            <FoodResult
              snapshot={scannedFood}
              sourceTag={scannedFood.source === 'fatsecret' ? 'fatsecret' : 'Open Food Facts'}
              defaultMeal={mealTarget ?? undefined}
              pending={logMutation.isPending}
              onLog={(grams, meal, serving) => {
                logMutation.mutate({ snapshot: scannedFood, grams, meal, serving });
                setScannedFood(null);
              }}
            />
          </ul>
        </section>
      )}

      {createdFood && (
        <section className="space-y-1.5">
          <p className="text-xs font-semibold text-accent">
            “{createdFood.name}” saved to your foods — log it now, or find it in any future search:
          </p>
          <ul>
            <FoodResult
              snapshot={createdFood}
              sourceTag="your food"
              defaultMeal={mealTarget ?? undefined}
              pending={logMutation.isPending}
              onLog={(grams, meal, serving) => {
                logMutation.mutate({ snapshot: createdFood, grams, meal, serving });
                setCreatedFood(null);
              }}
            />
          </ul>
        </section>
      )}

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
                defaultMeal={mealTarget ?? undefined}
                pending={logMutation.isPending}
                onLog={(grams, meal, serving) =>
                  logMutation.mutate({ snapshot: food, grams, meal, serving })
                }
              />
            ))}
            {offSorted.map((snapshot) => (
              <FoodResult
                key={snapshot.barcode}
                snapshot={snapshot}
                sourceTag={
                  snapshot.source === 'curated'
                    ? 'Atlas'
                    : snapshot.source === 'fatsecret'
                      ? 'fatsecret'
                      : snapshot.source === 'usda'
                        ? 'USDA'
                        : 'Open Food Facts'
                }
                defaultMeal={mealTarget ?? undefined}
                pending={logMutation.isPending}
                onLog={(grams, meal, serving) =>
                  logMutation.mutate({ snapshot, grams, meal, serving })
                }
              />
            ))}
          </ul>
          {!localResults.isLoading &&
            !offResults.isLoading &&
            localSorted.length === 0 &&
            offSorted.length === 0 && <p className="text-muted">No foods found.</p>}
          {offResults.data && (
            <Pagination
              page={offResults.data.page}
              pageCount={offResults.data.pageCount}
              onChange={setFoodPage}
            />
          )}
        </section>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {tiles.map(({ key, label, unit, Icon, tint }) => {
              const target = targetsQuery.data
                ? { kcal: targetsQuery.data.kcal, proteinG: targetsQuery.data.proteinG, carbsG: targetsQuery.data.carbsG, fatG: targetsQuery.data.fatG }[key]
                : undefined;
              const over = target !== undefined && totals[key] > target;
              return (
                <div key={key} className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-display text-2xl font-bold tracking-tight tabular-nums">
                        {Math.round(totals[key])}
                        {unit && <span className="text-base font-semibold text-muted"> {unit}</span>}
                      </p>
                      <p className="mt-0.5 text-sm text-muted">
                        {label}
                        {target !== undefined && (
                          <span className="tabular-nums"> / {Math.round(target)}{unit}</span>
                        )}
                      </p>
                    </div>
                    <span className={`flex h-11 w-11 items-center justify-center rounded-full ${tint}`}>
                      <Icon size={20} strokeWidth={1.8} aria-hidden />
                    </span>
                  </div>
                  {target !== undefined && (
                    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-elev">
                      <div
                        className={`h-full rounded-full transition-[width] duration-500 ${
                          over ? 'bg-rose-500' : 'bg-linear-to-r from-accent to-accent-2'
                        }`}
                        style={{ width: `${Math.min(100, Math.round((totals[key] / target) * 100))}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </section>

          {totals.kcal > 0 && (
            <p className="text-sm text-muted tabular-nums">
              Also today: {totals.sugarG.toFixed(1)}
              {targetsQuery.data ? ` of ≤${targetsQuery.data.sugarMaxG}` : ''} g sugar ·{' '}
              {totals.fiberG.toFixed(1)}
              {targetsQuery.data ? ` of ${targetsQuery.data.fiberG}` : ''} g fiber ·{' '}
              {(totals.sodiumG * 1000).toFixed(0)}
              {targetsQuery.data ? ' of ≤2300' : ''} mg sodium
            </p>
          )}
          {targetsQuery.data ? (
            <p className="text-xs text-muted">
              Targets come from <span className="font-medium">Your plan</span> on the Goals page —{' '}
              <Link to="/you/goals" className="text-accent hover:underline">
                recalculate or set custom numbers
              </Link>
              .
            </p>
          ) : (
            <p className="text-xs text-muted">
              Tip:{' '}
              <Link to="/you/goals" className="text-accent hover:underline">
                set up “Your plan” on the Goals page
              </Link>{' '}
              to get recommended daily targets here — or enter your own custom numbers there.
            </p>
          )}

          {(() => {
            const entries = diaryQuery.data ?? [];
            const planned = plannedQuery.data ?? {};
            const hasPlanToday = Object.keys(planned).length > 0;
            const mealsEaten = (['breakfast', 'lunch', 'dinner'] as MealType[]).filter((m) =>
              entries.some((e) => e.meal === m),
            ).length;
            const snackCount = entries.filter((e) => e.meal === 'snack').length;
            return (
              <p className="text-sm font-medium tabular-nums">
                {mealsEaten} of 3 meals · {snackCount} snack{snackCount === 1 ? '' : 's'} today
                {hasPlanToday && (
                  <span className="ml-1.5 text-xs font-normal text-muted">
                    — measured against today's meal plan
                  </span>
                )}
              </p>
            );
          })()}

          {MEALS.map((mealName) => {
            const entries = (diaryQuery.data ?? []).filter((e) => e.meal === mealName);
            const subtotal = Math.round(entries.reduce((sum, e) => sum + e.macros.kcal, 0));
            const planned = plannedQuery.data?.[mealName];
            const hasPlanToday = Object.keys(plannedQuery.data ?? {}).length > 0;
            const overBy = planned !== undefined ? subtotal - planned : 0;
            const unplanned = hasPlanToday && planned === undefined && entries.length > 0;
            const { Icon, tint } = MEAL_META[mealName];
            return (
              <section
                key={mealName}
                className="rounded-2xl border border-line bg-surface shadow-sm"
              >
                <div className="flex items-center gap-2.5 p-3.5 pb-0">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tint}`}>
                    <Icon size={16} strokeWidth={1.8} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold capitalize">{mealName}</h2>
                    {entries.length > 0 && (
                      <p className="text-xs text-muted tabular-nums">
                        {subtotal} kcal
                        {planned !== undefined && ` of ~${planned} planned`}
                      </p>
                    )}
                  </div>
                  {planned !== undefined && overBy > 75 && (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                      +{overBy} kcal over plan
                    </span>
                  )}
                  {unplanned && (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                      unplanned
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => addToMeal(mealName)}
                    className="springy ml-auto rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent"
                  >
                    + Add
                  </button>
                </div>
                {entries.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => addToMeal(mealName)}
                    className="springy m-3.5 mt-2.5 block w-[calc(100%-1.75rem)] rounded-xl border border-dashed border-line px-3 py-2.5 text-left text-xs text-muted hover:bg-elev"
                  >
                    Nothing logged{planned !== undefined ? ` — ~${planned} kcal planned` : ''} · tap
                    to add {mealName === 'snack' ? 'a snack' : mealName}
                  </button>
                ) : (
                  <ul className="mt-1.5 divide-y divide-line px-1.5 pb-1.5">
                    {entries.map(renderEntry)}
                  </ul>
                )}
              </section>
            );
          })}
        </>
      )}

      <p className="pt-2 text-xs text-muted/70">
        Powered by{' '}
        <a href="https://platform.fatsecret.com" target="_blank" rel="noreferrer" className="underline">
          fatsecret
        </a>
        . Additional food data from{' '}
        <a href="https://fdc.nal.usda.gov" target="_blank" rel="noreferrer" className="underline">
          USDA FoodData Central
        </a>{' '}
        (public domain) and{' '}
        <a href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer" className="underline">
          Open Food Facts
        </a>{' '}
        (ODbL).
      </p>
    </div>
  );

  /** One diary entry row — expandable to full stats, re-log and delete.
   * Rows live inside the meal card, so no border of their own. */
  function renderEntry(entry: NonNullable<typeof diaryQuery.data>[number]) {
    return (
      <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => setOpenEntry(openEntry === entry.id ? null : entry.id)}
                  aria-expanded={openEntry === entry.id}
                  className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-elev"
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
                  <div className="space-y-3 p-2.5 pt-0">
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
    );
  }
}
