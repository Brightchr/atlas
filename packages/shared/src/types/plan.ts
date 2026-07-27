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

export interface RecipeIngredient {
  id: string;
  recipeId: string;
  foodId: string;
  foodName: string;
  grams: number;
}
