/** Versioned schema for the local SQLite database.
 * To evolve the schema, add a new entry with `toVersion: N + 1` containing only
 * the ALTER/CREATE statements for that step — never edit an existing version. */

export const DB_NAME = 'arcadia';

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
];

export const DB_VERSION = upgradeStatements[upgradeStatements.length - 1]!.toVersion;
