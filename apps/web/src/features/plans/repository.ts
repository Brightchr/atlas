import type {
  PlanVisibility,
  SharedPlanPayload,
  TrainingPlan,
  TrainingPlanDay,
  Workout,
} from '@arcadia/shared';
import { getDb, newId, persist } from '@/lib/db';

interface PlanRow {
  id: string;
  name: string;
  description: string | null;
  source: 'user' | 'provided';
  visibility: PlanVisibility;
}

interface DayRow {
  plan_id: string;
  day_of_week: number;
  workout_id: string | null;
  is_rest_day: number;
}

export async function listPlans(): Promise<TrainingPlan[]> {
  const db = await getDb();
  const plans = (await db.query('SELECT * FROM training_plans ORDER BY name')).values as PlanRow[];
  const days = (await db.query('SELECT * FROM training_plan_days')).values as DayRow[];
  return plans.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    source: p.source,
    visibility: p.visibility,
    days: days
      .filter((d) => d.plan_id === p.id)
      .map((d): TrainingPlanDay => ({
        dayOfWeek: d.day_of_week,
        workoutId: d.workout_id,
        isRestDay: Boolean(d.is_rest_day),
      })),
  }));
}

export async function createPlan(name: string): Promise<string> {
  const db = await getDb();
  const id = newId();
  await db.run(
    `INSERT INTO training_plans (id, name, description, source, visibility)
     VALUES (?, ?, NULL, 'user', 'private')`,
    [id, name],
  );
  await persist();
  return id;
}

export async function deletePlan(id: string): Promise<void> {
  const db = await getDb();
  await db.run('DELETE FROM training_plans WHERE id = ?', [id]);
  await persist();
}

/** Assign a day: a workout, a rest day, or nothing (clears the row). */
export async function setPlanDay(
  planId: string,
  dayOfWeek: number,
  value: { workoutId: string } | 'rest' | null,
): Promise<void> {
  const db = await getDb();
  if (value === null) {
    await db.run('DELETE FROM training_plan_days WHERE plan_id = ? AND day_of_week = ?', [
      planId,
      dayOfWeek,
    ]);
  } else {
    await db.run(
      `INSERT OR REPLACE INTO training_plan_days (plan_id, day_of_week, workout_id, is_rest_day)
       VALUES (?, ?, ?, ?)`,
      [planId, dayOfWeek, value === 'rest' ? null : value.workoutId, value === 'rest' ? 1 : 0],
    );
  }
  await persist();
}

/** The creator's notes: shown on the plan card and published with shares. */
export async function updatePlanDescription(id: string, description: string): Promise<void> {
  const db = await getDb();
  await db.run('UPDATE training_plans SET description = ? WHERE id = ?', [
    description.trim() || null,
    id,
  ]);
  await persist();
}

export async function setPlanVisibility(id: string, visibility: PlanVisibility): Promise<void> {
  const db = await getDb();
  await db.run('UPDATE training_plans SET visibility = ? WHERE id = ?', [visibility, id]);
  await persist();
}

/** Snapshot a plan into the wire format: workout definitions ride along so an
 * import needs nothing but the payload. */
export function buildPlanPayload(plan: TrainingPlan, workouts: Workout[]): SharedPlanPayload {
  const byId = new Map(workouts.map((w) => [w.id, w]));
  return {
    name: plan.name,
    description: plan.description ?? '',
    days: plan.days.map((day) => {
      const workout = day.workoutId ? byId.get(day.workoutId) : undefined;
      return {
        dayOfWeek: day.dayOfWeek,
        isRestDay: day.isRestDay,
        workout: workout
          ? {
              name: workout.name,
              exercises: workout.exercises.map((e) => ({
                exerciseId: e.exerciseId,
                exerciseName: e.exerciseName,
                position: e.position,
                targetSets: e.targetSets,
                targetReps: e.targetReps,
                targetDurationSec: e.targetDurationSec,
                restSec: e.restSec,
              })),
            }
          : null,
      };
    }),
  };
}

/** Import a shared payload: recreate its workouts locally, then the plan. */
export async function importPlanPayload(payload: SharedPlanPayload): Promise<string> {
  const db = await getDb();
  const now = new Date().toISOString();
  const planId = newId();
  await db.run(
    `INSERT INTO training_plans (id, name, description, source, visibility)
     VALUES (?, ?, ?, 'user', 'private')`,
    [planId, payload.name, payload.description || null],
  );

  // One local workout per distinct embedded workout name.
  const workoutIds = new Map<string, string>();
  for (const day of payload.days) {
    if (!day.workout || workoutIds.has(day.workout.name)) continue;
    const workoutId = newId();
    workoutIds.set(day.workout.name, workoutId);
    await db.run(
      `INSERT INTO workouts (id, name, notes, source, created_at, updated_at)
       VALUES (?, ?, 'Imported from a shared plan', 'user', ?, ?)`,
      [workoutId, day.workout.name, now, now],
    );
    for (const exercise of day.workout.exercises) {
      await db.run(
        `INSERT INTO workout_exercises
          (id, workout_id, exercise_id, exercise_name, position, target_sets, target_reps,
           target_duration_sec, rest_sec)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId(),
          workoutId,
          exercise.exerciseId,
          exercise.exerciseName,
          exercise.position,
          exercise.targetSets,
          exercise.targetReps,
          exercise.targetDurationSec,
          exercise.restSec,
        ],
      );
    }
  }

  for (const day of payload.days) {
    if (!day.workout && !day.isRestDay) continue;
    await db.run(
      `INSERT OR REPLACE INTO training_plan_days (plan_id, day_of_week, workout_id, is_rest_day)
       VALUES (?, ?, ?, ?)`,
      [
        planId,
        day.dayOfWeek,
        day.workout ? workoutIds.get(day.workout.name) : null,
        day.isRestDay ? 1 : 0,
      ],
    );
  }

  await persist();
  return planId;
}
