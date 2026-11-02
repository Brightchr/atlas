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

/** One exercise in a session — a snapshot of a routine slot, or one added on
 * the fly. Independent of the routine: editing either never touches the other. */
export interface SessionExercise {
  id: string;
  sessionId: string;
  exerciseId: number;
  exerciseName: string;
  position: number;
  targetSets: number | null;
  targetReps: number | null;
  targetDurationSec: number | null;
  restSec: number | null;
}

/** A completed (or in-progress) session: from a routine (workoutId set) or
 * an empty workout built as it went (workoutId null). */
export interface WorkoutSession {
  id: string;
  workoutId: string | null;
  workoutName: string;
  startedAt: string;
  finishedAt: string | null;
  notes: string | null;
  exercises: SessionExercise[];
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
