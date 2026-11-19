import type { DiaryEntry, Food, Macros, MealType } from '@arcadia/shared';
import { getDb, newId, persist } from '@/lib/db';
import type { FoodSnapshot } from '@/lib/off/client';
import { addDays, localIsoDate } from '@/lib/dates';

export function scaleMacros(per100g: Macros, grams: number): Macros {
  const f = grams / 100;
  const opt = (v: number | undefined) => (v === undefined ? undefined : +(v * f).toFixed(2));
  return {
    kcal: Math.round(per100g.kcal * f),
    proteinG: +(per100g.proteinG * f).toFixed(1),
    carbsG: +(per100g.carbsG * f).toFixed(1),
    fatG: +(per100g.fatG * f).toFixed(1),
    sugarG: opt(per100g.sugarG),
    fiberG: opt(per100g.fiberG),
    sodiumG: opt(per100g.sodiumG),
  };
}

interface FoodRow {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  source: Food['source'];
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  saturated_fat_g: number | null;
  sodium_g: number | null;
  image_url: string | null;
  serving_name: string | null;
  serving_grams: number | null;
}

function toFood(r: FoodRow): Food {
  return {
    id: r.id,
    name: r.name,
    brand: r.brand,
    barcode: r.barcode,
    source: r.source,
    per100g: {
      kcal: r.kcal,
      proteinG: r.protein_g,
      carbsG: r.carbs_g,
      fatG: r.fat_g,
      fiberG: r.fiber_g ?? undefined,
      sugarG: r.sugar_g ?? undefined,
      saturatedFatG: r.saturated_fat_g ?? undefined,
      sodiumG: r.sodium_g ?? undefined,
    },
    imageUrl: r.image_url,
    servingName: r.serving_name,
    servingGrams: r.serving_grams,
  };
}

/** Imports a snapshot (or user-created food) into the local DB. Reuses an
 * existing row when the same barcode was imported before. Returns the Food. */
export async function importFood(snapshot: FoodSnapshot): Promise<Food> {
  const db = await getDb();
  if (snapshot.barcode) {
    const existing = (
      await db.query('SELECT * FROM foods WHERE barcode = ? LIMIT 1', [snapshot.barcode])
    ).values as FoodRow[];
    if (existing[0]) return toFood(existing[0]);
  }
  const id = newId();
  const { per100g } = snapshot;
  await db.run(
    `INSERT INTO foods
      (id, name, brand, barcode, source, kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g,
       saturated_fat_g, sodium_g, image_url, serving_name, serving_grams)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      snapshot.name,
      snapshot.brand,
      snapshot.barcode,
      snapshot.source,
      per100g.kcal,
      per100g.proteinG,
      per100g.carbsG,
      per100g.fatG,
      per100g.fiberG ?? null,
      per100g.sugarG ?? null,
      per100g.saturatedFatG ?? null,
      per100g.sodiumG ?? null,
      snapshot.imageUrl,
      snapshot.servingName,
      snapshot.servingGrams,
    ],
  );
  await persist();
  return { ...snapshot, id };
}

export async function getFoodsByIds(ids: string[]): Promise<Map<string, Food>> {
  if (ids.length === 0) return new Map();
  const db = await getDb();
  const placeholders = ids.map(() => '?').join(',');
  const rows = (await db.query(`SELECT * FROM foods WHERE id IN (${placeholders})`, ids))
    .values as FoodRow[];
  return new Map(rows.map((r) => [r.id, toFood(r)]));
}

export async function searchLocalFoods(term: string): Promise<Food[]> {
  const db = await getDb();
  const rows = (
    await db.query('SELECT * FROM foods WHERE name LIKE ? ORDER BY name LIMIT 25', [`%${term}%`])
  ).values as FoodRow[];
  return rows.map(toFood);
}

export async function logFood(args: {
  date: string;
  meal: MealType;
  food: Food;
  grams: number;
}): Promise<void> {
  const db = await getDb();
  const m = scaleMacros(args.food.per100g, args.grams);
  await db.run(
    `INSERT INTO diary_entries
      (id, date, meal, food_id, food_name, grams, kcal, protein_g, carbs_g, fat_g,
       sugar_g, fiber_g, sodium_g, logged_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId(),
      args.date,
      args.meal,
      args.food.id,
      args.food.name,
      args.grams,
      m.kcal,
      m.proteinG,
      m.carbsG,
      m.fatG,
      m.sugarG ?? null,
      m.fiberG ?? null,
      m.sodiumG ?? null,
      new Date().toISOString(),
    ],
  );
  await persist();
}

export async function getDiaryForDate(date: string): Promise<DiaryEntry[]> {
  const db = await getDb();
  const rows = (
    await db.query(
      `SELECT d.*, f.image_url FROM diary_entries d
        LEFT JOIN foods f ON f.id = d.food_id
       WHERE d.date = ? ORDER BY d.logged_at`,
      [date],
    )
  ).values as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as string,
    date: r.date as string,
    meal: r.meal as MealType,
    foodId: r.food_id as string,
    foodName: r.food_name as string,
    imageUrl: (r.image_url as string | null) ?? null,
    grams: r.grams as number,
    macros: {
      kcal: r.kcal as number,
      proteinG: r.protein_g as number,
      carbsG: r.carbs_g as number,
      fatG: r.fat_g as number,
      sugarG: (r.sugar_g as number | null) ?? undefined,
      fiberG: (r.fiber_g as number | null) ?? undefined,
      sodiumG: (r.sodium_g as number | null) ?? undefined,
    },
    loggedAt: r.logged_at as string,
  }));
}

