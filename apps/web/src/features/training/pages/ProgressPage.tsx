import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Award,
  CalendarCheck,
  ChevronRight,
  Dumbbell,
  TrendingUp,
  UtensilsCrossed,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, PageHeader, buttonClasses } from '@/components/ui';
import { displayWeight, kgToLb, useUnits, weightUnit } from '@/lib/units';
import { getSavedTargets } from '@/features/goals/repository';
import { nutritionDiscipline } from '@/features/nutrition/stats';
import { GainsHero } from '../components/GainsHero';
import {
  listSessionHistory,
  muscleSetsThisWeek,
  topLifts,
  weeklyTrainingStats,
  weightTrend,
} from '../stats';

/** Axis labels for big totals: 105000 → "105k", so six digits fit the gutter. */
const compactNumber = (v: number): string =>
  Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v);

/** A titled card — every chart and list on this page sits in one. */
function Panel({
  title,
  Icon,
  children,
}: {
  title: string;
  Icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon size={18} className="shrink-0 text-accent" strokeWidth={1.8} aria-hidden />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </Card>
  );
}

// recharts draws SVG, so it takes colors as strings rather than classes; the
// CSS variables keep the charts on the active theme.
const chartStyle = {
  grid: 'var(--color-line)',
  axis: 'var(--color-muted)',
  accent: 'var(--color-accent)',
};
const tickSize = 12;

/** Progress: the data the app has been logging all along, finally visible —
 * weekly training volume, muscle balance, top lifts, and weight trend. */
