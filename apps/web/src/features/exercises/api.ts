import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  fetchAllExercises,
  fetchExercise,
  fetchExercises,
  filterExercises,
  hasActiveFilters,
  type ExerciseFilters,
} from '@/lib/exercise-db/client';

export const PAGE_SIZE = 20;

export function useExercisePage(page: number) {
  return useQuery({
    queryKey: ['exercises', 'page', page],
    queryFn: () => fetchExercises(page * PAGE_SIZE, PAGE_SIZE),
    placeholderData: keepPreviousData,
  });
}

/** Full catalog, fetched once and shared by cache key with useFilteredExercises. */
export function useExerciseCatalog() {
  return useQuery({
    queryKey: ['exercises', 'all'],
    queryFn: fetchAllExercises,
  });
}

/** Filters the cached catalog client-side — instant results per keystroke/chip. */
export function useFilteredExercises(term: string, filters: ExerciseFilters) {
  return useQuery({
    queryKey: ['exercises', 'all'],
    queryFn: fetchAllExercises,
    enabled: term.trim().length >= 2 || hasActiveFilters(filters),
    select: (all) => filterExercises(all, term, filters),
  });
}

export function useExercise(id: number) {
  return useQuery({
    queryKey: ['exercises', 'detail', id],
    queryFn: () => fetchExercise(id),
    enabled: Number.isFinite(id),
  });
}
