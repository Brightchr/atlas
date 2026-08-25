import type { Exercise } from '@arcadia/shared';
import { getDb } from '@/lib/db';
import { fetchAllExercises } from '@/lib/exercise-db/client';

/** Progress analytics over the local session log. Everything is computed
 * from logged_sets/workout_sessions/body_weight_logs — the data the app has
 * been writing since day one but never read back until now. */

export interface SessionSummary {
  id: string;
  workoutName: string;
  startedAt: string;
  finishedAt: string | null;
  setCount: number;
  /** Sum of weight × reps across the session, in kg. */
  volumeKg: number;
  durationMin: number | null;
}

export async function listSessionHistory(limit = 50): Promise<SessionSummary[]> {
  const db = await getDb();
  const rows = (
    await db.query(
      `SELECT s.id, s.workout_name, s.started_at, s.finished_at,
              COUNT(l.id) AS set_count,
              COALESCE(SUM(COALESCE(l.weight_kg, 0) * COALESCE(l.reps, 0)), 0) AS volume_kg
         FROM workout_sessions s
         LEFT JOIN logged_sets l ON l.session_id = s.id
        WHERE s.finished_at IS NOT NULL
        GROUP BY s.id
        ORDER BY s.started_at DESC
        LIMIT ?`,
      [limit],
    )
  ).values as {
    id: string;
    workout_name: string;
    started_at: string;
    finished_at: string | null;
    set_count: number;
    volume_kg: number;
  }[];
  return rows.map((r) => ({
    id: r.id,
    workoutName: r.workout_name,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    setCount: r.set_count,
    volumeKg: Math.round(r.volume_kg),
    durationMin: r.finished_at
      ? Math.max(1, Math.round((Date.parse(r.finished_at) - Date.parse(r.started_at)) / 60_000))
      : null,
  }));
}

export interface WeekPoint {
  /** Monday of the week, YYYY-MM-DD. */
  week: string;
  label: string;
  sessions: number;
  volumeKg: number;
  sets: number;
}

function mondayOf(dateIso: string): string {
  const d = new Date(dateIso.slice(0, 10));
  const shift = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - shift);
  return d.toISOString().slice(0, 10);
}

/** Last N calendar weeks of training, empty weeks included so gaps show. */
export async function weeklyTrainingStats(weeks = 8): Promise<WeekPoint[]> {
  const db = await getDb();
  const sinceMonday = mondayOf(
    new Date(Date.now() - (weeks - 1) * 7 * 86_400_000).toISOString(),
  );
  const sessions = (
    await db.query(
      `SELECT s.id, s.started_at,
              COUNT(l.id) AS set_count,
              COALESCE(SUM(COALESCE(l.weight_kg, 0) * COALESCE(l.reps, 0)), 0) AS volume_kg
         FROM workout_sessions s
         LEFT JOIN logged_sets l ON l.session_id = s.id
        WHERE s.finished_at IS NOT NULL AND s.started_at >= ?
        GROUP BY s.id`,
      [sinceMonday],
    )
  ).values as { id: string; started_at: string; set_count: number; volume_kg: number }[];

  const byWeek = new Map<string, WeekPoint>();
  for (let i = 0; i < weeks; i++) {
    const monday = mondayOf(new Date(Date.parse(sinceMonday) + i * 7 * 86_400_000).toISOString());
    byWeek.set(monday, {
      week: monday,
      label: new Date(monday).toLocaleDateString([], { month: 'short', day: 'numeric' }),
      sessions: 0,
      volumeKg: 0,
      sets: 0,
    });
  }
  for (const s of sessions) {
    const point = byWeek.get(mondayOf(s.started_at));
    if (!point) continue;
    point.sessions += 1;
    point.sets += s.set_count;
    point.volumeKg += Math.round(s.volume_kg);
  }
  return [...byWeek.values()];
}

export interface MuscleSets {
  muscle: string;
  sets: number;
}

let exerciseById: Promise<Map<number, Exercise>> | null = null;
function getExerciseById(): Promise<Map<number, Exercise>> {
  exerciseById ??= fetchAllExercises().then((all) => new Map(all.map((e) => [e.id, e])));
  return exerciseById;
}

