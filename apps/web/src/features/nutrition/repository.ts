import type { DiaryEntry, Food, Macros, MealType } from '@arcadia/shared';
import { getDb, newId, persist } from '@/lib/db';
import type { FoodSnapshot } from '@/lib/off/client';

function scaleMacros(per100g: Macros, grams: number): Macros {
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
    await db.query('SELECT * FROM diary_entries WHERE date = ? ORDER BY logged_at', [date])
  ).values as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as string,
    date: r.date as string,
    meal: r.meal as MealType,
    foodId: r.food_id as string,
    foodName: r.food_name as string,
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
