/** A reusable workout template (either user-created or a provided/preset plan). */
export interface Workout {
  id: string;
  name: string;
  notes: string | null;
  /** Provided (built-in) workouts are read-only presets; user workouts are editable. */
  source: 'user' | 'provided';
  exercises: WorkoutExercise[];
  createdAt: string;
  updatedAt: string;
}

/** One exercise slot inside a workout, with its target scheme. */
export interface WorkoutExercise {
  id: string;
  workoutId: string;
  /** References Exercise.id from the exercise database */
  exerciseId: number;
  exerciseName: string;
  position: number;
  targetSets: number;
  targetReps: number | null;
  /** Seconds, for timed exercises (planks etc.) */
  targetDurationSec: number | null;
  restSec: number | null;
  notes: string | null;
}

/** A completed (or in-progress) session of a workout. */
export interface WorkoutSession {
  id: string;
  workoutId: string | null;
  workoutName: string;
  startedAt: string;
  finishedAt: string | null;
  sets: LoggedSet[];
}

export interface LoggedSet {
  id: string;
  sessionId: string;
  exerciseId: number;
  exerciseName: string;
  setNumber: number;
  reps: number | null;
  weightKg: number | null;
  durationSec: number | null;
  completedAt: string;
}
