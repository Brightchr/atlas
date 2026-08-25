import type { FriendStats } from '@arcadia/shared';
import { currentStreak } from '@/features/goals/progress';
import { getSessionDates, getWeightHistory } from '@/features/goals/repository';
import { weeklyWeightDelta } from '@/features/dashboard/pulse';
import { readTrainingProfile } from '@/features/training/profile';
import { getDb, onPersist } from '@/lib/db';
import { apiFetch } from '@/lib/api';
import { fetchAllExercises } from '@/lib/exercise-db/client';

/** The stats snapshot pipeline: computed from the local database and
 * published to the server so friends (and only the people the user granted)
 * can see it. The client decides WHAT leaves the device — the weight trend
 * is included only when the share_weight_trend setting is on — and the
 * server decides WHO gets to read it. */

const WEIGHT_SHARE_KEY = 'share_weight_trend';

export async function isWeightSharingEnabled(): Promise<boolean> {
  const db = await getDb();
  const rows = (await db.query('SELECT value FROM settings WHERE key = ?', [WEIGHT_SHARE_KEY]))
    .values as { value: string }[];
  return rows[0]?.value === '1';
}

export async function setWeightSharingEnabled(enabled: boolean): Promise<void> {
  const db = await getDb();
  await db.run(
    'INSERT INTO settings (id, key, value) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [WEIGHT_SHARE_KEY, WEIGHT_SHARE_KEY, enabled ? '1' : '0'],
  );
  // Re-publish immediately so the change takes effect server-side too —
  // turning weight sharing OFF must promptly remove it from the snapshot.
  void publishStats(true);
}

async function computeSnapshot(): Promise<FriendStats> {
  const db = await getDb();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const sessionDates = await getSessionDates(60);
  const workouts = sessionDates.filter((d) => d >= weekAgo.slice(0, 10)).length;

  const volumeRows = (
    await db.query(
      `SELECT COALESCE(SUM(weight_kg * COALESCE(reps, 1)), 0) AS volume
         FROM logged_sets WHERE completed_at >= ? AND weight_kg IS NOT NULL`,
      [weekAgo],
    )
  ).values as { volume: number }[];

  // Cardio minutes: timed sets on exercises the catalog files under cardio.
  const timedRows = (
    await db.query(
      `SELECT exercise_id, COALESCE(SUM(duration_sec), 0) AS seconds
         FROM logged_sets WHERE completed_at >= ? AND duration_sec IS NOT NULL
        GROUP BY exercise_id`,
      [weekAgo],
    )
  ).values as { exercise_id: number; seconds: number }[];
  let cardioMin = 0;
  if (timedRows.length > 0) {
    const catalog = await fetchAllExercises().catch(() => []);
    const cardioIds = new Set(
      catalog.filter((e) => e.category?.name === 'Cardio').map((e) => e.id),
    );
    cardioMin = Math.round(
      timedRows.filter((r) => cardioIds.has(r.exercise_id)).reduce((s, r) => s + r.seconds, 0) / 60,
    );
  }

  const lastSession = (
    await db.query(
      'SELECT workout_name, started_at FROM workout_sessions ORDER BY started_at DESC LIMIT 1',
    )
  ).values as { workout_name: string; started_at: string }[];

  const profile = await readTrainingProfile();

  const snapshot: FriendStats = {
    week: {
      workouts,
      volumeKg: Math.round(volumeRows[0]?.volume ?? 0),
      cardioMin,
    },
    streakDays: currentStreak(sessionDates),
    weeklyTargetDays: profile?.daysPerWeek ?? null,
    lastWorkout: lastSession[0]
      ? { name: lastSession[0].workout_name, at: lastSession[0].started_at }
      : null,
  };

  if (await isWeightSharingEnabled()) {
    const delta = weeklyWeightDelta(await getWeightHistory(30));
    if (delta !== null) snapshot.weightDeltaKg = Math.round(delta * 100) / 100;
  }
  return snapshot;
}

/* ------------------------------- Publisher ------------------------------- */

const MIN_PUBLISH_GAP_MS = 10 * 60 * 1000;
const DEBOUNCE_MS = 30 * 1000;

let lastPublished = '';
let lastPublishedAt = 0;
let publishing = false;

/** Computes and uploads the snapshot; skips when nothing changed or the last
 * publish is fresh (unless forced). Failures are silent — stats are a social
 * nicety, never worth an error banner. */
export async function publishStats(force = false): Promise<void> {
  if (publishing || !navigator.onLine) return;
  publishing = true;
  try {
    const snapshot = await computeSnapshot();
    const serialized = JSON.stringify(snapshot);
    const fresh = Date.now() - lastPublishedAt < MIN_PUBLISH_GAP_MS;
    if (!force && (serialized === lastPublished || fresh)) return;
    await apiFetch('/v1/stats', { method: 'PUT', body: serialized });
    lastPublished = serialized;
    lastPublishedAt = Date.now();
  } catch {
    // Offline, signed out, or server down — next trigger retries.
  } finally {
    publishing = false;
  }
}

/** Wires publishing to the app lifecycle: once at start, debounced after
 * local writes, and on a slow interval. Returns a cleanup. */
export function startStatsPublisher(): () => void {
  let debounce: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => void publishStats(), DEBOUNCE_MS);
  };
  const offPersist = onPersist(schedule);
  const interval = setInterval(() => void publishStats(), MIN_PUBLISH_GAP_MS);
  void publishStats(true);
  return () => {
    clearTimeout(debounce);
    offPersist();
    clearInterval(interval);
  };
}
