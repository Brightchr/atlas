import type { SharedRecipeIngredient } from '@arcadia/shared';
import catalogJson from './recipeCatalog.json';

/** The built-in recipe catalog: ~100 healthy recipes with full ingredient
 * snapshots, bundled with the app so meal-plan templates can materialize
 * offline. The same data seeds the community browser on the server. */
export interface CatalogRecipe {
  name: string;
  description: string;
  servings: number;
  instructions: string | null;
  ingredients: SharedRecipeIngredient[];
}

export const RECIPE_CATALOG = catalogJson as CatalogRecipe[];

const byName = new Map(RECIPE_CATALOG.map((r) => [r.name.toLowerCase(), r]));

export function catalogRecipe(name: string): CatalogRecipe | undefined {
  return byName.get(name.toLowerCase());
}

const kcalCache = new Map<string, number>();

/** Calories in one serving of a catalog recipe, from its ingredient snapshot. */
export function catalogKcalPerServing(entry: CatalogRecipe): number {
  const hit = kcalCache.get(entry.name);
  if (hit !== undefined) return hit;
  const total = entry.ingredients.reduce((s, i) => s + (i.food.per100g.kcal * i.grams) / 100, 0);
  const kcal = Math.round(total / Math.max(1, entry.servings));
  kcalCache.set(entry.name, kcal);
  return kcal;
}
