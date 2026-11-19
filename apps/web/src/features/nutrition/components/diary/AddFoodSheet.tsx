import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PlusCircle, ScanBarcode, Search, X } from 'lucide-react';
import type { Food, MealType } from '@arcadia/shared';
import { lookupBarcode, type FoodSnapshot } from '@/lib/off/client';
import { Pagination } from '@/components/Pagination';
import { Button, IconButton, SectionLabel, Sheet } from '@/components/ui';
import { getFoodHistory, type FoodHistoryItem } from '../../repository';
import { BarcodeScannerModal } from '../BarcodeScannerModal';
import { CreateFoodCard } from './CreateFoodCard';
import { FoodRow, type ServingInfo } from './FoodRow';
import { MEALS, mealLabel, sourceTag, type FoodLike } from './meals';
import { useFoodSearch } from './useFoodSearch';

/** The add-food sheet: pick a meal, then search / scan / pick a recent food.
 * It opens over the diary and stays open after each log, so a whole meal can
 * be entered in one go. Mounted only while open — closing it throws away the
 * search state, which is exactly the reset we want next time. */
export function AddFoodSheet({
  initialMeal,
  onLog,
  onClose,
}: {
  /** The meal whose Add button opened the sheet (or the time-of-day guess). */
  initialMeal: MealType;
  onLog: (args: {
    food: FoodLike;
    grams: number;
    meal: MealType;
    serving?: ServingInfo;
  }) => Promise<unknown>;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [meal, setMeal] = useState<MealType>(initialMeal);
  const search = useFoodSearch();

  // Foods from the diary's own history, shown before anything is typed.
  const recentQuery = useQuery({
    queryKey: ['foods', 'history', 'recent'],
    queryFn: () => getFoodHistory('recent'),
  });
  const frequentQuery = useQuery({
    queryKey: ['foods', 'history', 'frequent'],
    queryFn: () => getFoodHistory('frequent'),
  });
  const recent = recentQuery.data ?? [];
  // Don't list a food twice: Frequent only adds what Recent doesn't show.
  const recentIds = new Set(recent.map((r) => r.food.id));
  const frequent = (frequentQuery.data ?? []).filter((f) => !recentIds.has(f.food.id));

  // Barcode scanning: modal -> lookup (FatSecret, then OFF) -> one result row.
  const [scanning, setScanning] = useState(false);
  const [scannedFood, setScannedFood] = useState<FoodSnapshot | null>(null);
  const barcodeMutation = useMutation({
    mutationFn: lookupBarcode,
    onSuccess: (snapshot) => setScannedFood(snapshot),
  });
  // useCallback keeps these two functions the same object between renders.
  // The scanner restarts its camera whenever `onDetected` changes, so a new
  // function on every render would keep interrupting the camera.
  const lookup = barcodeMutation.mutate;
  const onDetected = useCallback(
    (code: string) => {
      setScanning(false);
      lookup(code);
    },
    [lookup],
  );
  const closeScanner = useCallback(() => setScanning(false), []);

  const [creating, setCreating] = useState(false);
  const [createdFood, setCreatedFood] = useState<Food | null>(null);

  /** One row, wired to log into the currently selected meal. */
  const row = (food: FoodLike, key: string, extra?: { lastGrams?: number; open?: boolean }) => (
    <FoodRow
      key={key}
      food={food}
      tag={sourceTag(food)}
      lastGrams={extra?.lastGrams}
      defaultOpen={extra?.open}
      meal={meal}
      onLog={(grams, serving) => onLog({ food, grams, meal, serving })}
    />
  );
  const historyRow = (item: FoodHistoryItem) =>
    row(item.food, item.food.id, { lastGrams: item.lastGrams });

  return (
    <>
      <Sheet
        title="Add food"
        tall
        // While the scanner is on top, Escape / backdrop taps belong to it.
        onClose={scanning ? closeScanner : onClose}
        footer={
          <Button variant="secondary" size="lg" block onClick={onClose}>
            Done
          </Button>
        }
      >
        <div className="space-y-4">
          {/* Target meal: every "+" in this sheet logs to the selected chip. */}
          <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Log to meal">
            {MEALS.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={meal === m}
                onClick={() => setMeal(m)}
                className={`springy min-h-11 rounded-xl px-1 text-sm font-semibold ${
                  meal === m ? 'bg-accent text-accent-ink' : 'bg-elev text-muted'
                }`}
              >
                {mealLabel(m)}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                size={18}
                className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted"
                aria-hidden
              />
              <input
                // Opening the sheet means "I want to type a food" — focus
                // straight away so the keyboard is already up.
                autoFocus
                // A text input with search hints rather than type="search":
                // browsers add their own clear "x" to search inputs, which
                // would sit next to ours.
                type="text"
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
                value={search.term}
                onChange={(e) => search.setTerm(e.target.value)}
                placeholder="Search foods or brands"
                aria-label="Search foods to log"
                // text-base (16px) stops iOS Safari zooming in on focus.
                className="h-11 w-full rounded-xl border border-line bg-bg pr-12 pl-11 text-base outline-none placeholder:text-muted/70 focus:border-accent"
              />
              {search.term !== '' && (
                <IconButton
                  label="Clear search"
                  onClick={() => search.setTerm('')}
                  className="absolute top-0 right-0"
                >
                  <X size={18} aria-hidden />
                </IconButton>
              )}
            </div>
            <IconButton
              label="Scan a barcode"
              variant="secondary"
              onClick={() => {
                setScannedFood(null);
                barcodeMutation.reset();
                setScanning(true);
              }}
            >
              <ScanBarcode size={20} strokeWidth={1.8} aria-hidden />
            </IconButton>
          </div>

          {/* Autocomplete as a row of chips under the field. (It used to be a
              dropdown, but a dropdown would cover the results and their "+"
              buttons inside a sheet.) */}
          {search.searching && search.suggestions.length > 0 && (
            <ul className="-mx-5 flex gap-2 overflow-x-auto px-5" aria-label="Suggestions">
              {search.suggestions.map((s) => (
                <li key={s} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => search.setTerm(s)}
                    className="springy min-h-11 rounded-full border border-line px-4 text-sm font-medium whitespace-nowrap hover:bg-elev"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
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
            <section className="space-y-1">
              <SectionLabel>Scanned</SectionLabel>
              <ul>{row(scannedFood, `scan-${scannedFood.barcode}`, { open: true })}</ul>
            </section>
          )}

          {search.searching ? (
            <section className="space-y-2">
              {search.loading && <p className="text-sm text-muted">Searching…</p>}
              {search.remoteFailed && (
                <p className="text-sm text-rose-500">
                  Food database unreachable — showing your saved foods only.
                </p>
              )}
              <ul className="space-y-2">
                {search.local.map((food) => row(food, food.id))}
                {search.remote.map((snapshot) =>
                  row(snapshot, `${snapshot.source}-${snapshot.barcode}`),
                )}
              </ul>
              {!search.loading && search.local.length === 0 && search.remote.length === 0 && (
                <p className="text-sm text-muted">No foods found.</p>
              )}
              <Pagination page={search.page} pageCount={search.pageCount} onChange={search.setPage} />
            </section>
          ) : (
            <>
              {recent.length > 0 && (
                <section className="space-y-1">
                  <SectionLabel>Recent</SectionLabel>
                  <ul className="space-y-2">{recent.map(historyRow)}</ul>
                </section>
              )}
              {frequent.length > 0 && (
                <section className="space-y-1">
                  <SectionLabel>Frequent</SectionLabel>
                  <ul className="space-y-2">{frequent.map(historyRow)}</ul>
                </section>
              )}
              {recentQuery.isSuccess && recent.length === 0 && (
                <p className="text-sm text-muted">
                  Search for a food or scan a barcode. Foods you log will show up here for one-tap
                  logging next time.
                </p>
              )}
            </>
          )}

          {/* Always reachable at the bottom, whatever the search shows. */}
          <section className="space-y-3 border-t border-line pt-3">
            {createdFood && (
              <div className="space-y-1">
                <SectionLabel>Saved to your foods</SectionLabel>
                <ul>{row(createdFood, createdFood.id, { open: true })}</ul>
              </div>
            )}
            <Button
              variant="ghost"
              block
              aria-expanded={creating}
              onClick={() => setCreating(!creating)}
            >
              <PlusCircle size={18} aria-hidden />
              {creating ? 'Cancel new food' : "Can't find it? Create a food from its label"}
            </Button>
            {creating && (
              <CreateFoodCard
                onCreated={(food) => {
                  setCreating(false);
                  setCreatedFood(food);
                  // So the new food is findable by search straight away.
                  void queryClient.invalidateQueries({ queryKey: ['foods', 'local'] });
                }}
              />
            )}
          </section>
        </div>
      </Sheet>

      {/* The scanner is a full-screen `position: fixed` overlay. Pages animate
          in with a CSS transform, and a transformed ancestor becomes the box
          that `fixed` is measured against — so, like Sheet does for itself,
          portal it to <body> to cover the screen rather than the page. Being
          added to <body> after the sheet (same z-index) puts it on top. */}
      {scanning &&
        createPortal(
          <BarcodeScannerModal onClose={closeScanner} onDetected={onDetected} />,
          document.body,
        )}
    </>
  );
}