/** Sets per primary muscle over the last 7 days — the volume-balance view. */
export async function muscleSetsThisWeek(): Promise<MuscleSets[]> {
  const db = await getDb();
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const rows = (
    await db.query(
      `SELECT exercise_id, COUNT(*) AS sets FROM logged_sets
        WHERE completed_at >= ? GROUP BY exercise_id`,
      [since],
    )
  ).values as { exercise_id: number; sets: number }[];
  const index = await getExerciseById();
  const byMuscle = new Map<string, number>();
  for (const r of rows) {
    const muscle = index.get(r.exercise_id)?.primaryMuscles[0]?.commonName ?? 'Other';
    byMuscle.set(muscle, (byMuscle.get(muscle) ?? 0) + r.sets);
  }
  return [...byMuscle.entries()]
    .map(([muscle, sets]) => ({ muscle, sets }))
    .sort((a, b) => b.sets - a.sets);
}

export interface LiftPr {
  exerciseId: number;
  exerciseName: string;
  bestWeightKg: number;
  /** Epley estimate: weight × (1 + reps / 30). */
  estimatedOneRepMaxKg: number;
}

/** Best estimated 1RM per exercise (Epley), heaviest five lifts. */
export async function topLifts(limit = 5): Promise<LiftPr[]> {
  const db = await getDb();
  const rows = (
    await db.query(
      `SELECT exercise_name,
              MIN(exercise_id) AS exercise_id,
              MAX(weight_kg) AS best_weight,
              MAX(weight_kg * (1 + COALESCE(reps, 1) / 30.0)) AS est_1rm
         FROM logged_sets
        WHERE weight_kg IS NOT NULL AND weight_kg > 0
        GROUP BY exercise_name
        ORDER BY est_1rm DESC
        LIMIT ?`,
      [limit],
    )
  ).values as {
    exercise_name: string;
    exercise_id: number;
    best_weight: number;
    est_1rm: number;
  }[];
  return rows.map((r) => ({
    exerciseId: r.exercise_id,
    exerciseName: r.exercise_name,
    bestWeightKg: Math.round(r.best_weight * 10) / 10,
    estimatedOneRepMaxKg: Math.round(r.est_1rm * 10) / 10,
  }));
}

/* ------------------------- Schedule adherence ------------------------- */

export type DayStatus = 'done' | 'missed' | 'today' | 'planned' | 'off';

export interface AdherenceDay {
  date: string;
  status: DayStatus;
}

export interface AdherenceStats {
  /** Monday-first rows, oldest week first, current week last. */
  weeks: { monday: string; days: AdherenceDay[] }[];
  done: number;
  missed: number;
  /** done / (done + missed), percent, or null before any planned day passed. */
  adherencePct: number | null;
  /** Consecutive planned days completed, counting back from today. */
  streak: number;
}

/** Done-vs-missed over the last N calendar weeks: a day counts as planned
 * when any weekly plan schedules a workout on that weekday; it's done when a
 * session was finished that date. Untrained rest/unplanned days are 'off'. */
export async function adherenceStats(weeksBack = 4): Promise<AdherenceStats> {
  const db = await getDb();
  const planned = (
    await db.query(
      'SELECT DISTINCT day_of_week FROM training_plan_days WHERE is_rest_day = 0 AND workout_id IS NOT NULL',
    )
  ).values as { day_of_week: number }[];
  const plannedDows = new Set(planned.map((p) => p.day_of_week));

  const sinceMondayIso = mondayOf(
    new Date(Date.now() - (weeksBack - 1) * 7 * 86_400_000).toISOString(),
  );
  const sessions = (
    await db.query(
      `SELECT DISTINCT substr(started_at, 1, 10) AS date FROM workout_sessions
        WHERE finished_at IS NOT NULL AND started_at >= ?`,
      [sinceMondayIso],
    )
  ).values as { date: string }[];
  const trained = new Set(sessions.map((s) => s.date));

  // Only judge days after training actually began — a plan adopted yesterday
  // must not paint the previous month red.
  const firstEver = (
    await db.query(
      'SELECT MIN(substr(started_at, 1, 10)) AS first FROM workout_sessions WHERE finished_at IS NOT NULL',
    )
  ).values as { first: string | null }[];
  const judgeFrom = firstEver[0]?.first ?? '9999-12-31';

  const todayIso = new Date().toISOString().slice(0, 10);
  const weeks: AdherenceStats['weeks'] = [];
  let done = 0;
  let missed = 0;
  for (let w = 0; w < weeksBack; w++) {
    const monday = new Date(Date.parse(sinceMondayIso) + w * 7 * 86_400_000);
    const days: AdherenceDay[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(monday.getTime() + d * 86_400_000).toISOString().slice(0, 10);
      let status: DayStatus;
      if (trained.has(date)) status = 'done';
      else if (date === todayIso) status = 'today';
      else if (!plannedDows.has(d)) status = 'off';
      else if (date < todayIso) status = date >= judgeFrom ? 'missed' : 'off';
      else status = 'planned';
      if (status === 'done' && date <= todayIso) done += 1;
      if (status === 'missed') missed += 1;
      days.push({ date, status });
    }
    weeks.push({ monday: monday.toISOString().slice(0, 10), days });
  }

  // Streak: walk back from today over planned days only.
  let streak = 0;
  for (let i = 0; i < weeksBack * 7; i++) {
    const date = new Date(Date.parse(todayIso) - i * 86_400_000);
    const iso = date.toISOString().slice(0, 10);
    const dow = (date.getUTCDay() + 6) % 7;
    if (trained.has(iso)) streak += 1;
    else if (plannedDows.has(dow) && iso !== todayIso) break;
  }

  const total = done + missed;
  return {
    weeks,
    done,
    missed,
    adherencePct: total === 0 ? null : Math.round((done / total) * 100),
    streak,
  };
}

