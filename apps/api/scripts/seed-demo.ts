import { randomBytes, randomUUID } from 'node:crypto';
import { pool, query } from '../src/db/pool';
import { runMigrations } from '../src/db/migrations';
import { env } from '../src/lib/env';
import { hashPassword } from '../src/lib/password';
import { CATALOG_PLANS, CATALOG_WORKOUTS } from '../../web/src/features/training/catalog';
import {
  MEAL_PLAN_TEMPLATES,
  templateSlotsForDay,
} from '../../web/src/features/nutrition/mealPlanCatalog';
import { computeTargets } from '../../web/src/features/goals/targets';
import recipeCatalogJson from '../../web/src/features/nutrition/recipeCatalog.json';
import exercisesJson from '../../web/src/lib/exercise-db/exercises.json';

/** Populates the demo account with about nine weeks of realistic use: two
 * adopted training plans, ~40 logged sessions with progressive loads, daily
 * weigh-ins trending down, a full meal-plan week with saved plans, a logged
 * diary for almost every day, a living shopping list, goals, a public
 * profile, friends with shared stats, a group, and community plans/recipes
 * with reviews.
 *
 * All device data goes into sync_rows (the server's replica log) shaped
 * exactly like the client's SQLite tables, so the first sign-in on any
 * device pulls the whole history down. Re-running wipes and rebuilds the
 * demo's data and the companion accounts; nothing else is touched.
 *
 *   npm run seed:demo -w @arcadia/api
 *
 * DATABASE_URL picks the target; DEMO_PASSWORD sets the demo password (the
 * dev default from env.ts applies when unset outside production). */

/* ------------------------------ Utilities ------------------------------ */

const DAY_MS = 86_400_000;
/** SEED_SHOWCASE=1 logs today in full (meals, weigh-in, session) regardless of
 * the clock — for screenshots, where an empty 'today' looks like nobody uses
 * the app. Normal runs only log what has already happened today. */
const SHOWCASE = process.env.SEED_SHOWCASE === '1';
const LB_PER_KG = 1 / 0.45359237;

/** Deterministic PRNG (mulberry32) so re-seeding yields the same history. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261010);
const chance = (p: number) => rand() < p;
const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
/** Midnight UTC of the calendar day `daysAgo` days before today. */
function dayStart(daysAgo: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return new Date(d.getTime() - daysAgo * DAY_MS);
}
const at = (day: Date, hour: number, minute = 0) =>
  new Date(day.getTime() + hour * 3_600_000 + minute * 60_000);
/** Monday = 0 … Sunday = 6, from a UTC date. */
const dow = (d: Date) => (d.getUTCDay() + 6) % 7;

const lbToKg = (lb: number) => Math.round(lb * 0.45359237 * 100) / 100;
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** The same FNV-1a the web client uses to turn dataset slugs into ids. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}
const exerciseIdByName = new Map(
  (exercisesJson as { id: string; name: string }[]).map((e) => [e.name, fnv1a(e.id)]),
);
function exerciseId(name: string): number {
  const id = exerciseIdByName.get(name);
  if (id === undefined) throw new Error(`Exercise "${name}" is not in the vendored dataset`);
  return id;
}

/* --------------------------- Sync row builder --------------------------- */

type Payload = Record<string, string | number | boolean | null>;
interface SyncRow {
  entity: string;
  rowId: string;
  payload: Payload;
  changedAt: string;
}
const syncRows: SyncRow[] = [];
function row(entity: string, payload: Payload & { id: string }, changedAt: Date | string) {
  syncRows.push({
    entity,
    rowId: payload.id,
    payload,
    changedAt: typeof changedAt === 'string' ? changedAt : changedAt.toISOString(),
  });
}

/* ------------------------------- Persona ------------------------------- */

const DEMO = {
  email: 'demo@arcadia.dev',
  username: 'demo',
  displayName: 'Jordan Reyes',
  bio: 'Recomp season. Five days a week in the garage gym, protein first, long walks on rest days.',
  heightCm: 180.3, // 5'11"
  age: 31,
  startWeightLb: 204.0,
  currentWeightLb: 195.5,
  targetWeightLb: 190,
};

const JOURNEY_DAYS = 63; // nine full weeks of history
const PLAN_SWITCH_DAY = 49; // weeks 1–2 on Push Pull Legs, then Power Builder
const MEAL_SWITCH_DAY = 49; // weeks 1–2 on Lean Cut, then High-Protein Maintain
const todayStart = dayStart(0);
const journeyStart = dayStart(JOURNEY_DAYS);

/* ------------------------------ Training ------------------------------- */

/** Week-one working loads in lb for an 8-rep set, and the weekly jump. */
const LOADS: Record<string, { base: number; inc: number }> = {
  'Barbell Bench Press - Medium Grip': { base: 165, inc: 5 },
  'Barbell Incline Bench Press - Medium Grip': { base: 135, inc: 5 },
  'Incline Dumbbell Press': { base: 55, inc: 2.5 },
  'Dumbbell Shoulder Press': { base: 45, inc: 2.5 },
  'Standing Military Press': { base: 105, inc: 2.5 },
  'Cable Crossover': { base: 35, inc: 2.5 },
  'Dumbbell Flyes': { base: 30, inc: 2.5 },
  'Side Lateral Raise': { base: 20, inc: 1.25 },
  'Triceps Pushdown': { base: 70, inc: 2.5 },
  'Triceps Overhead Extension with Rope': { base: 60, inc: 2.5 },
  'Cable Rope Overhead Triceps Extension': { base: 60, inc: 2.5 },
  'Bent Over Barbell Row': { base: 155, inc: 5 },
  'Seated Cable Rows': { base: 130, inc: 5 },
  'Wide-Grip Lat Pulldown': { base: 130, inc: 5 },
  'Face Pull': { base: 45, inc: 2.5 },
  'Barbell Curl': { base: 70, inc: 2.5 },
  'Hammer Curls': { base: 35, inc: 2.5 },
  'Incline Dumbbell Curl': { base: 30, inc: 2.5 },
  'Dumbbell Shrug': { base: 70, inc: 5 },
  'Barbell Deadlift': { base: 245, inc: 10 },
  'Barbell Squat': { base: 205, inc: 5 },
  'Front Squat (Clean Grip)': { base: 145, inc: 5 },
  'One Leg Barbell Squat': { base: 65, inc: 2.5 },
  'Barbell Hip Thrust': { base: 185, inc: 10 },
  'Romanian Deadlift': { base: 165, inc: 5 },
  'Leg Press': { base: 270, inc: 10 },
  'Leg Extensions': { base: 110, inc: 5 },
  'Lying Leg Curls': { base: 90, inc: 5 },
  'Standing Calf Raises': { base: 180, inc: 5 },
  'Seated Calf Raise': { base: 90, inc: 5 },
  'Cable Crunch': { base: 80, inc: 5 },
  'Dumbbell Bicep Curl': { base: 35, inc: 2.5 },
  'EZ-Bar Skullcrusher': { base: 60, inc: 2.5 },
};
const BODYWEIGHT = new Set(['Pullups', 'Pushups', 'Hanging Leg Raise', 'Chin-Up', 'Plank']);

/** Loads scale with the rep target: fives are heavier than fifteens. */
function repFactor(reps: number): number {
  if (reps <= 5) return 1.12;
  if (reps <= 8) return 1;
  if (reps <= 10) return 0.93;
  if (reps <= 12) return 0.87;
  return 0.8;
}

/** Working load for an exercise in training week `week` (0-based). Linear
 * progression that slows after a month, with a deload in week 6. */
function loadLb(name: string, reps: number, week: number): number | null {
  if (BODYWEIGHT.has(name)) return null;
  const spec = LOADS[name] ?? { base: 50, inc: 2.5 };
  const progress = week <= 4 ? week : 4 + (week - 4) * 0.6;
  let lb = spec.base * repFactor(reps) + spec.inc * progress;
  if (week === 5) lb *= 0.88;
  return Math.round(lb / 2.5) * 2.5;
}

interface LocalExercise {
  id: string;
  exerciseId: number;
  name: string;
  position: number;
  sets: number;
  reps: number | null;
  durationSec: number | null;
  restSec: number;
}
interface LocalWorkout {
  id: string;
  name: string;
  exercises: LocalExercise[];
}

const workoutsByKey = new Map<string, LocalWorkout>();

/** Mirrors importCatalogWorkout: a 'provided' workout with the catalog's
 * exercises resolved to dataset ids. */
