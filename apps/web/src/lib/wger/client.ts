import type { Exercise } from '@arcadia/shared';
import { env } from '@/lib/env';
import type { WgerExerciseInfo, WgerPage } from './types';
import { toExercise } from './mappers';

const BASE_URL = `${env.wgerUrl}/api/v2`;
const ENGLISH = 2;

async function wgerFetch<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set('format', 'json');
  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, String(value));
  }

  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`wger request failed: ${res.status} ${res.statusText} (${path})`);
  }
  return (await res.json()) as T;
}

export interface ExercisePage {
  exercises: Exercise[];
  total: number;
  hasMore: boolean;
}

/** Browse exercises with full details, paginated. */
export async function fetchExercises(offset = 0, limit = 20): Promise<ExercisePage> {
  const page = await wgerFetch<WgerPage<WgerExerciseInfo>>('/exerciseinfo/', {
    language: ENGLISH,
    limit,
    offset,
  });
  return {
    exercises: page.results.map(toExercise),
    total: page.count,
    hasMore: page.next !== null,
  };
}

/** Full details for a single exercise. */
export async function fetchExercise(id: number): Promise<Exercise> {
  const info = await wgerFetch<WgerExerciseInfo>(`/exerciseinfo/${id}/`);
  return toExercise(info);
}

/** The full exercise catalog (~900 entries — small enough to cache whole).
 * Search runs client-side over this: instant, offline-friendly, and independent
 * of wger API versions (newer servers dropped the /exercise/search/ endpoint). */
export async function fetchAllExercises(): Promise<Exercise[]> {
  const all: Exercise[] = [];
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const page = await fetchExercises(offset, limit);
    all.push(...page.exercises);
    if (!page.hasMore) break;
  }
  return all;
}

/** Faceted filter selection. Empty arrays / null mean "facet not filtered". */
export interface ExerciseFilters {
  muscleIds: number[];
  equipmentIds: number[];
  categoryId: number | null;
}

export const EMPTY_FILTERS: ExerciseFilters = {
  muscleIds: [],
  equipmentIds: [],
  categoryId: null,
};

export function hasActiveFilters(f: ExerciseFilters): boolean {
  return f.muscleIds.length > 0 || f.equipmentIds.length > 0 || f.categoryId !== null;
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
    const categoryMatch = filters.categoryId === null || e.category?.id === filters.categoryId;
    return textMatch && muscleMatch && equipmentMatch && categoryMatch;
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