/* ------------------------------- Gains ------------------------------- */

export interface StrengthGain {
  exerciseName: string;
  exerciseId: number;
  /** Best estimated 1RM in the first 4 weeks of logging this exercise. */
  baselineKg: number;
  /** All-time best estimated 1RM. */
  bestKg: number;
  /** Percent improvement of best over baseline (≥ 0 — never framed down). */
  gainPct: number;
  /** "since May" — when the baseline window started. */
  sinceLabel: string;
}

/** Strength gains framed the encouraging way: all-time best vs the lifter's
 * own first month. Percent-since-start only ever grows — it survives a bad
 * week, unlike week-vs-week deltas (the framing the UX research warns
 * about). Exercises still in their first month are skipped: no baseline,
 * no judgment. */
export async function strengthGains(limit = 4): Promise<StrengthGain[]> {
  const db = await getDb();
  const rows = (
    await db.query(
      `WITH per_set AS (
         SELECT exercise_name, exercise_id, completed_at,
                weight_kg * (1 + COALESCE(reps, 1) / 30.0) AS est
           FROM logged_sets
          WHERE weight_kg IS NOT NULL AND weight_kg > 0
       ),
       firsts AS (
         SELECT exercise_name, MIN(completed_at) AS first_at
           FROM per_set GROUP BY exercise_name
       )
       SELECT p.exercise_name,
              MIN(p.exercise_id) AS exercise_id,
              MIN(f.first_at) AS first_at,
              MAX(p.est) AS best,
              MAX(CASE WHEN p.completed_at <= datetime(f.first_at, '+28 days')
                       THEN p.est END) AS baseline
         FROM per_set p JOIN firsts f ON f.exercise_name = p.exercise_name
        WHERE f.first_at <= datetime('now', '-28 days')
        GROUP BY p.exercise_name`,
    )
  ).values as {
    exercise_name: string;
    exercise_id: number;
    first_at: string;
    best: number;
    baseline: number | null;
  }[];

  return rows
    .filter((r) => r.baseline !== null && r.baseline > 0)
    .map((r) => ({
      exerciseName: r.exercise_name,
      exerciseId: r.exercise_id,
      baselineKg: Math.round(r.baseline! * 10) / 10,
      bestKg: Math.round(r.best * 10) / 10,
      gainPct: Math.max(0, Math.round(((r.best - r.baseline!) / r.baseline!) * 100)),
      sinceLabel: new Date(r.first_at).toLocaleDateString([], { month: 'long' }),
    }))
    .sort((a, b) => b.gainPct - a.gainPct || b.bestKg - a.bestKg)
    .slice(0, limit);
}

export interface PersonalRecord {
  exerciseName: string;
  exerciseId: number;
  weightKg: number;
  reps: number | null;
  estimatedOneRepMaxKg: number;
  date: string;
}

/** Recent PR moments: sets whose estimated 1RM beat everything that lifter
 * had ever logged for that exercise before that moment. */
