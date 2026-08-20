import type { MealType } from '@arcadia/shared';
import { getDb } from '@/lib/db';
import { plannedKcalByMeal } from './mealPlan';

/** Plan-vs-reality nutrition over time — the rolled-up view of the diary's
 * per-meal badges: how often eating followed the plan, how often extras
 * crept in, and how the daily calories tracked the target. */

const MEALS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export interface NutritionDay {
  date: string;
  label: string;
  kcal: number;
  mealsEaten: number;
  snacks: number;
  /** Meal slots eaten that today's plan never scheduled (needs a plan). */
  unplanned: number;
  overTarget: boolean;
}

export interface NutritionDiscipline {
  days: NutritionDay[];
  daysLogged: number;
  daysOverTarget: number;
  unplannedTotal: number;
  avgMeals: number;
  avgSnacks: number;
  targetKcal: number | null;
}

export async function nutritionDiscipline(
  daysBack = 14,
  targetKcal: number | null = null,
): Promise<NutritionDiscipline> {
  const db = await getDb();
  const since = new Date(Date.now() - (daysBack - 1) * 86_400_000).toISOString().slice(0, 10);
  const rows = (
    await db.query(
      `SELECT date, meal, SUM(kcal) AS kcal, COUNT(*) AS entries
         FROM diary_entries WHERE date >= ? GROUP BY date, meal`,
      [since],
    )
  ).values as { date: string; meal: MealType; kcal: number; entries: number }[];

  // Planned meals per weekday, computed once each.
  const plannedByDow = await Promise.all(
    Array.from({ length: 7 }, (_, dow) => plannedKcalByMeal(dow)),
  );

  const byDate = new Map<string, { meal: MealType; kcal: number; entries: number }[]>();
  for (const r of rows) {
    const list = byDate.get(r.date) ?? [];
    list.push(r);
    byDate.set(r.date, list);
  }

  const days: NutritionDay[] = [];
  for (let i = 0; i < daysBack; i++) {
    const d = new Date(Date.parse(since) + i * 86_400_000);
    const date = d.toISOString().slice(0, 10);
    const dow = (d.getUTCDay() + 6) % 7;
    const planned = plannedByDow[dow] ?? {};
    const hasPlan = Object.keys(planned).length > 0;
    const meals = byDate.get(date) ?? [];
    const kcal = Math.round(meals.reduce((sum, m) => sum + m.kcal, 0));
    const unplanned = hasPlan
      ? MEALS.filter(
          (meal) => planned[meal] === undefined && meals.some((m) => m.meal === meal),
        ).length
      : 0;
    days.push({
      date,
      label: d.toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: 'UTC' }),
      kcal,
      mealsEaten: (['breakfast', 'lunch', 'dinner'] as MealType[]).filter((meal) =>
        meals.some((m) => m.meal === meal),
      ).length,
      snacks: meals.find((m) => m.meal === 'snack')?.entries ?? 0,
      unplanned,
      overTarget: targetKcal !== null && kcal > targetKcal + 50,
    });
  }

  const logged = days.filter((d) => d.kcal > 0);
  return {
    days,
    daysLogged: logged.length,
    daysOverTarget: days.filter((d) => d.overTarget).length,
    unplannedTotal: days.reduce((sum, d) => sum + d.unplanned, 0),
    avgMeals: logged.length
      ? Math.round((logged.reduce((s, d) => s + d.mealsEaten, 0) / logged.length) * 10) / 10
      : 0,
    avgSnacks: logged.length
      ? Math.round((logged.reduce((s, d) => s + d.snacks, 0) / logged.length) * 10) / 10
      : 0,
    targetKcal,
  };
}
