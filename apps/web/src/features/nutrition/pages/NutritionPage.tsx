import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import type { Food, MealType } from '@arcadia/shared';
import { Button } from '@/components/ui';
import { getSavedTargets } from '@/features/goals/repository';
import { localDayOfWeek, localIsoDate, parseLocalDate } from '@/lib/dates';
import { AddFoodSheet } from '../components/diary/AddFoodSheet';
import { DaySummary } from '../components/diary/DaySummary';
import { DaySwitcher } from '../components/diary/DaySwitcher';
import { EntrySheet } from '../components/diary/EntrySheet';
import type { ServingInfo } from '../components/diary/FoodRow';
import { MealSection } from '../components/diary/MealSection';
import { MEALS, mealForTime, type FoodLike } from '../components/diary/meals';
import { plannedKcalByMeal } from '../mealPlan';
import {
  deleteDiaryEntry,
  duplicateDiaryEntry,
  getDiaryForDate,
  importFood,
  logFood,
  updateDiaryEntryGrams,
} from '../repository';

/** The food diary. Top to bottom: which day, how the day is going, the four
 * meals, and a sticky "Add food" button. Adding and editing happen in sheets
 * on top, so the diary itself never jumps around.
 *
 * This component owns the data (queries + mutations) and which sheet is
 * open; the pieces under components/diary/ only draw what they are given. */
