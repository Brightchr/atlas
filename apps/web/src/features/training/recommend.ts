import type { Exercise } from '@arcadia/shared';
import { getDb, newId, persist } from '@/lib/db';
import { fetchAllExercises } from '@/lib/exercise-db/client';
import { setActivePlanId } from '@/features/plans/repository';
import { CATALOG_PLANS, CATALOG_WORKOUTS, type CatalogPlan, type CatalogWorkout } from './catalog';
import type { TrainingLevel, TrainingProfile } from './profile';

/** Recommendation engine over the built-in catalog. Deterministic and
 * explainable: goal match dominates, level closeness refines, and for plans
 * the weekly day count is matched to what the user said they can commit to.
 * (The same shape Fitbod-style "smart" systems start from — rules first,
 * models later, and the rules keep working offline.) */

const LEVEL_ORDER: Record<TrainingLevel, number> = { beginner: 0, intermediate: 1, advanced: 2 };

function goalScore(itemGoal: string, profileGoal: string): number {
  if (itemGoal === profileGoal) return 3;
  if (itemGoal === 'general' || profileGoal === 'general') return 1;
  return 0;
}

function levelScore(item: TrainingLevel, profile: TrainingLevel): number {
  const distance = Math.abs(LEVEL_ORDER[item] - LEVEL_ORDER[profile]);
  return distance === 0 ? 2 : distance === 1 ? 1 : 0;
}

export function scoreWorkout(w: CatalogWorkout, profile: TrainingProfile): number {
  return goalScore(w.goal, profile.goal) * 10 + levelScore(w.level, profile.level);
}

export function scorePlan(p: CatalogPlan, profile: TrainingProfile): number {
  const daysScore = Math.max(0, 2 - Math.abs(p.daysPerWeek - profile.daysPerWeek));
  return goalScore(p.goal, profile.goal) * 10 + levelScore(p.level, profile.level) * 2 + daysScore;
}

export function recommendWorkouts(profile: TrainingProfile, limit = 6): CatalogWorkout[] {
  return [...CATALOG_WORKOUTS]
    .sort((a, b) => scoreWorkout(b, profile) - scoreWorkout(a, profile))
    .slice(0, limit);
}

export function recommendPlans(profile: TrainingProfile, limit = 3): CatalogPlan[] {
  return [...CATALOG_PLANS]
    .sort((a, b) => scorePlan(b, profile) - scorePlan(a, profile))
    .slice(0, limit);
}

/* --------------------------------- Import --------------------------------- */

let exerciseIndex: Promise<Map<string, Exercise>> | null = null;

/** name → Exercise for the whole vendored dataset, built once per session. */
function getExerciseIndex(): Promise<Map<string, Exercise>> {
  exerciseIndex ??= fetchAllExercises().then((all) => new Map(all.map((e) => [e.name, e])));
  return exerciseIndex;
}

async function findWorkoutIdByName(name: string): Promise<string | null> {
  const db = await getDb();
  const rows = (await db.query('SELECT id FROM workouts WHERE name = ? LIMIT 1', [name]))
    .values as { id: string }[];
  return rows[0]?.id ?? null;
}

/** Copies a catalog workout into the user's own workouts (idempotent by
 * name), resolving exercise names to catalog ids. Returns the local id. */
export async function importCatalogWorkout(w: CatalogWorkout): Promise<string> {
  const existing = await findWorkoutIdByName(w.name);
  if (existing) return existing;

  const index = await getExerciseIndex();
  const db = await getDb();
  const workoutId = newId();
  const now = new Date().toISOString();
  await db.run(
    'INSERT INTO workouts (id, name, notes, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [workoutId, w.name, w.description, 'provided', now, now],
  );
  let position = 0;
  for (const item of w.exercises) {
    const exercise = index.get(item.name);
    if (!exercise) {
      console.warn(`catalog: exercise "${item.name}" missing from dataset — skipped`);
      continue;
    }
    await db.run(
      `INSERT INTO workout_exercises
        (id, workout_id, exercise_id, exercise_name, position, target_sets, target_reps,
         target_duration_sec, rest_sec)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId(),
        workoutId,
        exercise.id,
        exercise.name,
        position,
        item.sets,
        item.reps ?? null,
        item.seconds ?? (item.minutes ? item.minutes * 60 : null),
        item.restSec,
      ],
    );
    position += 1;
  }
  await persist();
  return workoutId;
}

/** Adopts a recommended plan: imports its workouts (deduped by name), then
 * creates the weekly plan and makes it ACTIVE — adopting means trying it.
 * Idempotent by plan name (re-adopting just re-activates). Returns the id. */
export async function importCatalogPlan(p: CatalogPlan): Promise<string> {
  const db = await getDb();
  const existing = (
    await db.query('SELECT id FROM training_plans WHERE name = ? LIMIT 1', [p.name])
  ).values as { id: string }[];
  if (existing[0]) {
    await setActivePlanId(existing[0].id);
    return existing[0].id;
  }

  const workoutIds = new Map<string, string>();
  for (const key of p.days) {
    if (key === 'rest' || workoutIds.has(key)) continue;
    const workout = CATALOG_WORKOUTS.find((w) => w.key === key);
    if (workout) workoutIds.set(key, await importCatalogWorkout(workout));
  }

  const planId = newId();
  await db.run(
    `INSERT INTO training_plans
       (id, name, description, source, visibility, based_on_kind, based_on_ref, based_on_name)
     VALUES (?, ?, ?, 'provided', 'private', 'catalog', ?, ?)`,
    [planId, p.name, p.description, p.key, p.name],
  );
  for (let day = 0; day < 7; day++) {
    const key = p.days[day];
    if (!key) continue;
    await db.run(
      `INSERT OR REPLACE INTO training_plan_days (id, plan_id, day_of_week, workout_id, is_rest_day)
       VALUES (?, ?, ?, ?, ?)`,
      [
        `${planId}#${day}`,
        planId,
        day,
        key === 'rest' ? null : (workoutIds.get(key) ?? null),
        key === 'rest' ? 1 : 0,
      ],
    );
  }
  await setActivePlanId(planId);
  await persist();
  return planId;
}
