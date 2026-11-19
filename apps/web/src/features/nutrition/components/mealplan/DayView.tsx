import { Link } from 'react-router';
import { ArrowLeftRight, Plus, Trash2 } from 'lucide-react';
import type { MealPlanItem, MealType } from '@arcadia/shared';
import { Button, Card, IconButton } from '@/components/ui';
import { localDayOfWeek } from '@/lib/dates';
import { MEAL_ICON, MEALS, mealLabel } from '../diary/meals';
import { RecipeThumb } from '../RecipeArt';
import { amountLabel, DAYS, itemMacros, sumMacros, type PlanLookup } from './planMath';

/** Mon … Sun as seven equal buttons. A grid (not a scrolling row) so all
 * seven are always visible — nothing hides off the right edge on a phone. */
function DayPicker({ day, onChange }: { day: number; onChange: (day: number) => void }) {
  const today = localDayOfWeek();
  return (
    <div
      role="group"
      aria-label="Day of the week"
      className="grid grid-cols-7 gap-1 rounded-xl border border-line bg-surface p-1 shadow-sm"
    >
      {DAYS.map((label, i) => (
        <button
          key={label}
          type="button"
          aria-pressed={day === i}
          onClick={() => onChange(i)}
          className={`springy min-h-11 rounded-lg text-sm font-semibold md:min-h-8 ${
            day === i
              ? 'bg-accent text-accent-ink shadow-sm'
              : // Today stands out in the accent color when it isn't selected.
                `hover:bg-elev hover:text-ink ${i === today ? 'text-accent' : 'text-muted'}`
          }`}
        >
          {label.slice(0, 3)}
          {i === today && <span className="sr-only"> (today)</span>}
        </button>
      ))}
    </div>
  );
}

/** One day, editable: four meal cards in the same shape as the diary's, each
 * listing what is planned with swap and remove on every item. */
export function DayView({
  day,
  onDayChange,
  items,
  lookup,
  onAdd,
  onSwap,
  onRemove,
}: {
  day: number;
  onDayChange: (day: number) => void;
  /** Only this day's items. */
  items: MealPlanItem[];
  lookup: PlanLookup;
  onAdd: (meal: MealType) => void;
  onSwap: (item: MealPlanItem) => void;
  /** Asks for confirmation first — the page owns that sheet. */
  onRemove: (item: MealPlanItem) => void;
}) {
  return (
    <div className="space-y-3">
      <DayPicker day={day} onChange={onDayChange} />

      {MEALS.map((meal) => {
        const slotItems = items.filter((i) => i.meal === meal);
        const Icon = MEAL_ICON[meal];
        const kcal = Math.round(sumMacros(slotItems, lookup).kcal);
        return (
          <Card key={meal} className="overflow-hidden">
            <div className="flex items-center gap-3 p-3 pl-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                <Icon size={18} strokeWidth={1.8} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold">{mealLabel(meal)}</h2>
                <p className="truncate text-sm text-muted tabular-nums">
                  {slotItems.length === 0 ? 'Nothing planned' : `${kcal} kcal`}
                </p>
              </div>
              <Button
                variant="soft"
                onClick={() => onAdd(meal)}
                aria-label={`Add to ${DAYS[day]} ${meal}`}
              >
                <Plus size={18} aria-hidden />
                Add
              </Button>
            </div>

            {slotItems.length > 0 && (
              <ul className="divide-y divide-line border-t border-line">
                {slotItems.map((item) => {
                  const m = itemMacros(item, lookup);
                  return (
                    <li key={item.id} className="flex min-h-14 items-center gap-3 py-1.5 pr-2 pl-4">
                      <RecipeThumb name={item.name} className="h-10 w-10 rounded-lg text-lg" />
                      {/* Two lines (name, then amount and calories) so the
                          name keeps its width next to two icon buttons. */}
                      <span className="min-w-0 flex-1">
                        {item.kind === 'recipe' ? (
                          <Link
                            to={`/eat/recipes/${item.refId}`}
                            className="block truncate text-sm font-semibold hover:text-accent hover:underline"
                          >
                            {item.name}
                          </Link>
                        ) : (
                          <span className="block truncate text-sm font-semibold">{item.name}</span>
                        )}
                        <span className="block truncate text-sm text-muted tabular-nums">
                          {amountLabel(item)}
                          {m && ` · ${m.kcal} kcal`}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center">
                        <IconButton label={`Swap ${item.name}`} onClick={() => onSwap(item)}>
                          <ArrowLeftRight size={16} aria-hidden />
                        </IconButton>
                        <IconButton label={`Remove ${item.name}`} onClick={() => onRemove(item)}>
                          <Trash2 size={16} aria-hidden />
                        </IconButton>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        );
      })}
    </div>
  );
}
