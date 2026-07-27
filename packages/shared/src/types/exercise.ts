/** Domain model for exercises. Populated from wger, but source-agnostic so the
 * data source can be swapped (or vendored as a static dataset) without touching features. */

export interface Muscle {
  id: number;
  name: string;
  /** Common gym name, e.g. "Lats" for latissimus dorsi */
  commonName: string;
  isFront: boolean;
}

export interface Equipment {
  id: number;
  name: string;
}

export interface ExerciseCategory {
  id: number;
  name: string;
}

export interface Exercise {
  id: number;
  name: string;
  /** HTML or plain-text description / instructions */
  description: string;
  category: ExerciseCategory | null;
  primaryMuscles: Muscle[];
  secondaryMuscles: Muscle[];
  equipment: Equipment[];
  imageUrls: string[];
}
