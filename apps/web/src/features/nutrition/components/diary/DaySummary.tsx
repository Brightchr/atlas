import { Link } from 'react-router';
import { Target } from 'lucide-react';
import type { DiaryEntry, MealType } from '@arcadia/shared';
import type { DailyTargets } from '@/features/goals/targets';
import { Card } from '@/components/ui';

interface DayTotals {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sugarG: number;
  fiberG: number;
  sodiumG: number;
}

/** Adds up every entry of a day. Optional nutrients count as 0 when a food
 * doesn't report them. */
function sumEntries(entries: DiaryEntry[]): DayTotals {
  return entries.reduce<DayTotals>(
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
}

const MACROS = [
  { key: 'proteinG', label: 'Protein' },
  { key: 'carbsG', label: 'Carbs' },
  { key: 'fatG', label: 'Fat' },
] as const;

/** A thin progress bar; turns rose once the target is passed. */
function Bar({ value, target }: { value: number; target: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-elev">
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${
          value > target ? 'bg-rose-500' : 'bg-linear-to-r from-accent to-accent-2'
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** The day at a glance. The headline is calories REMAINING (target minus
 * eaten) because that is the number that answers "can I have this?" — with
 * no target set there is nothing to subtract from, so it shows calories
 * eaten instead. */
export function DaySummary({
  entries,
  targets,
  hasPlan,
}: {
  entries: DiaryEntry[];
  /** null/undefined = the user hasn't set up targets yet. */
  targets: DailyTargets | null | undefined;
  /** True when the meal plan has something planned for this weekday. */
  hasPlan: boolean;
}) {
  const totals = sumEntries(entries);
  const eaten = Math.round(totals.kcal);
  const remaining = targets ? Math.round(targets.kcal) - eaten : null;
  const over = remaining !== null && remaining < 0;

  const mealsEaten = (['breakfast', 'lunch', 'dinner'] as MealType[]).filter((m) =>
    entries.some((e) => e.meal === m),
  ).length;
  const snackCount = entries.filter((e) => e.meal === 'snack').length;

  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p
            className={`font-display text-5xl leading-none font-bold tracking-tight tabular-nums ${
              over ? 'text-rose-500' : ''
            }`}
          >
            {remaining === null ? eaten : Math.abs(remaining)}
          </p>
          <p className="mt-1.5 text-sm font-medium text-muted">
            {remaining === null ? 'kcal eaten' : over ? 'kcal over target' : 'kcal remaining'}
          </p>
        </div>
        {targets && (
          <p className="pb-0.5 text-right text-sm text-muted tabular-nums">
            {eaten} eaten
            <br />
            of {Math.round(targets.kcal)}
          </p>
        )}
      </div>
      {targets && <Bar value={totals.kcal} target={targets.kcal} />}

      <div className="grid grid-cols-3 gap-3">
        {MACROS.map(({ key, label }) => {
          const target = targets?.[key];
          return (
            <div key={key} className="min-w-0 space-y-1.5">
              <p className="text-sm text-muted">{label}</p>
              <p className="truncate text-sm font-semibold tabular-nums">
                {Math.round(totals[key])}
                {target !== undefined && (
                  <span className="font-normal text-muted"> / {Math.round(target)}</span>
                )}{' '}
                g
              </p>
              {target !== undefined && <Bar value={totals[key]} target={target} />}
            </div>
          );
        })}
      </div>

      {entries.length > 0 && (
        <p className="text-sm text-muted tabular-nums">
          {totals.sugarG.toFixed(1)}
          {targets ? ` of ≤${targets.sugarMaxG}` : ''} g sugar · {totals.fiberG.toFixed(1)}
          {targets ? ` of ${targets.fiberG}` : ''} g fiber · {(totals.sodiumG * 1000).toFixed(0)}
          {targets ? ' of ≤2300' : ''} mg sodium
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-3 border-t border-line pt-2">
        <p className="text-sm font-medium tabular-nums">
          {mealsEaten} of 3 meals · {snackCount} snack{snackCount === 1 ? '' : 's'}
          {hasPlan && <span className="font-normal text-muted"> · vs. your meal plan</span>}
        </p>
        {/* A link styled as a 44px-tall row so it is easy to hit. */}
        <Link
          to="/progress/goals"
          className="-mr-1 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-1 text-sm font-semibold text-accent hover:underline"
        >
          <Target size={16} aria-hidden />
          {targets ? 'Edit targets' : 'Set daily targets'}
        </Link>
      </div>
    </Card>
  );
}
