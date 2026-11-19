import { ArrowLeftRight, ChevronRight, Plus } from 'lucide-react';
import type { MealPlanItem, MealType } from '@arcadia/shared';
import { Card, IconButton } from '@/components/ui';
import { localDayOfWeek } from '@/lib/dates';
import { MEAL_ICON, MEALS, mealLabel } from '../diary/meals';
import { RecipeThumb } from '../RecipeArt';
import { DAYS, sumMacros, type PlanLookup, type PlanTargets } from './planMath';

/** One meal of one day, as a row. A planned meal shows its first item (the
 * rest as "+ …") and opens that day; an empty one opens the add sheet for
 * exactly this slot. */
function MealRow({
  meal,
  items,
  lookup,
  onOpen,
  onAdd,
  onSwap,
}: {
  meal: MealType;
  items: MealPlanItem[];
  lookup: PlanLookup;
  onOpen: () => void;
  onAdd: () => void;
  onSwap: (item: MealPlanItem) => void;
}) {
  const Icon = MEAL_ICON[meal];
  const primary = items[0];

  if (!primary) {
    return (
      <button
        type="button"
        onClick={onAdd}
        className="flex min-h-12 w-full items-center gap-3 px-4 py-1.5 text-left text-sm text-muted transition-colors hover:bg-elev hover:text-ink"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-elev">
          <Icon size={16} strokeWidth={1.8} aria-hidden />
        </span>
        <span className="flex-1">Add {meal}</span>
        <Plus size={16} className="mr-2.5 shrink-0" aria-hidden />
      </button>
    );
  }

  const kcal = Math.round(sumMacros(items, lookup).kcal);
  return (
    // The row button and the swap button are siblings, not nested: a button
    // inside a button is invalid HTML and confuses keyboards/screen readers.
    <div className="flex items-center pr-2">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2 pr-2 pl-4 text-left transition-colors hover:bg-elev"
      >
        <RecipeThumb name={primary.name} className="h-10 w-10 rounded-lg text-lg" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{primary.name}</span>
          <span className="block truncate text-sm text-muted tabular-nums">
            {mealLabel(meal)}
            {kcal > 0 && ` · ${kcal} kcal`}
            {items.length > 1 &&
              ` · + ${items
                .slice(1)
                .map((i) => i.name)
                .join(', ')}`}
          </span>
        </span>
      </button>
      <IconButton label={`Swap ${primary.name}`} onClick={() => onSwap(primary)}>
        <ArrowLeftRight size={16} aria-hidden />
      </IconButton>
    </div>
  );
}

/** The whole week: one card per day, four meal rows each. The card header
 * opens that day in the Day view, where items can be added and removed. */
export function WeekView({
  items,
  lookup,
  perDay,
  targets,
  onOpenDay,
  onAdd,
  onSwap,
}: {
  items: MealPlanItem[];
  lookup: PlanLookup;
  /** Calories per day (index 0 = Monday); undefined while nothing is planned. */
  perDay: { kcal: number }[] | undefined;
  targets: PlanTargets;
  onOpenDay: (day: number) => void;
  onAdd: (day: number, meal: MealType) => void;
  onSwap: (item: MealPlanItem) => void;
}) {
  const today = localDayOfWeek();
  return (
    <div className="space-y-3">
      {DAYS.map((label, day) => {
        const kcal = Math.round(perDay?.[day]?.kcal ?? 0);
        return (
          // overflow-hidden clips the rows' hover background to the corners.
          <Card key={label} className="overflow-hidden">
            {/* The heading wraps the button (not the other way round): a
                heading is not allowed inside a button. */}
            <h2>
              <button
                type="button"
                onClick={() => onOpenDay(day)}
                className="flex min-h-11 w-full items-center gap-2 px-4 py-2 text-left transition-colors hover:bg-elev"
              >
                <span className="text-base font-bold">{label}</span>
                {day === today && (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">
                    Today
                  </span>
                )}
                <span className="flex-1" />
                {kcal > 0 && (
                  <span className="text-sm font-normal text-muted tabular-nums">
                    {kcal}
                    {targets ? ` / ${Math.round(targets.kcal)}` : ''} kcal
                  </span>
                )}
                <ChevronRight size={16} className="shrink-0 text-muted" aria-hidden />
              </button>
            </h2>
            <ul className="divide-y divide-line border-t border-line">
              {MEALS.map((meal) => (
                <li key={meal}>
                  <MealRow
                    meal={meal}
                    items={items.filter((it) => it.dayOfWeek === day && it.meal === meal)}
                    lookup={lookup}
                    onOpen={() => onOpenDay(day)}
                    onAdd={() => onAdd(day, meal)}
                    onSwap={onSwap}
                  />
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
