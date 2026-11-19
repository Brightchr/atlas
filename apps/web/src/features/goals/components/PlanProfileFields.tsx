import {
  cmToFtIn,
  displayHeight,
  formatWeight,
  ftInToCm,
  heightUnit,
  parseHeight,
  weightUnit,
  type UnitSystem,
} from '@/lib/units';
import type { DietType, Profile, Sex } from '../targets';
import { Field, fieldClasses } from './Field';

/** Small heading over a group of fields. */
function GroupLabel({ children }: { children: string }) {
  return <p className="text-xs font-semibold tracking-wide text-muted uppercase">{children}</p>;
}

/** The inputs of the daily-targets calculator, in two groups: who you are
 * (feeds the BMR formula) and what you are aiming for (activity, diet style,
 * weekly rate). Holds no state of its own; PlanCard owns the profile. */
export function PlanProfileFields({
  profile,
  onChange,
  weight,
  onWeightChange,
  weightPlaceholder,
  units,
}: {
  profile: Profile;
  onChange: <K extends keyof Profile>(key: K, value: Profile[K]) => void;
  /** Typed weight, in the user's unit. Empty means "use my last weigh-in". */
  weight: string;
  onWeightChange: (next: string) => void;
  weightPlaceholder: string;
  units: UnitSystem;
}) {
  const height = cmToFtIn(profile.heightCm);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <GroupLabel>About you</GroupLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Sex">
            <select
              value={profile.sex}
              onChange={(e) => onChange('sex', e.target.value as Sex)}
              className={fieldClasses}
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </Field>
          <Field label="Age (yrs)">
            <input
              type="number"
              inputMode="numeric"
              min="13"
              max="100"
              value={profile.age}
              onChange={(e) => onChange('age', Number(e.target.value))}
              className={fieldClasses}
            />
          </Field>
          {units === 'imperial' ? (
            // Two inputs under one caption, so this is a group rather than a
            // <label> (a label can only name a single control).
            <div role="group" aria-label="Height" className="min-w-0">
              <span className="mb-1 block text-xs font-medium text-muted">Height (ft / in)</span>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  inputMode="numeric"
                  min="3"
                  max="8"
                  aria-label="Height feet"
                  value={height.feet}
                  onChange={(e) =>
                    onChange('heightCm', ftInToCm(Number(e.target.value), height.inches))
                  }
                  className={fieldClasses}
                />
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="11"
                  aria-label="Height inches"
                  value={height.inches}
                  onChange={(e) =>
                    onChange('heightCm', ftInToCm(height.feet, Number(e.target.value)))
                  }
                  className={fieldClasses}
                />
              </div>
            </div>
          ) : (
            <Field label={`Height (${heightUnit(units)})`}>
              <input
                type="number"
                inputMode="decimal"
                value={displayHeight(profile.heightCm, units)}
                onChange={(e) => onChange('heightCm', parseHeight(Number(e.target.value), units))}
                className={fieldClasses}
              />
            </Field>
          )}
          <Field label={`Weight (${weightUnit(units)})`}>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={weight}
              onChange={(e) => onWeightChange(e.target.value)}
              placeholder={weightPlaceholder}
              className={fieldClasses}
            />
          </Field>
        </div>
      </div>

      <div className="space-y-2">
        <GroupLabel>Your aim</GroupLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Activity">
            <select
              value={profile.activity}
              onChange={(e) => onChange('activity', Number(e.target.value))}
              className={fieldClasses}
            >
              <option value={1.2}>Sedentary</option>
              <option value={1.375}>Lightly active</option>
              <option value={1.55}>Moderately active</option>
              <option value={1.725}>Very active</option>
            </select>
          </Field>
          <Field label="Diet style">
            <select
              value={profile.dietType}
              onChange={(e) => onChange('dietType', e.target.value as DietType)}
              className={fieldClasses}
            >
              <option value="balanced">Balanced</option>
              <option value="low_carb">Low carb</option>
              <option value="keto">Keto</option>
              <option value="high_protein">High protein</option>
            </select>
          </Field>
          {/* Three fields in a two-column phone grid: let the odd one out
              span the row instead of leaving a hole beside it. */}
          <div className="col-span-2 sm:col-span-1">
            <Field label="Weekly goal">
              <select
                value={profile.weeklyRateKg}
                onChange={(e) => onChange('weeklyRateKg', Number(e.target.value))}
                className={fieldClasses}
              >
                <option value={-1}>Lose {formatWeight(1, units)}/week</option>
                <option value={-0.5}>Lose {formatWeight(0.5, units)}/week</option>
                <option value={0}>Maintain</option>
                <option value={0.25}>Gain {formatWeight(0.25, units)}/week</option>
                <option value={0.5}>Gain {formatWeight(0.5, units)}/week</option>
              </select>
            </Field>
          </div>
        </div>
      </div>
    </div>
  );
}
