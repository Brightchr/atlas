/** Goal taxonomy modeled on what leading fitness apps offer:
 * - weight_target      reach a target body weight (MyFitnessPal-style)
 * - workout_frequency  train N days per week (consistency)
 * - streak             train N days in a row (habit building)
 * - muscle_focus       prioritize growing a specific muscle (drives suggestions)
 * - calorie_target     stay at/under daily calories
 * - protein_target     hit daily protein
 */
export type GoalType =
  | 'weight_target'
  | 'workout_frequency'
  | 'streak'
  | 'muscle_focus'
  | 'calorie_target'
  | 'protein_target';

export interface Goal {
  id: string;
  type: GoalType;
  title: string;
  /** Numeric target — kg, days/week, days, kcal or grams depending on type. */
  target: number | null;
  /** For muscle_focus goals: the wger muscle being prioritized. */
  muscleId: number | null;
  muscleName: string | null;
  createdAt: string;
  archived: boolean;
}

export interface BodyWeightLog {
  id: string;
  /** ISO date (yyyy-mm-dd) — one entry per day. */
  date: string;
  weightKg: number;
  loggedAt: string;
}

/** A goal with its computed progress, ready for display. */
export interface GoalProgress {
  goal: Goal;
  /** 0..1 fraction toward the target (clamped). */
  fraction: number;
  /** Human-readable state, e.g. "3 of 4 workouts this week". */
  label: string;
}
