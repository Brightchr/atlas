import { Plus, UtensilsCrossed } from 'lucide-react';
import type { DiaryEntry, MealType } from '@arcadia/shared';
import { Button, Card } from '@/components/ui';
import { MEAL_ICON, mealLabel } from './meals';

/** One meal of the day as a card: header with subtotal and an Add button,
 * then its entries. Always rendered, even when empty, so the day's shape
 * (and where to tap) never moves around. */
export function MealSection({
  meal,
  entries,
  plannedKcal,
  hasPlan,
  onAdd,
  onOpenEntry,
}: {
  meal: MealType;
  /** Only this meal's entries. */
  entries: DiaryEntry[];
  /** What the meal plan expects here; undefined = nothing planned. */
  plannedKcal: number | undefined;
  /** True when the plan has anything at all for this day. */
  hasPlan: boolean;
  onAdd: () => void;
  onOpenEntry: (entry: DiaryEntry) => void;
}) {
  const Icon = MEAL_ICON[meal];
  const subtotal = Math.round(entries.reduce((sum, e) => sum + e.macros.kcal, 0));
  const overBy = plannedKcal !== undefined ? subtotal - plannedKcal : 0;
  // Food in a meal the plan left empty — e.g. a snack on a no-snack day.
  const unplanned = hasPlan && plannedKcal === undefined && entries.length > 0;
  const badge =
    plannedKcal !== undefined && overBy > 75
      ? `+${overBy} kcal over plan`
      : unplanned
        ? 'unplanned'
        : null;

  return (
    // overflow-hidden clips the rows' hover background to the rounded corners.
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 p-3 pl-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Icon size={18} strokeWidth={1.8} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold">{mealLabel(meal)}</h2>
          <p className="truncate text-sm text-muted tabular-nums">
            {entries.length > 0 ? `${subtotal} kcal` : 'Nothing logged'}
            {plannedKcal !== undefined &&
              (entries.length > 0 ? ` of ~${plannedKcal} planned` : ` · ~${plannedKcal} planned`)}
          </p>
        </div>
        <Button variant="soft" onClick={onAdd} aria-label={`Add food to ${meal}`}>
          <Plus size={18} aria-hidden />
          Add
        </Button>
      </div>

      {badge && (
        <p className="px-4 pb-2">
          <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-600">
            {badge}
          </span>
        </p>
      )}

      {entries.length > 0 && (
        <ul className="divide-y divide-line border-t border-line">
          {entries.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => onOpenEntry(entry)}
                className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-elev"
              >
                {entry.imageUrl ? (
                  // Product photos are shot on white, so the tile stays white
                  // in every theme.
                  <img
                    src={entry.imageUrl}
                    alt=""
                    loading="lazy"
                    className="h-10 w-10 shrink-0 rounded-lg bg-white object-contain"
                  />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-elev text-muted">
                    <UtensilsCrossed size={16} strokeWidth={1.8} aria-hidden />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{entry.foodName}</span>
                  <span className="block text-sm text-muted tabular-nums">{entry.grams} g</span>
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {entry.macros.kcal} kcal
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
