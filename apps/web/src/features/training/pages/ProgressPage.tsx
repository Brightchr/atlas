import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Award, CalendarCheck, Dumbbell, TrendingUp, UtensilsCrossed } from 'lucide-react';
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
import { useUnits } from '@/lib/units';
import { getSavedTargets } from '@/features/goals/repository';
import { nutritionDiscipline } from '@/features/nutrition/stats';
import {
  listSessionHistory,
  muscleSetsThisWeek,
  topLifts,
  weeklyTrainingStats,
  weightTrend,
} from '../stats';

const KG_TO_LB = 2.2046226218;

function Panel({ title, Icon, children }: { title: string; Icon: typeof Award; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Icon size={15} strokeWidth={1.8} aria-hidden />
        </span>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

const chartStyle = {
  grid: 'var(--color-line)',
  axis: 'var(--color-muted)',
  accent: 'var(--color-accent)',
};

/** Progress: the data the app has been logging all along, finally visible —
 * weekly training volume, muscle balance, top lifts, and weight trend. */
export function ProgressPage() {
  const units = useUnits();
  const weekly = useQuery({ queryKey: ['stats', 'weekly'], queryFn: () => weeklyTrainingStats(8) });
  const muscles = useQuery({ queryKey: ['stats', 'muscles'], queryFn: muscleSetsThisWeek });
  const lifts = useQuery({ queryKey: ['stats', 'lifts'], queryFn: () => topLifts(5) });
  const weight = useQuery({ queryKey: ['stats', 'weight'], queryFn: () => weightTrend(90) });
  const history = useQuery({ queryKey: ['stats', 'history'], queryFn: () => listSessionHistory(30) });
  const eating = useQuery({
    queryKey: ['stats', 'nutrition-discipline'],
    queryFn: async () => nutritionDiscipline(14, (await getSavedTargets())?.kcal ?? null),
  });

  const toDisplay = (kg: number) =>
    units === 'imperial' ? Math.round(kg * KG_TO_LB) : Math.round(kg);
  const unitLabel = units === 'imperial' ? 'lb' : 'kg';

  const weeklyData = (weekly.data ?? []).map((w) => ({ ...w, volume: toDisplay(w.volumeKg) }));
  const weightData = (weight.data ?? []).map((w) => ({
    ...w,
    weight: units === 'imperial' ? Math.round(w.weightKg * KG_TO_LB * 10) / 10 : w.weightKg,
  }));

  const hasAnyTraining = (history.data ?? []).length > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-bold">Progress</h1>
        <p className="text-sm text-muted">
          Every set you log builds this page — volume, balance, records, and trend lines.
        </p>
      </header>

      {!hasAnyTraining && history.isSuccess && (
        <p className="rounded-2xl border border-line bg-surface p-6 text-center text-sm text-muted">
          Finish your first workout and your charts start here.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={`Weekly volume (${unitLabel} lifted)`} Icon={TrendingUp}>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                <CartesianGrid stroke={chartStyle.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" stroke={chartStyle.axis} fontSize={11} tickLine={false} />
                <YAxis stroke={chartStyle.axis} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(value) => [`${Number(value).toLocaleString()} ${unitLabel}`, 'Volume']}
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
            <ul className="space-y-2">
              {(muscles.data ?? []).slice(0, 8).map((m) => {
                const max = muscles.data![0]!.sets;
                return (
                  <li key={m.muscle} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 truncate text-xs font-medium">{m.muscle}</span>
                    <span className="h-2.5 grow overflow-hidden rounded-full bg-elev">
                      <span
                        className="block h-full rounded-full bg-linear-to-r from-accent to-accent-2"
                        style={{ width: `${Math.max(8, (m.sets / max) * 100)}%` }}
                      />
                    </span>
                    <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted">
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
                <li key={l.exerciseName} className="flex items-center gap-3 py-2">
                  <span className="w-5 text-center text-xs font-bold text-accent">{i + 1}</span>
                  <Link
                    to={`/exercises/${l.exerciseId}`}
                    className="grow truncate text-sm font-medium hover:text-accent hover:underline"
                  >
                    {l.exerciseName}
                  </Link>
                  <span className="text-sm font-semibold tabular-nums">
                    {toDisplay(l.estimatedOneRepMaxKg)} {unitLabel}
                  </span>
                  <span className="text-xs tabular-nums text-muted">
                    best {toDisplay(l.bestWeightKg)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={`Body weight (${unitLabel})`} Icon={TrendingUp}>
          {weightData.length < 2 ? (
            <p className="py-8 text-center text-sm text-muted">
              Log your weight on the Goals page a few days in a row to see the trend.
            </p>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weightData} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke={chartStyle.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" stroke={chartStyle.axis} fontSize={11} tickLine={false} />
                  <YAxis
                    stroke={chartStyle.axis}
                    fontSize={11}
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
                className={`rounded-full px-3 py-1.5 text-xs font-semibold tabular-nums ${
                  eating.data.daysOverTarget > 3
                    ? 'bg-rose-500/15 text-rose-500'
                    : 'bg-elev'
                }`}
              >
                {eating.data.daysOverTarget} day{eating.data.daysOverTarget === 1 ? '' : 's'} over
                calorie target
              </span>
            )}
            <span
              className={`rounded-full px-3 py-1.5 text-xs font-semibold tabular-nums ${
                eating.data.unplannedTotal > 4 ? 'bg-amber-500/15 text-amber-600' : 'bg-elev'
              }`}
            >
              {eating.data.unplannedTotal} unplanned extra{eating.data.unplannedTotal === 1 ? '' : 's'}
            </span>
            <span className="rounded-full bg-elev px-3 py-1.5 text-xs font-semibold tabular-nums">
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
          <p className="mt-2 text-xs text-muted">
            {eating.data.targetKcal !== null
              ? `Bars vs your ${eating.data.targetKcal.toLocaleString()} kcal target — rose = over target, amber = had unplanned extras.`
              : 'Set daily targets on the Goals page to see over-target days here.'}
          </p>
        </Panel>
      )}

      <Panel title="Workout history" Icon={CalendarCheck}>
        {(history.data ?? []).length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">No finished workouts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted">
                  <th className="pb-2 font-semibold">Workout</th>
                  <th className="pb-2 font-semibold">Date</th>
                  <th className="pb-2 text-right font-semibold">Sets</th>
                  <th className="pb-2 text-right font-semibold">Volume</th>
                  <th className="pb-2 text-right font-semibold">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(history.data ?? []).map((s) => (
                  <tr key={s.id}>
                    <td className="py-2 font-medium">
                      <Link
                        to={`/you/history/${s.id}`}
                        className="hover:text-accent hover:underline"
                      >
                        {s.workoutName}
                      </Link>
                    </td>
                    <td className="py-2 text-muted">
                      {new Date(s.startedAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="py-2 text-right tabular-nums">{s.setCount}</td>
                    <td className="py-2 text-right tabular-nums">
                      {toDisplay(s.volumeKg).toLocaleString()} {unitLabel}
                    </td>
                    <td className="py-2 text-right tabular-nums text-muted">
                      {s.durationMin ? `${s.durationMin} min` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
