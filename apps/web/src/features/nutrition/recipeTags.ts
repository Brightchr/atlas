import type { MealType } from '@arcadia/shared';
import { MEAL_PLAN_TEMPLATES } from './mealPlanCatalog';

/** Structured signals mined from the recipe catalog: the style tags embedded
 * in every description ("High protein · Quick · …") and which meal a recipe
 * usually plays in a plan. Both power browsing — category shelves, filters,
 * and slot-aware suggestions — without touching the data model. */

export const RECIPE_TAGS = [
  'High protein',
  'Low carb',
  'High fiber',
  'Weight loss',
  'Weight gain',
  'Vegetarian',
  'Quick',
] as const;

export type RecipeTag = (typeof RECIPE_TAGS)[number];

/** The known style tags present in a catalog description. */
export function parseRecipeTags(description: string): RecipeTag[] {
  return RECIPE_TAGS.filter((tag) => description.includes(tag));
}

/** The human sentence at the front of a catalog description, without the
 * tag list and macro summary that follow it. */
export function descriptionBlurb(description: string): string {
  const end = description.indexOf('.');
  return end === -1 ? description : description.slice(0, end + 1);
}

/* ---------------------------- Meal affinity ----------------------------- */

/** Which meal each catalog recipe usually fills, learned from where the 21
 * starter templates place it (majority vote across all pools and days). */
let templateAffinity: Map<string, MealType> | null = null;

function affinityFromTemplates(): Map<string, MealType> {
  if (templateAffinity) return templateAffinity;
  const votes = new Map<string, Partial<Record<MealType, number>>>();
  const add = (name: string, meal: MealType) => {
    const v = votes.get(name.toLowerCase()) ?? {};
    v[meal] = (v[meal] ?? 0) + 1;
    votes.set(name.toLowerCase(), v);
  };
  for (const t of MEAL_PLAN_TEMPLATES) {
    if (t.days) {
      for (const day of t.days) {
        for (const meal of Object.keys(day) as MealType[]) {
          for (const slot of day[meal]) add(slot.recipe, meal);
        }
      }
    } else {
      for (const meal of Object.keys(t.pools) as MealType[]) {
        for (const slot of t.pools[meal]) add(slot.recipe, meal);
      }
    }
  }
  templateAffinity = new Map(
    [...votes.entries()].map(([name, v]) => {
      const [meal] = (Object.entries(v) as [MealType, number][]).sort((a, b) => b[1] - a[1])[0]!;
      return [name, meal];
    }),
  );
  return templateAffinity;
}

const AFFINITY_KEYWORDS: [MealType, string[]][] = [
  ['breakfast', ['breakfast', 'omelet', 'scramble', 'egg', 'oat', 'toast', 'smoothie', 'pancake']],
  ['snack', ['snack', 'shake', 'bark', 'bites', 'mix', 'pack', 'plate']],
  ['lunch', ['salad', 'wrap', 'sandwich', 'slaw', 'soup', 'bowl', 'quesadilla']],
  ['dinner', []],
];

/** Best-guess meal for a recipe name: template placement first, then name
 * keywords, defaulting to dinner (mains dominate the uncovered tail). */
export function mealAffinity(name: string): MealType {
  const fromTemplates = affinityFromTemplates().get(name.toLowerCase());
  if (fromTemplates) return fromTemplates;
  const lower = name.toLowerCase();
  for (const [meal, words] of AFFINITY_KEYWORDS) {
    if (words.some((w) => lower.includes(w))) return meal;
  }
  return 'dinner';
}
