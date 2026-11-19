import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Plus, UtensilsCrossed } from 'lucide-react';
import type { MealType } from '@arcadia/shared';
import { fetchServing } from '@/lib/off/client';
import { Button, IconButton, Stepper } from '@/components/ui';
import {
  amountToGrams,
  defaultAmount,
  formatAmount,
  mealLabel,
  type Amount,
  type AmountUnit,
  type FoodLike,
} from './meals';
import { StatsGrid } from './StatsGrid';

/** Serving details that ride along with a log, so a food imported from a
 * search result remembers its serving size. */
export interface ServingInfo {
  name: string | null;
  grams: number;
}

/** One food in the add-food sheet (a search result, a recent food, a scanned
 * or just-created one). Two ways to log it:
 *  - the "+" button logs the default amount straight away — one tap;
 *  - tapping the row opens amount controls for anything else.
 * After a log the row shows what was added for a moment; the sheet stays
 * open so several foods can go in one after another. */
export function FoodRow({
  food,
  tag,
  lastGrams,
  meal,
  defaultOpen = false,
  onLog,
}: {
  food: FoodLike;
  /** Small source label: "saved", "USDA", "Open Food Facts"… */
  tag?: string;
  /** Grams logged last time — becomes the default amount (recent foods). */
  lastGrams?: number;
  /** The meal the sheet is logging to (only used for the button label). */
  meal: MealType;
  defaultOpen?: boolean;
  /** Resolves once the entry is saved; rejects if it could not be. */
  onLog: (grams: number, serving?: ServingInfo) => Promise<unknown>;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(defaultOpen);
  // null = "not touched yet, follow the default". Keeping the user's edits
  // separate from the default lets the default improve when serving data
  // arrives late, without overwriting something already typed.
  const [amountText, setAmountText] = useState<string | null>(null);
  const [unitChoice, setUnitChoice] = useState<AmountUnit | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [added, setAdded] = useState<string | null>(null);

  // Clear the "Added" note after a moment so the row can be used again.
  useEffect(() => {
    if (added === null) return;
    const t = setTimeout(() => setAdded(null), 2000);
    return () => clearTimeout(t);
  }, [added]);

  // OFF's search index has no serving data — fetch it once the row expands.
  // (USDA rows already carry theirs; their codes mean nothing to OFF.)
  const needsServingLookup =
    food.servingGrams === null && food.barcode !== null && food.source === 'off';
  const servingQueryKey = ['foods', 'serving', food.barcode];
  const servingQuery = useQuery({
    queryKey: servingQueryKey,
    queryFn: () => fetchServing(food.barcode!),
    enabled: open && needsServingLookup,
    staleTime: Infinity,
    retry: 1,
  });
  const servingGrams = food.servingGrams ?? servingQuery.data?.grams ?? null;
  const servingName = food.servingName ?? servingQuery.data?.name ?? null;

  const fallback = defaultAmount(servingGrams, lastGrams);
  const unit: AmountUnit = unitChoice ?? fallback.unit;
  const text = amountText ?? String(fallback.value);
  const grams = amountToGrams({ value: Number(text), unit }, servingGrams);
  const valid = Number.isFinite(grams) && grams > 0 && grams <= 5000;
  const kcalFor = (g: number) => Math.round((food.per100g.kcal * g) / 100);

  /** Saves `amount` and shows the result on the row. */
  const log = async (amount: Amount, serving: { grams: number | null; name: string | null }) => {
    setStatus('saving');
    try {
      const g = amountToGrams(amount, serving.grams);
      await onLog(g, serving.grams ? { name: serving.name, grams: serving.grams } : undefined);
      setStatus('idle');
      setAdded(`Added ${formatAmount(amount)} · ${kcalFor(g)} kcal`);
    } catch {
      setStatus('error');
    }
  };

  /** The "+" button: log the default amount without opening anything. */
  const quickAdd = async () => {
    let serving = { grams: servingGrams, name: servingName };
    if (serving.grams === null && needsServingLookup) {
      // Collapsed rows haven't looked up the serving yet. Do it now so the
      // quick add is "1 serving", not a blind 100 g — and so the food is
      // saved to the library with its serving size. Same cache key as the
      // query above, so each product is fetched at most once. If the lookup
      // fails (offline), fall back to 100 g rather than block the log.
      setStatus('saving');
      const fetched = await queryClient
        .fetchQuery({
          queryKey: servingQueryKey,
          queryFn: () => fetchServing(food.barcode!),
          staleTime: Infinity,
        })
        .catch(() => null);
      serving = { grams: fetched?.grams ?? null, name: fetched?.name ?? null };
    }
    await log(defaultAmount(serving.grams, lastGrams), serving);
  };

  /** Switching unit converts the amount, so "2 servings" becomes "64 g"
   * instead of the nonsense "2 g". */
  const changeUnit = (next: AmountUnit) => {
    if (next === unit || !servingGrams) return;
    const value = Number(text) || 0;
    const converted = next === 'g' ? value * servingGrams : value / servingGrams;
    setAmountText(String(Math.round(converted * 100) / 100));
    setUnitChoice(next);
  };

  // The grey line under the name: what the "+" will log, or the label facts.
  const preview = defaultAmount(servingGrams, lastGrams);
  const previewGrams = amountToGrams(preview, servingGrams);
  const facts =
    lastGrams !== undefined
      ? `${formatAmount(preview)} · ${kcalFor(previewGrams)} kcal`
      : servingGrams
        ? `${kcalFor(servingGrams)} kcal / ${servingName ?? 'serving'}`
        : `${Math.round(food.per100g.kcal)} kcal / 100 g`;

  return (
    <li className="rounded-2xl border border-line bg-surface">
      <div className="flex items-center gap-1 pr-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-2xl py-2 pl-3 text-left"
        >
          {food.imageUrl ? (
            // Product photos are shot on white — keep the tile white in every theme.
            <img
              src={food.imageUrl}
              alt=""
              loading="lazy"
              className="h-11 w-11 shrink-0 rounded-lg bg-white object-contain"
            />
          ) : (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-elev text-muted">
              <UtensilsCrossed size={18} strokeWidth={1.8} aria-hidden />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{food.name}</span>
            {added ? (
              <span className="flex items-center gap-1 text-sm font-semibold text-accent" role="status">
                <Check size={15} aria-hidden />
                <span className="truncate">{added}</span>
              </span>
            ) : (
              <span className="block truncate text-sm text-muted">
                {food.brand ? `${food.brand} · ` : ''}
                {facts}
                {tag && <span className="ml-1.5 text-xs text-accent">{tag}</span>}
              </span>
            )}
          </span>
        </button>
        <IconButton
          label={`Add ${food.name} to ${meal}`}
          variant="soft"
          disabled={status === 'saving'}
          onClick={() => void quickAdd()}
        >
          {added ? <Check size={20} aria-hidden /> : <Plus size={20} aria-hidden />}
        </IconButton>
      </div>

      {status === 'error' && (
        <p className="px-3 pb-2 text-sm text-rose-500">Couldn't save that — try again.</p>
      )}

      {open && (
        <div className="space-y-3 border-t border-line p-3">
          {servingGrams && (
            // Two big chips instead of a <select>: one tap, no native picker.
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Unit">
              {(['serving', 'g'] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  aria-pressed={unit === u}
                  onClick={() => changeUnit(u)}
                  className={`springy min-h-11 rounded-xl px-3 text-sm font-semibold ${
                    unit === u ? 'bg-accent text-accent-ink' : 'bg-elev text-muted'
                  }`}
                >
                  {u === 'serving' ? `Servings (${servingGrams} g)` : 'Grams'}
                </button>
              ))}
            </div>
          )}
          <Stepper
            label={unit === 'serving' ? 'Servings' : 'Grams'}
            value={text}
            onChange={setAmountText}
            step={unit === 'serving' ? 0.5 : 10}
            min={unit === 'serving' ? 0.25 : 1}
            decimals
          />
          <Button
            size="lg"
            block
            disabled={!valid || status === 'saving'}
            onClick={() =>
              void log({ value: Number(text), unit }, { grams: servingGrams, name: servingName })
            }
          >
            {valid
              ? `Log ${grams} g · ${kcalFor(grams)} kcal to ${mealLabel(meal)}`
              : 'Enter an amount'}
          </Button>
          {servingGrams ? (
            <StatsGrid
              per100g={food.per100g}
              grams={servingGrams}
              caption={`per serving${servingName ? ` — ${servingName}` : ` (${servingGrams} g)`}`}
            />
          ) : (
            <StatsGrid per100g={food.per100g} />
          )}
        </div>
      )}
    </li>
  );
}
