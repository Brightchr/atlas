/** Recommended daily nutrition targets — the standard model used by major
 * tracking apps (MyFitnessPal, Lose It, MacroFactor):
 *
 *   1. BMR via Mifflin-St Jeor (the equation clinical dietetics uses):
 *        men:   10·kg + 6.25·cm − 5·age + 5
 *        women: 10·kg + 6.25·cm − 5·age − 161
 *   2. TDEE = BMR × activity multiplier (1.2 sedentary … 1.725 very active)
 *   3. Goal adjustment: ~7700 kcal per kg of body weight, spread over the week
 *      (−0.5 kg/week ≈ −550 kcal/day). Never below BMR (safety floor).
 *   4. Protein by body weight (g/kg — the evidence-based anchor), carbs as a
 *      % of calories set by the diet style, fat fills the remainder.
 *   5. Micro guidance: sugar < 10% of calories (WHO), fiber 14 g / 1000 kcal
 *      (USDA), sodium < 2.3 g (FDA).
 *
 * Pure function — unit-test target. */

export type Sex = 'male' | 'female';
export type DietType = 'balanced' | 'low_carb' | 'keto' | 'high_protein';

export interface Profile {
  sex: Sex;
  age: number;
  heightCm: number;
  /** 1.2 sedentary · 1.375 light · 1.55 moderate · 1.725 very active */
  activity: number;
  dietType: DietType;
  /** kg per week: negative = lose (e.g. -0.5), 0 = maintain, positive = gain */
  weeklyRateKg: number;
}

export interface DailyTargets {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sugarMaxG: number;
  fiberG: number;
  sodiumMaxG: number;
  bmr: number;
  tdee: number;
}

const DIET_SPLITS: Record<DietType, { carbsPct: number; proteinPerKg: number }> = {
  balanced: { carbsPct: 0.45, proteinPerKg: 1.8 },
  low_carb: { carbsPct: 0.2, proteinPerKg: 2.0 },
  keto: { carbsPct: 0.05, proteinPerKg: 2.0 },
  high_protein: { carbsPct: 0.35, proteinPerKg: 2.4 },
};

export function computeTargets(profile: Profile, weightKg: number): DailyTargets {
  const bmr =
    10 * weightKg +
    6.25 * profile.heightCm -
    5 * profile.age +
    (profile.sex === 'male' ? 5 : -161);
  const tdee = bmr * profile.activity;
  // 1 kg body weight ≈ 7700 kcal; clamp so a cut never goes below BMR.
  const kcal = Math.round(Math.max(bmr, tdee + (profile.weeklyRateKg * 7700) / 7));

  const split = DIET_SPLITS[profile.dietType];
  const proteinG = Math.round(split.proteinPerKg * weightKg);
  const carbsG = Math.round((kcal * split.carbsPct) / 4);
  const fatKcal = kcal - proteinG * 4 - carbsG * 4;
  const fatG = Math.round(Math.max(30, fatKcal / 9)); // never below essential-fat floor

  return {
    kcal,
    proteinG,
    carbsG,
    fatG,
    sugarMaxG: Math.round((kcal * 0.1) / 4),
    fiberG: Math.round((kcal / 1000) * 14),
    sodiumMaxG: 2.3,
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
  };
}

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return +(weightKg / (m * m)).toFixed(1);
}
