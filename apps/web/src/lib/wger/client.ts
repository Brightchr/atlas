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

/** Case-insensitive name/category/muscle match, name-prefix hits first. */
export function filterExercises(all: Exercise[], term: string): Exercise[] {
  const q = term.trim().toLowerCase();
  if (!q) return [];
  const matches = all.filter(
    (e) =>
      e.name.toLowerCase().includes(q) ||
      e.category?.name.toLowerCase().includes(q) ||
      e.primaryMuscles.some((m) => m.commonName.toLowerCase().includes(q)),
  );
  return matches.sort((a, b) => {
    const aPrefix = a.name.toLowerCase().startsWith(q) ? 0 : 1;
    const bPrefix = b.name.toLowerCase().startsWith(q) ? 0 : 1;
    return aPrefix - bPrefix || a.name.localeCompare(b.name);
  });
}