function importCatalogWorkout(key: string, createdAt: Date): LocalWorkout {
  const existing = workoutsByKey.get(key);
  if (existing) return existing;
  const w = CATALOG_WORKOUTS.find((x) => x.key === key);
  if (!w) throw new Error(`Catalog workout ${key} missing`);
  const workout: LocalWorkout = { id: randomUUID(), name: w.name, exercises: [] };
  row(
    'workouts',
    {
      id: workout.id,
      name: w.name,
      notes: w.description,
      source: 'provided',
      created_at: createdAt.toISOString(),
      updated_at: createdAt.toISOString(),
    },
    createdAt,
  );
  w.exercises.forEach((e, position) => {
    const durationSec = e.seconds ?? (e.minutes ? e.minutes * 60 : null);
    const ex: LocalExercise = {
      id: randomUUID(),
      exerciseId: exerciseId(e.name),
      name: e.name,
      position,
      sets: e.sets,
      reps: e.reps ?? null,
      durationSec,
      restSec: e.restSec,
    };
    workout.exercises.push(ex);
    row(
      'workout_exercises',
      {
        id: ex.id,
        workout_id: workout.id,
        exercise_id: ex.exerciseId,
        exercise_name: ex.name,
        position,
        target_sets: ex.sets,
        target_reps: ex.reps,
        target_duration_sec: ex.durationSec,
        rest_sec: ex.restSec,
        notes: null,
      },
      createdAt,
    );
  });
  workoutsByKey.set(key, workout);
  return workout;
}

function createUserWorkout(
  name: string,
  notes: string,
  createdAt: Date,
  exercises: { name: string; sets: number; reps: number; restSec: number }[],
): LocalWorkout {
  const workout: LocalWorkout = { id: randomUUID(), name, exercises: [] };
  row(
    'workouts',
    {
      id: workout.id,
      name,
      notes,
      source: 'user',
      created_at: createdAt.toISOString(),
      updated_at: createdAt.toISOString(),
    },
    createdAt,
  );
  exercises.forEach((e, position) => {
    const ex: LocalExercise = {
      id: randomUUID(),
      exerciseId: exerciseId(e.name),
      name: e.name,
      position,
      sets: e.sets,
      reps: e.reps,
      durationSec: null,
      restSec: e.restSec,
    };
    workout.exercises.push(ex);
    row(
      'workout_exercises',
      {
        id: ex.id,
        workout_id: workout.id,
        exercise_id: ex.exerciseId,
        exercise_name: ex.name,
        position,
        target_sets: ex.sets,
        target_reps: ex.reps,
        target_duration_sec: null,
        rest_sec: ex.restSec,
        notes: null,
      },
      createdAt,
    );
  });
  return workout;
}

interface LocalPlan {
  id: string;
  name: string;
  days: (LocalWorkout | 'rest' | null)[];
}

/** Mirrors importCatalogPlan: workouts first, then the plan and its days. */
function importCatalogPlan(
  key: string,
  createdAt: Date,
  opts: { visibility?: 'private' | 'public'; description?: string } = {},
): LocalPlan {
  const p = CATALOG_PLANS.find((x) => x.key === key);
  if (!p) throw new Error(`Catalog plan ${key} missing`);
  const plan: LocalPlan = { id: randomUUID(), name: p.name, days: [] };
  for (const dayKey of p.days) {
    plan.days.push(dayKey === 'rest' ? 'rest' : importCatalogWorkout(dayKey, createdAt));
  }
  row(
    'training_plans',
    {
      id: plan.id,
      name: p.name,
      description: opts.description ?? p.description,
      source: 'provided',
      visibility: opts.visibility ?? 'private',
      local_only: 0,
      based_on_kind: 'catalog',
      based_on_ref: p.key,
      based_on_name: p.name,
    },
    createdAt,
  );
  plan.days.forEach((d, day) => {
    row(
      'training_plan_days',
      {
        id: `${plan.id}#${day}`,
        plan_id: plan.id,
        day_of_week: day,
        workout_id: d === 'rest' || d === null ? null : d.id,
        is_rest_day: d === 'rest' ? 1 : 0,
      },
      createdAt,
    );
  });
  return plan;
}

interface SessionRecord {
  id: string;
  workoutName: string;
  startedAt: Date;
  volumeKg: number;
  cardioSec: number;
}
const sessions: SessionRecord[] = [];

/** One completed session: every exercise gets its target sets, loads come
 * from the progression curve, the last set often falls a rep or two short,
 * and now and then a set beats the target (that is where PRs come from). */
function logSession(workout: LocalWorkout, startedAt: Date, week: number): SessionRecord {
  const sessionId = randomUUID();
  let clock = startedAt.getTime() + 6 * 60_000; // warm-up before the first set
  let volumeKg = 0;
  let cardioSec = 0;
  for (const ex of workout.exercises) {
    const lb = ex.reps === null ? null : loadLb(ex.name, ex.reps, week);
    for (let set = 1; set <= ex.sets; set++) {
      clock += (ex.durationSec ?? 35) * 1000 + ex.restSec * 1000 * between(0.85, 1.25);
      let reps: number | null = null;
      let durationSec: number | null = null;
      if (ex.durationSec !== null) {
        durationSec = ex.durationSec;
        cardioSec += durationSec;
      } else if (ex.reps !== null) {
        reps = ex.reps;
        if (set === ex.sets && chance(0.35)) reps -= Math.ceil(between(1, 2.2));
        else if (set === 1 && chance(0.12)) reps += 1;
        if (BODYWEIGHT.has(ex.name) && chance(0.3)) reps -= 1;
      }
      const weightKg = lb === null ? null : lbToKg(lb);
      if (weightKg !== null && reps !== null) volumeKg += weightKg * reps;
      row(
        'logged_sets',
        {
          id: randomUUID(),
          session_id: sessionId,
          exercise_id: ex.exerciseId,
          exercise_name: ex.name,
          set_number: set,
          reps,
          weight_kg: weightKg,
          duration_sec: durationSec,
          completed_at: new Date(clock).toISOString(),
        },
        new Date(clock),
      );
    }
  }
  const finishedAt = new Date(clock + 3 * 60_000);
  // The session row is written at finish time (that is when the client
  // last touched it), but it must precede its sets in the sync log.
  const sessionRow: SyncRow = {
    entity: 'workout_sessions',
    rowId: sessionId,
    payload: {
      id: sessionId,
      workout_id: workout.id,
      workout_name: workout.name,
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
    },
    changedAt: finishedAt.toISOString(),
  };
  const firstSetIndex = syncRows.findIndex(
    (r) => r.entity === 'logged_sets' && r.payload.session_id === sessionId,
  );
  syncRows.splice(firstSetIndex, 0, sessionRow);
  const record = { id: sessionId, workoutName: workout.name, startedAt, volumeKg, cardioSec };
  sessions.push(record);
  return record;
}

/** Morning lifter on weekdays, late morning on Saturdays — in UTC hours that
 * keep the session on its intended calendar date for a US viewer. */
function sessionStart(day: Date): Date {
  const weekend = dow(day) >= 5;
  const hour = weekend ? 14 + Math.floor(between(0, 2)) : chance(0.75) ? 11 : 22;
  return at(day, hour, Math.floor(between(0, 50)));
}

