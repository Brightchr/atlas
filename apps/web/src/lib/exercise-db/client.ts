import type { Exercise, Muscle } from '@arcadia/shared';
import exercisesUrl from './exercises.json?url';

/** Exercise catalog client, backed by Free Exercise DB
 * (https://github.com/yuhonas/free-exercise-db — public domain, Unlicense).
 *
 * The full catalog (873 exercises, every one with two staged demo photos) is
 * vendored into the repo as exercises.json and shipped as a hashed immutable
 * asset via the `?url` import — one same-origin fetch, cached forever, no
 * third-party API at runtime. Images are hotlinked from the same dataset
 * commit through jsDelivr's CDN so they can never drift from the vendored
 * JSON. Search and filtering run client-side over the cached catalog. */

/** Commit of yuhonas/free-exercise-db the vendored exercises.json came from.
 * Bump BOTH together: re-download exercises.json and update this pin. */
const DATA_COMMIT = 'b0eed061e1c832b3ed815fbaa4b45b3cdc14df49';
const IMAGE_BASE = `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@${DATA_COMMIT}/exercises/`;

interface RawExercise {
  /** Human-readable slug, e.g. "3_4_Sit-Up" — stable across dataset versions. */
  id: string;
  name: string;
  level: string;
  force: string | null;
  mechanic: string | null;
  equipment: string | null;
  category: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  images: string[];
}

/** The app stores Exercise.id as a number (workout logs, local sqlite), so the
 * dataset's string ids are hashed to stable 32-bit numbers with FNV-1a.
 * Verified collision-free over the vendored dataset; toCatalog re-checks at
 * load time so a future data bump can never silently alias two exercises. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** Fixed vocabularies get small stable ids; names are display-cased. */
const MUSCLES: Record<string, Muscle> = Object.fromEntries(
  (
    [
      [1, 'abdominals', 'Abdominals', true],
      [2, 'abductors', 'Abductors', false],
      [3, 'adductors', 'Adductors', true],
      [4, 'biceps', 'Biceps', true],
      [5, 'calves', 'Calves', false],
      [6, 'chest', 'Chest', true],
      [7, 'forearms', 'Forearms', true],
      [8, 'glutes', 'Glutes', false],
      [9, 'hamstrings', 'Hamstrings', false],
      [10, 'lats', 'Lats', false],
      [11, 'lower back', 'Lower back', false],
      [12, 'middle back', 'Middle back', false],
      [13, 'neck', 'Neck', true],
      [14, 'quadriceps', 'Quadriceps', true],
      [15, 'shoulders', 'Shoulders', true],
      [16, 'traps', 'Traps', false],
      [17, 'triceps', 'Triceps', false],
    ] as const
  ).map(([id, key, commonName, isFront]) => [
    key,
    { id, name: commonName, commonName, isFront },
  ]),
);

/** "body only" — exercises needing no gear; they always pass equipment
 * ownership filters. */
export const BODY_ONLY_EQUIPMENT_ID = 3;

const EQUIPMENT: Record<string, { id: number; name: string }> = Object.fromEntries(
  (
    [
      [1, 'bands', 'Bands'],
      [2, 'barbell', 'Barbell'],
      [3, 'body only', 'Body only'],
      [4, 'cable', 'Cable'],
      [5, 'dumbbell', 'Dumbbell'],
      [6, 'e-z curl bar', 'E-Z curl bar'],
      [7, 'exercise ball', 'Exercise ball'],
      [8, 'foam roll', 'Foam roll'],
      [9, 'kettlebells', 'Kettlebells'],
      [10, 'machine', 'Machine'],
      [11, 'medicine ball', 'Medicine ball'],
      [12, 'other', 'Other'],
    ] as const
  ).map(([id, key, name]) => [key, { id, name }]),
);

/** The full equipment vocabulary — used by the home-gym setup UI. */
export const EQUIPMENT_OPTIONS: { id: number; name: string }[] = Object.values(EQUIPMENT).sort(
  (a, b) => a.name.localeCompare(b.name),
);

const CATEGORIES: Record<string, { id: number; name: string }> = Object.fromEntries(
  (
    [
      [1, 'cardio', 'Cardio'],
      [2, 'olympic weightlifting', 'Olympic weightlifting'],
      [3, 'plyometrics', 'Plyometrics'],
      [4, 'powerlifting', 'Powerlifting'],
      [5, 'strength', 'Strength'],
      [6, 'stretching', 'Stretching'],
      [7, 'strongman', 'Strongman'],
    ] as const
  ).map(([id, key, name]) => [key, { id, name }]),
);

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Vocabulary lookups fall back to a hashed id so an unknown value in a future
 * dataset bump degrades to an extra facet chip instead of a crash. */
