import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db/pool';
import exercisesJson from '../../web/src/lib/exercise-db/exercises.json';

/** Publish the plans in scripts/plans/*.json as public community plans.
 *
 * Each file is a weekly template written with exercise NAMES from the
 * vendored dataset (like the client catalog); this script resolves them to
 * the same FNV-1a ids the web app uses, so an imported copy links to the
 * exercise pages. Re-running updates each plan in place — the row is keyed
 * by (owner, local_plan_id = `curated:${key}`), exactly like a device
 * republishing its plan.
 *
 *   npm run publish:plans -w @arcadia/api            # owner: admin
 *   PLAN_OWNER=jordan npm run publish:plans -w @arcadia/api
 *
 * Point DATABASE_URL at the target database (the dev .env by default). */

interface PlanExercise {
  name: string;
  sets: number;
  reps?: number;
  minutes?: number;
  seconds?: number;
  restSec: number;
}
interface PlanFile {
  key: string;
  name: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  goal: 'build_muscle' | 'lose_weight' | 'get_stronger' | 'general';
  diet: 'high_protein' | 'calorie_deficit' | 'balanced' | 'performance' | null;
  days: {
    dayOfWeek: number;
    isRestDay: boolean;
    workout: { name: string; exercises: PlanExercise[] } | null;
  }[];
}

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

function toPayload(plan: PlanFile) {
  return {
    name: plan.name,
    description: plan.description,
    days: plan.days.map((d) => ({
      dayOfWeek: d.dayOfWeek,
      isRestDay: d.isRestDay,
      workout:
        d.isRestDay || !d.workout
          ? null
          : {
              name: d.workout.name,
              exercises: d.workout.exercises.map((e, position) => {
                const exerciseId = exerciseIdByName.get(e.name);
                if (exerciseId === undefined) {
                  throw new Error(
                    `${plan.key}: exercise "${e.name}" is not in the vendored dataset`,
                  );
                }
                const durationSec = e.seconds ?? (e.minutes !== undefined ? e.minutes * 60 : null);
                return {
                  exerciseId,
                  exerciseName: e.name,
                  position,
                  targetSets: e.sets,
                  targetReps: durationSec === null ? (e.reps ?? null) : null,
                  targetDurationSec: durationSec,
                  restSec: e.restSec,
                };
              }),
            },
    })),
  };
}

async function main() {
  const dir = fileURLToPath(new URL('./plans', import.meta.url));
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort();
  if (files.length === 0) throw new Error(`No plan files in ${dir}`);

  const ownerName = process.env.PLAN_OWNER ?? 'admin';
  const owner = await pool.query<{ id: string }>(
    'SELECT id FROM users WHERE lower(username) = lower($1)',
    [ownerName],
  );
  const ownerId = owner.rows[0]?.id;
  if (!ownerId) throw new Error(`Owner "${ownerName}" is not a user in this database`);

  for (const file of files) {
    const plan = JSON.parse(readFileSync(join(dir, file), 'utf8')) as PlanFile;
    if (plan.days.length !== 7)
      throw new Error(`${plan.key}: a plan needs 7 days, got ${plan.days.length}`);
    const payload = toPayload(plan);
    const res = await pool.query<{ id: string; inserted: boolean }>(
      `INSERT INTO shared_plans
         (owner_user_id, local_plan_id, name, description, visibility, difficulty, goal, diet, payload)
       VALUES ($1, $2, $3, $4, 'public', $5, $6, $7, $8::jsonb)
       ON CONFLICT (owner_user_id, local_plan_id) DO UPDATE
         SET name = EXCLUDED.name, description = EXCLUDED.description, visibility = 'public',
             difficulty = EXCLUDED.difficulty, goal = EXCLUDED.goal, diet = EXCLUDED.diet,
             payload = EXCLUDED.payload, updated_at = now()
       RETURNING id, (xmax = 0) AS inserted`,
      [
        ownerId,
        `curated:${plan.key}`,
        plan.name,
        plan.description,
        plan.difficulty,
        plan.goal,
        plan.diet,
        JSON.stringify(payload),
      ],
    );
    const row = res.rows[0]!;
    console.log(`${row.inserted ? 'published' : 'updated'}  ${plan.name}  (${row.id})`);
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
