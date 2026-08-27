import type { Food, Macros, MealType, Recipe } from '@arcadia/shared';
import { getDb, newId, persist } from '@/lib/db';
import { getFoodsByIds, importFood, logFood, scaleMacros } from './repository';

/** Recipes = named food groups ("sandwich"): ingredients with gram amounts,
 * loggable to the diary as one unit and usable as meal-plan entries. */

export interface RecipeDetails extends Recipe {
  /** Macros for the whole recipe (all servings). */
  totals: Macros;
  /** Macros for a single serving. */
  perServing: Macros;
}

function addMacros(acc: Macros, m: Macros): Macros {
  return {
    kcal: acc.kcal + m.kcal,
    proteinG: +(acc.proteinG + m.proteinG).toFixed(1),
    carbsG: +(acc.carbsG + m.carbsG).toFixed(1),
    fatG: +(acc.fatG + m.fatG).toFixed(1),
  };
}

const ZERO: Macros = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };

function divideMacros(m: Macros, by: number): Macros {
  const d = Math.max(1, by);
  return {
    kcal: Math.round(m.kcal / d),
    proteinG: +(m.proteinG / d).toFixed(1),
    carbsG: +(m.carbsG / d).toFixed(1),
    fatG: +(m.fatG / d).toFixed(1),
  };
}

export async function listRecipes(): Promise<RecipeDetails[]> {
  const db = await getDb();
  const recipes = (await db.query('SELECT * FROM recipes ORDER BY name')).values as {
    id: string;
    name: string;
    instructions: string | null;
    servings: number;
  }[];
  const ingredients = (await db.query('SELECT * FROM recipe_ingredients')).values as {
    id: string;
    recipe_id: string;
    food_id: string;
    food_name: string;
    grams: number;
  }[];
  const foods = await getFoodsByIds([...new Set(ingredients.map((i) => i.food_id))]);

  return recipes.map((r) => {
    const own = ingredients.filter((i) => i.recipe_id === r.id);
    const totals = own.reduce((acc, i) => {
      const food = foods.get(i.food_id);
      return food ? addMacros(acc, scaleMacros(food.per100g, i.grams)) : acc;
    }, ZERO);
    return {
      id: r.id,
      name: r.name,
      instructions: r.instructions,
      servings: r.servings,
      ingredients: own.map((i) => ({
        id: i.id,
        recipeId: i.recipe_id,
        foodId: i.food_id,
        foodName: i.food_name,
        grams: i.grams,
      })),
      totals,
      perServing: divideMacros(totals, r.servings),
    };
  });
}

export async function createRecipe(name: string, servings: number): Promise<string> {
  const db = await getDb();
  const id = newId();
  await db.run('INSERT INTO recipes (id, name, instructions, servings) VALUES (?, ?, NULL, ?)', [
    id,
    name,
    Math.max(1, Math.round(servings)),
  ]);
  await persist();
  return id;
}

export async function setRecipeInstructions(id: string, instructions: string): Promise<void> {
  const db = await getDb();
  await db.run('UPDATE recipes SET instructions = ? WHERE id = ?', [
    instructions.trim() || null,
    id,
  ]);
  await persist();
}

export async function deleteRecipe(id: string): Promise<void> {
  const db = await getDb();
  await db.run('DELETE FROM recipes WHERE id = ?', [id]);
  await persist();
}

export async function addIngredient(recipeId: string, food: Food, grams: number): Promise<void> {
  const db = await getDb();
  await db.run(
    'INSERT INTO recipe_ingredients (id, recipe_id, food_id, food_name, grams) VALUES (?, ?, ?, ?, ?)',
    [newId(), recipeId, food.id, food.name, grams],
  );
  await persist();
}

export async function removeIngredient(id: string): Promise<void> {
  const db = await getDb();
  await db.run('DELETE FROM recipe_ingredients WHERE id = ?', [id]);
  await persist();
}

/** Materialize a bundled catalog recipe as a local recipe (idempotent by
 * name); ingredient foods import barcode/name-deduped. Returns the local id. */
export async function importRecipeFromCatalog(entry: {
  name: string;
  servings: number;
  instructions: string | null;
  ingredients: { grams: number; food: Omit<Food, 'id'> }[];
}): Promise<string> {
  const db = await getDb();
  const existing = (await db.query('SELECT id FROM recipes WHERE name = ? LIMIT 1', [entry.name]))
    .values as { id: string }[];
  if (existing[0]) return existing[0].id;

  const id = newId();
  await db.run('INSERT INTO recipes (id, name, instructions, servings) VALUES (?, ?, ?, ?)', [
    id,
    entry.name,
    entry.instructions,
    entry.servings,
  ]);
  for (const ingredient of entry.ingredients) {
    const food = await importFood(ingredient.food);
    await db.run(
      'INSERT INTO recipe_ingredients (id, recipe_id, food_id, food_name, grams) VALUES (?, ?, ?, ?, ?)',
      [newId(), id, food.id, food.name, ingredient.grams],
    );
  }
  await persist();
  return id;
}

/** Log N servings of a recipe: each ingredient goes into the diary scaled by
 * servings / recipe.servings, so the diary stays ingredient-accurate. */
export async function logRecipeToDiary(
  recipe: Recipe,
  args: { date: string; meal: MealType; servings: number },
): Promise<void> {
  const foods = await getFoodsByIds(recipe.ingredients.map((i) => i.foodId));
  const factor = args.servings / Math.max(1, recipe.servings);
  for (const ingredient of recipe.ingredients) {
    const food = foods.get(ingredient.foodId);
    if (!food) continue;
    await logFood({
      date: args.date,
      meal: args.meal,
      food,
      grams: +(ingredient.grams * factor).toFixed(1),
    });
  }
}
