import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchExercise, fetchExercises, searchExercises } from '@/lib/wger/client';

export const PAGE_SIZE = 20;

export function useExercisePage(page: number) {
  return useQuery({
    queryKey: ['exercises', 'page', page],
    queryFn: () => fetchExercises(page * PAGE_SIZE, PAGE_SIZE),
    placeholderData: keepPreviousData,
  });
}

export function useExerciseSearch(term: string) {
  return useQuery({
    queryKey: ['exercises', 'search', term],
    queryFn: () => searchExercises(term),
    enabled: term.trim().length >= 2,
  });
}

export function useExercise(id: number) {
  return useQuery({
    queryKey: ['exercises', 'detail', id],
    queryFn: () => fetchExercise(id),
    enabled: Number.isFinite(id),
  });
}
