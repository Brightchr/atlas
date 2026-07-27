import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchAllExercises, fetchExercise, fetchExercises, filterExercises } from '@/lib/wger/client';

export const PAGE_SIZE = 20;

export function useExercisePage(page: number) {
  return useQuery({
    queryKey: ['exercises', 'page', page],
    queryFn: () => fetchExercises(page * PAGE_SIZE, PAGE_SIZE),
    placeholderData: keepPreviousData,
  });
}

// TODO(step 2a): Add a `useExerciseCatalog()` hook: same queryKey ['exercises', 'all'] and
// queryFn fetchAllExercises, but always enabled (no `enabled` option). The FilterBar needs the
// catalog to derive which muscles/equipment/categories exist. Because the queryKey is identical,
// TanStack Query fetches ONCE and both hooks share the cache — that's the point of query keys.
//
// TODO(step 2b): Rework this hook into `useFilteredExercises(term: string, filters: ExerciseFilters)`:
//   - enabled when there's a term (>= 2 chars) OR any filter is active
//   - select: (all) => filterExercises(all, term, filters)
// Then delete the old useExerciseSearch.
/** Loads the full catalog once (cached), filters client-side per keystroke. */
export function useExerciseSearch(term: string) {
  return useQuery({
    queryKey: ['exercises', 'all'],
    queryFn: fetchAllExercises,
    enabled: term.trim().length >= 2,
    select: (all) => filterExercises(all, term),
  });
}

export function useExercise(id: number) {
  return useQuery({
    queryKey: ['exercises', 'detail', id],
    queryFn: () => fetchExercise(id),
    enabled: Number.isFinite(id),
  });
}
