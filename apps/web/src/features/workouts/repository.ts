import type { Workout, WorkoutExercise } from '@arcadia/shared';
import { getDb, newId, persist } from '@/lib/db';

/** Reference repository pattern: plain functions over the shared SQLite
 * connection. Other features (nutrition, shopping, plans) follow the same shape. */

interface WorkoutRow {
  id: string;
  name: string;
  notes: string | null;
  source: 'user' | 'provided';
  created_at: string;
  updated_at: string;
}

interface WorkoutExerciseRow {
  id: string;
  workout_id: string;
  exercise_id: number;
  exercise_name: string;
  position: number;
  target_sets: number;
  target_reps: number | null;
  target_duration_sec: number | null;
  rest_sec: number | null;
  notes: string | null;
}

function toWorkoutExercise(row: WorkoutExerciseRow): WorkoutExercise {
  return {
    id: row.id,
    workoutId: row.workout_id,
    exerciseId: row.exercise_id,
    exerciseName: row.exercise_name,
    position: row.position,
    targetSets: row.target_sets,
    targetReps: row.target_reps,
    targetDurationSec: row.target_duration_sec,
    restSec: row.rest_sec,
    notes: row.notes,
  };
}

export async function listWorkouts(): Promise<Workout[]> {
  const db = await getDb();
  const workouts = (await db.query('SELECT * FROM workouts ORDER BY updated_at DESC'))
    .values as WorkoutRow[];
  const exercises = (
    await db.query('SELECT * FROM workout_exercises ORDER BY workout_id, position')
  ).values as WorkoutExerciseRow[];

  return workouts.map((w) => ({
    id: w.id,
    name: w.name,
    notes: w.notes,
    source: w.source,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
    exercises: exercises.filter((e) => e.workout_id === w.id).map(toWorkoutExercise),
  }));
}

export async function createWorkout(name: string): Promise<string> {
  const db = await getDb();
  const id = newId();
  const now = new Date().toISOString();
  await db.run(
    'INSERT INTO workouts (id, name, notes, source, created_at, updated_at) VALUES (?, ?, NULL, ?, ?, ?)',
    [id, name, 'user', now, now],
  );
  await persist();
  return id;
}

export async function deleteWorkout(id: string): Promise<void> {
  const db = await getDb();
  await db.run('DELETE FROM workouts WHERE id = ?', [id]);
  await persist();
}

export async function addExerciseToWorkout(
  workoutId: string,
  exercise: { exerciseId: number; exerciseName: string },
): Promise<void> {
  const db = await getDb();
  const positionRes = await db.query(
    'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM workout_exercises WHERE workout_id = ?',
    [workoutId],
  );
  const position = (positionRes.values?.[0]?.next as number) ?? 0;
  await db.run(
    `INSERT INTO workout_exercises
      (id, workout_id, exercise_id, exercise_name, position, target_sets, target_reps)
     VALUES (?, ?, ?, ?, ?, 3, 10)`,
    [newId(), workoutId, exercise.exerciseId, exercise.exerciseName, position],
  );
  await db.run('UPDATE workouts SET updated_at = ? WHERE id = ?', [
    new Date().toISOString(),
    workoutId,
  ]);
  await persist();
}
