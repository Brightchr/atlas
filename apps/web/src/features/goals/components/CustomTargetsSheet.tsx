import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Sheet } from '@/components/ui';
import { saveTargets, upsertTargetGoal } from '../repository';
import type { DailyTargets } from '../targets';
import { Field, fieldClasses } from './Field';

const fields = [
  { key: 'kcal', label: 'Calories (kcal)', min: 800 },
  { key: 'proteinG', label: 'Protein (g)', min: 0 },
  { key: 'carbsG', label: 'Carbs (g)', min: 0 },
  { key: 'fatG', label: 'Fat (g)', min: 0 },
] as const;

/** Type your own daily numbers instead of taking the formula's: some people
 * run coach-given or personal targets, and the formula is a starting point,
 * never a cage.
 *
 * The sheet is only mounted while it is open, so useState's initial value is
 * enough to prefill the fields each time; no effect or reset is needed. */
export function CustomTargetsSheet({
  base,
  onClose,
  onSaved,
}: {
  /** What to start from: the saved targets, else the calculated ones. */
  base: DailyTargets | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const [custom, setCustom] = useState({
    kcal: base ? String(base.kcal) : '',
    proteinG: base ? String(base.proteinG) : '',
    carbsG: base ? String(base.carbsG) : '',
    fatG: base ? String(base.fatG) : '',
  });

  const valid =
    Number(custom.kcal) > 0 &&
    Number(custom.proteinG) >= 0 &&
    Number(custom.carbsG) >= 0 &&
    Number(custom.fatG) >= 0;

  const save = useMutation({
    mutationFn: async () => {
      const kcal = Math.round(Number(custom.kcal));
      const next: DailyTargets = {
        kcal,
        proteinG: Math.round(Number(custom.proteinG)),
        carbsG: Math.round(Number(custom.carbsG)),
        fatG: Math.round(Number(custom.fatG)),
        // Micro guidance stays formula-derived from the chosen calories.
        sugarMaxG: Math.round((kcal * 0.1) / 4),
        fiberG: Math.round((kcal / 1000) * 14),
        sodiumMaxG: 2.3,
        bmr: base?.bmr ?? 0,
        tdee: base?.tdee ?? 0,
      };
      await saveTargets(next);
      await upsertTargetGoal('calorie_target', 'Daily calorie budget', next.kcal);
      await upsertTargetGoal('protein_target', 'Daily protein', next.proteinG);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['goals'] });
      void queryClient.invalidateQueries({ queryKey: ['targets'] });
      onSaved();
    },
  });

  return (
    <Sheet
      title="Custom daily targets"
      onClose={onClose}
      footer={
        <Button size="lg" block disabled={!valid || save.isPending} onClick={() => save.mutate()}>
          Save custom targets
        </Button>
      }
    >
      <p className="text-sm text-muted">
        Yours beat the formula. Sugar and fiber guidance re-derive from your calories.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {fields.map(({ key, label, min }) => (
          <Field key={key} label={label}>
            <input
              type="number"
              inputMode="numeric"
              min={min}
              value={custom[key]}
              onChange={(e) => setCustom((c) => ({ ...c, [key]: e.target.value }))}
              className={fieldClasses}
            />
          </Field>
        ))}
      </div>
    </Sheet>
  );
}
