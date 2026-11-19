import type { Food, Macros, MealPlanItem } from '@arcadia/shared';
import type { DailyTargets } from '@/features/goals/targets';
import type { RecipeDetails } from '../../recipes';
import { scaleMacros } from '../../repository';

/** Pure helpers for the meal plan screen: no React, no database. Everything
 * here takes the already-loaded plan items, foods and recipes and turns them
 * into numbers or labels, so the components only have to draw. */

/** Plan days are stored as 0 = Monday … 6 = Sunday. */
export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Only the two targets this screen compares against. */
export type PlanTargets = Pick<DailyTargets, 'kcal' | 'proteinG'> | null | undefined;

/** What the lookups need to price an item: foods by id, recipes as a list. */
export interface PlanLookup {
  foods: Map<string, Food>;
  recipes: RecipeDetails[];
}

const ZERO: Macros = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };

/** Macros of one planned item, or null when its food/recipe is gone (deleted
 * since it was planned) and there is nothing to calculate from. */
export function itemMacros(item: MealPlanItem, { foods, recipes }: PlanLookup): Macros | null {
  if (item.kind === 'food') {
    const food = foods.get(item.refId);
    return food && item.grams ? scaleMacros(food.per100g, item.grams) : null;
  }
  const recipe = recipes.find((r) => r.id === item.refId);
  if (!recipe) return null;
  const s = item.servings ?? 1;
  return {
    kcal: Math.round(recipe.perServing.kcal * s),
    proteinG: +(recipe.perServing.proteinG * s).toFixed(1),
    carbsG: +(recipe.perServing.carbsG * s).toFixed(1),
    fatG: +(recipe.perServing.fatG * s).toFixed(1),
  };
}

export function sumMacros(items: MealPlanItem[], lookup: PlanLookup): Macros {
  return items.reduce((acc, item) => {
    const m = itemMacros(item, lookup);
    return m
      ? {
          kcal: acc.kcal + m.kcal,
          proteinG: acc.proteinG + m.proteinG,
          carbsG: acc.carbsG + m.carbsG,
          fatG: acc.fatG + m.fatG,
        }
      : acc;
  }, ZERO);
}

/** "150 g" for a food, "2 servings" for a recipe. */
export function amountLabel(item: MealPlanItem): string {
  if (item.kind === 'food') return `${item.grams ?? 0} g`;
  const s = item.servings ?? 1;
  return `${s} serving${s === 1 ? '' : 's'}`;
}

export interface WeekSummary {
  /** How many of the 7 days have anything planned. */
  days: number;
  /** The average planned day (empty days are ignored, not counted as 0). */
  average: Macros;
  /** Totals for each day, index 0 = Monday. */
  perDay: Macros[];
}

export function summarizeWeek(items: MealPlanItem[], lookup: PlanLookup): WeekSummary | null {
  const perDay = DAYS.map((_, i) =>
    sumMacros(
      items.filter((it) => it.dayOfWeek === i),
      lookup,
    ),
  );
  const planned = perDay.filter((d) => d.kcal > 0);
  if (planned.length === 0) return null;
  const avg = (pick: (m: Macros) => number) =>
    Math.round(planned.reduce((s, d) => s + pick(d), 0) / planned.length);
  return {
    days: planned.length,
    average: {
      kcal: avg((m) => m.kcal),
      proteinG: avg((m) => m.proteinG),
      carbsG: avg((m) => m.carbsG),
      fatG: avg((m) => m.fatG),
    },
    perDay,
  };
}