function toMuscle(key: string): Muscle {
  return (
    MUSCLES[key] ?? { id: fnv1a(key), name: titleCase(key), commonName: titleCase(key), isFront: false }
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toExercise(raw: RawExercise): Exercise {
  return {
    id: fnv1a(raw.id),
    name: raw.name,
    // The detail page renders description as HTML; build an ordered list from
    // the dataset's step-by-step instructions (escaped — data is text, not markup).
    description: raw.instructions.length
      ? `<ol>${raw.instructions.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol>`
      : '',
    category: CATEGORIES[raw.category] ?? { id: fnv1a(raw.category), name: titleCase(raw.category) },
    primaryMuscles: raw.primaryMuscles.map(toMuscle),
    secondaryMuscles: raw.secondaryMuscles.map(toMuscle),
    equipment: raw.equipment
      ? [EQUIPMENT[raw.equipment] ?? { id: fnv1a(raw.equipment), name: titleCase(raw.equipment) }]
      : [],
    imageUrls: raw.images.map((path) => `${IMAGE_BASE}${path}`),
  };
}

function toCatalog(raw: RawExercise[]): Exercise[] {
  const catalog = raw.map(toExercise).sort((a, b) => a.name.localeCompare(b.name));
  if (new Set(catalog.map((e) => e.id)).size !== catalog.length) {
    throw new Error('Exercise id hash collision — see fnv1a note in exercise-db/client.ts');
  }
  return catalog;
}

let catalogPromise: Promise<Exercise[]> | null = null;

/** The full exercise catalog, loaded once per session. Memoized here (on top
 * of react-query's cache) because several features fetch it independently;
 * a failed load un-memoizes so retries actually refetch. */
export function fetchAllExercises(): Promise<Exercise[]> {
  catalogPromise ??= (async () => {
    const res = await fetch(exercisesUrl);
    if (!res.ok) throw new Error(`Exercise catalog failed to load (${res.status})`);
    return toCatalog((await res.json()) as RawExercise[]);
  })().catch((err: unknown) => {
    catalogPromise = null;
    throw err;
  });
  return catalogPromise;
}

export interface ExercisePage {
  exercises: Exercise[];
  total: number;
  hasMore: boolean;
}

/** Browse the catalog alphabetically, paginated. */
export async function fetchExercises(offset = 0, limit = 20): Promise<ExercisePage> {
  const all = await fetchAllExercises();
  return {
    exercises: all.slice(offset, offset + limit),
    total: all.length,
    hasMore: offset + limit < all.length,
  };
}

/** Full details for a single exercise. */
export async function fetchExercise(id: number): Promise<Exercise> {
  const all = await fetchAllExercises();
  const exercise = all.find((e) => e.id === id);
  if (!exercise) throw new Error(`Unknown exercise id ${id}`);
  return exercise;
}

/** Faceted filter selection. Empty arrays / null mean "facet not filtered". */
export interface ExerciseFilters {
  muscleIds: number[];
  equipmentIds: number[];
  categoryId: number | null;
  /** "Only what I own": keep exercises whose every equipment requirement is in
   * this set. Bodyweight ("body only" / no equipment) always passes. Null =
   * not filtering by ownership. */
  ownedEquipmentIds: number[] | null;
}

export const EMPTY_FILTERS: ExerciseFilters = {
  muscleIds: [],
  equipmentIds: [],
  categoryId: null,
  ownedEquipmentIds: null,
};

export function hasActiveFilters(f: ExerciseFilters): boolean {
  return (
    f.muscleIds.length > 0 ||
    f.equipmentIds.length > 0 ||
    f.categoryId !== null ||
    f.ownedEquipmentIds !== null
  );
}

/** Text + facet filtering. Standard faceted-search semantics: OR within a facet,
 * AND across facets and the text term. Name-prefix hits sort first when searching. */
export function filterExercises(
  all: Exercise[],
  term: string,
  filters: ExerciseFilters = EMPTY_FILTERS,
): Exercise[] {
  const q = term.trim().toLowerCase();

  const matches = all.filter((e) => {
    const textMatch =
      q === '' ||
      e.name.toLowerCase().includes(q) ||
      e.category?.name.toLowerCase().includes(q) ||
      e.primaryMuscles.some((m) => m.commonName.toLowerCase().includes(q));
    const muscleMatch =
      filters.muscleIds.length === 0 ||
      e.primaryMuscles.some((m) => filters.muscleIds.includes(m.id));
    const equipmentMatch =
      filters.equipmentIds.length === 0 ||
      e.equipment.some((eq) => filters.equipmentIds.includes(eq.id));
    const ownedMatch =
      filters.ownedEquipmentIds === null ||
      e.equipment.every(
        (eq) => eq.id === BODY_ONLY_EQUIPMENT_ID || filters.ownedEquipmentIds!.includes(eq.id),
      );
    const categoryMatch = filters.categoryId === null || e.category?.id === filters.categoryId;
    return textMatch && muscleMatch && equipmentMatch && ownedMatch && categoryMatch;
  });

  return matches.sort((a, b) => {
    if (q !== '') {
      const aPrefix = a.name.toLowerCase().startsWith(q) ? 0 : 1;
      const bPrefix = b.name.toLowerCase().startsWith(q) ? 0 : 1;
      if (aPrefix !== bPrefix) return aPrefix - bPrefix;
    }
    return a.name.localeCompare(b.name);
  });
}
