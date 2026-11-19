import { Cookie, Moon, Sun, Sunrise, type LucideIcon } from 'lucide-react';
import type { Food, MealType } from '@arcadia/shared';
import type { FoodSnapshot } from '@/lib/off/client';

/** Small shared pieces of the diary: the meal list, and the rules for turning
 * "an amount in servings or grams" into the grams the diary stores. */

export const MEALS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export const MEAL_ICON: Record<MealType, LucideIcon> = {
  breakfast: Sunrise,
  lunch: Sun,
  dinner: Moon,
  snack: Cookie,
};

/** "breakfast" -> "Breakfast" (CSS `capitalize` can't reach aria-labels). */
export const mealLabel = (meal: MealType): string => meal[0]!.toUpperCase() + meal.slice(1);

/** The meal someone is most likely logging right now, by local clock:
 * before 10:30 breakfast, before 15:00 lunch, before 21:00 dinner, else snack. */
export function mealForTime(now: Date = new Date()): MealType {
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes < 10 * 60 + 30) return 'breakfast';
  if (minutes < 15 * 60) return 'lunch';
  if (minutes < 21 * 60) return 'dinner';
  return 'snack';
}

/** A search result (not saved yet) or a food from the local library. */
export type FoodLike = FoodSnapshot | Food;

export type AmountUnit = 'serving' | 'g';

export interface Amount {
  value: number;
  unit: AmountUnit;
}

/** The amount a food is pre-filled with.
 * - Logged before: the same amount as last time. The diary only stores grams,
 *   so it is shown as servings when it divides into clean quarter-servings
 *   (64 g of a 32 g serving -> "2 servings") and as grams otherwise.
 * - Never logged: 1 serving when the product declares one, else 100 g. */
export function defaultAmount(servingGrams: number | null, lastGrams?: number): Amount {
  if (lastGrams !== undefined && lastGrams > 0) {
    if (servingGrams) {
      const servings = lastGrams / servingGrams;
      const quarters = Math.round(servings * 4) / 4;
      if (quarters > 0 && Math.abs(servings - quarters) < 0.01) {
        return { value: quarters, unit: 'serving' };
      }
    }
    return { value: lastGrams, unit: 'g' };
  }
  return servingGrams ? { value: 1, unit: 'serving' } : { value: 100, unit: 'g' };
}

/** Grams for an amount, rounded to 0.1 g like every other diary write. */
export function amountToGrams(amount: Amount, servingGrams: number | null): number {
  const grams =
    amount.unit === 'serving' && servingGrams ? amount.value * servingGrams : amount.value;
  return Math.round(grams * 10) / 10;
}

/** "2 servings", "0.5 serving", "150 g". */
export function formatAmount(amount: Amount): string {
  if (amount.unit === 'g') return `${amount.value} g`;
  return `${amount.value} serving${amount.value === 1 ? '' : 's'}`;
}

/** Where a result came from, as the small tag on its row. */
export function sourceTag(food: FoodLike): string {
  if ('id' in food) return 'saved';
  switch (food.source) {
    case 'curated':
      return 'Atlas';
    case 'fatsecret':
      return 'fatsecret';
    case 'usda':
      return 'USDA';
    default:
      return 'Open Food Facts';
  }
}
