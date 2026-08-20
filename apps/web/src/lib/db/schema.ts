/** Versioned schema for the local SQLite database.
 * To evolve the schema, add a new entry with `toVersion: N + 1` containing only
 * the ALTER/CREATE statements for that step — never edit an existing version. */

export const DB_NAME = 'arcadia';

/** Tables mirrored to the server when sync is on. Adding a table here (plus a
 * new schema version calling syncTriggerStatements + a backfill seed) is all
 * it takes to sync a new domain — the engine and server are entity-agnostic. */
export const SYNCED_TABLES = [
  'foods',
  'diary_entries',
  'recipes',
  'recipe_ingredients',
  'meal_plan_items',
  'shopping_items',
  'body_weight_logs',
] as const;

const NOW_ISO = `strftime('%Y-%m-%dT%H:%M:%fZ','now')`;
// Triggers record every write into sync_pending (a dirty-set, latest change
// wins per row) so repositories never have to remember to track changes.
// The WHEN guard lets the sync engine apply *remote* changes without them
// echoing back into the pending set (suspend flag in sync_meta).
const NOT_APPLYING = `COALESCE((SELECT value FROM sync_meta WHERE key = 'suspend'), '0') <> '1'`;

function syncTriggerStatements(table: string): string[] {
  const mark = (rowId: string, op: string) =>
    `INSERT INTO sync_pending (entity, row_id, op, changed_at)
       VALUES ('${table}', ${rowId}, '${op}', ${NOW_ISO})
       ON CONFLICT(entity, row_id) DO UPDATE SET op = excluded.op, changed_at = excluded.changed_at;`;
  return [
    `CREATE TRIGGER IF NOT EXISTS trg_sync_${table}_ins AFTER INSERT ON ${table}
       WHEN ${NOT_APPLYING} BEGIN ${mark('NEW.id', 'upsert')} END;`,
    `CREATE TRIGGER IF NOT EXISTS trg_sync_${table}_upd AFTER UPDATE ON ${table}
       WHEN ${NOT_APPLYING} BEGIN ${mark('NEW.id', 'upsert')} END;`,
    `CREATE TRIGGER IF NOT EXISTS trg_sync_${table}_del AFTER DELETE ON ${table}
       WHEN ${NOT_APPLYING} BEGIN ${mark('OLD.id', 'delete')} END;`,
  ];
}

/** Marks every existing row as pending — first-sync backfill, and re-run when
 * the user re-enables sync (their server copy may be gone or stale). */
export function seedPendingStatements(): string[] {
  return SYNCED_TABLES.map(
    (t) =>
      `INSERT INTO sync_pending (entity, row_id, op, changed_at)
         SELECT '${t}', id, 'upsert', ${NOW_ISO} FROM ${t} WHERE true
         ON CONFLICT(entity, row_id) DO NOTHING;`,
  );
}

