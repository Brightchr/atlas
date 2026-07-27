import type { DiaryEntry, Food, Macros, MealType } from '@arcadia/shared';
import { getDb, newId, persist } from '@/lib/db';

function scaleMacros(per100g: Macros, grams: number): Macros {
  const f = grams / 100;
  return {
    kcal: Math.round(per100g.kcal * f),
    proteinG: +(per100g.proteinG * f).toFixed(1),
    carbsG: +(per100g.carbsG * f).toFixed(1),
    fatG: +(per100g.fatG * f).toFixed(1),
  };
}

export async function createFood(
  food: Omit<Food, 'id' | 'source'> & { source?: Food['source'] },
): Promise<string> {
  const db = await getDb();
  const id = newId();
  await db.run(
    `INSERT INTO foods
      (id, name, brand, barcode, source, kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, serving_name, serving_grams)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      food.name,
      food.brand,
      food.barcode,
      food.source ?? 'user',
      food.per100g.kcal,
      food.per100g.proteinG,
      food.per100g.carbsG,
      food.per100g.fatG,
      food.per100g.fiberG ?? null,
      food.per100g.sugarG ?? null,
      food.servingName,
      food.servingGrams,
    ],
  );
  await persist();
  return id;
}

export async function searchFoods(term: string): Promise<Food[]> {
  const db = await getDb();
  const rows = (
    await db.query('SELECT * FROM foods WHERE name LIKE ? ORDER BY name LIMIT 25', [`%${term}%`])
  ).values as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    brand: r.brand as string | null,
    barcode: r.barcode as string | null,
    source: r.source as Food['source'],
    per100g: {
      kcal: r.kcal as number,
      proteinG: r.protein_g as number,
      carbsG: r.carbs_g as number,
      fatG: r.fat_g as number,
      fiberG: (r.fiber_g as number | null) ?? undefined,
      sugarG: (r.sugar_g as number | null) ?? undefined,
    },
    servingName: r.serving_name as string | null,
    servingGrams: r.serving_grams as number | null,
  }));
}

export async function logFood(args: {
  date: string;
  meal: MealType;
  food: Food;
  grams: number;
}): Promise<void> {
  const db = await getDb();
  const macros = scaleMacros(args.food.per100g, args.grams);
  await db.run(
    `INSERT INTO diary_entries
      (id, date, meal, food_id, food_name, grams, kcal, protein_g, carbs_g, fat_g, logged_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId(),
      args.date,
      args.meal,
      args.food.id,
      args.food.name,
      args.grams,
      macros.kcal,
      macros.proteinG,
      macros.carbsG,
      macros.fatG,
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
    },
    loggedAt: r.logged_at as string,
  }));
}

export async function deleteDiaryEntry(id: string): Promise<void> {
  const db = await getDb();
  await db.run('DELETE FROM diary_entries WHERE id = ?', [id]);
  await persist();
}
