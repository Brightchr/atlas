import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, SlidersHorizontal } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { displayWeight, parseWeight, useUnits } from '@/lib/units';
import {
  getProfile,
  getSavedTargets,
  getWeightHistory,
  saveProfile,
  saveTargets,
  upsertTargetGoal,
} from '../repository';
import { bmi, computeTargets, type Profile } from '../targets';
import { CustomTargetsSheet } from './CustomTargetsSheet';
import { PlanProfileFields } from './PlanProfileFields';

const DEFAULT_PROFILE: Profile = {
  sex: 'male',
  age: 30,
  heightCm: 178,
  activity: 1.375,
  dietType: 'balanced',
  weeklyRateKg: -0.5,
};

/** One headline number of the result (calories and the three macros). */
function TargetTile({ value, unit, label }: { value: number; unit: string; label: string }) {
  return (
    <div className="rounded-xl bg-elev px-3 py-2">
      <p className="text-lg leading-tight font-bold tabular-nums">
        {value}
        <span className="ml-1 text-xs font-medium text-muted">{unit}</span>
      </p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

/** Profile → computed daily targets (Mifflin-St Jeor → TDEE → diet split).
 * Applying stores the targets for the Nutrition page and upserts the calorie
 * and protein goals so everything tracks against the same numbers.
 *
 * Read top to bottom it is: inputs, the resulting targets, then save. */
export function PlanCard() {
  const queryClient = useQueryClient();
  const units = useUnits();
  const profileQuery = useQuery({ queryKey: ['profile'], queryFn: getProfile });
  // Keyed under 'goals' so logging a weight on this page (which invalidates
  // ['goals']) refreshes the weight the calculation falls back to.
  const weightQuery = useQuery({
    queryKey: ['goals', 'weight-history', 1],
    queryFn: () => getWeightHistory(1),
  });
  const savedTargetsQuery = useQuery({ queryKey: ['targets'], queryFn: getSavedTargets });

  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [weight, setWeight] = useState('');
  useEffect(() => {
    if (profileQuery.data) setProfile(profileQuery.data);
  }, [profileQuery.data]);

  const [customizing, setCustomizing] = useState(false);
  const [customSaved, setCustomSaved] = useState(false);

  // Typed weight is in the preferred unit; stored history is kg.
  const lastLoggedKg = weightQuery.data?.[0]?.weightKg;
  const latestWeight =
    (Number(weight) ? parseWeight(Number(weight), units) : 0) || lastLoggedKg || 0;
  const targets = latestWeight > 0 ? computeTargets(profile, latestWeight) : null;

  const apply = useMutation({
    mutationFn: async () => {
      if (!targets) return;
      await saveProfile(profile);
      await saveTargets(targets);
      await upsertTargetGoal('calorie_target', 'Daily calorie budget', targets.kcal);
      await upsertTargetGoal('protein_target', 'Daily protein', targets.proteinG);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['goals'] });
      void queryClient.invalidateQueries({ queryKey: ['targets'] });
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    setProfile((p) => ({ ...p, [key]: value }));

  return (
    <Card className="space-y-4 p-4">
      <p className="text-sm text-muted">
        Recommended daily targets from your profile (Mifflin-St Jeor, then activity and diet style).
        Everything you log is tracked against them.
      </p>

      <PlanProfileFields
        profile={profile}
        onChange={set}
        weight={weight}
        onWeightChange={setWeight}
        weightPlaceholder={lastLoggedKg ? String(displayWeight(lastLoggedKg, units)) : 'weight'}
        units={units}
      />

      {targets ? (
        <div className="space-y-2 border-t border-line pt-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <TargetTile value={targets.kcal} unit="kcal" label="Calories / day" />
            <TargetTile value={targets.proteinG} unit="g" label="Protein" />
            <TargetTile value={targets.carbsG} unit="g" label="Carbs" />
            <TargetTile value={targets.fatG} unit="g" label="Fat" />
          </div>
          {/* Guidance rather than targets you chase, so it is a quiet line. */}
          <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {[
              ['Sugar', `≤${targets.sugarMaxG} g`],
              ['Fiber', `${targets.fiberG} g`],
              ['Sodium', '≤2300 mg'],
              ['BMI', String(bmi(latestWeight, profile.heightCm))],
            ].map(([label, value]) => (
              <div key={label} className="flex gap-1.5">
                <dt className="text-muted">{label}</dt>
                <dd className="font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted">
            BMR {targets.bmr} kcal · maintenance {targets.tdee} kcal. General guidance, not medical
            advice.
          </p>
        </div>
      ) : (
        <p className="border-t border-line pt-4 text-sm text-muted">
          Enter your weight to see recommended targets.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {targets && (
          // "soft", not the gradient: Log weight is this screen's one primary.
          <Button
            variant="soft"
            disabled={apply.isPending}
            onClick={() => {
              setCustomSaved(false);
              apply.mutate();
            }}
          >
            Use as my daily targets
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={() => {
            setCustomSaved(false);
            setCustomizing(true);
          }}
        >
          <SlidersHorizontal size={16} aria-hidden />
          Set custom targets
        </Button>
        {/* Whichever save happened last; they overwrite each other's numbers. */}
        {(customSaved || apply.isSuccess) && (
          <span className="flex items-center gap-1 text-sm text-accent" role="status">
            <Check size={16} aria-hidden />
            {customSaved ? 'Custom targets saved' : 'Applied'}
          </span>
        )}
      </div>

      {customizing && (
        <CustomTargetsSheet
          base={savedTargetsQuery.data ?? targets}
          onClose={() => setCustomizing(false)}
          onSaved={() => {
            setCustomizing(false);
            setCustomSaved(true);
          }}
        />
      )}
    </Card>
  );
}
