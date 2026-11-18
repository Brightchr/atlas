import type {
  LoggedSet,
  SessionExercise,
  Workout,
  WorkoutExercise,
  WorkoutSession,
} from '@arcadia/shared';
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
  notes: string | null;
}

interface SessionExerciseRow {
  id: string;
  session_id: string;
  exercise_id: number;
  exercise_name: string;
  position: number;
  target_sets: number | null;
  target_reps: number | null;
  target_duration_sec: number | null;
  rest_sec: number | null;
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

function toSessionExercise(r: SessionExerciseRow): SessionExercise {
  return {
    id: r.id,
    sessionId: r.session_id,
    exerciseId: r.exercise_id,
    exerciseName: r.exercise_name,
    position: r.position,
    targetSets: r.target_sets,
    targetReps: r.target_reps,
    targetDurationSec: r.target_duration_sec,
    restSec: r.rest_sec,
  };
}

/** Sessions logged before v12 have no exercise rows of their own. Rebuild the
 * list from what was actually logged (in the order it happened); an open one
 * with nothing logged yet falls back to its routine's current slots. Computed,
 * never written — reads stay side-effect free. */
async function legacyExercises(
  session: SessionRow,
  sets: LoggedSetRow[],
): Promise<SessionExercise[]> {
  const seen = new Map<number, SessionExercise>();
  for (const set of sets) {
    if (seen.has(set.exercise_id)) continue;
    seen.set(set.exercise_id, {
      id: `${session.id}#${set.exercise_id}`,
      sessionId: session.id,
      exerciseId: set.exercise_id,
      exerciseName: set.exercise_name,
      position: seen.size,
      targetSets: null,
      targetReps: null,
      targetDurationSec: null,
      restSec: null,
    });
  }
  if (seen.size === 0 && session.finished_at === null && session.workout_id) {
    const workout = await getWorkout(session.workout_id);
    for (const e of workout?.exercises ?? []) {
      seen.set(e.exerciseId, {
        id: `${session.id}#${e.exerciseId}`,
        sessionId: session.id,
        exerciseId: e.exerciseId,
        exerciseName: e.exerciseName,
        position: seen.size,
        targetSets: e.targetSets,
        targetReps: e.targetReps,
        targetDurationSec: e.targetDurationSec,
        restSec: e.restSec,
      });
    }
  }
  return [...seen.values()];
}

async function hydrateSession(row: SessionRow): Promise<WorkoutSession> {
  const db = await getDb();
  const sets = (
    await db.query('SELECT * FROM logged_sets WHERE session_id = ? ORDER BY completed_at', [row.id])
  ).values as LoggedSetRow[];
  const exerciseRows = (
    await db.query('SELECT * FROM session_exercises WHERE session_id = ? ORDER BY position', [
      row.id,
    ])
  ).values as SessionExerciseRow[];
  const exercises =
    exerciseRows.length > 0
      ? exerciseRows.map(toSessionExercise)
      : await legacyExercises(row, sets);
  return {
    id: row.id,
    workoutId: row.workout_id,
    workoutName: row.workout_name,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    notes: row.notes,
    exercises,
    sets: sets.map(toLoggedSet),
  };
}

type ExerciseSlot = Pick<
  WorkoutExercise,
  'exerciseId' | 'exerciseName' | 'targetSets' | 'targetReps' | 'targetDurationSec' | 'restSec'
>;

async function insertSessionExercises(
  sessionId: string,
  slots: (ExerciseSlot | SessionExercise)[],
  startPosition = 0,
): Promise<void> {
  const db = await getDb();
  let position = startPosition;
  for (const slot of slots) {
    await db.run(
      `INSERT INTO session_exercises
        (id, session_id, exercise_id, exercise_name, position, target_sets, target_reps, target_duration_sec, rest_sec)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId(),
        sessionId,
        slot.exerciseId,
        slot.exerciseName,
        position++,
        slot.targetSets ?? null,
        slot.targetReps ?? null,
        slot.targetDurationSec ?? null,
        slot.restSec ?? null,
      ],
    );
  }
}

/** Start a session from a routine: its slots are copied in, so the routine
 * can change (or go) without touching this session. */
export async function startSession(workout: Workout): Promise<string> {
  const db = await getDb();
  const id = newId();
  await db.run(
    'INSERT INTO workout_sessions (id, workout_id, workout_name, started_at, finished_at) VALUES (?, ?, ?, ?, NULL)',
    [id, workout.id, workout.name, new Date().toISOString()],
  );
  await insertSessionExercises(id, workout.exercises);
  await persist();
  return id;
}

/** An empty workout: no routine, no exercises yet — add them as you go. */
export async function startEmptySession(name = 'Workout'): Promise<string> {
  const db = await getDb();
  const id = newId();
  await db.run(
    'INSERT INTO workout_sessions (id, workout_id, workout_name, started_at, finished_at) VALUES (?, NULL, ?, ?, NULL)',
    [id, name, new Date().toISOString()],
  );
  await persist();
  return id;
}

/** Log a workout that already happened: created finished, dated as given,
 * then filled in through the session page's edit mode. */
export async function createPastSession(args: {
  name: string;
  startedAt: Date;
  durationMin: number;
  workout?: Workout | null;
}): Promise<string> {
  const db = await getDb();
  const id = newId();
  const finishedAt = new Date(args.startedAt.getTime() + Math.max(1, args.durationMin) * 60_000);
  await db.run(
    'INSERT INTO workout_sessions (id, workout_id, workout_name, started_at, finished_at) VALUES (?, ?, ?, ?, ?)',
    [
      id,
      args.workout?.id ?? null,
      args.name,
      args.startedAt.toISOString(),
      finishedAt.toISOString(),
    ],
  );
  if (args.workout) await insertSessionExercises(id, args.workout.exercises);
  await persist();
  return id;
}

/** A fresh session with the same exercises as an earlier one ("Repeat"). */
export async function repeatSession(sourceId: string): Promise<string | null> {
  const source = await getSession(sourceId);
  if (!source) return null;
  const db = await getDb();
  const id = newId();
  await db.run(
    'INSERT INTO workout_sessions (id, workout_id, workout_name, started_at, finished_at) VALUES (?, ?, ?, ?, NULL)',
    [id, source.workoutId, source.workoutName, new Date().toISOString()],
  );
  await insertSessionExercises(id, source.exercises);
  await persist();
  return id;
}

export async function getSession(id: string): Promise<WorkoutSession | null> {
  const db = await getDb();
  const rows = (await db.query('SELECT * FROM workout_sessions WHERE id = ?', [id]))
    .values as SessionRow[];
  if (!rows[0]) return null;
  return hydrateSession(rows[0]);
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
  return hydrateSession(rows[0]);
}

export async function addExerciseToSession(
  sessionId: string,
  exercise: { exerciseId: number; exerciseName: string },
): Promise<void> {
  const db = await getDb();
  const positionRes = await db.query(
    'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM session_exercises WHERE session_id = ?',
    [sessionId],
  );
  const position = (positionRes.values?.[0]?.next as number) ?? 0;
  await insertSessionExercises(
    sessionId,
    [{ ...exercise, targetSets: 3, targetReps: 10, targetDurationSec: null, restSec: null }],
    position,
  );
  await persist();
}

/** Drops the exercise and every set logged against it in that session. */
export async function removeSessionExercise(id: string): Promise<void> {
  const db = await getDb();
  const rows = (await db.query('SELECT * FROM session_exercises WHERE id = ?', [id]))
    .values as SessionExerciseRow[];
  const row = rows[0];
  if (!row) return;
  await db.run('DELETE FROM logged_sets WHERE session_id = ? AND exercise_id = ?', [
    row.session_id,
    row.exercise_id,
  ]);
  await db.run('DELETE FROM session_exercises WHERE id = ?', [id]);
  await persist();
}

export async function renameSession(id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  const db = await getDb();
  await db.run('UPDATE workout_sessions SET workout_name = ? WHERE id = ?', [trimmed, id]);
  await persist();
}

export async function setSessionNotes(id: string, notes: string | null): Promise<void> {
  const db = await getDb();
  await db.run('UPDATE workout_sessions SET notes = ? WHERE id = ?', [notes?.trim() || null, id]);
  await persist();
}

/** Re-date a finished session (edit mode). Its sets move with it so weekly
 * stats, which key on completed_at, follow the new date. */
export async function updateSessionTimes(
  id: string,
  times: { startedAt: Date; durationMin: number },
): Promise<void> {
  const db = await getDb();
  const startedAt = times.startedAt.toISOString();
  const finishedAt = new Date(
    times.startedAt.getTime() + Math.max(1, times.durationMin) * 60_000,
  ).toISOString();
  await db.run('UPDATE workout_sessions SET started_at = ?, finished_at = ? WHERE id = ?', [
    startedAt,
    finishedAt,
    id,
  ]);
  await db.run('UPDATE logged_sets SET completed_at = ? WHERE session_id = ?', [startedAt, id]);
  await persist();
}

export async function logSet(args: {
  sessionId: string;
  exerciseId: number;
  exerciseName: string;
  setNumber: number;
  reps: number | null;
  weightKg: number | null;
  durationSec: number | null;
  /** Defaults to now; a backdated session passes its own start time. */
  completedAt?: string;
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
      args.completedAt ?? new Date().toISOString(),
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

/** Deletes the session and everything logged in it. Used for "Discard" on
 * an open session and "Delete" on a finished one. */
export async function discardSession(id: string): Promise<void> {
  const db = await getDb();
  await db.run('DELETE FROM logged_sets WHERE session_id = ?', [id]);
  await db.run('DELETE FROM session_exercises WHERE session_id = ?', [id]);
  await db.run('DELETE FROM workout_sessions WHERE id = ?', [id]);
  await persist();
}

/** True when the session's exercise sequence no longer matches its routine —
 * the cue to offer "Update routine" on finish. */
export function sessionDiffersFromRoutine(session: WorkoutSession, workout: Workout): boolean {
  const a = session.exercises.map((e) => e.exerciseId);
  const b = workout.exercises.map((e) => e.exerciseId);
  return a.length !== b.length || a.some((id, i) => id !== b[i]);
}

/** Turn an ad-hoc session into a reusable routine (with its targets). */
export async function saveSessionAsRoutine(sessionId: string, name: string): Promise<string> {
  const session = await getSession(sessionId);
  if (!session) throw new Error('Session not found');
  const routineName = name.trim() || session.workoutName;
  const workoutId = await createWorkout(routineName);
  await replaceRoutineExercises(workoutId, session.exercises);
  const db = await getDb();
  // The session takes the routine's name too, so history reads "Push day",
  // not the "Workout" placeholder it started under.
  await db.run('UPDATE workout_sessions SET workout_id = ?, workout_name = ? WHERE id = ?', [
    workoutId,
    routineName,
    sessionId,
  ]);
  await persist();
  return workoutId;
}

/** Make the routine match what the session actually did. */
export async function updateRoutineFromSession(sessionId: string): Promise<void> {
  const session = await getSession(sessionId);
  if (!session?.workoutId) return;
  await replaceRoutineExercises(session.workoutId, session.exercises);
}

async function replaceRoutineExercises(
  workoutId: string,
  exercises: SessionExercise[],
): Promise<void> {
  const db = await getDb();
  await db.run('DELETE FROM workout_exercises WHERE workout_id = ?', [workoutId]);
  let position = 0;
  for (const e of exercises) {
    await db.run(
      `INSERT INTO workout_exercises
        (id, workout_id, exercise_id, exercise_name, position, target_sets, target_reps, target_duration_sec, rest_sec)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId(),
        workoutId,
        e.exerciseId,
        e.exerciseName,
        position++,
        e.targetSets ?? 3,
        e.targetReps ?? (e.targetDurationSec ? null : 10),
        e.targetDurationSec,
        e.restSec,
      ],
    );
  }
  await db.run('UPDATE workouts SET updated_at = ? WHERE id = ?', [
    new Date().toISOString(),
    workoutId,
  ]);
  await persist();
}
