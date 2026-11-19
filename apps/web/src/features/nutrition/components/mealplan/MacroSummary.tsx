import type { Macros } from '@arcadia/shared';
import { Card } from '@/components/ui';
import type { PlanTargets } from './planMath';

/** One number with its label; shows "/ target" when there is one. */
function Stat({ label, value, target }: { label: string; value: number; target?: number }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted">{label}</p>
      <p className="truncate text-sm font-semibold tabular-nums">
        {Math.round(value)}
        {target !== undefined && (
          <span className="font-normal text-muted"> / {Math.round(target)}</span>
        )}{' '}
        g
      </p>
    </div>
  );
}

/** Calories and macros for "a day of this plan" — the average planned day in
 * the week view, the selected day's totals in the day view. Same card for
 * both so the left column doesn't change shape when the view switches. */
export function MacroSummary({
  title,
  note,
  macros,
  targets,
  className = '',
}: {
  title: string;
  /** Small right-aligned remark, e.g. "5 of 7 days planned". */
  note?: string;
  macros: Macros;
  targets: PlanTargets;
  className?: string;
}) {
  const kcal = Math.round(macros.kcal);
  const over = targets ? macros.kcal > targets.kcal : false;
  const pct = targets ? Math.min(100, Math.round((macros.kcal / targets.kcal) * 100)) : 0;

  return (
    <Card className={`space-y-3 p-4 ${className}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {note && <p className="text-xs text-muted">{note}</p>}
      </div>

      <div>
        <p className="flex items-baseline gap-1.5 tabular-nums">
          <span
            className={`font-display text-3xl leading-none font-bold tracking-tight ${
              over ? 'text-rose-500' : ''
            }`}
          >
            {kcal.toLocaleString()}
          </span>
          <span className="text-sm text-muted">
            {targets ? `/ ${Math.round(targets.kcal).toLocaleString()} kcal` : 'kcal'}
          </span>
        </p>
        {/* The bar only means something against a target; rose = over it. */}
        {targets && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-elev">
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${
                over ? 'bg-rose-500' : 'bg-linear-to-r from-accent to-accent-2'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Protein" value={macros.proteinG} target={targets?.proteinG} />
        <Stat label="Carbs" value={macros.carbsG} />
        <Stat label="Fat" value={macros.fatG} />
      </div>
    </Card>
  );
}
