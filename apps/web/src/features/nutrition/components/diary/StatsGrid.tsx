import type { Macros } from '@arcadia/shared';

/** Full nutrient breakdown grid. `grams` scales from per-100g when given;
 * `caption` overrides the heading (for already-scaled values). */
export function StatsGrid({
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
    ['Calories', `${Math.round(per100g.kcal * f)} kcal`],
    ['Protein', fmt(per100g.proteinG, 'g')],
    ['Carbs', fmt(per100g.carbsG, 'g')],
    ['· of which sugar', fmt(per100g.sugarG, 'g')],
    ['Fat', fmt(per100g.fatG, 'g')],
    ['· of which saturated', fmt(per100g.saturatedFatG, 'g')],
    ['Fiber', fmt(per100g.fiberG, 'g')],
    [
      'Sodium',
      per100g.sodiumG === undefined ? '—' : `${(per100g.sodiumG * f * 1000).toFixed(0)} mg`,
    ],
  ];
  return (
    <div className="rounded-xl bg-elev p-3">
      <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
        Nutrition facts {caption ?? (grams === undefined ? 'per 100 g' : `for ${grams} g`)}
      </p>
      {/* One column on phones: two columns of label + value get too cramped. */}
      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
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
