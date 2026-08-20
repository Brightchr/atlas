import type { BodyWeightLog, Goal, GoalType } from '@arcadia/shared';
import { getDb, newId, persist } from '@/lib/db';
import type { DailyTargets, Profile } from './targets';

/** Generic key/value settings helpers (settings table, JSON values). */
async function getSetting<T>(key: string): Promise<T | null> {
  const db = await getDb();
  const rows = (await db.query('SELECT value FROM settings WHERE key = ?', [key])).values as {
    value: string;
  }[];
  return rows[0] ? (JSON.parse(rows[0].value) as T) : null;
}

async function setSetting(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  await db.run(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, JSON.stringify(value)],
  );
  await persist();
}

export const getProfile = () => getSetting<Profile>('profile');
export const saveProfile = (profile: Profile) => setSetting('profile', profile);
export const getSavedTargets = () => getSetting<DailyTargets>('daily-targets');
export const saveTargets = (targets: DailyTargets) => setSetting('daily-targets', targets);

interface GoalRow {
  id: string;
  type: GoalType;
  title: string;
  target: number | null;
  muscle_id: number | null;
  muscle_name: string | null;
  created_at: string;
  archived: number;
}

function toGoal(r: GoalRow): Goal {
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    target: r.target,
    muscleId: r.muscle_id,
    muscleName: r.muscle_name,
    createdAt: r.created_at,
    archived: Boolean(r.archived),
  };
}

export async function listGoals(includeArchived = false): Promise<Goal[]> {
  const db = await getDb();
  const rows = (
    await db.query(
      includeArchived
        ? 'SELECT * FROM goals ORDER BY created_at DESC'
        : 'SELECT * FROM goals WHERE archived = 0 ORDER BY created_at DESC',
    )
  ).values as GoalRow[];
  return rows.map(toGoal);
}

export async function createGoal(input: {
  type: GoalType;
  title: string;
  target?: number;
  muscleId?: number;
  muscleName?: string;
}): Promise<string> {
  const db = await getDb();
  const id = newId();
  await db.run(
    `INSERT INTO goals (id, type, title, target, muscle_id, muscle_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.type,
      input.title,
      input.target ?? null,
      input.muscleId ?? null,
      input.muscleName ?? null,
      new Date().toISOString(),
    ],
  );
  await persist();
  return id;
}

/** Sets the target for a goal type, updating the active goal if one exists —
 * used when applying computed daily targets so goals don't duplicate. */
export async function upsertTargetGoal(
  type: GoalType,
  title: string,
  target: number,
): Promise<void> {
  const db = await getDb();
  const existing = (
    await db.query('SELECT id FROM goals WHERE type = ? AND archived = 0 LIMIT 1', [type])
  ).values as { id: string }[];
  if (existing[0]) {
    await db.run('UPDATE goals SET target = ? WHERE id = ?', [target, existing[0].id]);
  } else {
    await db.run(
      'INSERT INTO goals (id, type, title, target, created_at) VALUES (?, ?, ?, ?, ?)',
      [newId(), type, title, target, new Date().toISOString()],
    );
  }
  await persist();
}

export async function archiveGoal(id: string): Promise<void> {
  const db = await getDb();
  await db.run('UPDATE goals SET archived = 1 WHERE id = ?', [id]);
  await persist();
}

/** One weight entry per day — logging twice replaces that day's value. The id
 * IS the date: deterministic across devices, so syncing the same day from two
 * phones converges on one row instead of colliding on UNIQUE(date). */
export async function logBodyWeight(weightKg: number): Promise<void> {
  const db = await getDb();
  const date = new Date().toISOString().slice(0, 10);
  await db.run(
    `INSERT INTO body_weight_logs (id, date, weight_kg, logged_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET weight_kg = excluded.weight_kg, logged_at = excluded.logged_at`,
    [date, date, weightKg, new Date().toISOString()],
  );
  await persist();
}

export async function getWeightHistory(limit = 60): Promise<BodyWeightLog[]> {
  const db = await getDb();
  const rows = (
    await db.query('SELECT * FROM body_weight_logs ORDER BY date DESC LIMIT ?', [limit])
  ).values as { id: string; date: string; weight_kg: number; logged_at: string }[];
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    weightKg: r.weight_kg,
    loggedAt: r.logged_at,
  }));
}

/** Distinct local dates with a workout session, most recent first. */
export async function getSessionDates(sinceDays = 60): Promise<string[]> {
  const db = await getDb();
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();
  const rows = (
    await db.query(
      `SELECT DISTINCT substr(started_at, 1, 10) AS d FROM workout_sessions
        WHERE started_at >= ? ORDER BY d DESC`,
      [since],
    )
  ).values as { d: string }[];
  return rows.map((r) => r.d);
}

/** Recently performed exercises (for suggestion recency/variety). */
export async function getRecentLoggedSets(
  sinceDays = 21,
): Promise<{ exerciseId: number; completedAt: string }[]> {
  const db = await getDb();
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();
  const rows = (
    await db.query(
      'SELECT exercise_id, completed_at FROM logged_sets WHERE completed_at >= ?',
      [since],
    )
  ).values as { exercise_id: number; completed_at: string }[];
  return rows.map((r) => ({ exerciseId: r.exercise_id, completedAt: r.completed_at }));
}
