import type { Exercise } from '@arcadia/shared';
import type { WgerExerciseInfo, WgerPage, WgerSearchResponse } from './types';
import { toExercise } from './mappers';

const BASE_URL = 'https://wger.de/api/v2';
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

export interface ExerciseSearchHit {
  /** id usable with fetchExercise */
  exerciseId: number;
  name: string;
  category: string;
  thumbnailUrl: string | null;
}

/** Name search (autocomplete-style). Returns light-weight hits. */
export async function searchExercises(term: string): Promise<ExerciseSearchHit[]> {
  if (!term.trim()) return [];
  const res = await wgerFetch<WgerSearchResponse>('/exercise/search/', {
    term,
    language: 'english',
  });
  return res.suggestions.map((s) => ({
    exerciseId: s.data.base_id,
    name: s.data.name,
    category: s.data.category,
    thumbnailUrl: s.data.image_thumbnail ? `https://wger.de${s.data.image_thumbnail}` : null,
  }));
}
