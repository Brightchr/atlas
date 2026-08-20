import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  displayHeight,
  displayWeight,
  formatWeight,
  cmToFtIn,
  ftInToCm,
  heightUnit,
  parseHeight,
  parseWeight,
  useUnits,
  weightUnit,
} from '@/lib/units';
import { getProfile, getWeightHistory, saveProfile, saveTargets, upsertTargetGoal } from '../repository';
import { bmi, computeTargets, type DietType, type Profile, type Sex } from '../targets';

const DEFAULT_PROFILE: Profile = {
  sex: 'male',
  age: 30,
  heightCm: 178,
  activity: 1.375,
  dietType: 'balanced',
  weeklyRateKg: -0.5,
};

const selectClasses =
  'w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent';

/** Labeled form field — keeps the profile grid scannable instead of a run of
 * anonymous inputs. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

/** Profile → computed daily targets (Mifflin-St Jeor → TDEE → diet split).
 * Applying stores the targets for the Nutrition page and upserts the calorie
 * and protein goals so everything tracks against the same numbers. */
export function PlanCard() {
  const queryClient = useQueryClient();
  const units = useUnits();
  const profileQuery = useQuery({ queryKey: ['profile'], queryFn: getProfile });
  const weightQuery = useQuery({ queryKey: ['weight'], queryFn: () => getWeightHistory(1) });

  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [weight, setWeight] = useState('');
  useEffect(() => {
    if (profileQuery.data) setProfile(profileQuery.data);
  }, [profileQuery.data]);

  // Typed weight is in the preferred unit; stored history is kg.
  const latestWeight =
    (Number(weight) ? parseWeight(Number(weight), units) : 0) ||
    weightQuery.data?.[0]?.weightKg ||
    0;
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
    <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
          <ClipboardCheck size={17} strokeWidth={1.8} aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold">Your plan</p>
          <p className="text-xs text-muted">
            We compute recommended daily targets from your profile (Mifflin-St Jeor → activity →
            diet style) and track everything against them.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        <Field label="Sex">
          <select value={profile.sex} onChange={(e) => set('sex', e.target.value as Sex)} className={selectClasses}>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </Field>
        <Field label="Age (yrs)">
          <input
            type="number"
            min="13"
            max="100"
            value={profile.age}
            onChange={(e) => set('age', Number(e.target.value))}
            className={selectClasses}
          />
        </Field>
        {units === 'imperial' ? (
          <Field label="Height (ft / in)">
            <div className="flex gap-1.5">
              <input
                type="number"
                min="3"
                max="8"
                aria-label="Height feet"
                value={cmToFtIn(profile.heightCm).feet}
                onChange={(e) =>
                  set('heightCm', ftInToCm(Number(e.target.value), cmToFtIn(profile.heightCm).inches))
                }
                className={selectClasses}
              />
              <input
                type="number"
                min="0"
                max="11"
                aria-label="Height inches"
                value={cmToFtIn(profile.heightCm).inches}
                onChange={(e) =>
                  set('heightCm', ftInToCm(cmToFtIn(profile.heightCm).feet, Number(e.target.value)))
                }
                className={selectClasses}
              />
            </div>
          </Field>
        ) : (
          <Field label={`Height (${heightUnit(units)})`}>
            <input
              type="number"
              value={displayHeight(profile.heightCm, units)}
              onChange={(e) => set('heightCm', parseHeight(Number(e.target.value), units))}
              className={selectClasses}
            />
          </Field>
        )}
        <Field label={`Weight (${weightUnit(units)})`}>
          <input
            type="number"
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder={
              weightQuery.data?.[0]
                ? `${displayWeight(weightQuery.data[0].weightKg, units)}`
                : 'weight'
            }
            className={selectClasses}
          />
        </Field>
        <Field label="Activity">
          <select value={profile.activity} onChange={(e) => set('activity', Number(e.target.value))} className={selectClasses}>
            <option value={1.2}>Sedentary</option>
            <option value={1.375}>Lightly active</option>
            <option value={1.55}>Moderately active</option>
            <option value={1.725}>Very active</option>
          </select>
        </Field>
        <Field label="Diet style">
          <select value={profile.dietType} onChange={(e) => set('dietType', e.target.value as DietType)} className={selectClasses}>
            <option value="balanced">Balanced</option>
            <option value="low_carb">Low carb</option>
            <option value="keto">Keto</option>
            <option value="high_protein">High protein</option>
          </select>
        </Field>
        <Field label="Weekly goal">
          <select value={profile.weeklyRateKg} onChange={(e) => set('weeklyRateKg', Number(e.target.value))} className={selectClasses}>
            <option value={-1}>Lose {formatWeight(1, units)}/week</option>
            <option value={-0.5}>Lose {formatWeight(0.5, units)}/week</option>
            <option value={0}>Maintain</option>
            <option value={0.25}>Gain {formatWeight(0.25, units)}/week</option>
            <option value={0.5}>Gain {formatWeight(0.5, units)}/week</option>
          </select>
        </Field>
      </div>

      {targets ? (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-xl bg-elev p-3 text-sm sm:grid-cols-4">
            <p><span className="font-semibold tabular-nums">{targets.kcal}</span> <span className="text-muted">kcal/day</span></p>
            <p><span className="font-semibold tabular-nums">{targets.proteinG} g</span> <span className="text-muted">protein</span></p>
            <p><span className="font-semibold tabular-nums">{targets.carbsG} g</span> <span className="text-muted">carbs</span></p>
            <p><span className="font-semibold tabular-nums">{targets.fatG} g</span> <span className="text-muted">fat</span></p>
            <p><span className="font-semibold tabular-nums">≤{targets.sugarMaxG} g</span> <span className="text-muted">sugar</span></p>
            <p><span className="font-semibold tabular-nums">{targets.fiberG} g</span> <span className="text-muted">fiber</span></p>
            <p><span className="font-semibold tabular-nums">≤2300 mg</span> <span className="text-muted">sodium</span></p>
            <p><span className="font-semibold tabular-nums">{bmi(latestWeight, profile.heightCm)}</span> <span className="text-muted">BMI</span></p>
          </div>
          <p className="text-xs text-muted">
            BMR {targets.bmr} kcal · maintenance {targets.tdee} kcal. General guidance, not medical
            advice.
          </p>
          <button
            type="button"
            disabled={apply.isPending}
            onClick={() => apply.mutate()}
            className="rounded-xl bg-linear-to-r from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Use as my daily targets
          </button>
          {apply.isSuccess && <span className="ml-2 text-sm text-accent">Applied ✓</span>}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">Enter your weight to see recommended targets.</p>
      )}
    </section>
  );
}
