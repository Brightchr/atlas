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

const perServingCache = new Map<string, { kcal: number; proteinG: number }>();

/** Per-serving kcal and protein of a catalog recipe, from its ingredient
 * snapshot (memoized — the browser renders a hundred of these). */
export function catalogPerServing(entry: CatalogRecipe): { kcal: number; proteinG: number } {
  const hit = perServingCache.get(entry.name);
  if (hit) return hit;
  const servings = Math.max(1, entry.servings);
  const total = entry.ingredients.reduce(
    (acc, i) => ({
      kcal: acc.kcal + (i.food.per100g.kcal * i.grams) / 100,
      proteinG: acc.proteinG + (i.food.per100g.proteinG * i.grams) / 100,
    }),
    { kcal: 0, proteinG: 0 },
  );
  const per = {
    kcal: Math.round(total.kcal / servings),
    proteinG: Math.round(total.proteinG / servings),
  };
  perServingCache.set(entry.name, per);
  return per;
}

/** Calories in one serving of a catalog recipe. */
export function catalogKcalPerServing(entry: CatalogRecipe): number {
  return catalogPerServing(entry).kcal;
}
