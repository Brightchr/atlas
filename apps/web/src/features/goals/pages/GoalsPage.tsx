import { useState } from 'react';
import {
  BicepsFlexed,
  CalendarCheck,
  Drumstick,
  Flame,
  Repeat,
  Scale,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { GoalType } from '@arcadia/shared';
import { useExerciseCatalog } from '@/features/exercises/api';
import { useArchiveGoal, useCreateGoal, useGoalProgress, useLogWeight } from '../api';
import { PlanCard } from '../components/PlanCard';

/* Goal templates modeled on what leading fitness apps offer. */
const templates: {
  type: GoalType;
  label: string;
  hint: string;
  Icon: LucideIcon;
  unit: string;
  defaultTarget: number;
  needsMuscle?: boolean;
}[] = [
  { type: 'weight_target', label: 'Reach a target weight', hint: 'Track body weight toward a goal', Icon: Scale, unit: 'kg', defaultTarget: 75 },
  { type: 'workout_frequency', label: 'Train weekly', hint: 'Hit a number of workouts each week', Icon: CalendarCheck, unit: 'days/week', defaultTarget: 3 },
  { type: 'streak', label: 'Build a streak', hint: 'Train several days in a row', Icon: Repeat, unit: 'days', defaultTarget: 7 },
  { type: 'muscle_focus', label: 'Grow a muscle', hint: 'Prioritize a muscle in suggestions', Icon: BicepsFlexed, unit: 'sets/week', defaultTarget: 10, needsMuscle: true },
  { type: 'calorie_target', label: 'Daily calorie budget', hint: 'Stay at or under a kcal target', Icon: Flame, unit: 'kcal', defaultTarget: 2000 },
  { type: 'protein_target', label: 'Daily protein', hint: 'Hit your protein every day', Icon: Drumstick, unit: 'g', defaultTarget: 120 },
];

export function GoalsPage() {
  const catalog = useExerciseCatalog();
  const progress = useGoalProgress(catalog.data);
  const createGoal = useCreateGoal();
  const archiveGoal = useArchiveGoal();
  const logWeight = useLogWeight();

  const [openTemplate, setOpenTemplate] = useState<GoalType | null>(null);
  const [target, setTarget] = useState('');
  const [muscleId, setMuscleId] = useState('');
  const [weight, setWeight] = useState('');

  const muscles = (() => {
    const map = new Map<number, string>();
    for (const e of catalog.data ?? []) for (const m of e.primaryMuscles) map.set(m.id, m.commonName);
    return [...map].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  })();

  const hasWeightGoal = progress.data?.some((p) => p.goal.type === 'weight_target') ?? false;

  const handleCreate = (template: (typeof templates)[number]) => {
    const numericTarget = Number(target) || template.defaultTarget;
    const muscle = muscles.find((m) => m.id === Number(muscleId));
    if (template.needsMuscle && !muscle) return;
    createGoal.mutate({
      type: template.type,
      title: template.needsMuscle ? `Grow ${muscle!.name}` : template.label,
      target: numericTarget,
      muscleId: muscle?.id,
      muscleName: muscle?.name,
    });
    setOpenTemplate(null);
    setTarget('');
    setMuscleId('');
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-bold">Goals</h1>
        <p className="text-sm text-muted">
          Set targets — exercise suggestions adapt to what you're chasing.
        </p>
      </header>

      <PlanCard />

      {progress.data?.length === 0 && (
        <p className="text-muted">No goals yet — pick one below to get started.</p>
      )}

      <ul className="space-y-2">
        {progress.data?.map(({ goal, fraction, label }) => (
          <li key={goal.id} className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">{goal.title}</p>
              <button
                type="button"
                onClick={() => archiveGoal.mutate(goal.id)}
                aria-label={`Archive ${goal.title}`}
                className="rounded-lg p-1.5 text-muted transition-colors hover:bg-elev hover:text-ink"
              >
                <X size={15} aria-hidden />
              </button>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-elev">
              <div
                className="h-full rounded-full bg-linear-to-r from-accent to-accent-2 transition-[width] duration-500"
                style={{ width: `${Math.round(fraction * 100)}%` }}
              />
            </div>
            <p className="mt-1.5 text-sm text-muted tabular-nums">{label}</p>
          </li>
        ))}
      </ul>

      {hasWeightGoal && (
        <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface p-3 shadow-sm">
          <Scale size={17} className="shrink-0 text-muted" aria-hidden />
          <input
            type="number"
            step="0.1"
            min="20"
            max="400"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="Today's weight (kg)"
            className="w-44 rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none placeholder:text-muted/70 focus:border-accent"
          />
          <button
            type="button"
            disabled={!Number(weight)}
            onClick={() => {
              logWeight.mutate(Number(weight));
              setWeight('');
            }}
            className="rounded-xl bg-linear-to-r from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Log weight
          </button>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Add a goal</h2>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <li key={template.type}>
              <div className="h-full rounded-2xl border border-line bg-surface p-4 shadow-sm">
                <button
                  type="button"
                  onClick={() =>
                    setOpenTemplate(openTemplate === template.type ? null : template.type)
                  }
                  className="flex w-full items-center gap-3 text-left"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                    <template.Icon size={17} strokeWidth={1.8} aria-hidden />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{template.label}</span>
                    <span className="block text-xs text-muted">{template.hint}</span>
                  </span>
                </button>
                {openTemplate === template.type && (
                  <div className="mt-3 space-y-2">
                    {template.needsMuscle && (
                      <select
                        value={muscleId}
                        onChange={(e) => setMuscleId(e.target.value)}
                        className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
                      >
                        <option value="">Pick a muscle…</option>
                        {muscles.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    )}
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={target}
                        onChange={(e) => setTarget(e.target.value)}
                        placeholder={`${template.defaultTarget} ${template.unit}`}
                        className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none placeholder:text-muted/70 focus:border-accent"
                      />
                      <button
                        type="button"
                        onClick={() => handleCreate(template)}
                        disabled={template.needsMuscle && !muscleId}
                        className="shrink-0 rounded-xl bg-linear-to-r from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        Set
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
