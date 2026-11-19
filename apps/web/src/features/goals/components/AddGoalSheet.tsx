import { useState } from 'react';
import {
  BicepsFlexed,
  CalendarCheck,
  ChevronRight,
  Drumstick,
  Flame,
  Repeat,
  Scale,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { GoalType } from '@arcadia/shared';
import { Button, Sheet, Stepper } from '@/components/ui';
import { useExerciseCatalog } from '@/features/exercises/api';
import { displayWeight, parseWeight, useUnits, weightUnit } from '@/lib/units';
import { useCreateGoal } from '../api';
import { fieldClasses } from './Field';

interface GoalTemplate {
  type: GoalType;
  label: string;
  hint: string;
  Icon: LucideIcon;
  unit: string;
  defaultTarget: number;
  /** How much one tap of the stepper's plus or minus changes the target. */
  step: number;
  needsMuscle?: boolean;
}

/* Goal templates modeled on what leading fitness apps offer. */
const templates: GoalTemplate[] = [
  {
    type: 'weight_target',
    label: 'Reach a target weight',
    hint: 'Track body weight toward a goal',
    Icon: Scale,
    unit: 'kg',
    defaultTarget: 75,
    step: 0.5,
  },
  {
    type: 'workout_frequency',
    label: 'Train weekly',
    hint: 'Hit a number of workouts each week',
    Icon: CalendarCheck,
    unit: 'days/week',
    defaultTarget: 3,
    step: 1,
  },
  {
    type: 'streak',
    label: 'Build a streak',
    hint: 'Train several days in a row',
    Icon: Repeat,
    unit: 'days',
    defaultTarget: 7,
    step: 1,
  },
  {
    type: 'muscle_focus',
    label: 'Grow a muscle',
    hint: 'Prioritize a muscle in suggestions',
    Icon: BicepsFlexed,
    unit: 'sets/week',
    defaultTarget: 10,
    step: 1,
    needsMuscle: true,
  },
  {
    type: 'calorie_target',
    label: 'Daily calorie budget',
    hint: 'Stay at or under a kcal target',
    Icon: Flame,
    unit: 'kcal',
    defaultTarget: 2000,
    step: 50,
  },
  {
    type: 'protein_target',
    label: 'Daily protein',
    hint: 'Hit your protein every day',
    Icon: Drumstick,
    unit: 'g',
    defaultTarget: 120,
    step: 5,
  },
];

/** Adding a goal, as a two-step sheet: pick a kind, then set its target. It
 * used to be six always-open cards on the page; a sheet keeps the page about
 * the goals you already have. */
export function AddGoalSheet({ onClose }: { onClose: () => void }) {
  const catalog = useExerciseCatalog();
  const createGoal = useCreateGoal();
  const units = useUnits();

  // null = step one (the list of kinds); a template = step two (its target).
  const [template, setTemplate] = useState<GoalTemplate | null>(null);
  const [target, setTarget] = useState('');
  const [muscleId, setMuscleId] = useState('');

  // Every primary muscle in the catalog, de-duplicated and sorted, for the
  // "Grow a muscle" picker.
  const muscles = (() => {
    const map = new Map<number, string>();
    for (const e of catalog.data ?? [])
      for (const m of e.primaryMuscles) map.set(m.id, m.commonName);
    return [...map]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  })();

  // Weight targets are typed in the preferred unit but stored in kg.
  const defaultFor = (t: GoalTemplate) =>
    t.type === 'weight_target' ? displayWeight(t.defaultTarget, units) : t.defaultTarget;

  const pick = (t: GoalTemplate) => {
    setTemplate(t);
    // Start from a sensible number, so plus and minus are useful right away.
    setTarget(String(defaultFor(t)));
    setMuscleId('');
  };

  const handleCreate = (t: GoalTemplate) => {
    // An emptied field falls back to the suggested default.
    const typed = Number(target) || defaultFor(t);
    const numericTarget = t.type === 'weight_target' ? parseWeight(typed, units) : typed;
    const muscle = muscles.find((m) => m.id === Number(muscleId));
    if (t.needsMuscle && !muscle) return;
    createGoal.mutate({
      type: t.type,
      title: t.needsMuscle ? `Grow ${muscle!.name}` : t.label,
      target: numericTarget,
      muscleId: muscle?.id,
      muscleName: muscle?.name,
    });
    onClose();
  };

  if (!template) {
    return (
      <Sheet title="Add a goal" onClose={onClose}>
        <ul className="-mx-2">
          {templates.map((t) => (
            <li key={t.type}>
              <button
                type="button"
                onClick={() => pick(t)}
                className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-elev"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <t.Icon size={18} strokeWidth={1.9} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{t.label}</span>
                  <span className="block text-xs text-muted">{t.hint}</span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    );
  }

  const unit = template.type === 'weight_target' ? weightUnit(units) : template.unit;
  return (
    <Sheet
      title={template.label}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" size="lg" onClick={() => setTemplate(null)}>
            Back
          </Button>
          <Button
            size="lg"
            className="flex-1"
            onClick={() => handleCreate(template)}
            disabled={template.needsMuscle && !muscleId}
          >
            Set goal
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">{template.hint}</p>
        {template.needsMuscle && (
          <select
            value={muscleId}
            onChange={(e) => setMuscleId(e.target.value)}
            aria-label="Muscle"
            className={fieldClasses}
          >
            <option value="">Pick a muscle…</option>
            {muscles.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        )}
        {/* Stepper sizes itself with flex-1, so it needs a flex parent. */}
        <div className="flex">
          <Stepper
            label={`Target (${unit})`}
            value={target}
            onChange={setTarget}
            step={template.step}
            decimals={template.type === 'weight_target'}
            placeholder={String(defaultFor(template))}
          />
        </div>
      </div>
    </Sheet>
  );
}
