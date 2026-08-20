import type { TrainingGoal, TrainingLevel } from './profile';

/** The built-in workout catalog: 40 curated workouts and 8 weekly plans
 * spanning every goal at three intensity levels. Exercise names MUST match
 * the vendored Free Exercise DB dataset exactly — they're resolved to
 * exercise ids at import time (see recommend.ts), and the typecheck-time
 * constant here is verified by the import path's name lookup. */

export interface CatalogExercise {
  /** Exact dataset name. */
  name: string;
  sets: number;
  reps?: number;
  /** For timed work (cardio, planks) — minutes per set. */
  minutes?: number;
  restSec: number;
}

export interface CatalogWorkout {
  key: string;
  name: string;
  description: string;
  goal: TrainingGoal;
  level: TrainingLevel;
  exercises: CatalogExercise[];
}

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

export const CATALOG_WORKOUTS: CatalogWorkout[] = [
  /* ------------------------------ Get stronger ------------------------------ */
  {
    key: 'str-foundations-a',
    name: 'Strength Foundations A',
    description: 'The classic starter: squat, press, pull. Add weight every session you complete.',
    goal: 'get_stronger',
    level: 'beginner',
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
    exercises: [
      ex('Barbell Deadlift', 4, 5, 180),
      ex('Pushups', 4, 20, 60),
      ex('Box Jump (Multiple Response)', 4, 6, 90),
      timed('Rowing, Stationary', 1, 10, 60),
      ex('Ab Roller', 4, 10, 60),
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
];
