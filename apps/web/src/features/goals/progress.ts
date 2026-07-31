import type { BodyWeightLog, Goal, GoalProgress } from '@arcadia/shared';

/** Pure progress calculations — no I/O, fully unit-testable. All inputs are
 * plain data; callers fetch them from repositories. */

interface ProgressInputs {
  /** Distinct yyyy-mm-dd dates with a workout session, most recent first. */
  sessionDates: string[];
  weightHistory: BodyWeightLog[];
  todayKcal: number;
  todayProteinG: number;
  /** Sets performed per muscle id in the last 7 days. */
  weeklySetsPerMuscle: Map<number, number>;
  /** Renders a stored kg value in the user's preferred unit. Defaults to kg. */
  formatWeight?: (kg: number) => string;
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Consecutive training days ending today or yesterday (a streak survives
 * until a full rest day passes). */
export function currentStreak(sessionDates: string[]): number {
  const dates = new Set(sessionDates);
  let day = 0;
  if (!dates.has(isoDaysAgo(0)) && dates.has(isoDaysAgo(1))) day = 1;
  else if (!dates.has(isoDaysAgo(0))) return 0;
  let streak = 0;
  while (dates.has(isoDaysAgo(day + streak))) streak++;
  return streak;
}

export function goalProgress(goal: Goal, inputs: ProgressInputs): GoalProgress {
  switch (goal.type) {
    case 'workout_frequency': {
      const target = goal.target ?? 3;
      const thisWeek = inputs.sessionDates.filter((d) => d >= isoDaysAgo(6)).length;
      return {
        goal,
        fraction: Math.min(1, thisWeek / target),
        label: `${thisWeek} of ${target} workouts in the last 7 days`,
      };
    }
    case 'streak': {
      const target = goal.target ?? 7;
      const streak = currentStreak(inputs.sessionDates);
      return {
        goal,
        fraction: Math.min(1, streak / target),
        label: `${streak}-day streak — target ${target}`,
      };
    }
    case 'weight_target': {
      const target = goal.target ?? 0;
      const fmt = inputs.formatWeight ?? ((kg: number) => `${kg} kg`);
      const latest = inputs.weightHistory[0];
      const first = inputs.weightHistory[inputs.weightHistory.length - 1];
      if (!latest || !first) {
        return { goal, fraction: 0, label: 'Log your weight to start tracking' };
      }
      const total = Math.abs(first.weightKg - target);
      const done = Math.abs(first.weightKg - latest.weightKg);
      const movingRightWay =
        Math.sign(latest.weightKg - first.weightKg) === Math.sign(target - first.weightKg);
      return {
        goal,
        fraction: total === 0 ? 1 : Math.min(1, movingRightWay ? done / total : 0),
        label: `${fmt(latest.weightKg)} now — target ${fmt(target)}`,
      };
    }
    case 'muscle_focus': {
      // 10 hard sets/week is a common hypertrophy floor — treat it as the bar.
      const targetSets = goal.target ?? 10;
      const sets = goal.muscleId ? (inputs.weeklySetsPerMuscle.get(goal.muscleId) ?? 0) : 0;
      return {
        goal,
        fraction: Math.min(1, sets / targetSets),
        label: `${sets} of ${targetSets} ${goal.muscleName ?? ''} sets this week`,
      };
    }
    case 'calorie_target': {
      const target = goal.target ?? 2000;
      const kcal = Math.round(inputs.todayKcal);
      const over = kcal > target;
      return {
        goal,
        // The bar shows consumption of the budget: 654/1800 → 36% full.
        fraction: Math.min(1, kcal / target),
        label: over
          ? `${kcal} of ${target} kcal today — ${kcal - target} over budget`
          : `${kcal} of ${target} kcal today`,
      };
    }
    case 'protein_target': {
      const target = goal.target ?? 120;
      const protein = Math.round(inputs.todayProteinG);
      return {
        goal,
        fraction: Math.min(1, protein / target),
        label: `${protein} of ${target} g protein today`,
      };
    }
  }
}
