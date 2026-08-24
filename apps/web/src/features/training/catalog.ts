import type { TrainingGoal, TrainingLevel } from './profile';

/** The built-in workout catalog: 62 curated workouts and 13 weekly plans
 * spanning every goal at three intensity levels, across strength, cardio,
 * HIIT and mobility categories. Exercise names MUST match the vendored Free
 * Exercise DB dataset exactly — they're resolved to exercise ids at import
 * time (see recommend.ts), and the typecheck-time constant here is verified
 * by the import path's name lookup. */

export interface CatalogExercise {
  /** Exact dataset name. */
  name: string;
  sets: number;
  reps?: number;
  /** For timed work (cardio, planks) — minutes per set. */
  minutes?: number;
  /** For short timed work (interval bursts, stretch holds) — seconds per set.
   * Wins over minutes when both are set. */
  seconds?: number;
  restSec: number;
}

/** What kind of session a workout is — the second browse axis next to goal.
 * Mobility exists so stretch routines are first-class plannable workouts. */
export type WorkoutCategory = 'strength' | 'cardio' | 'hiit' | 'mobility';

export const WORKOUT_CATEGORY_OPTIONS: { id: WorkoutCategory; label: string }[] = [
  { id: 'strength', label: 'Strength' },
  { id: 'cardio', label: 'Cardio' },
  { id: 'hiit', label: 'HIIT' },
  { id: 'mobility', label: 'Stretch & mobility' },
];

export const WORKOUT_CATEGORY_LABELS: Record<WorkoutCategory, string> = Object.fromEntries(
  WORKOUT_CATEGORY_OPTIONS.map((c) => [c.id, c.label]),
) as Record<WorkoutCategory, string>;

export interface CatalogWorkout {
  key: string;
  name: string;
  description: string;
  goal: TrainingGoal;
  level: TrainingLevel;
  category: WorkoutCategory;
  exercises: CatalogExercise[];
}

/* ----------------------- Explore editorial shelves ----------------------- */

/** Flagship plans surfaced in Explore's Featured shelf — curate by hand,
 * order matters. */
export const FEATURED_PLAN_KEYS = ['plan-fat-comeback', 'plan-run-c25k', 'plan-fit-365'] as const;

/** Latest catalog additions, newest release first — the "New" shelf. Move
 * keys out when they stop being news; keep this list short. */
export const NEW_PLAN_KEYS = [
  'plan-fat-comeback',
  'plan-fat-shred5',
  'plan-mus-ulppl',
  'plan-run-c25k',
  'plan-fit-365',
] as const;

export const NEW_WORKOUT_KEYS = [
  'hiit-tabata',
  'hiit-kb-clock',
  'hiit-chipper',
  'hiit-102030',
  'mob-cooldown',
  'mob-hips',
  'mob-desk',
  'run-c25k',
  'cardio-5mile',
] as const;

export interface CatalogPlan {
  key: string;
  name: string;
  description: string;
  goal: TrainingGoal;
  level: TrainingLevel;
  diet: 'high_protein' | 'calorie_deficit' | 'balanced' | 'performance';
  daysPerWeek: number;
  /** Monday-first week: a workout key, or 'rest'. */
  days: (string | 'rest')[];
}

const ex = (name: string, sets: number, reps: number, restSec: number): CatalogExercise => ({
  name,
  sets,
  reps,
  restSec,
});
const timed = (name: string, sets: number, minutes: number, restSec = 60): CatalogExercise => ({
  name,
  sets,
  minutes,
  restSec,
});
/** Seconds-per-set timed work: interval bursts and stretch holds. */
const hold = (name: string, sets: number, seconds: number, restSec = 15): CatalogExercise => ({
  name,
  sets,
  seconds,
  restSec,
});