export function ProgressPage() {
  const units = useUnits();
  const weekly = useQuery({ queryKey: ['stats', 'weekly'], queryFn: () => weeklyTrainingStats(8) });
  const muscles = useQuery({ queryKey: ['stats', 'muscles'], queryFn: muscleSetsThisWeek });
  const lifts = useQuery({ queryKey: ['stats', 'lifts'], queryFn: () => topLifts(5) });
  const weight = useQuery({ queryKey: ['stats', 'weight'], queryFn: () => weightTrend(90) });
  const history = useQuery({
    queryKey: ['stats', 'history'],
    queryFn: () => listSessionHistory(3),
  });
  const eating = useQuery({
    queryKey: ['stats', 'nutrition-discipline'],
    queryFn: async () => nutritionDiscipline(14, (await getSavedTargets())?.kcal ?? null),
  });

  // Lifted weights read best as whole numbers ("225 lb", not "224.9 lb").
  const toDisplay = (kg: number) => Math.round(units === 'imperial' ? kgToLb(kg) : kg);
  const unitLabel = weightUnit(units);

  const weeklyData = (weekly.data ?? []).map((w) => ({ ...w, volume: toDisplay(w.volumeKg) }));
  // Body weight keeps one decimal — half a pound matters there.
  const weightData = (weight.data ?? []).map((w) => ({
    ...w,
    weight: displayWeight(w.weightKg, units),
  }));

  const hasAnyTraining = (history.data ?? []).length > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <PageHeader title="Progress" />

      {!hasAnyTraining && history.isSuccess && (
        <Card className="p-6 text-center text-sm text-muted">
          Finish your first workout and your charts start here.
        </Card>
      )}

      <GainsHero />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={`Weekly volume (${unitLabel} lifted)`} Icon={TrendingUp}>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                <CartesianGrid stroke={chartStyle.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke={chartStyle.axis}
                  fontSize={tickSize}
                  tickLine={false}
                />
                <YAxis
                  stroke={chartStyle.axis}
                  fontSize={tickSize}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={compactNumber}
                />
                <Tooltip
                  formatter={(value) => [
                    `${Number(value).toLocaleString()} ${unitLabel}`,
                    'Volume',
                  ]}
                  labelFormatter={(l) => `Week of ${String(l)}`}
                />
                <Bar dataKey="volume" fill={chartStyle.accent} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Sets per muscle — last 7 days" Icon={Dumbbell}>
          {(muscles.data ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">No sets logged this week yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {(muscles.data ?? []).slice(0, 8).map((m) => {
                // Sorted most-trained first, so the first row sets the scale.
                const max = muscles.data![0]!.sets;
                return (
                  <li key={m.muscle} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 truncate text-sm font-medium">{m.muscle}</span>
                    <span className="h-2.5 grow overflow-hidden rounded-full bg-elev">
                      <span
                        className="block h-full rounded-full bg-linear-to-r from-accent to-accent-2"
                        style={{ width: `${Math.max(8, (m.sets / max) * 100)}%` }}
                      />
                    </span>
                    <span className="w-8 shrink-0 text-right text-sm text-muted tabular-nums">
                      {m.sets}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title={`Top lifts — estimated 1RM (${unitLabel})`} Icon={Award}>
          {(lifts.data ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              Log weighted sets to see your strongest lifts.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {(lifts.data ?? []).map((l, i) => (
                <li key={l.exerciseName}>
                  {/* The whole row opens the exercise, not just its name. */}
                  <Link
                    to={`/exercises/${l.exerciseId}`}
                    className="-mx-2 flex min-h-12 items-center gap-3 rounded-xl px-2 hover:bg-elev"
                  >
                    <span className="w-5 shrink-0 text-center text-sm font-bold text-accent">
                      {i + 1}
                    </span>
                    <span className="min-w-0 grow truncate text-sm font-medium">
                      {l.exerciseName}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-semibold tabular-nums">
                        {toDisplay(l.estimatedOneRepMaxKg)} {unitLabel}
                      </span>
                      <span className="block text-sm text-muted tabular-nums">
                        best {toDisplay(l.bestWeightKg)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={`Body weight (${unitLabel})`} Icon={TrendingUp}>
          {weightData.length < 2 ? (
            <p className="py-8 text-center text-sm text-muted">
              Log your weight under Goals a few days in a row to see the trend.
            </p>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weightData} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke={chartStyle.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke={chartStyle.axis}
                    fontSize={tickSize}
                    tickLine={false}
                  />
                  <YAxis
                    stroke={chartStyle.axis}
                    fontSize={tickSize}
                    tickLine={false}
                    axisLine={false}
                    domain={['dataMin - 1', 'dataMax + 1']}
                  />
                  <Tooltip formatter={(value) => [`${String(value)} ${unitLabel}`, 'Weight']} />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke={chartStyle.accent}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      {eating.data && eating.data.daysLogged > 0 && (
        <Panel title="Eating vs the plan — last 14 days" Icon={UtensilsCrossed}>
          <div className="mb-3 flex flex-wrap gap-2">
            {eating.data.targetKcal !== null && (
              <span
                className={`rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums ${
                  eating.data.daysOverTarget > 3 ? 'bg-rose-500/15 text-rose-500' : 'bg-elev'
                }`}
              >
                {eating.data.daysOverTarget} day{eating.data.daysOverTarget === 1 ? '' : 's'} over
                calorie target
              </span>
            )}
            <span
              className={`rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums ${
                eating.data.unplannedTotal > 4 ? 'bg-amber-500/15 text-amber-500' : 'bg-elev'
              }`}
            >
              {eating.data.unplannedTotal} unplanned extra
              {eating.data.unplannedTotal === 1 ? '' : 's'}
            </span>
            <span className="rounded-full bg-elev px-3 py-1.5 text-sm font-semibold tabular-nums">
              {eating.data.avgMeals} meals · {eating.data.avgSnacks} snacks / day
            </span>
          </div>
          <div className="flex h-24 items-end gap-1">
            {eating.data.days.map((day) => {
              const target = eating.data!.targetKcal;
              const max = Math.max(target ?? 0, ...eating.data!.days.map((d) => d.kcal), 1);
              return (
                <span
                  key={day.date}
                  title={`${day.label}: ${day.kcal} kcal${day.unplanned ? ` · ${day.unplanned} unplanned` : ''}`}
                  className={`grow rounded-t ${
                    day.kcal === 0
                      ? 'bg-elev'
                      : day.overTarget
                        ? 'bg-rose-400'
                        : day.unplanned > 0
                          ? 'bg-amber-400'
                          : 'bg-linear-to-t from-accent to-accent-2'
                  }`}
                  style={{ height: `${Math.max(6, (day.kcal / max) * 100)}%` }}
                />
              );
            })}
          </div>
          <p className="mt-2 text-sm text-muted">
            {eating.data.targetKcal !== null
              ? `Bars vs your ${eating.data.targetKcal.toLocaleString()} kcal target — rose = over target, amber = had unplanned extras.`
              : 'Set daily targets under Goals to see over-target days here.'}
          </p>
        </Panel>
      )}

      <Panel title="Recent workouts" Icon={CalendarCheck}>
        {(history.data ?? []).length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">No finished workouts yet.</p>
        ) : (
          <>
            {/* Rows instead of a table: a five-column table needs sideways
                scrolling on a phone, and its only link was the workout name. */}
            <ul className="divide-y divide-line">
              {(history.data ?? []).map((s) => (
                <li key={s.id}>
                  <Link
                    to={`/history/${s.id}`}
                    className="-mx-2 flex min-h-14 items-center gap-3 rounded-xl px-2 py-2 hover:bg-elev"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{s.workoutName}</span>
                      <span className="block truncate text-sm text-muted tabular-nums">
                        {[
                          new Date(s.startedAt).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                          }),
                          s.durationMin ? `${s.durationMin} min` : null,
                          `${s.setCount} set${s.setCount === 1 ? '' : 's'}`,
                          s.volumeKg > 0
                            ? `${toDisplay(s.volumeKg).toLocaleString()} ${unitLabel}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                    <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
            <Link to="/history" className={buttonClasses('secondary', 'md', 'mt-3 w-full')}>
              See all history
            </Link>
          </>
        )}
      </Panel>
    </div>
  );
}
