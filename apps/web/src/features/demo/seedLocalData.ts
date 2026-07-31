import { getDb, newId, persist } from '@/lib/db';
import { fetchExercises } from '@/lib/exercise-db/client';

/** Fills the LOCAL device database with realistic demo data (workouts, logged
 * sessions, foods, today's diary, a shopping list). Idempotent — skips if any
 * workouts already exist. Exercises come from the bundled catalog so ids and
 * names are real. Server-side state (account, notifications) is separate. */
export async function seedDemoLocalData(): Promise<boolean> {
  const db = await getDb();
  const existing = await db.query('SELECT count(*) AS c FROM workouts');
  if (((existing.values?.[0]?.c as number) ?? 0) > 0) return false;

  const { exercises } = await fetchExercises(0, 30);
  if (exercises.length < 12) throw new Error('Not enough exercises available to seed');

  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const workouts = [
    { name: 'Push Day', exercises: exercises.slice(0, 4) },
    { name: 'Pull Day', exercises: exercises.slice(4, 8) },
    { name: 'Leg Day', exercises: exercises.slice(8, 12) },
  ];

  for (const workout of workouts) {
    const workoutId = newId();
    await db.run(
      "INSERT INTO workouts (id, name, notes, source, created_at, updated_at) VALUES (?, ?, 'Demo data', 'provided', ?, ?)",
      [workoutId, workout.name, now, now],
    );
    for (const [position, exercise] of workout.exercises.entries()) {
      await db.run(
        `INSERT INTO workout_exercises
          (id, workout_id, exercise_id, exercise_name, position, target_sets, target_reps, rest_sec)
         VALUES (?, ?, ?, ?, ?, 3, 10, 90)`,
        [newId(), workoutId, exercise.id, exercise.name, position],
      );
    }

    // One completed session per workout, spread over the past week.
    const sessionId = newId();
    const daysAgo = 2 + workouts.indexOf(workout) * 2;
    const started = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    const finished = new Date(started.getTime() + 55 * 60 * 1000);
    await db.run(
      'INSERT INTO workout_sessions (id, workout_id, workout_name, started_at, finished_at) VALUES (?, ?, ?, ?, ?)',
      [sessionId, workoutId, workout.name, started.toISOString(), finished.toISOString()],
    );
    for (const exercise of workout.exercises) {
      for (let set = 1; set <= 3; set++) {
        await db.run(
          `INSERT INTO logged_sets
            (id, session_id, exercise_id, exercise_name, set_number, reps, weight_kg, completed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [newId(), sessionId, exercise.id, exercise.name, set, 10 - set, 40 + set * 5, finished.toISOString()],
        );
      }
    }
  }

  const foods: [string, number, number, number, number][] = [
    ['Chicken breast', 165, 31, 0, 3.6],
    ['Brown rice (cooked)', 112, 2.6, 23, 0.9],
    ['Broccoli', 34, 2.8, 7, 0.4],
    ['Greek yogurt', 59, 10, 3.6, 0.4],
    ['Oats', 389, 16.9, 66, 6.9],
    ['Banana', 89, 1.1, 23, 0.3],
  ];
  const foodIds: string[] = [];
  for (const [name, kcal, protein, carbs, fat] of foods) {
    const id = newId();
    foodIds.push(id);
    await db.run(
      `INSERT INTO foods (id, name, brand, barcode, source, kcal, protein_g, carbs_g, fat_g)
       VALUES (?, ?, NULL, NULL, 'user', ?, ?, ?, ?)`,
      [id, name, kcal, protein, carbs, fat],
    );
  }

  const meals: [number, string, number][] = [
    [4, 'breakfast', 80], // oats
    [5, 'breakfast', 120], // banana
    [0, 'lunch', 200], // chicken
    [1, 'lunch', 180], // rice
    [2, 'dinner', 150], // broccoli
    [3, 'snack', 170], // yogurt
  ];
  for (const [foodIndex, meal, grams] of meals) {
    const [name, kcal, protein, carbs, fat] = foods[foodIndex]!;
    const f = grams / 100;
    await db.run(
      `INSERT INTO diary_entries
        (id, date, meal, food_id, food_name, grams, kcal, protein_g, carbs_g, fat_g, logged_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId(),
        today,
        meal,
        foodIds[foodIndex],
        name,
        grams,
        Math.round(kcal * f),
        +(protein * f).toFixed(1),
        +(carbs * f).toFixed(1),
        +(fat * f).toFixed(1),
        now,
      ],
    );
  }

  const listId = newId();
  await db.run(
    'INSERT INTO shopping_lists (id, name, diet_plan_id, created_at) VALUES (?, ?, NULL, ?)',
    [listId, 'Weekly groceries', now],
  );
  const items: [string, string, number][] = [
    ['Chicken breast', '1 kg', 0],
    ['Brown rice', '500 g', 0],
    ['Broccoli', '2 heads', 1],
    ['Greek yogurt', '4 cups', 0],
    ['Oats', '1 box', 1],
    ['Bananas', '6', 0],
  ];
  for (const [position, [name, quantity, checked]] of items.entries()) {
    await db.run(
      'INSERT INTO shopping_list_items (id, list_id, name, quantity, checked, position) VALUES (?, ?, ?, ?, ?, ?)',
      [newId(), listId, name, quantity, checked, position],
    );
  }

  await persist();
  return true;
}
