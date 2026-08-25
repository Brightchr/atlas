/** Per-100g (or per-serving) nutrient profile. */
export interface Macros {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
  sugarG?: number;
  saturatedFatG?: number;
  /** Grams of sodium (not salt). */
  sodiumG?: number;
}

/** A food item: user-created, or imported from an external source (Open Food
 * Facts / USDA). Imports are SNAPSHOTS — once picked, the data lives locally. */
export interface Food {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  source: 'user' | 'usda' | 'off' | 'fatsecret';
  /** Nutrients per 100 g */
  per100g: Macros;
  /** Product photo (external URL) when the source provides one. */
  imageUrl: string | null;
  /** Optional default serving, e.g. 1 slice = 32 g */
  servingName: string | null;
  servingGrams: number | null;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/** One logged food entry in the calorie diary. */
export interface DiaryEntry {
  id: string;
  /** ISO date (yyyy-mm-dd) the entry belongs to */
  date: string;
  meal: MealType;
  foodId: string;
  foodName: string;
  /** Product photo of the underlying food, when available. */
  imageUrl: string | null;
  grams: number;
  macros: Macros;
  loggedAt: string;
}

/** Daily targets used by the tracker to show remaining budget. */
export interface NutritionGoals {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}
