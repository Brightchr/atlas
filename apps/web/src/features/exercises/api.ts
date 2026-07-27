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
