import { useQuery } from '@tanstack/react-query';
import { Beef, Droplet, Flame, Wheat } from 'lucide-react';
import { getDiaryForDate } from '../repository';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/* Macro colors are fixed across themes: calories=orange, protein=rose,
   carbs=amber, fat=sky. Opacity tints work on light and dark surfaces. */
const tiles = [
  { key: 'kcal', label: 'Calories', unit: '', Icon: Flame, tint: 'bg-orange-500/15 text-orange-500' },
  { key: 'proteinG', label: 'Protein', unit: 'g', Icon: Beef, tint: 'bg-rose-500/15 text-rose-500' },
  { key: 'carbsG', label: 'Carbs', unit: 'g', Icon: Wheat, tint: 'bg-amber-500/15 text-amber-500' },
  { key: 'fatG', label: 'Fat', unit: 'g', Icon: Droplet, tint: 'bg-sky-500/15 text-sky-500' },
] as const;

export function NutritionPage() {
  const date = todayIso();
  const diaryQuery = useQuery({
    queryKey: ['diary', date],
    queryFn: () => getDiaryForDate(date),
  });

  const totals = (diaryQuery.data ?? []).reduce(
    (acc, e) => ({
      kcal: acc.kcal + e.macros.kcal,
      proteinG: acc.proteinG + e.macros.proteinG,
      carbsG: acc.carbsG + e.macros.carbsG,
      fatG: acc.fatG + e.macros.fatG,
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-bold">Nutrition</h1>
        <p className="text-sm text-muted">Today’s calories and macros.</p>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(({ key, label, unit, Icon, tint }) => (
          <div
            key={key}
            className="flex items-center justify-between rounded-2xl border border-line bg-surface p-4 shadow-sm"
          >
            <div>
              <p className="font-display text-2xl font-bold tracking-tight tabular-nums">
                {Math.round(totals[key])}
                {unit && <span className="text-base font-semibold text-muted"> {unit}</span>}
              </p>
              <p className="mt-0.5 text-sm text-muted">{label}</p>
            </div>
            <span className={`flex h-11 w-11 items-center justify-center rounded-full ${tint}`}>
              <Icon size={20} strokeWidth={1.8} aria-hidden />
            </span>
          </div>
        ))}
      </section>

      {diaryQuery.data?.length === 0 && (
        <p className="text-muted">
          Nothing logged today. Food logging UI lands here next — the storage layer (foods, diary,
          macros) is already in place.
        </p>
      )}

      <ul className="space-y-2">
        {diaryQuery.data?.map((entry) => (
          <li
            key={entry.id}
            className="flex items-center justify-between rounded-2xl border border-line bg-surface p-4 shadow-sm"
          >
            <div>
              <p className="font-semibold">{entry.foodName}</p>
              <p className="text-sm text-muted capitalize">
                {entry.meal} · {entry.grams} g
              </p>
            </div>
            <p className="font-semibold tabular-nums">{entry.macros.kcal} kcal</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
