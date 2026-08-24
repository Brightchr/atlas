import type { MealType } from './nutrition';

export type PlanVisibility = 'private' | 'friends' | 'public';

/** A weekly training plan mapping days to workouts. */
export interface TrainingPlan {
  id: string;
  name: string;
  description: string | null;
  source: 'user' | 'provided';
  visibility: PlanVisibility;
  /** Pinned to this device: excluded from training sync (per-device flag). */
  localOnly: boolean;
  /** 0 = Monday … 6 = Sunday */
  days: TrainingPlanDay[];
}

export interface TrainingPlanDay {
  dayOfWeek: number;
  workoutId: string | null;
  isRestDay: boolean;
}

/** Wire format for sharing a plan: the full plan travels as one payload with
 * workout definitions embedded, so importing needs no other server state. */
export interface SharedPlanWorkout {
  name: string;
  exercises: {
    exerciseId: number;
    exerciseName: string;
    position: number;
    targetSets: number;
    targetReps: number | null;
    targetDurationSec: number | null;
    restSec: number | null;
  }[];
}

export interface SharedPlanDay {
  dayOfWeek: number;
  isRestDay: boolean;
  workout: SharedPlanWorkout | null;
}

export interface SharedPlanPayload {
  name: string;
  description: string;
  days: SharedPlanDay[];
}

export type PlanDifficulty = 'beginner' | 'intermediate' | 'advanced';
export type PlanGoal = 'build_muscle' | 'lose_weight' | 'get_stronger' | 'general';
export type PlanDiet = 'high_protein' | 'calorie_deficit' | 'balanced' | 'performance';

export interface SharedPlanSummary {
  id: string;
  name: string;
  description: string;
  visibility: PlanVisibility;
  difficulty: PlanDifficulty;
  goal: PlanGoal;
  diet: PlanDiet | null;
  owner: string;
  mine: boolean;
  /** True when this plan was sent directly to the caller. */
  sharedToMe: boolean;
  /** Average rating (1 decimal), or null before the first review. */
  rating: number | null;
  reviewCount: number;
  updatedAt: string;
}

export interface PlanReview {
  id: string;
  rating: number;
  comment: string;
  author: string;
  mine: boolean;
  updatedAt: string;
}

/** A diet plan: recipes/meals assigned to days. Shopping lists are derived from this. */
export interface DietPlan {
  id: string;
  name: string;
  description: string | null;
  source: 'user' | 'provided';
  meals: DietPlanMeal[];
}

export interface DietPlanMeal {
  id: string;
  dayOfWeek: number;
  meal: MealType;
  recipeId: string;
  recipeName: string;
}

export interface Recipe {
  id: string;
  name: string;
  instructions: string | null;
  servings: number;
  ingredients: RecipeIngredient[];
}

/** One entry in a weekly meal-plan slot (day × meal). Either a plain food
 * measured in grams, or a recipe measured in servings. */
export interface MealPlanItem {
  id: string;
  /** 0 = Monday … 6 = Sunday */
  dayOfWeek: number;
  meal: MealType;
  kind: 'food' | 'recipe';
  /** Food.id or Recipe.id depending on kind. */
  refId: string;
  name: string;
  grams: number | null;
  servings: number | null;
}

export interface RecipeIngredient {
  id: string;
  recipeId: string;
  foodId: string;
  foodName: string;
  grams: number;
}