export function NutritionPage() {
  // The day on screen, as a YYYY-MM-DD key. Everything below — the diary
  // query, the plan comparison, every log action — uses this, not "today".
  const [date, setDate] = useState(() => localIsoDate());
  // Which meal the add-food sheet is logging to; null = sheet closed.
  const [addingTo, setAddingTo] = useState<MealType | null>(null);
  // The entry whose sheet is open (only its id, so the sheet always shows
  // the freshest copy from the query below).
  const [openEntryId, setOpenEntryId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const diaryQuery = useQuery({ queryKey: ['diary', date], queryFn: () => getDiaryForDate(date) });
  const targetsQuery = useQuery({ queryKey: ['targets'], queryFn: getSavedTargets });
  // What the meal plan expects per meal on this weekday — the yardstick that
  // makes an extra snack or an oversized dinner visible at a glance.
  const dayOfWeek = localDayOfWeek(parseLocalDate(date));
  const plannedQuery = useQuery({
    queryKey: ['meal-plan', 'planned-kcal', dayOfWeek],
    queryFn: () => plannedKcalByMeal(dayOfWeek),
  });

  const entries = diaryQuery.data ?? [];
  const planned = plannedQuery.data ?? {};
  const hasPlan = Object.keys(planned).length > 0;
  const openEntry = entries.find((e) => e.id === openEntryId) ?? null;

  /** Refresh everything a diary change can affect. */
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['diary'] });
    void queryClient.invalidateQueries({ queryKey: ['goals'] });
    // Recent/Frequent lists: mark them out of date but don't refetch while
    // the add-food sheet is open — re-sorting the list under someone's thumb
    // makes the next tap land on the wrong food. They reload on next open.
    void queryClient.invalidateQueries({ queryKey: ['foods', 'history'], refetchType: 'none' });
    // (Deliberately NOT refreshing ['foods', 'local'] here: a search result
    // that just got imported would swap from its "online" row to a "saved"
    // row mid-list and lose its "Added" tick.)
  };

  const logMutation = useMutation({
    mutationFn: async (args: {
      food: FoodLike;
      grams: number;
      meal: MealType;
      serving?: ServingInfo;
    }) => {
      // Search results aren't in the local database yet ("id" is what a
      // saved Food has and a snapshot lacks) — import first, then log.
      // Serving details looked up by the row ride along into the import so
      // the saved food remembers them.
      const food: Food =
        'id' in args.food
          ? args.food
          : await importFood(
              args.serving
                ? { ...args.food, servingName: args.serving.name, servingGrams: args.serving.grams }
                : args.food,
            );
      // `date` is the selected day: entries are keyed by this column alone
      // (logged_at is just a timestamp), so back-filling a past day works.
      await logFood({ date, meal: args.meal, food, grams: args.grams });
    },
    onSuccess: invalidate,
  });

  const closeEntry = () => setOpenEntryId(null);
  const afterEntryAction = () => {
    invalidate();
    closeEntry();
  };
  const updateMutation = useMutation({
    mutationFn: (args: { id: string; grams: number }) => updateDiaryEntryGrams(args.id, args.grams),
    onSuccess: afterEntryAction,
  });
  const duplicateMutation = useMutation({
    // "Log again" lands on the day being viewed, same meal and amount.
    mutationFn: (id: string) => duplicateDiaryEntry(id, date),
    onSuccess: afterEntryAction,
  });
  const deleteMutation = useMutation({
    mutationFn: deleteDiaryEntry,
    onSuccess: afterEntryAction,
  });
  const entryBusy =
    updateMutation.isPending || duplicateMutation.isPending || deleteMutation.isPending;
  const entryError = updateMutation.isError || duplicateMutation.isError || deleteMutation.isError;

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      {/* The Eat section's pill bar already says "Diary" right above, so the
          title is for screen readers only and the day switcher is the header. */}
      <h1 className="sr-only">Food diary</h1>
      {/* Wide screens: the day and its totals sit on the left and stay in
          view (sticky) while the meals scroll on the right. Phones stack. */}
      <div className="grid items-start gap-4 lg:grid-cols-5">
        <div className="min-w-0 space-y-4 lg:sticky lg:top-4 lg:col-span-2">
          <DaySwitcher date={date} onChange={setDate} />

          <DaySummary entries={entries} targets={targetsQuery.data} hasPlan={hasPlan} />

          {/* On wide screens the Add button lives here, under the totals. */}
          <div className="hidden lg:block">
            <Button size="lg" block onClick={() => setAddingTo(mealForTime())}>
              <Plus size={18} aria-hidden />
              Add food
            </Button>
          </div>
        </div>

        <div className="min-w-0 space-y-4 lg:col-span-3">
          {diaryQuery.isError && (
            <p className="text-sm text-rose-500">Couldn't load this day's diary.</p>
          )}
          {entryError && (
            <p className="text-sm text-rose-500">That change couldn't be saved — try again.</p>
          )}

          {MEALS.map((meal) => (
            <MealSection
              key={meal}
              meal={meal}
              entries={entries.filter((e) => e.meal === meal)}
              plannedKcal={planned[meal]}
              hasPlan={hasPlan}
              onAdd={() => setAddingTo(meal)}
              onOpenEntry={(entry) => setOpenEntryId(entry.id)}
            />
          ))}

          {/* Sticky, not fixed: it rides at the bottom of the scroll area (which
          already leaves room for the tab bar) and scrolls away with the page
          at the very end instead of covering the footer. */}
          <div className="sticky bottom-3 z-10 lg:hidden">
            <Button
              size="lg"
              block
              className="shadow-lg"
              // No particular meal chosen: guess from the time of day.
              onClick={() => setAddingTo(mealForTime())}
            >
              <Plus size={20} aria-hidden />
              Add food
            </Button>
          </div>
        </div>
      </div>

      <p className="pt-2 text-xs text-muted/70">
        Powered by{' '}
        <a
          href="https://platform.fatsecret.com"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          fatsecret
        </a>
        . Additional food data from{' '}
        <a href="https://fdc.nal.usda.gov" target="_blank" rel="noreferrer" className="underline">
          USDA FoodData Central
        </a>{' '}
        (public domain) and{' '}
        <a
          href="https://world.openfoodfacts.org"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          Open Food Facts
        </a>{' '}
        (ODbL).
      </p>

      {addingTo && (
        <AddFoodSheet
          initialMeal={addingTo}
          // mutateAsync returns a promise, so each row can show its own
          // "Added" (or an error) when its log finishes.
          onLog={(args) => logMutation.mutateAsync(args)}
          onClose={() => setAddingTo(null)}
        />
      )}

      {openEntry && (
        <EntrySheet
          // A new key per entry resets the sheet's amount field.
          key={openEntry.id}
          entry={openEntry}
          busy={entryBusy}
          onSaveGrams={(grams) => updateMutation.mutate({ id: openEntry.id, grams })}
          onLogAgain={() => duplicateMutation.mutate(openEntry.id)}
          onDelete={() => deleteMutation.mutate(openEntry.id)}
          onClose={closeEntry}
        />
      )}
    </div>
  );
}