export const upgradeStatements = [
  {
    toVersion: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS workouts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        notes TEXT,
        source TEXT NOT NULL DEFAULT 'user',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS workout_exercises (
        id TEXT PRIMARY KEY,
        workout_id TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
        exercise_id INTEGER NOT NULL,
        exercise_name TEXT NOT NULL,
        position INTEGER NOT NULL,
        target_sets INTEGER NOT NULL DEFAULT 3,
        target_reps INTEGER,
        target_duration_sec INTEGER,
        rest_sec INTEGER,
        notes TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS workout_sessions (
        id TEXT PRIMARY KEY,
        workout_id TEXT,
        workout_name TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS logged_sets (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
        exercise_id INTEGER NOT NULL,
        exercise_name TEXT NOT NULL,
        set_number INTEGER NOT NULL,
        reps INTEGER,
        weight_kg REAL,
        duration_sec INTEGER,
        completed_at TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS foods (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        brand TEXT,
        barcode TEXT,
        source TEXT NOT NULL DEFAULT 'user',
        kcal REAL NOT NULL,
        protein_g REAL NOT NULL,
        carbs_g REAL NOT NULL,
        fat_g REAL NOT NULL,
        fiber_g REAL,
        sugar_g REAL,
        serving_name TEXT,
        serving_grams REAL
      );`,
      `CREATE TABLE IF NOT EXISTS diary_entries (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        meal TEXT NOT NULL,
        food_id TEXT NOT NULL REFERENCES foods(id),
        food_name TEXT NOT NULL,
        grams REAL NOT NULL,
        kcal REAL NOT NULL,
        protein_g REAL NOT NULL,
        carbs_g REAL NOT NULL,
        fat_g REAL NOT NULL,
        logged_at TEXT NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS idx_diary_entries_date ON diary_entries(date);`,
      `CREATE TABLE IF NOT EXISTS recipes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        instructions TEXT,
        servings INTEGER NOT NULL DEFAULT 1
      );`,
      `CREATE TABLE IF NOT EXISTS recipe_ingredients (
        id TEXT PRIMARY KEY,
        recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
        food_id TEXT NOT NULL REFERENCES foods(id),
        food_name TEXT NOT NULL,
        grams REAL NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS training_plans (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        source TEXT NOT NULL DEFAULT 'user'
      );`,
      `CREATE TABLE IF NOT EXISTS training_plan_days (
        plan_id TEXT NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
        day_of_week INTEGER NOT NULL,
        workout_id TEXT,
        is_rest_day INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (plan_id, day_of_week)
      );`,
      `CREATE TABLE IF NOT EXISTS diet_plans (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        source TEXT NOT NULL DEFAULT 'user'
      );`,
      `CREATE TABLE IF NOT EXISTS diet_plan_meals (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL REFERENCES diet_plans(id) ON DELETE CASCADE,
        day_of_week INTEGER NOT NULL,
        meal TEXT NOT NULL,
        recipe_id TEXT NOT NULL REFERENCES recipes(id),
        recipe_name TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS shopping_lists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        diet_plan_id TEXT,
        created_at TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS shopping_list_items (
        id TEXT PRIMARY KEY,
        list_id TEXT NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        quantity TEXT,
        checked INTEGER NOT NULL DEFAULT 0,
        position INTEGER NOT NULL DEFAULT 0
      );`,
      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );`,
    ],
  },
  {
    toVersion: 2,
    statements: [
      `CREATE TABLE IF NOT EXISTS goals (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        target REAL,
        muscle_id INTEGER,
        muscle_name TEXT,
        created_at TEXT NOT NULL,
        archived INTEGER NOT NULL DEFAULT 0
      );`,
      `CREATE TABLE IF NOT EXISTS body_weight_logs (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL UNIQUE,
        weight_kg REAL NOT NULL,
        logged_at TEXT NOT NULL
      );`,
    ],
  },
  {
    toVersion: 3,
    statements: [
      `ALTER TABLE foods ADD COLUMN saturated_fat_g REAL;`,
      `ALTER TABLE foods ADD COLUMN sodium_g REAL;`,
      `ALTER TABLE foods ADD COLUMN image_url TEXT;`,
      `ALTER TABLE diary_entries ADD COLUMN sugar_g REAL;`,
      `ALTER TABLE diary_entries ADD COLUMN fiber_g REAL;`,
      `ALTER TABLE diary_entries ADD COLUMN sodium_g REAL;`,
    ],
  },
  {
    toVersion: 4,
    statements: [
      // One living shopping list. Items flip between 'needed' and 'bought';
      // bought items stay as history with a purchase count so they can be
      // re-added ("rebuy") instead of creating list after list.
      `CREATE TABLE IF NOT EXISTS shopping_items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        quantity TEXT,
        status TEXT NOT NULL DEFAULT 'needed',
        position INTEGER NOT NULL DEFAULT 0,
        times_bought INTEGER NOT NULL DEFAULT 0,
        last_bought_at TEXT
      );`,
      // Carry existing multi-list items into the single list; checked = bought.
      `INSERT INTO shopping_items (id, name, quantity, status, position, times_bought, last_bought_at)
        SELECT id, name, quantity,
               CASE WHEN checked = 1 THEN 'bought' ELSE 'needed' END,
               position, checked, NULL
          FROM shopping_list_items;`,
      // The weekly meal plan: one implicit plan, slots keyed by day + meal.
      // A slot entry is either a plain food (grams) or a recipe (servings).
      `CREATE TABLE IF NOT EXISTS meal_plan_items (
        id TEXT PRIMARY KEY,
        day_of_week INTEGER NOT NULL,
        meal TEXT NOT NULL,
        kind TEXT NOT NULL,
        ref_id TEXT NOT NULL,
        name TEXT NOT NULL,
        grams REAL,
        servings REAL
      );`,
      `CREATE INDEX IF NOT EXISTS idx_meal_plan_items_day ON meal_plan_items(day_of_week);`,
    ],
  },
  {
    toVersion: 5,
    statements: [
      // Sharing scope for training plans: private (device only), friends, or
      // public (community browse). The share itself lives server-side.
      `ALTER TABLE training_plans ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private';`,
    ],
  },
  {
    toVersion: 6,
    statements: [
      // Purge foods imported before the plausibility filter existed: community
      // data with impossible per-100g numbers (e.g. 38,000 kcal). Everything
      // referencing them goes too — their diary entries and plan/recipe uses
      // are equally wrong.
      `CREATE TEMPORARY TABLE implausible_foods AS
        SELECT id FROM foods
         WHERE kcal < 0 OR kcal > 950
            OR protein_g < 0 OR protein_g > 100
            OR carbs_g   < 0 OR carbs_g   > 100
            OR fat_g     < 0 OR fat_g     > 100
            OR COALESCE(sugar_g, 0)  < 0 OR COALESCE(sugar_g, 0)  > 100
            OR COALESCE(fiber_g, 0)  < 0 OR COALESCE(fiber_g, 0)  > 100
            OR COALESCE(sodium_g, 0) < 0 OR COALESCE(sodium_g, 0) > 40;`,
      `DELETE FROM diary_entries WHERE food_id IN (SELECT id FROM implausible_foods);`,
      `DELETE FROM recipe_ingredients WHERE food_id IN (SELECT id FROM implausible_foods);`,
      `DELETE FROM meal_plan_items WHERE kind = 'food' AND ref_id IN (SELECT id FROM implausible_foods);`,
      `DELETE FROM foods WHERE id IN (SELECT id FROM implausible_foods);`,
      `DROP TABLE implausible_foods;`,
    ],
  },
  {
    toVersion: 7,
    statements: [
      // Device sync plumbing. sync_meta holds engine state (device id, pull
      // cursor, enabled flag, apply-suspend flag); sync_pending is the set of
      // rows changed since their last successful push.
      `CREATE TABLE IF NOT EXISTS sync_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS sync_pending (
        entity TEXT NOT NULL,
        row_id TEXT NOT NULL,
        op TEXT NOT NULL,
        changed_at TEXT NOT NULL,
        PRIMARY KEY (entity, row_id)
      );`,
      ...SYNCED_TABLES.flatMap(syncTriggerStatements),
      // Everything that already exists syncs on first push.
      ...seedPendingStatements(),
    ],
  },
  {
    toVersion: 8,
    statements: [
      // Body weight joins sync with a *deterministic* id: the date itself.
      // Two devices logging the same day now address the same row (LWW picks
      // the later weigh-in) instead of colliding on UNIQUE(date). Triggers
      // first so the id rewrite marks every row pending; the seed then covers
      // devices that migrated straight past v7's list.
      ...syncTriggerStatements('body_weight_logs'),
      `UPDATE body_weight_logs SET id = date;`,
      ...seedPendingStatements(),
    ],
  },
];

export const DB_VERSION = upgradeStatements[upgradeStatements.length - 1]!.toVersion;