function buildTraining(): {
  activePlan: LocalPlan;
  firstPlan: LocalPlan;
  coolDown: LocalWorkout;
} {
  const firstPlan = importCatalogPlan('plan-mus-ppl', at(journeyStart, 1, 15));
  const activePlan = importCatalogPlan('plan-mus-ulppl', at(dayStart(PLAN_SWITCH_DAY), 0, 40), {
    visibility: 'public',
    description:
      'Seven weeks in. Upper/Lower early in the week for the heavy work, Push/Pull/Legs after Wednesday for volume. I swapped nothing — the template is good as written.',
  });
  const coolDown = importCatalogWorkout('mob-cooldown', at(dayStart(40), 2, 5));
  const arms = createUserWorkout(
    'Quick Arms & Abs',
    'For the days the plan is done but the gym is still open. 25 minutes, in and out.',
    at(dayStart(33), 1, 20),
    [
      { name: 'Dumbbell Bicep Curl', sets: 3, reps: 12, restSec: 60 },
      { name: 'EZ-Bar Skullcrusher', sets: 3, reps: 12, restSec: 60 },
      { name: 'Hammer Curls', sets: 2, reps: 15, restSec: 45 },
      { name: 'Cable Crunch', sets: 3, reps: 20, restSec: 45 },
    ],
  );

  // Rules of thumb for the history: a strong start, one rough week (week 4,
  // two sessions skipped), a deload in week 6, and the current week nearly
  // complete so the dashboard reads as "on track".
  const skipDays = new Set<number>();
  for (let daysAgo = JOURNEY_DAYS; daysAgo >= 1; daysAgo--) {
    const day = dayStart(daysAgo);
    const plan = daysAgo > PLAN_SWITCH_DAY ? firstPlan : activePlan;
    const scheduled = plan.days[dow(day)];
    if (scheduled === 'rest' || scheduled === null) continue;
    const week = Math.floor((JOURNEY_DAYS - daysAgo) / 7);
    const roughWeek = week === 3;
    const missChance = daysAgo <= 6 ? 0 : roughWeek ? 0.45 : 0.12;
    if (chance(missChance)) {
      skipDays.add(daysAgo);
      continue;
    }
    logSession(scheduled, sessionStart(day), week);
  }
  // Today: the morning session counts as done once its slot has passed, so
  // the Today card shows a finished workout; before that it is still waiting.
  const todayScheduled = activePlan.days[dow(todayStart)];
  const todayStartAt = at(todayStart, 11, 20);
  if (
    todayScheduled &&
    todayScheduled !== 'rest' &&
    (SHOWCASE || Date.now() >= todayStartAt.getTime() + 80 * 60_000)
  ) {
    logSession(todayScheduled, todayStartAt, Math.floor(JOURNEY_DAYS / 7));
  } else if (SHOWCASE && todayScheduled === 'rest') {
    logSession(coolDown, at(todayStart, 15, 30), 0);
  }

  // Extras outside the plan: Sunday cool-downs most weeks since week 4, and
  // the arms finisher on a couple of Wednesdays.
  for (let daysAgo = 40; daysAgo >= 1; daysAgo--) {
    const day = dayStart(daysAgo);
    if (dow(day) === 6 && chance(0.7)) logSession(coolDown, at(day, 15, 30), 0);
    if (dow(day) === 2 && daysAgo <= 33 && chance(0.5)) {
      logSession(arms, at(day, 22, 10), Math.floor((JOURNEY_DAYS - daysAgo) / 7));
    }
  }
  return { activePlan, firstPlan, coolDown };
}

/* ------------------------------ Body weight ----------------------------- */

const weightLogs: { date: string; kg: number }[] = [];

function buildWeight(): void {
  // Faster drop during the two cut weeks, then a slow recomp drift.
  for (let daysAgo = JOURNEY_DAYS; daysAgo >= 0; daysAgo--) {
    const day = dayStart(daysAgo);
    const elapsed = JOURNEY_DAYS - daysAgo;
    const cutDays = Math.min(elapsed, JOURNEY_DAYS - MEAL_SWITCH_DAY);
    const recompDays = Math.max(0, elapsed - (JOURNEY_DAYS - MEAL_SWITCH_DAY));
    const trendLb = DEMO.startWeightLb - cutDays * 0.22 - recompDays * 0.11;
    // Weekday weigh-ins, most weekend mornings skipped. Today's is logged
    // once its morning slot has passed (nothing may sit in the future).
    if (daysAgo === 0 && !SHOWCASE && Date.now() < at(day, 11, 5).getTime()) continue;
    if (daysAgo !== 0 && (dow(day) >= 5 ? chance(0.6) : chance(0.22))) continue;
    const lb = Math.round((trendLb + between(-0.7, 0.7)) * 10) / 10;
    const kg = lbToKg(lb);
    weightLogs.push({ date: isoDate(day), kg });
    row(
      'body_weight_logs',
      { id: isoDate(day), date: isoDate(day), weight_kg: kg, logged_at: at(day, 11, 5).toISOString() },
      at(day, 11, 5),
    );
  }
}

/* ------------------------------- Nutrition ------------------------------ */

interface Per100 {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
  sugarG?: number;
  saturatedFatG?: number;
  sodiumG?: number;
}
interface FoodSnapshot {
  name: string;
  brand: string | null;
  barcode: string | null;
  source: string;
  per100g: Per100;
  imageUrl: string | null;
  servingName: string | null;
  servingGrams: number | null;
}
interface LocalFood extends FoodSnapshot {
  id: string;
}
interface CatalogRecipe {
  name: string;
  description: string;
  servings: number;
  instructions: string | null;
  ingredients: { grams: number; food: FoodSnapshot }[];
}
const recipeCatalog = recipeCatalogJson as CatalogRecipe[];
const catalogRecipe = (name: string) =>
  recipeCatalog.find((r) => r.name.toLowerCase() === name.toLowerCase());

const foodsByKey = new Map<string, LocalFood>();
function importFood(snapshot: FoodSnapshot, createdAt: Date): LocalFood {
  const key = `${snapshot.name.toLowerCase()}|${(snapshot.brand ?? '').toLowerCase()}`;
  const existing = foodsByKey.get(key);
  if (existing) return existing;
  const food: LocalFood = { ...snapshot, id: randomUUID() };
  foodsByKey.set(key, food);
  const p = snapshot.per100g;
  row(
    'foods',
    {
      id: food.id,
      name: snapshot.name,
      brand: snapshot.brand,
      barcode: snapshot.barcode,
      source: snapshot.source,
      kcal: p.kcal,
      protein_g: p.proteinG,
      carbs_g: p.carbsG,
      fat_g: p.fatG,
      fiber_g: p.fiberG ?? null,
      sugar_g: p.sugarG ?? null,
      saturated_fat_g: p.saturatedFatG ?? null,
      sodium_g: p.sodiumG ?? null,
      image_url: snapshot.imageUrl,
      serving_name: snapshot.servingName,
      serving_grams: snapshot.servingGrams,
    },
    createdAt,
  );
  return food;
}

interface LocalRecipe {
  id: string;
  name: string;
  servings: number;
  instructions: string | null;
  ingredients: { food: LocalFood; grams: number }[];
}
const recipesByName = new Map<string, LocalRecipe>();

function importRecipe(entry: CatalogRecipe, createdAt: Date): LocalRecipe {
  const existing = recipesByName.get(entry.name.toLowerCase());
  if (existing) return existing;
  const recipe: LocalRecipe = {
    id: randomUUID(),
    name: entry.name,
    servings: entry.servings,
    instructions: entry.instructions,
    ingredients: [],
  };
  row(
    'recipes',
    { id: recipe.id, name: entry.name, instructions: entry.instructions, servings: entry.servings },
    createdAt,
  );
  for (const ing of entry.ingredients) {
    const food = importFood(ing.food, createdAt);
    recipe.ingredients.push({ food, grams: ing.grams });
    row(
      'recipe_ingredients',
      { id: randomUUID(), recipe_id: recipe.id, food_id: food.id, food_name: food.name, grams: ing.grams },
      createdAt,
    );
  }
  recipesByName.set(entry.name.toLowerCase(), recipe);
  return recipe;
}