export const CATALOG_WORKOUTS: CatalogWorkout[] = [
  /* ------------------------------ Get stronger ------------------------------ */
  {
    key: 'str-foundations-a',
    name: 'Strength Foundations A',
    description: 'The classic starter: squat, press, pull. Add weight every session you complete.',
    goal: 'get_stronger',
    level: 'beginner',
    category: 'strength',
    exercises: [
      ex('Barbell Squat', 3, 5, 180),
      ex('Barbell Bench Press - Medium Grip', 3, 5, 180),
      ex('Bent Over Barbell Row', 3, 8, 120),
      timed('Plank', 3, 1, 60),
    ],
  },
  {
    key: 'str-foundations-b',
    name: 'Strength Foundations B',
    description: 'Alternate with Foundations A: hinge, overhead press, and vertical pull.',
    goal: 'get_stronger',
    level: 'beginner',
    category: 'strength',
    exercises: [
      ex('Barbell Deadlift', 3, 5, 180),
      ex('Standing Military Press', 3, 5, 180),
      ex('Wide-Grip Lat Pulldown', 3, 8, 120),
      ex('Goblet Squat', 3, 8, 90),
    ],
  },
  {
    key: 'str-squat-day',
    name: 'Squat Day',
    description: 'Volume squats with quad and hamstring accessories.',
    goal: 'get_stronger',
    level: 'intermediate',
    category: 'strength',
    exercises: [
      ex('Barbell Squat', 5, 5, 180),
      ex('Leg Press', 3, 8, 120),
      ex('Romanian Deadlift', 3, 8, 120),
      ex('Standing Calf Raises', 4, 10, 60),
      ex('Hanging Leg Raise', 3, 10, 60),
    ],
  },
  {
    key: 'str-bench-day',
    name: 'Bench Day',
    description: 'Heavy pressing plus triceps and rear-delt balance work.',
    goal: 'get_stronger',
    level: 'intermediate',
    category: 'strength',
    exercises: [
      ex('Barbell Bench Press - Medium Grip', 5, 5, 180),
      ex('Barbell Incline Bench Press - Medium Grip', 3, 8, 120),
      ex('Dips - Triceps Version', 3, 8, 90),
      ex('Face Pull', 3, 12, 60),
    ],
  },
  {
    key: 'str-deadlift-day',
    name: 'Deadlift Day',
    description: 'Low-rep pulls with posterior-chain accessories.',
    goal: 'get_stronger',
    level: 'intermediate',
    category: 'strength',
    exercises: [
      ex('Barbell Deadlift', 5, 3, 210),
      ex('Bent Over Barbell Row', 4, 6, 120),
      ex('Good Morning', 3, 8, 120),
      ex('Barbell Shrug', 3, 10, 90),
    ],
  },
  {
    key: 'str-overhead-day',
    name: 'Overhead Day',
    description: 'Strict and push pressing for a stronger overhead lockout.',
    goal: 'get_stronger',
    level: 'intermediate',
    category: 'strength',
    exercises: [
      ex('Standing Military Press', 5, 5, 180),
      ex('Push Press', 3, 5, 150),
      ex('Side Lateral Raise', 3, 12, 60),
      ex('Upright Barbell Row', 3, 10, 90),
      ex('Triceps Pushdown', 3, 10, 60),
    ],
  },
  {
    key: 'str-heavy-lower',
    name: 'Heavy Lower',
    description: 'Triples and front squats — for lifters with a solid base.',
    goal: 'get_stronger',
    level: 'advanced',
    category: 'strength',
    exercises: [
      ex('Barbell Squat', 6, 3, 240),
      ex('Front Squat (Clean Grip)', 4, 5, 180),
      ex('Stiff-Legged Barbell Deadlift', 3, 6, 150),
      ex('Weighted Jump Squat', 3, 5, 120),
    ],
  },
  {
    key: 'str-heavy-upper',
    name: 'Heavy Upper',
    description: 'Heavy bench triples with strict accessory pressing and pulling.',
    goal: 'get_stronger',
    level: 'advanced',
    category: 'strength',
    exercises: [
      ex('Bench Press - Powerlifting', 6, 3, 240),
      ex('Close-Grip Barbell Bench Press', 4, 5, 180),
      ex('Seated Cable Rows', 4, 8, 120),
      ex('Chin-Up', 4, 6, 120),
      ex('EZ-Bar Skullcrusher', 3, 8, 90),
    ],
  },
  {
    key: 'str-olympic-power',
    name: 'Olympic Power',
    description: 'Explosive barbell work: cleans, snatches, and overhead stability.',
    goal: 'get_stronger',
    level: 'advanced',
    category: 'strength',
    exercises: [
      ex('Power Clean', 5, 3, 210),
      ex('Snatch', 5, 2, 210),
      ex('Push Press', 4, 3, 180),
      ex('Overhead Squat', 3, 5, 150),
    ],
  },
  {
    key: 'str-strongman',
    name: 'Strongman Conditioning',
    description: 'Carries, pushes and pulls — strength you can use.',
    goal: 'get_stronger',
    level: 'advanced',
    category: 'strength',
    exercises: [
      ex('Trap Bar Deadlift', 4, 5, 180),
      timed("Farmer's Walk", 4, 1, 120),
      timed('Sled Push', 5, 1, 120),
      ex('Box Jump (Multiple Response)', 4, 5, 90),
    ],
  },

  /* ------------------------------ Build muscle ------------------------------ */
  {
    key: 'mus-fullbody-starter',
    name: 'Full Body Muscle Starter',
    description: 'One approachable session that touches every major muscle.',
    goal: 'build_muscle',
    level: 'beginner',
    category: 'strength',
    exercises: [
      ex('Goblet Squat', 3, 10, 90),
      ex('Pushups', 3, 10, 90),
      ex('Seated Cable Rows', 3, 10, 90),
      ex('Dumbbell Shoulder Press', 3, 10, 90),
      ex('Crunches', 3, 15, 45),
    ],
  },
  {
    key: 'mus-upper-basics',
    name: 'Upper Body Basics',
    description: 'Simple pressing, pulling and arm work with dumbbells and cables.',
    goal: 'build_muscle',
    level: 'beginner',
    category: 'strength',
    exercises: [
      ex('Dumbbell Bench Press', 3, 10, 90),
      ex('Wide-Grip Lat Pulldown', 3, 10, 90),
      ex('Side Lateral Raise', 3, 12, 60),
      ex('Barbell Curl', 3, 10, 60),
      ex('Triceps Pushdown', 3, 10, 60),
    ],
  },
  {
    key: 'mus-lower-basics',
    name: 'Lower Body Basics',
    description: 'Machine-guided leg training that builds confidence and quads.',
    goal: 'build_muscle',
    level: 'beginner',
    category: 'strength',
    exercises: [
      ex('Leg Press', 3, 12, 90),
      ex('Lying Leg Curls', 3, 12, 90),
      ex('Leg Extensions', 3, 12, 60),
      ex('Standing Calf Raises', 3, 15, 45),
      timed('Plank', 3, 1, 45),
    ],
  },
  {
    key: 'mus-push',
    name: 'Push Hypertrophy',
    description: 'Chest, shoulders and triceps: the push day of a classic PPL split.',
    goal: 'build_muscle',
    level: 'intermediate',
    category: 'strength',
    exercises: [
      ex('Barbell Bench Press - Medium Grip', 4, 8, 120),
      ex('Incline Dumbbell Press', 3, 10, 90),
      ex('Dumbbell Shoulder Press', 3, 10, 90),
      ex('Cable Crossover', 3, 12, 60),
      ex('Side Lateral Raise', 3, 15, 60),
      ex('Triceps Pushdown', 3, 12, 60),
    ],
  },
  {
    key: 'mus-pull',
    name: 'Pull Hypertrophy',
    description: 'Back width, back thickness, and biceps: the pull day.',
    goal: 'build_muscle',
    level: 'intermediate',
    category: 'strength',
    exercises: [
      ex('Pullups', 4, 8, 120),
      ex('Bent Over Barbell Row', 4, 8, 120),
      ex('Seated Cable Rows', 3, 10, 90),
      ex('Face Pull', 3, 15, 60),
      ex('Barbell Curl', 3, 10, 60),
      ex('Hammer Curls', 3, 12, 60),
    ],
  },
  {
    key: 'mus-legs',
    name: 'Legs Hypertrophy',
    description: 'Quads, hamstrings, glutes and calves: the legs day.',
    goal: 'build_muscle',
    level: 'intermediate',
    category: 'strength',
    exercises: [
      ex('Barbell Squat', 4, 8, 150),
      ex('Romanian Deadlift', 3, 10, 120),
      ex('Leg Press', 3, 12, 90),
      ex('Lying Leg Curls', 3, 12, 60),
      ex('Standing Calf Raises', 4, 15, 45),
      ex('Hanging Leg Raise', 3, 12, 60),
    ],
  },
  {
    key: 'mus-chest-back',
    name: 'Chest & Back',
    description: 'Antagonist supersetting classic: press, then pull, repeat.',
    goal: 'build_muscle',
    level: 'intermediate',
    category: 'strength',
    exercises: [
      ex('Barbell Bench Press - Medium Grip', 4, 8, 120),
      ex('Wide-Grip Lat Pulldown', 4, 10, 90),
      ex('Incline Dumbbell Press', 3, 10, 90),
      ex('Seated Cable Rows', 3, 10, 90),
      ex('Dumbbell Flyes', 3, 12, 60),
    ],
  },
  {
    key: 'mus-arms-shoulders',
    name: 'Arms & Shoulders',
    description: 'A focused pump day for delts, biceps and triceps.',
    goal: 'build_muscle',
    level: 'intermediate',
    category: 'strength',
    exercises: [
      ex('Arnold Dumbbell Press', 4, 10, 90),
      ex('Side Lateral Raise', 3, 15, 60),
      ex('Barbell Curl', 3, 10, 60),
      ex('EZ-Bar Skullcrusher', 3, 10, 60),
      ex('Hammer Curls', 3, 12, 45),
      ex('Cable Lying Triceps Extension', 3, 12, 45),
    ],
  },
  {
    key: 'mus-push-adv',
    name: 'Push Advanced',
    description: 'High-volume pressing for experienced lifters chasing size.',
    goal: 'build_muscle',
    level: 'advanced',
    category: 'strength',
    exercises: [
      ex('Barbell Bench Press - Medium Grip', 5, 8, 120),
      ex('Barbell Incline Bench Press - Medium Grip', 4, 10, 90),
      ex('Close-Grip Barbell Bench Press', 3, 10, 90),
      ex('Arnold Dumbbell Press', 3, 10, 90),
      ex('Cable Crossover', 3, 15, 60),
      ex('Side Lateral Raise', 4, 15, 45),
    ],
  },
  {
    key: 'mus-pull-adv',
    name: 'Pull Advanced',
    description: 'Heavy rows and weighted vertical pulls with direct arm volume.',
    goal: 'build_muscle',
    level: 'advanced',
    category: 'strength',
    exercises: [
      ex('Chin-Up', 5, 6, 120),
      ex('Bent Over Barbell Row', 5, 8, 120),
      ex('Seated Cable Rows', 4, 10, 90),
      ex('Preacher Curl', 4, 10, 60),
      ex('Face Pull', 4, 15, 45),
    ],
  },
  {
    key: 'mus-glutes-hams',
    name: 'Glutes & Hamstrings',
    description: 'Hip-dominant training: thrusts, hinges and curls.',
    goal: 'build_muscle',
    level: 'advanced',
    category: 'strength',
    exercises: [
      ex('Barbell Hip Thrust', 4, 8, 120),
      ex('Romanian Deadlift', 4, 8, 120),
      ex('Barbell Glute Bridge', 3, 10, 90),
      ex('Lying Leg Curls', 3, 12, 60),
      ex('Glute Kickback', 3, 12, 45),
    ],
  },

  /* ------------------------------- Lose weight ------------------------------ */
  {
    key: 'fat-walk-tone',
    name: 'Walk & Tone',
    description: 'A gentle start: brisk walking plus simple strength moves.',
    goal: 'lose_weight',
    level: 'beginner',
    category: 'cardio',
    exercises: [
      timed('Walking, Treadmill', 1, 20, 60),
      ex('Bodyweight Squat', 3, 12, 60),
      ex('Pushups', 3, 8, 60),
      timed('Plank', 3, 1, 45),
    ],
  },
  {
    key: 'fat-beginner-circuit',
    name: 'Beginner Fat-Burn Circuit',
    description: 'Move continuously: bodyweight circuit with a cardio finisher.',
    goal: 'lose_weight',
    level: 'beginner',
    category: 'hiit',
    exercises: [
      ex('Bodyweight Squat', 3, 15, 45),
      timed('Mountain Climbers', 3, 1, 45),
      ex('Bodyweight Walking Lunge', 3, 10, 45),
      ex('Crunches', 3, 15, 45),
      timed('Elliptical Trainer', 1, 10, 0),
    ],
  },
  {
    key: 'fat-low-impact',
    name: 'Low-Impact Cardio',
    description: 'Easy on the joints, steady on the heart rate.',
    goal: 'lose_weight',
    level: 'beginner',
    category: 'cardio',
    exercises: [
      timed('Elliptical Trainer', 1, 15, 60),
      timed('Bicycling, Stationary', 1, 15, 60),
      timed('Walking, Treadmill', 1, 10, 0),
    ],
  },
  {
    key: 'fat-hiit',
    name: 'HIIT Circuit',
    description: 'Short, hard intervals — maximum burn per minute.',
    goal: 'lose_weight',
    level: 'intermediate',
    category: 'hiit',
    exercises: [
      timed('Rope Jumping', 5, 1, 60),
      ex('Freehand Jump Squat', 4, 12, 60),
      timed('Mountain Climbers', 4, 1, 60),
      timed('Air Bike', 1, 10, 0),
      ex('Russian Twist', 3, 20, 45),
    ],
  },
  {
    key: 'fat-kettlebell',
    name: 'Kettlebell Burner',
    description: 'Swings and squats that double as cardio.',
    goal: 'lose_weight',
    level: 'intermediate',
    category: 'hiit',
    exercises: [
      ex('One-Arm Kettlebell Swings', 4, 15, 60),
      ex('Goblet Squat', 4, 12, 60),
      ex('Dumbbell Step Ups', 3, 10, 60),
      ex('Sit-Up', 3, 15, 45),
      timed('Rope Jumping', 1, 5, 0),
    ],
  },
  {
    key: 'fat-treadmill-intervals',
    name: 'Treadmill Intervals',
    description: 'Run-walk intervals with a core finish.',
    goal: 'lose_weight',
    level: 'intermediate',
    category: 'cardio',
    exercises: [
      timed('Running, Treadmill', 1, 20, 120),
      timed('Walking, Treadmill', 1, 5, 60),
      ex('Hanging Leg Raise', 3, 10, 60),
      timed('Plank', 3, 1, 45),
    ],
  },
  {
    key: 'fat-fullbody-sweat',
    name: 'Full Body Sweat',
    description: 'Strength moves at circuit pace, capped with the air bike.',
    goal: 'lose_weight',
    level: 'intermediate',
    category: 'hiit',
    exercises: [
      ex('Barbell Squat', 3, 12, 60),
      ex('Pushups', 3, 12, 60),
      ex('Seated Cable Rows', 3, 12, 60),
      timed('Air Bike', 1, 8, 60),
      ex('Flutter Kicks', 3, 20, 45),
    ],
  },
  {
    key: 'fat-metcon',
    name: 'Metcon Melter',
    description: 'Explosive lifts and jumps at high heart rate. Advanced only.',
    goal: 'lose_weight',
    level: 'advanced',
    category: 'hiit',
    exercises: [
      ex('Power Clean', 5, 5, 90),
      ex('Box Jump (Multiple Response)', 4, 8, 60),
      ex('Kneeling Jump Squat', 4, 8, 60),
      timed('Rowing, Stationary', 1, 10, 60),
      ex('Ab Roller', 3, 10, 45),
    ],
  },
  {
    key: 'fat-stairs-core',
    name: 'Stairs & Core',
    description: 'Twenty minutes of climbing, then a focused ab block.',
    goal: 'lose_weight',
    level: 'advanced',
    category: 'cardio',
    exercises: [
      timed('Stairmaster', 1, 20, 90),
      ex('Hanging Leg Raise', 4, 12, 60),
      ex('Cable Crunch', 4, 15, 45),
      ex('Russian Twist', 4, 20, 45),
      timed('Side Bridge', 3, 1, 45),
    ],
  },
  {
    key: 'fat-row-burn',
    name: 'Row & Burn',
    description: 'Rowing intervals against heavy pulls and sled work.',
    goal: 'lose_weight',
    level: 'advanced',
    category: 'hiit',
    exercises: [
      timed('Rowing, Stationary', 1, 15, 90),
      ex('Sumo Deadlift', 4, 8, 120),
      ex('Pushups', 4, 15, 60),
      timed('Sled Push', 5, 1, 90),
      ex('Toe Touchers', 3, 15, 45),
    ],
  },

  /* --------------------------------- Stay fit -------------------------------- */
  {
    key: 'fit-first-steps',
    name: 'First Steps Full Body',
    description: 'Your first structured session: simple, safe, complete.',
    goal: 'general',
    level: 'beginner',
    category: 'strength',
    exercises: [
      ex('Bodyweight Squat', 2, 12, 60),
      ex('Pushups', 2, 8, 60),
      ex('Superman', 2, 12, 45),
      timed('Plank', 2, 1, 45),
      timed('Walking, Treadmill', 1, 10, 0),
    ],
  },
  {
    key: 'fit-home-bodyweight',
    name: 'Home Bodyweight Basics',
    description: 'No equipment needed — a living-room full body workout.',
    goal: 'general',
    level: 'beginner',
    category: 'strength',
    exercises: [
      ex('Bodyweight Squat', 3, 12, 45),
      ex('Bodyweight Walking Lunge', 3, 10, 45),
      ex('Pushups', 3, 10, 45),
      ex('Dead Bug', 3, 10, 45),
      timed('Side Bridge', 2, 1, 45),
    ],
  },
  {
    key: 'fit-machine-circuit',
    name: 'Machine Circuit',
    description: 'A guided lap of the machine floor — great for gym newcomers.',
    goal: 'general',
    level: 'beginner',
    category: 'strength',
    exercises: [
      ex('Leg Press', 2, 12, 60),
      ex('Butterfly', 2, 12, 60),
      ex('Wide-Grip Lat Pulldown', 2, 12, 60),
      ex('Leg Extensions', 2, 12, 60),
      ex('Seated Cable Rows', 2, 12, 60),
    ],
  },
  {
    key: 'fit-express-30',
    name: '30-Minute Express',
    description: 'Busy day? One compound per movement pattern and out the door.',
    goal: 'general',
    level: 'intermediate',
    category: 'strength',
    exercises: [
      ex('Goblet Squat', 3, 10, 60),
      ex('Dumbbell Bench Press', 3, 10, 60),
      ex('Seated Cable Rows', 3, 10, 60),
      timed('Plank', 3, 1, 45),
      timed('Rope Jumping', 1, 3, 0),
    ],
  },
  {
    key: 'fit-core-stability',
    name: 'Core & Stability',
    description: 'Anti-rotation, bracing and back health in one session.',
    goal: 'general',
    level: 'intermediate',
    category: 'strength',
    exercises: [
      timed('Plank', 3, 1, 45),
      timed('Side Bridge', 3, 1, 45),
      ex('Dead Bug', 3, 10, 45),
      ex('Pallof Press', 3, 12, 45),
      ex('Hyperextensions (Back Extensions)', 3, 12, 60),
      ex('Ab Roller', 3, 8, 60),
    ],
  },
  {
    key: 'fit-athletic',
    name: 'Athletic Conditioning',
    description: 'Jump, lunge, pull, carry — training that transfers to sport.',
    goal: 'general',
    level: 'intermediate',
    category: 'hiit',
    exercises: [
      ex('Box Jump (Multiple Response)', 4, 6, 90),
      ex('Dumbbell Lunges', 3, 10, 60),
      ex('Pullups', 3, 8, 90),
      timed('Mountain Climbers', 3, 1, 45),
      timed("Farmer's Walk", 3, 1, 90),
    ],
  },
  {
    key: 'fit-balanced-fullbody',
    name: 'Balanced Full Body',
    description: 'The classic barbell full-body — three big lifts plus extras.',
    goal: 'general',
    level: 'intermediate',
    category: 'strength',
    exercises: [
      ex('Barbell Squat', 3, 8, 120),
      ex('Barbell Bench Press - Medium Grip', 3, 8, 120),
      ex('Bent Over Barbell Row', 3, 8, 120),
      ex('Dumbbell Shoulder Press', 3, 10, 90),
      ex('Crunches', 3, 15, 45),
    ],
  },
  {
    key: 'fit-hybrid',
    name: 'Hybrid Athlete',
    description: 'Strength and engine in one session — lift heavy, then run.',
    goal: 'general',
    level: 'advanced',
    category: 'strength',
    exercises: [
      ex('Power Clean', 4, 3, 180),
      ex('Chin-Up', 4, 8, 90),
      ex('Barbell Walking Lunge', 3, 10, 90),
      timed('Running, Treadmill', 1, 15, 0),
    ],
  },
  {
    key: 'fit-total-challenge',
    name: 'Total Body Challenge',
    description: 'A benchmark session: heavy pulls, high-rep pushes, and a row.',
    goal: 'general',
    level: 'advanced',
    category: 'strength',
    exercises: [
      ex('Barbell Deadlift', 4, 5, 180),
      ex('Pushups', 4, 20, 60),
      ex('Box Jump (Multiple Response)', 4, 6, 90),
      timed('Rowing, Stationary', 1, 10, 60),
      ex('Ab Roller', 4, 10, 60),
    ],
  },

  /* --------------------- Upper/Lower + PPL hybrid (5-day) --------------------- */
  {
    key: 'ulppl-upper',
    name: 'Upper Strength',
    description: 'Heavy fives on the big presses and rows — the strength half of the hybrid week.',
    goal: 'build_muscle',
    level: 'intermediate',
    category: 'strength',
    exercises: [
      ex('Barbell Bench Press - Medium Grip', 4, 5, 180),
      ex('Bent Over Barbell Row', 4, 5, 180),
      ex('Standing Military Press', 3, 8, 120),
      ex('Wide-Grip Lat Pulldown', 3, 10, 90),
      ex('Incline Dumbbell Press', 3, 10, 90),
      ex('Barbell Curl', 3, 10, 60),
      ex('Triceps Overhead Extension with Rope', 3, 12, 60),
    ],
  },
  {
    key: 'ulppl-lower',
    name: 'Lower Strength',
    description: 'Squat fives, a heavy hinge, then quad and hamstring volume.',
    goal: 'build_muscle',
    level: 'intermediate',
    category: 'strength',
    exercises: [
      ex('Barbell Squat', 4, 5, 180),
      ex('Romanian Deadlift', 3, 8, 120),
      ex('Leg Press', 3, 10, 90),
      ex('Lying Leg Curls', 3, 12, 60),
      ex('Standing Calf Raises', 4, 12, 60),
      ex('Hanging Leg Raise', 3, 12, 60),
    ],
  },
  {
    key: 'ulppl-push',
    name: 'Push Volume',
    description: 'The hypertrophy pressing day: incline first, delts and triceps from every angle.',
    goal: 'build_muscle',
    level: 'intermediate',
    category: 'strength',
    exercises: [
      ex('Barbell Incline Bench Press - Medium Grip', 3, 10, 90),
      ex('Dumbbell Shoulder Press', 3, 10, 90),
      ex('Dumbbell Flyes', 3, 12, 60),
      ex('Side Lateral Raise', 3, 15, 60),
      ex('Triceps Pushdown', 3, 12, 60),
      ex('Cable Rope Overhead Triceps Extension', 3, 12, 60),
      ex('Pushups', 2, 15, 60),
    ],
  },
  {
    key: 'ulppl-pull',
    name: 'Pull Volume',
    description: 'Deadlift fives open the day; width, thickness and arms fill it.',
    goal: 'build_muscle',
    level: 'intermediate',
    category: 'strength',
    exercises: [
      ex('Barbell Deadlift', 3, 5, 210),
      ex('Pullups', 3, 8, 120),
      ex('Seated Cable Rows', 3, 10, 90),
      ex('Face Pull', 3, 15, 60),
      ex('Dumbbell Shrug', 3, 12, 60),
      ex('Incline Dumbbell Curl', 3, 10, 60),
      ex('Hammer Curls', 3, 12, 60),
    ],
  },
  {
    key: 'ulppl-legs',
    name: 'Legs Volume',
    description: 'Front squats, single-leg work and glute loading — the week’s second leg hit.',
    goal: 'build_muscle',
    level: 'intermediate',
    category: 'strength',
    exercises: [
      ex('Front Squat (Clean Grip)', 3, 8, 150),
      ex('One Leg Barbell Squat', 3, 8, 90),
      ex('Barbell Hip Thrust', 3, 10, 90),
      ex('Leg Extensions', 3, 15, 60),
      ex('Lying Leg Curls', 3, 12, 60),
      ex('Seated Calf Raise', 4, 15, 45),
      ex('Cable Crunch', 3, 15, 45),
    ],
  },

  /* --------------- Shred Season: metabolic lifting (cardio between sets) --------------- */
  {
    key: 'shred-chest-tri',
    name: 'Shred: Chest & Triceps',
    description:
      'Every rest period is 60 seconds of cardio — jump rope, march, step-ups. You never actually stop.',
    goal: 'lose_weight',
    level: 'advanced',
    category: 'hiit',
    exercises: [
      ex('Barbell Bench Press - Medium Grip', 4, 10, 60),
      ex('Incline Dumbbell Press', 3, 10, 45),
      ex('Cable Crossover', 3, 14, 45),
      ex('Dips - Triceps Version', 3, 10, 45),
      ex('EZ-Bar Skullcrusher', 3, 10, 45),
      ex('Triceps Pushdown - Rope Attachment', 3, 14, 45),
      ex('Hanging Leg Raise', 3, 15, 45),
      timed('Plank', 3, 1, 45),
    ],
  },
  {
    key: 'shred-back-bi',
    name: 'Shred: Back & Biceps',
    description: 'Deadlifts to straight-arm pulldowns with a cardio minute between every set.',
    goal: 'lose_weight',
    level: 'advanced',
    category: 'hiit',
    exercises: [
      ex('Barbell Deadlift', 3, 8, 60),
      ex('Bent Over Barbell Row', 4, 10, 45),
      ex('Wide-Grip Lat Pulldown', 3, 10, 45),
      ex('Rope Straight-Arm Pulldown', 3, 14, 45),
      ex('Barbell Curl', 3, 10, 45),
      ex('Incline Dumbbell Curl', 3, 14, 45),
      ex('Zottman Curl', 2, 15, 45),
      ex('Face Pull', 3, 15, 45),
    ],
  },
  {
    key: 'shred-legs',
    name: 'Shred: Legs & Calves',
    description: 'High-rep squats, lunges and hinges — the biggest calorie bill of the week.',
    goal: 'lose_weight',
    level: 'advanced',
    category: 'hiit',
    exercises: [
      ex('Barbell Squat', 4, 10, 60),
      ex('Leg Press', 3, 14, 45),
      ex('Barbell Walking Lunge', 3, 12, 45),
      ex('Romanian Deadlift', 3, 10, 60),
      ex('Leg Extensions', 3, 15, 45),
      ex('Lying Leg Curls', 3, 15, 45),
      ex('Standing Calf Raises', 4, 15, 45),
      ex('Seated Calf Raise', 3, 20, 45),
    ],
  },
  {
    key: 'shred-shoulders',
    name: 'Shred: Shoulders & Core',
    description: 'Presses, raises and trap work at pace, capped with a direct core block.',
    goal: 'lose_weight',
    level: 'advanced',
    category: 'hiit',
    exercises: [
      ex('Standing Military Press', 4, 10, 60),
      ex('Dumbbell Shoulder Press', 3, 12, 45),
      ex('Side Lateral Raise', 4, 14, 45),
      ex('Reverse Flyes', 3, 15, 45),
      ex('Upright Barbell Row', 3, 12, 45),
      ex('Barbell Shrug', 4, 12, 45),
      ex('Cable Crunch', 3, 15, 45),
      ex('Russian Twist', 3, 20, 45),
    ],
  },
  {
    key: 'shred-circuit',
    name: 'Shred: Full-Body Circuit',
    description: 'Three rounds of eight stations, minimal rest, then a treadmill finisher.',
    goal: 'lose_weight',
    level: 'advanced',
    category: 'hiit',
    exercises: [
      ex('Goblet Squat', 3, 12, 30),
      ex('Pushups', 3, 15, 30),
      ex('One-Arm Dumbbell Row', 3, 12, 30),
      ex('One-Arm Kettlebell Push Press', 3, 10, 30),
      ex('One-Arm Kettlebell Swings', 3, 15, 30),
      ex('Dumbbell Rear Lunge', 3, 10, 30),
      timed('Mountain Climbers', 3, 1, 30),
      timed('Running, Treadmill', 1, 10, 0),
    ],
  },

  /* --------------------------------- HIIT --------------------------------- */
  {
    key: 'hiit-tabata',
    name: 'Tabata Quad-Block',
    description:
      'Four Tabata blocks: 8 rounds of 20 seconds all-out, 10 off. Rest 90 seconds between blocks — and “all-out” is the whole point.',
    goal: 'lose_weight',
    level: 'intermediate',
    category: 'hiit',
    exercises: [
      hold('Freehand Jump Squat', 8, 20, 10),
      hold('Bodyweight Squat', 8, 20, 10),
      hold('Mountain Climbers', 8, 20, 10),
      hold('Rope Jumping', 8, 20, 10),
    ],
  },
  {
    key: 'hiit-kb-clock',
    name: 'The Kettlebell Clock',
    description:
      'EMOM 20: do the reps at the top of each minute, rest whatever’s left. Move fast and buy rest; the clock forgives nothing.',
    goal: 'get_stronger',
    level: 'intermediate',
    category: 'hiit',
    exercises: [
      ex('One-Arm Kettlebell Swings', 5, 15, 20),
      ex('Goblet Squat', 5, 12, 20),
      ex('Pushups', 5, 12, 20),
      ex('One-Arm Kettlebell Push Press', 5, 5, 20),
    ],
  },
  {
    key: 'hiit-chipper',
    name: 'Chipper 25',
    description:
      'One circuit, 25 minutes, as many rounds as possible. Your only opponent is last week’s round count.',
    goal: 'lose_weight',
    level: 'intermediate',
    category: 'hiit',
    exercises: [
      ex('Kettlebell Thruster', 5, 10, 15),
      ex('Alternating Renegade Row', 5, 8, 15),
      ex('Dumbbell Rear Lunge', 5, 12, 15),
      ex('Pushups', 5, 10, 15),
      ex('Sit-Up', 5, 15, 15),
    ],
  },
  {
    key: 'hiit-102030',
    name: '30-20-10 Intervals',
    description:
      'The Copenhagen run protocol: each 5-minute block is 5 cycles of 30s easy jog, 20s cruise, 10s sprint. Deceptively simple, honestly hard.',
    goal: 'general',
    level: 'beginner',
    category: 'hiit',
    exercises: [
      timed('Walking, Treadmill', 1, 5, 0),
      timed('Jogging, Treadmill', 3, 5, 120),
      timed('Walking, Treadmill', 1, 5, 0),
    ],
  },

  /* ---------------------------- Stretch & mobility ---------------------------- */
  {
    key: 'mob-cooldown',
    name: 'Full-Body Cool-Down',
    description:
      'The stretch session you always skip, made short enough that you won’t — top-down through every major group while you’re still warm.',
    goal: 'general',
    level: 'beginner',
    category: 'mobility',
    exercises: [
      hold('Side Neck Stretch', 2, 20, 10),
      hold('Shoulder Stretch', 2, 30, 10),
      hold('Overhead Triceps', 2, 30, 10),
      hold('Behind Head Chest Stretch', 2, 30, 10),
      hold('Standing Elevated Quad Stretch', 2, 30, 10),
      hold('Standing Hamstring and Calf Stretch', 2, 30, 10),
      hold('Lying Glute', 2, 30, 10),
      hold('Kneeling Hip Flexor', 2, 30, 10),
      hold('Calf Stretch Hands Against Wall', 2, 30, 10),
      hold("Child's Pose", 1, 60, 0),
    ],
  },
  {
    key: 'mob-hips',
    name: 'Hip Opener Flow',
    description:
      'The stretches physios actually prescribe — 90/90s, deep squat holds, the World’s Greatest — for hips that sit all day and squat on the weekend.',
    goal: 'general',
    level: 'beginner',
    category: 'mobility',
    exercises: [
      ex('Cat Stretch', 2, 8, 15),
      ex("World's Greatest Stretch", 2, 5, 20),
      hold('90/90 Hamstring', 2, 45, 15),
      hold('Sit Squats', 2, 30, 15),
      hold('Kneeling Hip Flexor', 2, 30, 15),
      hold('Lying Glute', 2, 30, 15),
      hold('Groin and Back Stretch', 2, 30, 15),
      ex('Standing Hip Circles', 2, 8, 15),
    ],
  },
  {
    key: 'mob-desk',
    name: 'Desk Undo',
    description:
      'Reverse-engineers eight hours of hunching: opens the chest, unlocks the mid-back, and reminds your neck it can rotate.',
    goal: 'general',
    level: 'beginner',
    category: 'mobility',
    exercises: [
      hold('Side Neck Stretch', 2, 20, 10),
      hold('Chin To Chest Stretch', 2, 20, 10),
      ex('Shoulder Circles', 2, 10, 10),
      hold('Elbows Back', 2, 30, 10),
      ex('Dynamic Chest Stretch', 2, 10, 10),
      hold('Upper Back Stretch', 2, 30, 10),
      hold('Standing Lateral Stretch', 2, 20, 10),
      hold('Side Wrist Pull', 2, 20, 10),
      hold('Looking At Ceiling', 2, 20, 10),
    ],
  },

  /* --------------------------------- Cardio --------------------------------- */
  {
    key: 'run-c25k',
    name: 'Road to 5K Run',
    description:
      'Walk 5 to warm up, then this week’s run/walk intervals (see the plan guide), walk 5 to cool down. Conversational pace — if you can’t speak a sentence, slow down.',
    goal: 'general',
    level: 'beginner',
    category: 'cardio',
    exercises: [
      timed('Walking, Treadmill', 1, 5, 0),
      timed('Jogging, Treadmill', 1, 20, 0),
      timed('Walking, Treadmill', 1, 5, 0),
    ],
  },
  {
    key: 'cardio-5mile',
    name: 'Five-Mile Cruise',
    description:
      'Five miles as the whole workout — steady, conversational effort on the elliptical (or a treadmill walk/jog when you want variety).',
    goal: 'lose_weight',
    level: 'beginner',
    category: 'cardio',
    exercises: [timed('Elliptical Trainer', 1, 60, 0)],
  },

  /* --------------------- The Comeback (hernia-aware 5-day) --------------------- */
  {
    key: 'cb-upper',
    name: 'Comeback Upper',
    description:
      'Pressing, rowing and band balance work in strict 8–12s — exhale on every rep, never grind. Ends with 30 elliptical minutes.',
    goal: 'lose_weight',
    level: 'intermediate',
    category: 'strength',
    exercises: [
      ex('Barbell Bench Press - Medium Grip', 3, 10, 90),
      ex('Bent Over Two-Dumbbell Row', 3, 10, 90),
      ex('Dumbbell Shoulder Press', 3, 10, 90),
      ex('Back Flyes - With Bands', 3, 15, 60),
      ex('Band Pull Apart', 3, 15, 45),
      ex('Barbell Curl', 3, 10, 60),
      ex('Band Skull Crusher', 3, 12, 45),
      ex('Pallof Press', 3, 10, 45),
      timed('Elliptical Trainer', 1, 30, 0),
    ],
  },
  {
    key: 'cb-lower',
    name: 'Comeback Lower',
    description:
      'Goblet squats, hinges and single-leg work at loads you can breathe through, plus glute and deep-core finishers. Ends with 30 elliptical minutes.',
    goal: 'lose_weight',
    level: 'intermediate',
    category: 'strength',
    exercises: [
      ex('Goblet Squat', 4, 10, 90),
      ex('Romanian Deadlift', 3, 10, 120),
      ex('Dumbbell Step Ups', 3, 10, 60),
      ex('Dumbbell Rear Lunge', 3, 10, 60),
      ex('One-Arm Kettlebell Swings', 3, 15, 60),
      ex('Standing Calf Raises', 3, 15, 45),
      ex('Butt Lift (Bridge)', 3, 12, 45),
      ex('Dead Bug', 3, 10, 45),
      timed('Elliptical Trainer', 1, 30, 0),
    ],
  },
  {
    key: 'cb-fullbody',
    name: 'Comeback Full Body',
    description:
      'Every pattern once, carries for the trunk, extension work for the back — all upright, all breathing. Ends with 30 elliptical minutes.',
    goal: 'lose_weight',
    level: 'intermediate',
    category: 'strength',
    exercises: [
      ex('Dumbbell Squat', 3, 12, 60),
      ex('Pushups', 3, 12, 60),
      ex('One-Arm Dumbbell Row', 3, 12, 60),
      ex('One-Arm Kettlebell Push Press', 3, 8, 60),
      ex('Superman', 3, 12, 45),
      timed("Farmer's Walk", 3, 1, 90),
      ex('Dead Bug', 3, 10, 45),
      timed('Elliptical Trainer', 1, 30, 0),
    ],
  },
];

