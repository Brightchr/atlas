import type { MealType } from './nutrition';

/** A weekly training plan mapping days to workouts. */
export interface TrainingPlan {
  id: string;
  name: string;
  description: string | null;
  source: 'user' | 'provided';
  /** 0 = Monday … 6 = Sunday */
  days: TrainingPlanDay[];
}

export interface TrainingPlanDay {
  dayOfWeek: number;
  workoutId: string | null;
  isRestDay: boolean;
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
