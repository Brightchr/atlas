import type { MealPlanItem } from '@arcadia/shared';
import { getDb, newId, persist } from '@/lib/db';
import { setActiveMealPlan } from './activeMealPlan';
import { catalogRecipe } from './recipeCatalog';
import { getFoodsByIds } from './repository';
import { importRecipeFromCatalog, listRecipes } from './recipes';

/** User-saved meal plans: snapshots of a whole week, kept as JSON in the
 * synced settings table so they follow the user across devices. Saving never
 * touches the live week; applying replaces it (same contract as templates). */

export interface SavedMealPlan {
  id: string;
  name: string;
  /** YYYY-MM-DD */
  savedAt: string;
  /** Average kcal of the planned days, computed at save time. */
  kcalPerDay: number;
  items: Omit<MealPlanItem, 'id'>[];
}

const KEY = 'saved_meal_plans';

export async function listSavedMealPlans(): Promise<SavedMealPlan[]> {
  const db = await getDb();
  const rows = (await db.query('SELECT value FROM settings WHERE key = ?', [KEY])).values as {
    value: string;
  }[];
  if (!rows[0]?.value) return [];
  try {
    const parsed = JSON.parse(rows[0].value) as SavedMealPlan[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(plans: SavedMealPlan[]): Promise<void> {
  const db = await getDb();
  await db.run(
    'INSERT INTO settings (id, key, value) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [KEY, KEY, JSON.stringify(plans)],
  );
  await persist();
}

/** Snapshot the current week under a name. Returns the saved plan, or null
 * when the week is empty (nothing worth keeping). */
export async function saveCurrentWeekAsPlan(name: string): Promise<SavedMealPlan | null> {
  const db = await getDb();
  const rows = (await db.query('SELECT * FROM meal_plan_items')).values as {
    day_of_week: number;
    meal: MealPlanItem['meal'];
    kind: MealPlanItem['kind'];
    ref_id: string;
    name: string;
    grams: number | null;
    servings: number | null;
  }[];
  if (rows.length === 0) return null;

  // Average kcal across the days that actually have food planned.
  const recipes = await listRecipes();
  const foods = await getFoodsByIds(rows.filter((r) => r.kind === 'food').map((r) => r.ref_id));
  const perDay = new Array<number>(7).fill(0);
  for (const r of rows) {
    let kcal = 0;
    if (r.kind === 'food') {
      const food = foods.get(r.ref_id);
      if (food && r.grams) kcal = (food.per100g.kcal * r.grams) / 100;
    } else {
      const recipe = recipes.find((x) => x.id === r.ref_id);
      if (recipe) kcal = recipe.perServing.kcal * (r.servings ?? 1);
    }
    perDay[r.day_of_week] = (perDay[r.day_of_week] ?? 0) + kcal;
  }
  const planned = perDay.filter((k) => k > 0);
  const kcalPerDay = Math.round(planned.reduce((a, b) => a + b, 0) / Math.max(1, planned.length));

  // Saving under an existing plan's name updates it in place — the edit
  // loop is: apply the plan, tweak the week, save it again under its name.
  const existing = await listSavedMealPlans();
  const match = existing.find((p) => p.name.toLowerCase() === name.trim().toLowerCase());
  const plan: SavedMealPlan = {
    id: match?.id ?? newId(),
    name: name.trim(),
    savedAt: new Date().toISOString().slice(0, 10),
    kcalPerDay,
    items: rows.map((r) => ({
      dayOfWeek: r.day_of_week,
      meal: r.meal,
      kind: r.kind,
      refId: r.ref_id,
      name: r.name,
      grams: r.grams,
      servings: r.servings,
    })),
  };
  await writeAll([plan, ...existing.filter((p) => p.id !== plan.id)]);
  return plan;
}

export async function renameSavedMealPlan(id: string, name: string): Promise<void> {
  await writeAll(
    (await listSavedMealPlans()).map((p) => (p.id === id ? { ...p, name: name.trim() } : p)),
  );
}

export async function deleteSavedMealPlan(id: string): Promise<void> {
  await writeAll((await listSavedMealPlans()).filter((p) => p.id !== id));
}

/** Replace the current week with a saved plan. Recipe references that no
 * longer exist locally are re-imported from the bundled catalog by name, so
 * an old save still applies cleanly after cleanup or on a new device. */
export async function applySavedMealPlan(id: string): Promise<void> {
  const plan = (await listSavedMealPlans()).find((p) => p.id === id);
  if (!plan) throw new Error('Saved plan not found');

  const recipes = await listRecipes();
  const localIds = new Map(recipes.map((r) => [r.id, r.id]));
  const byName = new Map(recipes.map((r) => [r.name.toLowerCase(), r.id]));
  const resolveRecipe = async (item: Omit<MealPlanItem, 'id'>): Promise<string | null> => {
    if (localIds.has(item.refId)) return item.refId;
    const local = byName.get(item.name.toLowerCase());
    if (local) return local;
    const entry = catalogRecipe(item.name);
    if (!entry) return null;
    const imported = await importRecipeFromCatalog(entry);
    byName.set(item.name.toLowerCase(), imported);
    return imported;
  };

  const db = await getDb();
  await db.run('DELETE FROM meal_plan_items');
  for (const item of plan.items) {
    const refId = item.kind === 'recipe' ? await resolveRecipe(item) : item.refId;
    if (!refId) continue; // recipe gone from device and catalog: skip the slot
    await db.run(
      `INSERT INTO meal_plan_items (id, day_of_week, meal, kind, ref_id, name, grams, servings)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [newId(), item.dayOfWeek, item.meal, item.kind, refId, item.name, item.grams, item.servings],
    );
  }
  await persist();
  await setActiveMealPlan({
    kind: 'custom',
    name: plan.name,
    appliedAt: new Date().toISOString().slice(0, 10),
  });
}
