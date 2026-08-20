import type { MealPlanItem, MealType } from '@arcadia/shared';
import { getDb, newId, persist } from '@/lib/db';
import { addNeededItem } from '@/features/shopping/repository';
import { getFoodsByIds, logFood } from './repository';
import { listRecipes } from './recipes';

/** The weekly meal plan: one implicit plan, slots keyed by day (0 = Monday)
 * and meal. Entries are plain foods (grams) or recipes (servings). The plan
 * drives two things: one-tap diary logging and shopping-list generation. */

interface ItemRow {
  id: string;
  day_of_week: number;
  meal: MealType;
  kind: 'food' | 'recipe';
  ref_id: string;
  name: string;
  grams: number | null;
  servings: number | null;
}

function toItem(r: ItemRow): MealPlanItem {
  return {
    id: r.id,
    dayOfWeek: r.day_of_week,
    meal: r.meal,
    kind: r.kind,
    refId: r.ref_id,
    name: r.name,
    grams: r.grams,
    servings: r.servings,
  };
}

/** Planned calories per meal for one weekday — what the diary compares the
 * day's reality against ("I had an extra snack" becomes visible). Meals with
 * nothing planned are absent from the map. */
export async function plannedKcalByMeal(
  dayOfWeek: number,
): Promise<Partial<Record<MealType, number>>> {
  const items = (await listMealPlanItems()).filter((i) => i.dayOfWeek === dayOfWeek);
  if (items.length === 0) return {};
  const foods = await getFoodsByIds(items.filter((i) => i.kind === 'food').map((i) => i.refId));
  const recipes = await listRecipes();
  const byMeal: Partial<Record<MealType, number>> = {};
  for (const item of items) {
    let kcal = 0;
    if (item.kind === 'food') {
      const food = foods.get(item.refId);
      if (food && item.grams) kcal = (food.per100g.kcal * item.grams) / 100;
    } else {
      const recipe = recipes.find((r) => r.id === item.refId);
      if (recipe) kcal = recipe.perServing.kcal * (item.servings ?? 1);
    }
    byMeal[item.meal] = (byMeal[item.meal] ?? 0) + kcal;
  }
  for (const meal of Object.keys(byMeal) as MealType[]) {
    byMeal[meal] = Math.round(byMeal[meal]!);
  }
  return byMeal;
}

export async function listMealPlanItems(): Promise<MealPlanItem[]> {
  const db = await getDb();
  const rows = (await db.query('SELECT * FROM meal_plan_items ORDER BY day_of_week, meal'))
    .values as ItemRow[];
  return rows.map(toItem);
}

export async function addMealPlanItem(item: Omit<MealPlanItem, 'id'>): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO meal_plan_items (id, day_of_week, meal, kind, ref_id, name, grams, servings)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [newId(), item.dayOfWeek, item.meal, item.kind, item.refId, item.name, item.grams, item.servings],
  );
  await persist();
}

export async function removeMealPlanItem(id: string): Promise<void> {
  const db = await getDb();
  await db.run('DELETE FROM meal_plan_items WHERE id = ?', [id]);
  await persist();
}

/** Log every entry of one planned day into the diary for `date` — the "eat
 * what the plan says" shortcut. Recipes expand to their ingredients so the
 * diary stays accurate. */
export async function logPlanDayToDiary(dayOfWeek: number, date: string): Promise<void> {
  const items = (await listMealPlanItems()).filter((i) => i.dayOfWeek === dayOfWeek);
  const recipes = await listRecipes();
  const foods = await getFoodsByIds(
    items.filter((i) => i.kind === 'food').map((i) => i.refId),
  );

  for (const item of items) {
    if (item.kind === 'food') {
      const food = foods.get(item.refId);
      if (food && item.grams) {
        await logFood({ date, meal: item.meal, food, grams: item.grams });
      }
      continue;
    }
    const recipe = recipes.find((r) => r.id === item.refId);
    if (!recipe) continue;
    const factor = (item.servings ?? 1) / Math.max(1, recipe.servings);
    const ingredientFoods = await getFoodsByIds(recipe.ingredients.map((i) => i.foodId));
    for (const ingredient of recipe.ingredients) {
      const food = ingredientFoods.get(ingredient.foodId);
      if (!food) continue;
      await logFood({
        date,
        meal: item.meal,
        food,
        grams: +(ingredient.grams * factor).toFixed(1),
      });
    }
  }
}

/** Aggregate the whole week's plan into shopping items — recipes expand to
 * ingredients, grams sum per food name — and merge them onto the needed list. */
export async function addPlanWeekToShoppingList(): Promise<number> {
  const items = await listMealPlanItems();
  const recipes = await listRecipes();

  const gramsByName = new Map<string, number>();
  const bump = (name: string, grams: number) =>
    gramsByName.set(name, (gramsByName.get(name) ?? 0) + grams);

  for (const item of items) {
    if (item.kind === 'food') {
      if (item.grams) bump(item.name, item.grams);
      continue;
    }
    const recipe = recipes.find((r) => r.id === item.refId);
    if (!recipe) continue;
    const factor = (item.servings ?? 1) / Math.max(1, recipe.servings);
    for (const ingredient of recipe.ingredients) {
      bump(ingredient.foodName, ingredient.grams * factor);
    }
  }

  for (const [name, grams] of gramsByName) {
    await addNeededItem(name, `${Math.round(grams)} g`);
  }
  return gramsByName.size;
}
