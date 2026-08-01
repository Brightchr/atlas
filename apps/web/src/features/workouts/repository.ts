import type { LoggedSet, Workout, WorkoutExercise, WorkoutSession } from '@arcadia/shared';
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

export async function getWorkout(id: string): Promise<Workout | null> {
  const all = await listWorkouts();
  return all.find((w) => w.id === id) ?? null;
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

export async function removeWorkoutExercise(id: string): Promise<void> {
  const db = await getDb();
  await db.run('DELETE FROM workout_exercises WHERE id = ?', [id]);
  await persist();
}

/** Update an exercise slot's targets. Only the provided keys change. */
export async function updateWorkoutExercise(
  id: string,
  targets: Partial<
    Pick<WorkoutExercise, 'targetSets' | 'targetReps' | 'targetDurationSec' | 'restSec'>
  >,
): Promise<void> {
  const db = await getDb();
  const columns: Record<string, string> = {
    targetSets: 'target_sets',
    targetReps: 'target_reps',
    targetDurationSec: 'target_duration_sec',
    restSec: 'rest_sec',
  };
  const entries = Object.entries(targets).filter(([k]) => columns[k]);
  if (entries.length === 0) return;
  await db.run(
    `UPDATE workout_exercises SET ${entries.map(([k]) => `${columns[k]} = ?`).join(', ')} WHERE id = ?`,
    [...entries.map(([, v]) => v), id],
  );
  await persist();
}

/* ------------------------------- Sessions ------------------------------- */

interface SessionRow {
  id: string;
  workout_id: string | null;
  workout_name: string;
  started_at: string;
  finished_at: string | null;
}

interface LoggedSetRow {
  id: string;
  session_id: string;
  exercise_id: number;
  exercise_name: string;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  duration_sec: number | null;
  completed_at: string;
}

function toLoggedSet(r: LoggedSetRow): LoggedSet {
  return {
    id: r.id,
    sessionId: r.session_id,
    exerciseId: r.exercise_id,
    exerciseName: r.exercise_name,
    setNumber: r.set_number,
    reps: r.reps,
    weightKg: r.weight_kg,
    durationSec: r.duration_sec,
    completedAt: r.completed_at,
  };
}

function toSession(r: SessionRow, sets: LoggedSetRow[]): WorkoutSession {
  return {
    id: r.id,
    workoutId: r.workout_id,
    workoutName: r.workout_name,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    sets: sets.filter((s) => s.session_id === r.id).map(toLoggedSet),
  };
}

export async function startSession(workout: Workout): Promise<string> {
  const db = await getDb();
  const id = newId();
  await db.run(
    'INSERT INTO workout_sessions (id, workout_id, workout_name, started_at, finished_at) VALUES (?, ?, ?, ?, NULL)',
    [id, workout.id, workout.name, new Date().toISOString()],
  );
  await persist();
  return id;
}

export async function getSession(id: string): Promise<WorkoutSession | null> {
  const db = await getDb();
  const rows = (await db.query('SELECT * FROM workout_sessions WHERE id = ?', [id]))
    .values as SessionRow[];
  if (!rows[0]) return null;
  const sets = (
    await db.query('SELECT * FROM logged_sets WHERE session_id = ? ORDER BY completed_at', [id])
  ).values as LoggedSetRow[];
  return toSession(rows[0], sets);
}

/** The most recent unfinished session, if any — lets the UI offer a resume. */
export async function getOpenSession(): Promise<WorkoutSession | null> {
  const db = await getDb();
  const rows = (
    await db.query(
      'SELECT * FROM workout_sessions WHERE finished_at IS NULL ORDER BY started_at DESC LIMIT 1',
    )
  ).values as SessionRow[];
  if (!rows[0]) return null;
  const sets = (
    await db.query('SELECT * FROM logged_sets WHERE session_id = ? ORDER BY completed_at', [
      rows[0].id,
    ])
  ).values as LoggedSetRow[];
  return toSession(rows[0], sets);
}

export async function logSet(args: {
  sessionId: string;
  exerciseId: number;
  exerciseName: string;
  setNumber: number;
  reps: number | null;
  weightKg: number | null;
  durationSec: number | null;
}): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO logged_sets
      (id, session_id, exercise_id, exercise_name, set_number, reps, weight_kg, duration_sec, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId(),
      args.sessionId,
      args.exerciseId,
      args.exerciseName,
      args.setNumber,
      args.reps,
      args.weightKg,
      args.durationSec,
      new Date().toISOString(),
    ],
  );
  await persist();
}

export async function deleteLoggedSet(id: string): Promise<void> {
  const db = await getDb();
  await db.run('DELETE FROM logged_sets WHERE id = ?', [id]);
  await persist();
}

export async function finishSession(id: string): Promise<void> {
  const db = await getDb();
  await db.run('UPDATE workout_sessions SET finished_at = ? WHERE id = ?', [
    new Date().toISOString(),
    id,
  ]);
  await persist();
}