export async function deleteDiaryEntry(id: string): Promise<void> {
  const db = await getDb();
  await db.run('DELETE FROM diary_entries WHERE id = ?', [id]);
  await persist();
}

/** Changes how much of a food one entry holds and rescales its stored macros.
 * Entries keep their own macro snapshot (so history survives a food being
 * removed), which means a new amount has to rewrite those columns too. */
export async function updateDiaryEntryGrams(id: string, grams: number): Promise<void> {
  const db = await getDb();
  const rows = (
    await db.query(
      `SELECT food_id, grams, kcal, protein_g, carbs_g, fat_g, sugar_g, fiber_g, sodium_g
         FROM diary_entries WHERE id = ?`,
      [id],
    )
  ).values as {
    food_id: string;
    grams: number;
    kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    sugar_g: number | null;
    fiber_g: number | null;
    sodium_g: number | null;
  }[];
  const entry = rows[0];
  if (!entry) return;

  // Prefer the food's exact per-100g numbers. If the food row is gone, scale
  // the entry's own snapshot instead: treating "macros for the old grams" as
  // the base, the new amount is (new / old) of it — scaleMacros divides by
  // 100, hence the * 100.
  const food = (await getFoodsByIds([entry.food_id])).get(entry.food_id);
  const m = food
    ? scaleMacros(food.per100g, grams)
    : scaleMacros(
        {
          kcal: entry.kcal,
          proteinG: entry.protein_g,
          carbsG: entry.carbs_g,
          fatG: entry.fat_g,
          sugarG: entry.sugar_g ?? undefined,
          fiberG: entry.fiber_g ?? undefined,
          sodiumG: entry.sodium_g ?? undefined,
        },
        entry.grams > 0 ? (grams / entry.grams) * 100 : 100,
      );
  await db.run(
    `UPDATE diary_entries
        SET grams = ?, kcal = ?, protein_g = ?, carbs_g = ?, fat_g = ?,
            sugar_g = ?, fiber_g = ?, sodium_g = ?
      WHERE id = ?`,
    [
      grams,
      m.kcal,
      m.proteinG,
      m.carbsG,
      m.fatG,
      m.sugarG ?? null,
      m.fiberG ?? null,
      m.sodiumG ?? null,
      id,
    ],
  );
  await persist();
}

/** A food the user has logged before, with how much they had last time —
 * what the "Recent" and "Frequent" lists in the add-food sheet are made of. */
export interface FoodHistoryItem {
  food: Food;
  /** Grams of the most recent entry for this food. */
  lastGrams: number;
  /** How many times it was logged inside the queried window. */
  timesLogged: number;
}

/** Distinct foods from the diary, one row per food.
 * - 'recent': every food ever logged, newest first.
 * - 'frequent': foods logged at least twice in the last `days` days, most
 *   often first.
 * Ordering uses `logged_at` (when the user actually tapped Log), not the
 * diary `date`, so back-filling last Tuesday still counts as recent. */
export async function getFoodHistory(
  kind: 'recent' | 'frequent',
  limit = 8,
  days = 60,
): Promise<FoodHistoryItem[]> {
  const db = await getDb();
  // The sub-select picks the grams of each food's latest entry. The JOIN
  // drops entries whose food no longer exists (nothing to log again).
  const select = `
    SELECT f.*, COUNT(*) AS times_logged, MAX(d.logged_at) AS last_logged_at,
           (SELECT d2.grams FROM diary_entries d2
             WHERE d2.food_id = d.food_id
             ORDER BY d2.logged_at DESC LIMIT 1) AS last_grams
      FROM diary_entries d
      JOIN foods f ON f.id = d.food_id`;
  const result =
    kind === 'recent'
      ? await db.query(`${select} GROUP BY d.food_id ORDER BY last_logged_at DESC LIMIT ?`, [limit])
      : await db.query(
          `${select} WHERE d.date >= ?
            GROUP BY d.food_id HAVING COUNT(*) >= 2
            ORDER BY times_logged DESC, last_logged_at DESC LIMIT ?`,
          [addDays(localIsoDate(), -days), limit],
        );
  const rows = (result.values ?? []) as (FoodRow & { times_logged: number; last_grams: number })[];
  return rows.map((r) => ({ food: toFood(r), lastGrams: r.last_grams, timesLogged: r.times_logged }));
}

/** Re-logs an existing entry as a fresh one (same food, grams and meal, now).
 * `date` is the diary day it lands on — today unless the caller is looking
 * at another day. */
export async function duplicateDiaryEntry(
  id: string,
  date: string = localIsoDate(),
): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO diary_entries
      (id, date, meal, food_id, food_name, grams, kcal, protein_g, carbs_g, fat_g,
       sugar_g, fiber_g, sodium_g, logged_at)
     SELECT ?, ?, meal, food_id, food_name, grams, kcal, protein_g, carbs_g, fat_g,
            sugar_g, fiber_g, sodium_g, ?
       FROM diary_entries WHERE id = ?`,
    [newId(), date, new Date().toISOString(), id],
  );
  await persist();
}
