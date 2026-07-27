/** Raw DTOs returned by the wger REST API (https://wger.de/api/v2/).
 * These stay private to the wger client — features only see the domain types
 * from @arcadia/shared (see mappers.ts). */

export interface WgerPage<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface WgerMuscle {
  id: number;
  name: string;
  name_en: string;
  is_front: boolean;
}

export interface WgerEquipment {
  id: number;
  name: string;
}

export interface WgerCategory {
  id: number;
  name: string;
}

export interface WgerExerciseImage {
  id: number;
  image: string;
  is_main: boolean;
}

export interface WgerTranslation {
  id: number;
  name: string;
  description: string;
  /** wger language id; 2 = English */
  language: number;
}

/** Result shape of /exerciseinfo/ — the "everything included" endpoint. */
export interface WgerExerciseInfo {
  id: number;
  uuid: string;
  category: WgerCategory | null;
  muscles: WgerMuscle[];
  muscles_secondary: WgerMuscle[];
  equipment: WgerEquipment[];
  images: WgerExerciseImage[];
  translations: WgerTranslation[];
}

