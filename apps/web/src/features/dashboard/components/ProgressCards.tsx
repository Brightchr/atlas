import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Scale, Target, TrendingUp } from 'lucide-react';
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
import { useExerciseCatalog } from '@/features/exercises/api';
import { useGoalProgress } from '@/features/goals/api';
import { weeklyTrainingStats, weightTrend } from '@/features/training/stats';
import { useUnits } from '@/lib/units';

const KG_TO_LB = 2.2046226218;

const chartStyle = {
  grid: 'var(--color-line)',
  axis: 'var(--color-muted)',
  accent: 'var(--color-accent)',
};

/** The compact card frame the dashboard's progress widgets share: icon +
 * title row with a drill-down link, content below. */
function CardFrame({
  title,
  Icon,
  to,
  toLabel,
  children,
}: {
  title: string;
  Icon: LucideIcon;
  to: string;
  toLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="h-full rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Icon size={15} strokeWidth={1.8} aria-hidden />
          </span>
          <h2 className="text-sm font-semibold">{title}</h2>
        </div>
        <Link to={to} className="text-xs font-medium text-accent hover:underline">
          {toLabel}
        </Link>
      </div>
      {children}
    </section>
  );
}

/** Weekly training volume — the interactive version of the old sparkline. */
export function VolumeCard() {
  const units = useUnits();
  const weekly = useQuery({ queryKey: ['stats', 'weekly'], queryFn: () => weeklyTrainingStats(8) });
  const unitLabel = units === 'imperial' ? 'lb' : 'kg';
  const data = (weekly.data ?? []).map((w) => ({
    ...w,
    volume: units === 'imperial' ? Math.round(w.volumeKg * KG_TO_LB) : Math.round(w.volumeKg),
  }));

  return (
    <CardFrame title={`Weekly volume (${unitLabel})`} Icon={TrendingUp} to="/you" toLabel="All charts →">
      {data.every((w) => w.volume === 0) ? (
        <p className="py-10 text-center text-sm text-muted">
          Finish a workout and your volume chart starts here.
        </p>
      ) : (
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
              <CartesianGrid stroke={chartStyle.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" stroke={chartStyle.axis} fontSize={11} tickLine={false} />
              <YAxis stroke={chartStyle.axis} fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                formatter={(value: unknown) => [
                  `${Number(value).toLocaleString()} ${unitLabel}`,
                  'Volume',
                ]}
                labelFormatter={(l: unknown) => `Week of ${String(l)}`}
              />
              <Bar dataKey="volume" fill={chartStyle.accent} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </CardFrame>
  );
}

/** Body-weight trend over the last 90 days. */
export function WeightCard() {
  const units = useUnits();
  const weight = useQuery({ queryKey: ['stats', 'weight'], queryFn: () => weightTrend(90) });
  const unitLabel = units === 'imperial' ? 'lb' : 'kg';
  const data = (weight.data ?? []).map((w) => ({
    ...w,
    weight: units === 'imperial' ? Math.round(w.weightKg * KG_TO_LB * 10) / 10 : w.weightKg,
  }));

  return (
    <CardFrame title={`Body weight (${unitLabel})`} Icon={Scale} to="/you/goals" toLabel="Log weight →">
      {data.length < 2 ? (
        <p className="py-10 text-center text-sm text-muted">
          Weigh in a few mornings a week to see your trend line here.
        </p>
      ) : (
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
              <CartesianGrid stroke={chartStyle.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" stroke={chartStyle.axis} fontSize={11} tickLine={false} />
              <YAxis
                stroke={chartStyle.axis}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                domain={['dataMin - 1', 'dataMax + 1']}
              />
              <Tooltip
                formatter={(value: unknown) => [`${String(value)} ${unitLabel}`, 'Weight']}
              />
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
    </CardFrame>
  );
}

/** The top active goals with their progress bars — the Goals page distilled. */
export function GoalsCard() {
  const catalog = useExerciseCatalog();
  const progress = useGoalProgress(catalog.data);
  const goals = (progress.data ?? []).slice(0, 4);

  return (
    <CardFrame title="Goals" Icon={Target} to="/you/goals" toLabel="Manage →">
      {goals.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">
          No goals yet — set one and your progress shows up here.
        </p>
      ) : (
        <ul className="space-y-3">
          {goals.map(({ goal, fraction, label }) => (
            <li key={goal.id}>
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-sm font-medium">{goal.title}</p>
                <span className="shrink-0 text-xs font-bold text-accent tabular-nums">
                  {Math.round(fraction * 100)}%
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-elev">
                <div
                  className="h-full rounded-full bg-linear-to-r from-accent to-accent-2 transition-[width] duration-500"
                  style={{ width: `${Math.round(fraction * 100)}%` }}
                />
              </div>
              <p className="mt-0.5 text-xs text-muted tabular-nums">{label}</p>
            </li>
          ))}
        </ul>
      )}
    </CardFrame>
  );
}
