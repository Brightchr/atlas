import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Card, buttonClasses } from '@/components/ui';
import { getSavedTargets } from '@/features/goals/repository';
import { getDiaryForDate } from '@/features/nutrition/repository';
import { localIsoDate } from '@/lib/dates';

/** One macro as a labelled progress bar: "Protein 82 / 150 g". Without a
 * target there is nothing to fill, so the bar stays empty and only the eaten
 * amount shows. */
function MacroBar({ label, eaten, target }: { label: string; eaten: number; target?: number }) {
  const pct = target ? Math.min(100, Math.round((eaten / target) * 100)) : 0;
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-sm font-medium">{label}</span>
        <span className="truncate text-sm text-muted tabular-nums">
          {Math.round(eaten)}
          {target ? ` / ${target}` : ''} g
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-elev">
        <div
          className="h-full rounded-full bg-linear-to-r from-accent to-accent-2 transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** Home's food summary: the one number that matters mid-day (calories left),
 * the three macros underneath, and a single door into the Eat tab. Uses the
 * same ['diary', date] and ['targets'] query keys as the Eat tab, so logging
 * food there updates this card without any extra wiring. */
export function TodayFoodCard() {
  const date = localIsoDate();
  const diary = useQuery({ queryKey: ['diary', date], queryFn: () => getDiaryForDate(date) });
  const targetsQuery = useQuery({ queryKey: ['targets'], queryFn: getSavedTargets });
  const targets = targetsQuery.data ?? null;

  const eaten = (diary.data ?? []).reduce(
    (acc, e) => ({
      kcal: acc.kcal + e.macros.kcal,
      proteinG: acc.proteinG + e.macros.proteinG,
      carbsG: acc.carbsG + e.macros.carbsG,
      fatG: acc.fatG + e.macros.fatG,
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );

  // With targets the headline is "what's left"; without them we can only say
  // what was eaten. Going over flips the wording (and the color) rather than
  // showing a negative number.
  // "2 of 3 meals · 1 snack": how much of the day has been logged.
  const entries = diary.data ?? [];
  const mealsLogged = new Set(entries.filter((e) => e.meal !== 'snack').map((e) => e.meal)).size;
  const snacks = entries.filter((e) => e.meal === 'snack').length;

  const remaining = targets ? Math.round(targets.kcal - eaten.kcal) : null;
  const over = remaining !== null && remaining < 0;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-muted">Today's food</h2>
        <Link to="/eat" className={buttonClasses('soft', 'md')}>
          <Plus size={16} aria-hidden />
          Log food
        </Link>
      </div>

      <div className="mt-1 flex items-end justify-between gap-3">
        <p className="min-w-0">
          <span
            className={`font-display text-3xl font-bold tabular-nums ${over ? 'text-rose-500' : ''}`}
          >
            {(remaining === null ? Math.round(eaten.kcal) : Math.abs(remaining)).toLocaleString()}
          </span>{' '}
          <span className="text-sm text-muted">
            {remaining === null ? 'kcal eaten' : over ? 'kcal over' : 'kcal left'}
          </span>
        </p>
        {targets && (
          <p className="shrink-0 pb-1 text-sm text-muted tabular-nums">
            {Math.round(eaten.kcal).toLocaleString()} / {targets.kcal.toLocaleString()}
          </p>
        )}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <MacroBar label="Protein" eaten={eaten.proteinG} target={targets?.proteinG} />
        <MacroBar label="Carbs" eaten={eaten.carbsG} target={targets?.carbsG} />
        <MacroBar label="Fat" eaten={eaten.fatG} target={targets?.fatG} />
      </div>

      <p className="mt-3 text-sm text-muted tabular-nums">
        {mealsLogged} of 3 meals · {snacks} snack{snacks === 1 ? '' : 's'}
      </p>

      {!targets && targetsQuery.isSuccess && (
        <p className="mt-3 text-sm text-muted">
          <Link to="/progress/goals" className="font-medium text-accent hover:underline">
            Set daily targets
          </Link>{' '}
          to see what you have left.
        </p>
      )}
    </Card>
  );
}