function recipeTotals(recipe: LocalRecipe): Per100 {
  return recipe.ingredients.reduce<Per100>(
    (acc, i) => ({
      kcal: acc.kcal + (i.food.per100g.kcal * i.grams) / 100,
      proteinG: acc.proteinG + (i.food.per100g.proteinG * i.grams) / 100,
      carbsG: acc.carbsG + (i.food.per100g.carbsG * i.grams) / 100,
      fatG: acc.fatG + (i.food.per100g.fatG * i.grams) / 100,
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}
const recipeKcalPerServing = (r: LocalRecipe) =>
  Math.round(recipeTotals(r).kcal / Math.max(1, r.servings));

/** Foods the demo added by hand or pulled in from search over the weeks. */
const user100 = (
  name: string,
  source: string,
  per100g: Per100,
  extra: Partial<FoodSnapshot> = {},
): FoodSnapshot => ({
  name,
  brand: null,
  barcode: null,
  source,
  per100g,
  imageUrl: null,
  servingName: null,
  servingGrams: null,
  ...extra,
});

const EXTRA_FOODS = {
  whey: user100(
    'Whey Protein Isolate',
    'user',
    { kcal: 371, proteinG: 80, carbsG: 5.7, fatG: 2.9, sugarG: 2.9, sodiumG: 0.43 },
    { servingName: '1 scoop', servingGrams: 35 },
  ),
  mango: user100('Frozen Mango Chunks', 'usda', { kcal: 60, proteinG: 0.8, carbsG: 15, fatG: 0.4, fiberG: 1.6, sugarG: 13.7 }),
  almondMilk: user100(
    'Unsweetened Almond Milk',
    'fatsecret',
    { kcal: 15, proteinG: 0.6, carbsG: 0.6, fatG: 1.2, sodiumG: 0.07 },
    { brand: 'Silk', servingName: '1 cup', servingGrams: 240 },
  ),
  greekYogurt: user100(
    'Nonfat Greek Yogurt, Plain',
    'fatsecret',
    { kcal: 59, proteinG: 10.2, carbsG: 3.6, fatG: 0.4, sugarG: 3.2, sodiumG: 0.04 },
    { brand: 'Fage', servingName: '1 container', servingGrams: 170 },
  ),
  banana: user100('Banana', 'usda', { kcal: 89, proteinG: 1.1, carbsG: 22.8, fatG: 0.3, fiberG: 2.6, sugarG: 12.2 }, { servingName: '1 medium', servingGrams: 118 }),
  apple: user100('Apple, with skin', 'usda', { kcal: 52, proteinG: 0.3, carbsG: 13.8, fatG: 0.2, fiberG: 2.4, sugarG: 10.4 }, { servingName: '1 medium', servingGrams: 182 }),
  almonds: user100('Almonds, raw', 'usda', { kcal: 579, proteinG: 21.2, carbsG: 21.6, fatG: 49.9, fiberG: 12.5, sugarG: 4.4 }, { servingName: '1 oz', servingGrams: 28 }),
  questBar: user100(
    'Protein Bar, Cookies & Cream',
    'fatsecret',
    { kcal: 317, proteinG: 35, carbsG: 36.7, fatG: 13.3, fiberG: 25, sugarG: 1.7, sodiumG: 0.37 },
    { brand: 'Quest', servingName: '1 bar', servingGrams: 60 },
  ),
  pizza: user100(
    'Pepperoni Pizza, Hand-Tossed',
    'fatsecret',
    { kcal: 282, proteinG: 12, carbsG: 30, fatG: 12.5, saturatedFatG: 5.5, sodiumG: 0.68 },
    { brand: "Domino's", servingName: '1 slice', servingGrams: 107 },
  ),
  ipa: user100(
    'IPA',
    'fatsecret',
    { kcal: 54, proteinG: 0.5, carbsG: 4.6, fatG: 0 },
    { brand: 'Sierra Nevada', servingName: '12 fl oz', servingGrams: 355 },
  ),
  iceCream: user100(
    'Vanilla Ice Cream',
    'fatsecret',
    { kcal: 207, proteinG: 3.5, carbsG: 24, fatG: 11, saturatedFatG: 7, sugarG: 21 },
    { brand: "Breyers", servingName: '2/3 cup', servingGrams: 88 },
  ),
  darkChocolate: user100('Dark Chocolate, 70%', 'usda', { kcal: 598, proteinG: 7.8, carbsG: 45.9, fatG: 42.6, fiberG: 10.9, sugarG: 24 }, { servingName: '2 squares', servingGrams: 20 }),
};

function scale(p: Per100, grams: number) {
  const f = grams / 100;
  const opt = (v: number | undefined) => (v === undefined ? null : round2(v * f));
  return {
    kcal: Math.round(p.kcal * f),
    protein_g: round1(p.proteinG * f),
    carbs_g: round1(p.carbsG * f),
    fat_g: round1(p.fatG * f),
    sugar_g: opt(p.sugarG),
    fiber_g: opt(p.fiberG),
    sodium_g: opt(p.sodiumG),
  };
}

let diaryDays = 0;
function logFood(date: Date, meal: string, food: LocalFood, grams: number, loggedAt: Date) {
  row(
    'diary_entries',
    {
      id: randomUUID(),
      date: isoDate(date),
      meal,
      food_id: food.id,
      food_name: food.name,
      grams,
      ...scale(food.per100g, grams),
      logged_at: loggedAt.toISOString(),
    },
    loggedAt,
  );
}
function logRecipe(date: Date, meal: string, recipe: LocalRecipe, servings: number, loggedAt: Date) {
  const factor = servings / Math.max(1, recipe.servings);
  for (const ing of recipe.ingredients) {
    logFood(date, meal, ing.food, round1(ing.grams * factor), loggedAt);
  }
}

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
/** UTC hour window per meal — US morning/midday/evening, same UTC date. */
const MEAL_HOURS: Record<(typeof MEALS)[number], [number, number]> = {
  breakfast: [12, 13.5],
  lunch: [16.5, 18],
  dinner: [23, 23.9],
  snack: [19.5, 21.5],
};
const mealTime = (day: Date, meal: (typeof MEALS)[number]) => {
  const [lo, hi] = MEAL_HOURS[meal];
  const h = between(lo, hi);
  return at(day, Math.floor(h), Math.floor((h % 1) * 60));
};

interface PlanItem {
  day_of_week: number;
  meal: string;
  kind: 'food' | 'recipe';
  ref_id: string;
  name: string;
  grams: number | null;
  servings: number | null;
}

function templateItems(key: string, createdAt: Date): PlanItem[] {
  const template = MEAL_PLAN_TEMPLATES.find((t) => t.key === key);
  if (!template) throw new Error(`Meal plan template ${key} missing`);
  const items: PlanItem[] = [];
  for (let day = 0; day < 7; day++) {
    const slots = templateSlotsForDay(template, day);
    for (const meal of MEALS) {
      for (const slot of slots[meal]) {
        const entry = catalogRecipe(slot.recipe);
        if (!entry) throw new Error(`Recipe "${slot.recipe}" missing from the catalog`);
        const recipe = importRecipe(entry, createdAt);
        items.push({
          day_of_week: day,
          meal,
          kind: 'recipe',
          ref_id: recipe.id,
          name: recipe.name,
          grams: null,
          servings: slot.servings ?? 1,
        });
      }
    }
  }
  return items;
}

function planKcalPerDay(items: PlanItem[], foods: Map<string, LocalFood>): number {
  const perDay = new Array<number>(7).fill(0);
  for (const it of items) {
    if (it.kind === 'recipe') {
      const recipe = [...recipesByName.values()].find((r) => r.id === it.ref_id);
      if (recipe) perDay[it.day_of_week] += recipeKcalPerServing(recipe) * (it.servings ?? 1);
    } else {
      const food = foods.get(it.ref_id);
      if (food && it.grams) perDay[it.day_of_week] += (food.per100g.kcal * it.grams) / 100;
    }
  }
  const planned = perDay.filter((k) => k > 0);
  return Math.round(planned.reduce((a, b) => a + b, 0) / Math.max(1, planned.length));
}

function buildNutrition(): { shake: LocalRecipe; shakeKcal: number } {
  const cutApplied = at(journeyStart, 2, 0);
  const maintainApplied = at(dayStart(MEAL_SWITCH_DAY), 1, 30);
  const cutItems = templateItems('lean-cut-1700', cutApplied);
  const weekItems = templateItems('hp-maintain-2400', maintainApplied);

  const whey = importFood(EXTRA_FOODS.whey, at(journeyStart, 3, 0));
  for (const snapshot of [
    EXTRA_FOODS.banana,
    EXTRA_FOODS.apple,
    EXTRA_FOODS.almonds,
    EXTRA_FOODS.questBar,
    EXTRA_FOODS.greekYogurt,
  ]) {
    importFood(snapshot, at(dayStart(JOURNEY_DAYS - Math.floor(between(1, 12))), 15, 0));
  }
  const treats = [EXTRA_FOODS.pizza, EXTRA_FOODS.ipa, EXTRA_FOODS.iceCream, EXTRA_FOODS.darkChocolate].map((s) =>
    importFood(s, at(dayStart(JOURNEY_DAYS - Math.floor(between(3, 20))), 23, 0)),
  );
  const snacks = [EXTRA_FOODS.banana, EXTRA_FOODS.apple, EXTRA_FOODS.almonds, EXTRA_FOODS.questBar].map(
    (s) => foodsByKey.get(`${s.name.toLowerCase()}|${(s.brand ?? '').toLowerCase()}`)!,
  );

  // The demo's own recipe, built from scratch and later published.
  const shakeCreated = at(dayStart(38), 16, 0);
  const shake: LocalRecipe = {
    id: randomUUID(),
    name: 'Mango Protein Shake',
    servings: 1,
    instructions:
      'Add 240 g almond milk to the blender first so nothing sticks.\nAdd 170 g Greek yogurt, 150 g frozen mango and one 35 g scoop of whey.\nBlend 45 seconds until completely smooth; add a splash of water if it is too thick to pour.\nDrink within 10 minutes of finishing your session.',
    ingredients: [
      { food: importFood(EXTRA_FOODS.almondMilk, shakeCreated), grams: 240 },
      { food: importFood(EXTRA_FOODS.greekYogurt, shakeCreated), grams: 170 },
      { food: importFood(EXTRA_FOODS.mango, shakeCreated), grams: 150 },
      { food: whey, grams: 35 },
    ],
  };
  row(
    'recipes',
    { id: shake.id, name: shake.name, instructions: shake.instructions, servings: 1 },
    shakeCreated,
  );
  for (const ing of shake.ingredients) {
    row(
      'recipe_ingredients',
      { id: randomUUID(), recipe_id: shake.id, food_id: ing.food.id, food_name: ing.food.name, grams: ing.grams },
      shakeCreated,
    );
  }
  recipesByName.set(shake.name.toLowerCase(), shake);

  // The live week: the maintain template plus the shake on training days.
  const liveItems: PlanItem[] = weekItems.map((it) => ({ ...it }));
  for (const day of [0, 1, 3, 4, 5]) {
    liveItems.push({
      day_of_week: day,
      meal: 'snack',
      kind: 'recipe',
      ref_id: shake.id,
      name: shake.name,
      grams: null,
      servings: 1,
    });
  }
  const liveWritten = at(dayStart(36), 16, 30);
  for (const it of liveItems) row('meal_plan_items', { id: randomUUID(), ...it }, liveWritten);

  // Diary: cut weeks follow the cut template, then the live week. A few
  // unlogged days early on, snacks and weekend treats on top of the plan.
  for (let daysAgo = JOURNEY_DAYS; daysAgo >= 0; daysAgo--) {
    const day = dayStart(daysAgo);
    if (daysAgo > 10 && chance(0.08)) continue;
    diaryDays += 1;
    const items = (daysAgo > MEAL_SWITCH_DAY ? cutItems : liveItems).filter(
      (it) => it.day_of_week === dow(day),
    );
    const now = Date.now();
    for (const it of items) {
      const when = mealTime(day, it.meal as (typeof MEALS)[number]);
      if (daysAgo === 0 && !SHOWCASE && when.getTime() > now) continue; // today: only what has happened
      if (it.meal === 'snack' && chance(0.15)) continue; // skipped snacks happen
      if (it.kind === 'recipe') {
        const recipe = [...recipesByName.values()].find((r) => r.id === it.ref_id)!;
        logRecipe(day, it.meal, recipe, it.servings ?? 1, when);
      }
    }
    if (daysAgo > 0 || SHOWCASE || Date.now() > at(day, 20, 0).getTime()) {
      if (chance(0.3)) {
        const food = pick(snacks);
        logFood(day, 'snack', food, food.servingGrams ?? 100, mealTime(day, 'snack'));
      }
      if (dow(day) >= 5 && chance(0.45)) {
        const food = pick(treats);
        const servings = food.name.startsWith('Pepperoni') ? 2 : 1;
        logFood(day, 'dinner', food, (food.servingGrams ?? 100) * servings, at(day, 23, 45));
      }
    }
  }

  // Saved plans: the live week under a name, and the cut week kept for later.
  const foods = new Map([...foodsByKey.values()].map((f) => [f.id, f]));
  const savedPlans = [
    {
      id: randomUUID(),
      name: 'Recomp week',
      savedAt: isoDate(dayStart(20)),
      kcalPerDay: planKcalPerDay(liveItems, foods),
      items: liveItems.map((it) => ({
        dayOfWeek: it.day_of_week,
        meal: it.meal,
        kind: it.kind,
        refId: it.ref_id,
        name: it.name,
        grams: it.grams,
        servings: it.servings,
      })),
    },
    {
      id: randomUUID(),
      name: 'Lean Cut (weeks 1–2)',
      savedAt: isoDate(dayStart(MEAL_SWITCH_DAY)),
      kcalPerDay: planKcalPerDay(cutItems, foods),
      items: cutItems.map((it) => ({
        dayOfWeek: it.day_of_week,
        meal: it.meal,
        kind: it.kind,
        refId: it.ref_id,
        name: it.name,
        grams: it.grams,
        servings: it.servings,
      })),
    },
  ];
  setting('saved_meal_plans', JSON.stringify(savedPlans), at(dayStart(20), 17, 0));
  setting(
    'active_meal_plan',
    JSON.stringify({
      kind: 'template',
      key: 'hp-maintain-2400',
      name: 'High-Protein Maintain',
      appliedAt: isoDate(dayStart(MEAL_SWITCH_DAY)),
    }),
    maintainApplied,
  );

  // Shopping: what the next few plan days need, plus pantry regulars, and a
  // purchase history that makes the rebuy list feel lived-in.
  const gramsByName = new Map<string, number>();
  for (let i = 0; i < 4; i++) {
    const d = (dow(todayStart) + i) % 7;
    for (const it of liveItems.filter((x) => x.day_of_week === d)) {
      const recipe = [...recipesByName.values()].find((r) => r.id === it.ref_id);
      if (!recipe) continue;
      const factor = (it.servings ?? 1) / Math.max(1, recipe.servings);
      for (const ing of recipe.ingredients) {
        gramsByName.set(ing.food.name, (gramsByName.get(ing.food.name) ?? 0) + ing.grams * factor);
      }
    }
  }
  const needed = [...gramsByName.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 11)
    .map(([name, grams]) => ({ name, quantity: `${Math.round(grams)} g` }));
  needed.push({ name: 'Sparkling water', quantity: '12-pack' }, { name: 'Coffee beans', quantity: '1 bag' });
  const listWritten = at(dayStart(1), 23, 20);
  needed.forEach((item, position) =>
    row(
      'shopping_items',
      { id: randomUUID(), name: item.name, quantity: item.quantity, status: 'needed', position, times_bought: 0, last_bought_at: null },
      listWritten,
    ),
  );
  const history: [string, string, number, number][] = [
    ['Chicken Breast', '1.5 kg', 7, 6],
    ['Eggs', '2 dozen', 8, 4],
    ['Greek Yogurt', '4 tubs', 6, 9],
    ['Spinach', '2 bags', 6, 6],
    ['Frozen Mango Chunks', '1 bag', 4, 13],
    ['Rolled Oats', '1 container', 3, 16],
    ['Olive Oil', '1 bottle', 2, 27],
    ['Whey Protein Isolate', '5 lb tub', 2, 34],
    ['Sweet Potato', '1 kg', 5, 11],
    ['Broccoli', '2 heads', 5, 8],
  ];
  history.forEach(([name, quantity, timesBought, daysAgo], i) =>
    row(
      'shopping_items',
      {
        id: randomUUID(),
        name,
        quantity,
        status: 'bought',
        position: 100 + i,
        times_bought: timesBought,
        last_bought_at: at(dayStart(daysAgo), 22, 10).toISOString(),
      },
      at(dayStart(daysAgo), 22, 10),
    ),
  );

  return { shake, shakeKcal: recipeKcalPerServing(shake) };
}

/* -------------------------------- Settings ------------------------------ */

function setting(key: string, value: string, changedAt: Date) {
  row('settings', { id: key, key, value }, changedAt);
}

function buildSettingsAndGoals(activePlanId: string): { targets: ReturnType<typeof computeTargets> } {
  const onboarding = at(journeyStart, 0, 50);
  setting('training_profile', JSON.stringify({ goal: 'build_muscle', level: 'intermediate', daysPerWeek: 5 }), at(dayStart(PLAN_SWITCH_DAY), 0, 35));
  setting('training_setup', JSON.stringify({ location: 'both', homeEquipmentIds: [2, 3, 5, 9] }), onboarding);
  setting('units', 'imperial', onboarding);
  setting('rest_timer_enabled', '1', onboarding);
  setting('share_weight_trend', '1', at(dayStart(55), 14, 0));
  setting('shopping_cadence_days', '4', at(dayStart(30), 15, 0));
  setting('catalog_instructions_v', '2', at(dayStart(2), 12, 0));
  setting('active_plan_id', activePlanId, at(dayStart(PLAN_SWITCH_DAY), 0, 40));

  const bodyProfile = {
    sex: 'male',
    age: DEMO.age,
    heightCm: DEMO.heightCm,
    activity: 1.55,
    dietType: 'high_protein',
    weeklyRateKg: -0.25,
  } as const;
  const currentKg = weightLogs[weightLogs.length - 1]!.kg;
  const targets = computeTargets(bodyProfile, currentKg);
  setting('profile', JSON.stringify(bodyProfile), at(dayStart(MEAL_SWITCH_DAY), 1, 0));
  setting('daily-targets', JSON.stringify(targets), at(dayStart(7), 12, 0));

  const goal = (
    type: string,
    title: string,
    target: number | null,
    createdAt: Date,
    extra: { muscleId?: number; muscleName?: string; archived?: boolean } = {},
  ) =>
    row(
      'goals',
      {
        id: randomUUID(),
        type,
        title,
        target,
        muscle_id: extra.muscleId ?? null,
        muscle_name: extra.muscleName ?? null,
        created_at: createdAt.toISOString(),
        archived: extra.archived ? 1 : 0,
      },
      createdAt,
    );
  goal('weight_target', 'Get to 190 lb', lbToKg(DEMO.targetWeightLb), at(journeyStart, 1, 0));
  goal('workout_frequency', 'Train 5 days a week', 5, at(dayStart(PLAN_SWITCH_DAY), 0, 45));
  goal('protein_target', 'Hit 200 g protein', 200, at(dayStart(MEAL_SWITCH_DAY), 1, 10));
  goal('muscle_focus', 'Grow my chest', 12, at(dayStart(28), 13, 0), { muscleId: 6, muscleName: 'Chest' });
  goal('streak', '14-day streak', 14, at(dayStart(60), 12, 0), { archived: true });
  return { targets };
}

/* --------------------------- Server-side world -------------------------- */

interface Companion {
  username: string;
  displayName: string;
  bio: string;
  bannerId: string;
  avatarIcon: string;
  avatarTone: string;
  lastSeenMinutesAgo: number;
  stats: Record<string, unknown>;
}

const COMPANIONS: Companion[] = [
  {
    username: 'maya_lifts',
    displayName: 'Maya Chen',
    bio: 'Powerlifting-curious. Chasing a 2-plate bench.',
    bannerId: 'ember',
    avatarIcon: 'flame',
    avatarTone: 'orange',
    lastSeenMinutesAgo: 1,
    stats: {
      week: { workouts: 4, volumeKg: 9850, cardioMin: 35 },
      streakDays: 3,
      weeklyTargetDays: 4,
      lastWorkout: { name: 'Push Volume', at: at(dayStart(1), 22, 40).toISOString() },
      weightDeltaKg: -0.3,
    },
  },
  {
    username: 'tomas_runs',
    displayName: 'Tomás Ruiz',
    bio: 'Road to 5K, week 7. Lifting twice a week so my knees forgive me.',
    bannerId: 'meadow',
    avatarIcon: 'footprints',
    avatarTone: 'emerald',
    lastSeenMinutesAgo: 190,
    stats: {
      week: { workouts: 3, volumeKg: 2100, cardioMin: 140 },
      streakDays: 1,
      weeklyTargetDays: 4,
      lastWorkout: { name: 'Road to 5K Run', at: at(dayStart(1), 11, 5).toISOString() },
    },
  },
  {
    username: 'priya_k',
    displayName: 'Priya Kapoor',
    bio: 'Strength coach by day. Here to keep my own numbers honest.',
    bannerId: 'sunset',
    avatarIcon: 'trophy',
    avatarTone: 'violet',
    lastSeenMinutesAgo: 60 * 26,
    stats: {
      week: { workouts: 5, volumeKg: 12400, cardioMin: 20 },
      streakDays: 5,
      weeklyTargetDays: 5,
      lastWorkout: { name: 'Lower Strength', at: at(dayStart(1), 12, 15).toISOString() },
      weightDeltaKg: 0.1,
    },
  },
  {
    username: 'devon_b',
    displayName: 'Devon Brooks',
    bio: 'New here. Friend of Maya.',
    bannerId: 'mono',
    avatarIcon: 'rocket',
    avatarTone: 'sky',
    lastSeenMinutesAgo: 60 * 5,
    stats: {
      week: { workouts: 2, volumeKg: 3400, cardioMin: 0 },
      streakDays: 0,
      weeklyTargetDays: 3,
      lastWorkout: { name: 'Strength Foundations A', at: at(dayStart(2), 23, 0).toISOString() },
    },
  },
];

function catalogPlanPayload(key: string, nameOverride?: string, description?: string) {
  const p = CATALOG_PLANS.find((x) => x.key === key)!;
  return {
    plan: p,
    payload: {
      name: nameOverride ?? p.name,
      description: description ?? p.description,
      days: p.days.map((dayKey, dayOfWeek) => {
        if (dayKey === 'rest') return { dayOfWeek, isRestDay: true, workout: null };
        const w = CATALOG_WORKOUTS.find((x) => x.key === dayKey)!;
        return {
          dayOfWeek,
          isRestDay: false,
          workout: {
            name: w.name,
            exercises: w.exercises.map((e, position) => ({
              exerciseId: exerciseId(e.name),
              exerciseName: e.name,
              position,
              targetSets: e.sets,
              targetReps: e.reps ?? null,
              targetDurationSec: e.seconds ?? (e.minutes ? e.minutes * 60 : null),
              restSec: e.restSec,
            })),
          },
        };
      }),
    },
  };
}

function localPlanPayload(plan: LocalPlan, description: string) {
  return {
    name: plan.name,
    description,
    days: plan.days.map((d, dayOfWeek) => ({
      dayOfWeek,
      isRestDay: d === 'rest',
      workout:
        d === 'rest' || d === null
          ? null
          : {
              name: d.name,
              exercises: d.exercises.map((e) => ({
                exerciseId: e.exerciseId,
                exerciseName: e.name,
                position: e.position,
                targetSets: e.sets,
                targetReps: e.reps,
                targetDurationSec: e.durationSec,
                restSec: e.restSec,
              })),
            },
    })),
  };
}

function demoStatsSnapshot(): Record<string, unknown> {
  const weekAgo = Date.now() - 7 * DAY_MS;
  const thisWeek = sessions.filter((s) => s.startedAt.getTime() >= weekAgo);
  const dates = new Set(sessions.map((s) => isoDate(s.startedAt)));
  let streak = 0;
  let day = dates.has(isoDate(dayStart(0))) ? 0 : dates.has(isoDate(dayStart(1))) ? 1 : -1;
  if (day >= 0) while (dates.has(isoDate(dayStart(day + streak)))) streak++;
  const last = [...sessions].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0]!;
  const latest = weightLogs[weightLogs.length - 1]!;
  const baseline = weightLogs.find((w) => {
    const days = (Date.parse(latest.date) - Date.parse(w.date)) / DAY_MS;
    return days >= 6 && days <= 8;
  });
  return {
    week: {
      workouts: new Set(thisWeek.map((s) => isoDate(s.startedAt))).size,
      volumeKg: Math.round(thisWeek.reduce((s, x) => s + x.volumeKg, 0)),
      cardioMin: Math.round(thisWeek.reduce((s, x) => s + x.cardioSec, 0) / 60),
    },
    streakDays: streak,
    weeklyTargetDays: 5,
    lastWorkout: { name: last.workoutName, at: last.startedAt.toISOString() },
    ...(baseline ? { weightDeltaKg: round2(latest.kg - baseline.kg) } : {}),
  };
}

/* --------------------------------- Main --------------------------------- */

async function main() {
  const password = env.demoPassword;
  if (!password) {
    throw new Error('DEMO_PASSWORD must be set to seed the demo account in production');
  }
  await runMigrations();

  // Build the whole device history in memory first (deterministic).
  const { activePlan, firstPlan } = buildTraining();
  buildWeight();
  const { shake, shakeKcal } = buildNutrition();
  buildSettingsAndGoals(activePlan.id);
  void firstPlan;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Companion accounts are fully owned by this seed: drop and recreate.
    await client.query('DELETE FROM users WHERE username = ANY($1)', [
      COMPANIONS.map((c) => c.username),
    ]);

    const demoRows = (
      await client.query<{ id: string }>(
        `INSERT INTO users (email, username, password_hash, role, display_name, bio, profile,
                            comped, email_verified, created_at, last_seen_at)
         VALUES ($1, $2, $3, 'user', $4, $5, $6::jsonb, true, true, $7, now())
         ON CONFLICT (email) DO UPDATE
           SET password_hash = EXCLUDED.password_hash, display_name = EXCLUDED.display_name,
               bio = EXCLUDED.bio, profile = EXCLUDED.profile, comped = true,
               email_verified = true, status = 'active', banned_at = NULL, ban_reason = NULL,
               deleted_at = NULL, created_at = EXCLUDED.created_at
         RETURNING id`,
        [
          DEMO.email,
          DEMO.username,
          await hashPassword(password),
          DEMO.displayName,
          DEMO.bio,
          JSON.stringify({
            bannerId: 'tide',
            avatarIcon: 'mountain',
            avatarTone: 'teal',
            show: { plans: true, stats: true, reviews: true, activity: true, goals: true, online: true },
            sharedGoals: [
              {
                title: 'Get to 190 lb',
                label: `${round1(weightLogs[weightLogs.length - 1]!.kg * LB_PER_KG)} lb now — target 190 lb`,
                pct: Math.round(
                  ((DEMO.startWeightLb - weightLogs[weightLogs.length - 1]!.kg * LB_PER_KG) /
                    (DEMO.startWeightLb - DEMO.targetWeightLb)) *
                    100,
                ),
              },
              { title: 'Train 5 days a week', label: '4 of 5 workouts this week', pct: 80 },
            ],
          }),
          at(dayStart(JOURNEY_DAYS + 2), 19, 12),
        ],
      )
    ).rows;
    const demoId = demoRows[0]!.id;

    // Wipe the demo's previous seeded world (device data and social graph).
    await client.query('DELETE FROM sync_rows WHERE user_id = $1', [demoId]);
    await client.query('DELETE FROM user_stats WHERE user_id = $1', [demoId]);
    await client.query('DELETE FROM shared_plans WHERE owner_user_id = $1', [demoId]);
    await client.query('DELETE FROM shared_recipes WHERE owner_user_id = $1', [demoId]);
    await client.query('DELETE FROM plan_reviews WHERE user_id = $1', [demoId]);
    await client.query('DELETE FROM recipe_reviews WHERE user_id = $1', [demoId]);
    await client.query('DELETE FROM notifications WHERE user_id = $1', [demoId]);
    await client.query('DELETE FROM friendships WHERE requester_id = $1 OR addressee_id = $1', [demoId]);
    await client.query('DELETE FROM stat_grants WHERE owner_user_id = $1 OR grantee_user_id = $1', [demoId]);
    await client.query('DELETE FROM groups WHERE owner_user_id = $1', [demoId]);
    await client.query('DELETE FROM group_members WHERE user_id = $1', [demoId]);

    // Device data, in dependency order (parents before children) so a fresh
    // device can apply each sync page without foreign-key surprises.
    const ORDER = [
      'foods',
      'recipes',
      'recipe_ingredients',
      'meal_plan_items',
      'shopping_items',
      'body_weight_logs',
      'goals',
      'settings',
      'workouts',
      'workout_exercises',
      'training_plans',
      'training_plan_days',
      'workout_sessions',
      'logged_sets',
      'diary_entries',
    ];
    const rank = new Map(ORDER.map((e, i) => [e, i]));
    const ordered = [...syncRows].sort(
      (a, b) =>
        rank.get(a.entity)! - rank.get(b.entity)! || (a.changedAt < b.changedAt ? -1 : 1),
    );
    const CHUNK = 500;
    for (let i = 0; i < ordered.length; i += CHUNK) {
      const chunk = ordered.slice(i, i + CHUNK);
      const values: unknown[] = [];
      const tuples = chunk.map((r, j) => {
        values.push(demoId, r.entity, r.rowId, JSON.stringify(r.payload), r.changedAt);
        const b = j * 5;
        return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}::jsonb, false, $${b + 5}, 'seed')`;
      });
      await client.query(
        `INSERT INTO sync_rows (user_id, entity, row_id, payload, deleted, changed_at, device_id)
         VALUES ${tuples.join(',\n')}`,
        values,
      );
    }

    // Companions.
    const companionIds = new Map<string, string>();
    for (const c of COMPANIONS) {
      const rows = await client.query<{ id: string }>(
        `INSERT INTO users (email, username, password_hash, role, display_name, bio, profile,
                            comped, email_verified, created_at, last_seen_at)
         VALUES ($1, $2, $3, 'user', $4, $5, $6::jsonb, true, true, $7, $8)
         RETURNING id`,
        [
          `${c.username}@example.com`,
          c.username,
          await hashPassword(randomBytes(24).toString('base64url')),
          c.displayName,
          c.bio,
          JSON.stringify({
            bannerId: c.bannerId,
            avatarIcon: c.avatarIcon,
            avatarTone: c.avatarTone,
            show: { plans: true, stats: true, reviews: true, activity: true, goals: false, online: true },
            sharedGoals: [],
          }),
          at(dayStart(JOURNEY_DAYS + 30 + Math.floor(between(0, 40))), 18, 0),
          new Date(Date.now() - c.lastSeenMinutesAgo * 60_000),
        ],
      );
      companionIds.set(c.username, rows.rows[0]!.id);
      await client.query(
        'INSERT INTO user_stats (user_id, payload, updated_at) VALUES ($1, $2::jsonb, $3)',
        [rows.rows[0]!.id, JSON.stringify(c.stats), new Date(Date.now() - c.lastSeenMinutesAgo * 60_000)],
      );
    }
    const id = (username: string) => companionIds.get(username)!;

    await client.query(
      'INSERT INTO user_stats (user_id, payload, updated_at) VALUES ($1, $2::jsonb, now())',
      [demoId, JSON.stringify(demoStatsSnapshot())],
    );

    // Friend graph: three friends, one pending request waiting on the demo.
    const friendship = async (from: string, to: string, daysAgo: number, accepted = true) =>
      client.query(
        `INSERT INTO friendships (requester_id, addressee_id, status, created_at, responded_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          from,
          to,
          accepted ? 'accepted' : 'pending',
          at(dayStart(daysAgo), 20, 0),
          accepted ? at(dayStart(daysAgo), 21, 30) : null,
        ],
      );
    await friendship(id('maya_lifts'), demoId, 55);
    await friendship(demoId, id('tomas_runs'), 40);
    await friendship(demoId, id('priya_k'), 30);
    await friendship(id('devon_b'), demoId, 2, false);
    await friendship(id('maya_lifts'), id('devon_b'), 20);

    const grant = (owner: string, grantee: string) =>
      client.query(
        'INSERT INTO stat_grants (owner_user_id, grantee_user_id) VALUES ($1, $2)',
        [owner, grantee],
      );
    await grant(demoId, id('maya_lifts'));
    await grant(id('maya_lifts'), demoId);
    await grant(demoId, id('tomas_runs'));
    await grant(id('tomas_runs'), demoId);
    await grant(id('priya_k'), demoId);

    // Groups: the demo's own crew, and one they were invited into.
    const gang = (
      await client.query<{ id: string }>(
        `INSERT INTO groups (name, owner_user_id, created_at) VALUES ('Garage Gang', $1, $2) RETURNING id`,
        [demoId, at(dayStart(38), 23, 0)],
      )
    ).rows[0]!.id;
    const member = (group: string, user: string, status: 'member' | 'invited', invitedBy: string, daysAgo: number) =>
      client.query(
        `INSERT INTO group_members (group_id, user_id, status, share_stats, invited_by, created_at, joined_at)
         VALUES ($1, $2, $3, true, $4, $5, $6)`,
        [
          group,
          user,
          status,
          invitedBy,
          at(dayStart(daysAgo), 23, 5),
          status === 'member' ? at(dayStart(Math.max(0, daysAgo - 1)), 13, 0) : null,
        ],
      );
    await member(gang, demoId, 'member', demoId, 38);
    await member(gang, id('maya_lifts'), 'member', demoId, 38);
    await member(gang, id('tomas_runs'), 'member', demoId, 37);
    await member(gang, id('priya_k'), 'invited', demoId, 3);
    const runClub = (
      await client.query<{ id: string }>(
        `INSERT INTO groups (name, owner_user_id, created_at) VALUES ('Sunday Long Run Club', $1, $2) RETURNING id`,
        [id('tomas_runs'), at(dayStart(25), 15, 0)],
      )
    ).rows[0]!.id;
    await member(runClub, id('tomas_runs'), 'member', id('tomas_runs'), 25);
    await member(runClub, demoId, 'member', id('tomas_runs'), 24);
    await member(runClub, id('devon_b'), 'member', id('tomas_runs'), 10);

    // Community plans: the demo's published plan plus two from friends.
    const publishPlan = async (
      owner: string,
      localPlanId: string,
      payload: unknown,
      meta: { difficulty: string; goal: string; diet: string | null },
      daysAgo: number,
    ) =>
      (
        await client.query<{ id: string }>(
          `INSERT INTO shared_plans
             (owner_user_id, local_plan_id, name, description, visibility, difficulty, goal, diet,
              payload, created_at, updated_at)
           VALUES ($1, $2, $3, $4, 'public', $5, $6, $7, $8::jsonb, $9, $9)
           RETURNING id`,
          [
            owner,
            localPlanId,
            (payload as { name: string }).name,
            (payload as { description: string }).description,
            meta.difficulty,
            meta.goal,
            meta.diet,
            JSON.stringify(payload),
            at(dayStart(daysAgo), 20, 30),
          ],
        )
      ).rows[0]!.id;
    const demoPlanId = await publishPlan(
      demoId,
      activePlan.id,
      localPlanPayload(
        activePlan,
        'Seven weeks in. Upper/Lower early in the week for the heavy work, Push/Pull/Legs after Wednesday for volume. I swapped nothing — the template is good as written.',
      ),
      { difficulty: 'intermediate', goal: 'build_muscle', diet: 'high_protein' },
      20,
    );
    const mayaShred = catalogPlanPayload(
      'plan-fat-int',
      "Shred 4-Day (Maya's cut)",
      'Running this for my spring cut. Swapped the Saturday circuit for a long hike when the weather is good.',
    );
    const mayaPlanId = await publishPlan(
      id('maya_lifts'),
      randomUUID(),
      mayaShred.payload,
      { difficulty: 'intermediate', goal: 'lose_weight', diet: 'calorie_deficit' },
      33,
    );
    const priyaPlan = catalogPlanPayload(
      'plan-str-beg',
      'Starting Strength — Coach Priya edition',
      'What I give every new client. Add five pounds to the bar every session you finish; stall twice, drop ten percent.',
    );
    const priyaPlanId = await publishPlan(
      id('priya_k'),
      randomUUID(),
      priyaPlan.payload,
      { difficulty: 'beginner', goal: 'get_stronger', diet: 'high_protein' },
      48,
    );
    const review = (plan: string, user: string, rating: number, comment: string, daysAgo: number) =>
      client.query(
        `INSERT INTO plan_reviews (plan_id, user_id, rating, comment, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $5)`,
        [plan, user, rating, comment, at(dayStart(daysAgo), 21, 0)],
      );
    await review(demoPlanId, id('maya_lifts'), 5, 'Upper Strength day is brutal in the best way. Bench finally moving again.', 12);
    await review(demoPlanId, id('tomas_runs'), 4, 'Great structure. I only manage four of the five days with running, still works.', 10);
    await review(demoPlanId, id('devon_b'), 5, 'Followed this for two weeks, loving the Thursday push day.', 4);
    await review(mayaPlanId, demoId, 4, 'Kettlebell day is sneaky hard. Ran it for a week during a deload.', 27);
    await review(mayaPlanId, id('priya_k'), 5, 'Solid conditioning template.', 30);
    await review(priyaPlanId, demoId, 5, 'This is where I started two years ago. Still the best first plan.', 45);
    await review(priyaPlanId, id('tomas_runs'), 5, 'Simple and it works.', 40);

    // Community recipes: the demo's shake, plus a friend's catalog favorite.
    const shakePayload = {
      instructions: shake.instructions,
      ingredients: shake.ingredients.map((i) => ({
        grams: i.grams,
        food: {
          name: i.food.name,
          brand: i.food.brand,
          barcode: i.food.barcode,
          source: i.food.source,
          per100g: i.food.per100g,
          imageUrl: i.food.imageUrl,
          servingName: i.food.servingName,
          servingGrams: i.food.servingGrams,
        },
      })),
    };
    const sharedShakeId = (
      await client.query<{ id: string }>(
        `INSERT INTO shared_recipes
           (owner_user_id, local_recipe_id, name, description, servings, kcal_per_serving, payload,
            created_at, updated_at)
         VALUES ($1, $2, $3, $4, 1, $5, $6::jsonb, $7, $7) RETURNING id`,
        [
          demoId,
          shake.id,
          shake.name,
          'My post-workout default: 40 g protein, tastes like a smoothie-shop order, blends in under a minute.',
          shakeKcal,
          JSON.stringify(shakePayload),
          at(dayStart(14), 17, 0),
        ],
      )
    ).rows[0]!.id;
    const oats = catalogRecipe('Protein Overnight Oats')!;
    const oatsKcal = Math.round(
      oats.ingredients.reduce((s, i) => s + (i.food.per100g.kcal * i.grams) / 100, 0) /
        Math.max(1, oats.servings),
    );
    const sharedOatsId = (
      await client.query<{ id: string }>(
        `INSERT INTO shared_recipes
           (owner_user_id, local_recipe_id, name, description, servings, kcal_per_serving, payload,
            created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $8) RETURNING id`,
        [
          id('maya_lifts'),
          randomUUID(),
          oats.name,
          'Meal-prep five jars on Sunday night and breakfast is solved for the week.',
          oats.servings,
          oatsKcal,
          JSON.stringify({ instructions: oats.instructions, ingredients: oats.ingredients }),
          at(dayStart(22), 16, 0),
        ],
      )
    ).rows[0]!.id;
    const recipeReview = (recipe: string, user: string, rating: number, comment: string, daysAgo: number) =>
      client.query(
        `INSERT INTO recipe_reviews (recipe_id, user_id, rating, comment, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $5)`,
        [recipe, user, rating, comment, at(dayStart(daysAgo), 19, 0)],
      );
    await recipeReview(sharedShakeId, id('priya_k'), 5, 'Frozen mango is the move. Stole this for my clients.', 5);
    await recipeReview(sharedShakeId, id('maya_lifts'), 4, 'Good, I add a handful of spinach — you cannot taste it.', 9);
    await recipeReview(sharedOatsId, demoId, 5, 'Been making these every Sunday since I found them.', 18);

    // Notifications the demo would have received along the way.
    const notify = (type: string, title: string, body: string, daysAgo: number, read: boolean, hour = 20) =>
      client.query(
        `INSERT INTO notifications (user_id, type, title, body, read, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [demoId, type, title, body, read, at(dayStart(daysAgo), hour, Math.floor(between(0, 59)))],
      );
    await notify('welcome', 'Welcome to Arcadia Atlas', 'Set up your first workout to start tracking progress.', JOURNEY_DAYS + 2, true, 19);
    await notify('friend_request', 'maya_lifts sent you a friend request', 'Accept it from the Friends page.', 55, true);
    await notify('friend_accepted', 'tomas_runs accepted your friend request', '', 40, true);
    await notify('friend_accepted', 'priya_k accepted your friend request', '', 30, true);
    await notify('group_invite', 'tomas_runs invited you to the group “Sunday Long Run Club”', 'Joining a group shares your workout stats with its members (you can switch that off per group).', 24, true, 15);
    await notify('plan_review', 'maya_lifts rated "Power Builder 5-Day" 5/5', 'Upper Strength day is brutal in the best way. Bench finally moving again.', 12, true, 21);
    await notify('plan_review', 'tomas_runs rated "Power Builder 5-Day" 4/5', 'Great structure. I only manage four of the five days with running, still works.', 10, true, 21);
    await notify('recipe_review', 'priya_k rated “Mango Protein Shake”', '5/5 — Frozen mango is the move. Stole this for my clients.', 5, false, 19);
    await notify('plan_review', 'devon_b rated "Power Builder 5-Day" 5/5', 'Followed this for two weeks, loving the Thursday push day.', 4, false, 22);
    await notify('friend_request', 'devon_b sent you a friend request', 'Accept it from the Friends page.', 2, false, 20);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const counts = new Map<string, number>();
  for (const r of syncRows) counts.set(r.entity, (counts.get(r.entity) ?? 0) + 1);
  console.log(`Demo account ready: ${DEMO.email} (${DEMO.displayName})`);
  console.log(`  ${sessions.length} workout sessions over ${JOURNEY_DAYS} days, ${diaryDays} diary days`);
  for (const [entity, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${entity.padEnd(20)} ${n}`);
  }
  console.log(`  companions: ${COMPANIONS.map((c) => c.username).join(', ')}`);
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Demo seed failed:', err);
    process.exit(1);
  });