export async function recentPersonalRecords(days = 30, limit = 6): Promise<PersonalRecord[]> {
  const db = await getDb();
  const rows = (
    await db.query(
      `SELECT exercise_name, exercise_id, weight_kg, reps, completed_at,
              weight_kg * (1 + COALESCE(reps, 1) / 30.0) AS est
         FROM logged_sets
        WHERE weight_kg IS NOT NULL AND weight_kg > 0
        ORDER BY completed_at ASC`,
    )
  ).values as {
    exercise_name: string;
    exercise_id: number;
    weight_kg: number;
    reps: number | null;
    completed_at: string;
    est: number;
  }[];

  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const runningBest = new Map<string, number>();
  const records: PersonalRecord[] = [];
  for (const r of rows) {
    const prior = runningBest.get(r.exercise_name) ?? 0;
    if (r.est > prior) {
      runningBest.set(r.exercise_name, r.est);
      // Only a PR when it beats real history — the very first set of an
      // exercise is a starting point, not a record.
      if (prior > 0 && r.completed_at >= cutoff) {
        records.push({
          exerciseName: r.exercise_name,
          exerciseId: r.exercise_id,
          weightKg: Math.round(r.weight_kg * 10) / 10,
          reps: r.reps,
          estimatedOneRepMaxKg: Math.round(r.est * 10) / 10,
          date: r.completed_at.slice(0, 10),
        });
      }
    }
  }
  return records.reverse().slice(0, limit);
}

export interface WeightProgress {
  startKg: number;
  currentKg: number;
  targetKg: number;
  /** Toward-goal progress, 0..1. */
  fraction: number;
  /** Milestones of the journey (8 splits); how many are banked. */
  milestonesDone: number;
  milestonesTotal: number;
  /** Smoothed kg/week, positive = moving toward the goal. */
  towardGoalPerWeekKg: number | null;
}

/** Weight journey vs the active weight_target goal, framed Happy-Scale
 * style: milestones banked and a smoothed weekly trend toward the goal —
 * direction-aware, so gaining toward a gain goal counts as progress. */
export async function weightProgress(): Promise<WeightProgress | null> {
  const db = await getDb();
  const goalRows = (
    await db.query(
      `SELECT target FROM goals WHERE type = 'weight_target' AND archived = 0
        ORDER BY created_at DESC LIMIT 1`,
    )
  ).values as { target: number | null }[];
  const targetKg = goalRows[0]?.target;
  if (!targetKg) return null;

  const logs = (
    await db.query('SELECT date, weight_kg FROM body_weight_logs ORDER BY date ASC')
  ).values as { date: string; weight_kg: number }[];
  if (logs.length < 2) return null;

  const startKg = logs[0]!.weight_kg;
  // 7-entry moving average against daily noise.
  const tail = logs.slice(-7);
  const currentKg = tail.reduce((s, l) => s + l.weight_kg, 0) / tail.length;

  const total = Math.abs(startKg - targetKg);
  const towardGoal =
    Math.sign(targetKg - startKg) === Math.sign(currentKg - startKg)
      ? Math.abs(currentKg - startKg)
      : 0;
  const fraction = total === 0 ? 1 : Math.min(1, towardGoal / total);

  // Smoothed weekly rate: current average vs the average ~28 days back.
  let towardGoalPerWeekKg: number | null = null;
  const cutoff = new Date(Date.now() - 28 * 86_400_000).toISOString().slice(0, 10);
  const older = logs.filter((l) => l.date <= cutoff).slice(-7);
  if (older.length > 0) {
    const olderAvg = older.reduce((s, l) => s + l.weight_kg, 0) / older.length;
    const olderDate = older[older.length - 1]!.date;
    const weeksApart = Math.max(
      1,
      (Date.parse(logs[logs.length - 1]!.date) - Date.parse(olderDate)) / (7 * 86_400_000),
    );
    const perWeek = (currentKg - olderAvg) / weeksApart;
    towardGoalPerWeekKg =
      Math.round((Math.sign(targetKg - startKg) || 1) * perWeek * 100) / 100;
  }

  const milestonesTotal = 8;
  return {
    startKg: Math.round(startKg * 10) / 10,
    currentKg: Math.round(currentKg * 10) / 10,
    targetKg,
    fraction,
    milestonesDone: Math.floor(fraction * milestonesTotal),
    milestonesTotal,
    towardGoalPerWeekKg,
  };
}

export interface WeightPoint {
  date: string;
  label: string;
  weightKg: number;
}

export async function weightTrend(limit = 90): Promise<WeightPoint[]> {
  const db = await getDb();
  const rows = (
    await db.query('SELECT date, weight_kg FROM body_weight_logs ORDER BY date DESC LIMIT ?', [
      limit,
    ])
  ).values as { date: string; weight_kg: number }[];
  return rows.reverse().map((r) => ({
    date: r.date,
    label: new Date(r.date).toLocaleDateString([], { month: 'short', day: 'numeric' }),
    weightKg: r.weight_kg,
  }));
}
