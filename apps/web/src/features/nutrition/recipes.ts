import type { Food, Macros, MealType, Recipe } from '@arcadia/shared';
import { getDb, newId, persist } from '@/lib/db';
import { catalogRecipe } from './recipeCatalog';
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

/** Split stored instructions into display steps: authored steps are
 * newline-separated; legacy one-line instructions fall back to sentences. */
export function instructionSteps(text: string): string[] {
  const byLine = text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  if (byLine.length > 1) return byLine;
  return text
    .split(/(?<=\.)\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** When the bundled catalog's instructions improve, recipes imported from it
 * keep the old text — this one-time pass (per version, per device) refreshes
 * name-matching local recipes so everyone cooks from the current steps. */
const INSTRUCTIONS_VERSION = 2;
const INSTRUCTIONS_KEY = 'catalog_instructions_v';
let instructionsRefresh: Promise<void> | null = null;

function refreshCatalogInstructionsOnce(): Promise<void> {
  instructionsRefresh ??= (async () => {
    const db = await getDb();
    const rows = (await db.query('SELECT value FROM settings WHERE key = ?', [INSTRUCTIONS_KEY]))
      .values as { value: string }[];
    if (Number(rows[0]?.value) >= INSTRUCTIONS_VERSION) return;

    const recipes = (await db.query('SELECT id, name FROM recipes')).values as {
      id: string;
      name: string;
    }[];
    for (const r of recipes) {
      const entry = catalogRecipe(r.name);
      if (!entry?.instructions) continue;
      await db.run(
        `UPDATE recipes SET instructions = ?
         WHERE id = ? AND (instructions IS NULL OR instructions != ?)`,
        [entry.instructions, r.id, entry.instructions],
      );
    }
    await db.run(
      'INSERT INTO settings (id, key, value) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [INSTRUCTIONS_KEY, INSTRUCTIONS_KEY, String(INSTRUCTIONS_VERSION)],
    );
    await persist();
  })();
  return instructionsRefresh;
}

export async function listRecipes(): Promise<RecipeDetails[]> {
  await refreshCatalogInstructionsOnce();
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