export const CATALOG_PLANS: CatalogPlan[] = [
  {
    key: 'plan-str-beg',
    name: 'Starting Strength 3-Day',
    description: 'Alternating A/B full-body strength — the proven way to start lifting.',
    goal: 'get_stronger',
    level: 'beginner',
    diet: 'high_protein',
    daysPerWeek: 3,
    days: ['str-foundations-a', 'rest', 'str-foundations-b', 'rest', 'str-foundations-a', 'rest', 'rest'],
  },
  {
    key: 'plan-str-int',
    name: '4-Day Strength Split',
    description: 'One big lift per day: squat, bench, deadlift, press.',
    goal: 'get_stronger',
    level: 'intermediate',
    diet: 'high_protein',
    daysPerWeek: 4,
    days: ['str-squat-day', 'str-bench-day', 'rest', 'str-deadlift-day', 'str-overhead-day', 'rest', 'rest'],
  },
  {
    key: 'plan-mus-beg',
    name: 'Muscle Starter 3-Day',
    description: 'Full body, upper, lower — a gentle on-ramp to building muscle.',
    goal: 'build_muscle',
    level: 'beginner',
    diet: 'high_protein',
    daysPerWeek: 3,
    days: ['mus-fullbody-starter', 'rest', 'mus-upper-basics', 'rest', 'mus-lower-basics', 'rest', 'rest'],
  },
  {
    key: 'plan-mus-ppl',
    name: 'Push Pull Legs',
    description: 'The classic 3-day hypertrophy split.',
    goal: 'build_muscle',
    level: 'intermediate',
    diet: 'high_protein',
    daysPerWeek: 3,
    days: ['mus-push', 'rest', 'mus-pull', 'rest', 'mus-legs', 'rest', 'rest'],
  },
  {
    key: 'plan-mus-ppl6',
    name: 'PPL 6-Day Advanced',
    description: 'Push/pull/legs twice a week — serious volume for serious lifters.',
    goal: 'build_muscle',
    level: 'advanced',
    diet: 'high_protein',
    daysPerWeek: 6,
    days: ['mus-push-adv', 'mus-pull-adv', 'mus-legs', 'mus-push', 'mus-pull', 'mus-glutes-hams', 'rest'],
  },
  {
    key: 'plan-fat-beg',
    name: 'Fat Loss Kickstart',
    description: 'Three low-barrier sessions a week to build the habit and the deficit.',
    goal: 'lose_weight',
    level: 'beginner',
    diet: 'calorie_deficit',
    daysPerWeek: 3,
    days: ['fat-walk-tone', 'rest', 'fat-beginner-circuit', 'rest', 'fat-low-impact', 'rest', 'rest'],
  },
  {
    key: 'plan-fat-int',
    name: 'Shred 4-Day',
    description: 'Intervals, kettlebells and circuits — strength preserved, calories torched.',
    goal: 'lose_weight',
    level: 'intermediate',
    diet: 'calorie_deficit',
    daysPerWeek: 4,
    days: ['fat-hiit', 'rest', 'fat-kettlebell', 'fat-treadmill-intervals', 'rest', 'fat-fullbody-sweat', 'rest'],
  },
  {
    key: 'plan-fit-beg',
    name: 'Healthy Habit 3-Day',
    description: 'Balanced, beginner-friendly training for energy and long-term health.',
    goal: 'general',
    level: 'beginner',
    diet: 'balanced',
    daysPerWeek: 3,
    days: ['fit-first-steps', 'rest', 'fit-home-bodyweight', 'rest', 'fit-machine-circuit', 'rest', 'rest'],
  },
  {
    key: 'plan-mus-ulppl',
    name: 'Power Builder 5-Day',
    description:
      'Upper/Lower for heavy strength up front, Push/Pull/Legs for volume at the back — every muscle twice a week without a 6-day grind.',
    goal: 'build_muscle',
    level: 'intermediate',
    diet: 'high_protein',
    daysPerWeek: 5,
    days: ['ulppl-upper', 'ulppl-lower', 'rest', 'ulppl-push', 'ulppl-pull', 'ulppl-legs', 'rest'],
  },
  {
    key: 'plan-fat-shred5',
    name: 'Shred Season 5-Day',
    description:
      'Metabolic lifting: every between-set “rest” is a cardio minute. Heavy early in the week, breathless all of it.',
    goal: 'lose_weight',
    level: 'advanced',
    diet: 'calorie_deficit',
    daysPerWeek: 5,
    days: ['shred-chest-tri', 'shred-back-bi', 'shred-legs', 'rest', 'shred-shoulders', 'shred-circuit', 'rest'],
  },
  {
    key: 'plan-run-c25k',
    name: 'Road to 5K',
    description:
      'Nine weeks from the sofa to a 30-minute run: three runs a week, walk/run intervals that grow in sneaky increments. The guide has every week’s intervals.',
    goal: 'general',
    level: 'beginner',
    diet: 'balanced',
    daysPerWeek: 3,
    days: ['run-c25k', 'rest', 'run-c25k', 'rest', 'run-c25k', 'rest', 'rest'],
  },
  {
    key: 'plan-fit-365',
    name: 'The 365 Challenge',
    description:
      'Not a transformation sprint — a year of showing up, in four quarterly phases that each raise the bar. The guide maps all 52 weeks.',
    goal: 'general',
    level: 'beginner',
    diet: 'balanced',
    daysPerWeek: 4,
    days: ['fit-express-30', 'rest', 'fat-low-impact', 'rest', 'fit-home-bodyweight', 'mob-cooldown', 'rest'],
  },
  {
    key: 'plan-fat-comeback',
    name: 'The Comeback 5-Day',
    description:
      'A joint-friendly, reflux-aware transformation week: three strength days that finish on the elliptical, two five-mile cardio days, and a Saturday stretch. Built for big weight loss without risky core work.',
    goal: 'lose_weight',
    level: 'intermediate',
    diet: 'calorie_deficit',
    daysPerWeek: 5,
    days: ['cb-upper', 'cardio-5mile', 'cb-lower', 'cardio-5mile', 'cb-fullbody', 'mob-cooldown', 'rest'],
  },
];
