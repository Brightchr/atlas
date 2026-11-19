import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchFoodSuggestions, searchOpenFoodFacts } from '@/lib/off/client';
import { rankFoodsByRelevance } from '@/lib/foodRank';
import { searchLocalFoods } from '../../repository';

/** Food search for the add-food sheet: the user's saved foods plus the online
 * databases, ranked, with autocomplete suggestions. This is the search logic
 * that used to live inside NutritionPage, moved out unchanged so the sheet
 * component can stay about layout. */
export function useFoodSearch() {
  const [term, setTermState] = useState('');
  const [page, setPage] = useState(1);
  const searching = term.trim().length >= 2;

  /** A new search term always starts again from the first page of results. */
  const setTerm = (next: string) => {
    setTermState(next);
    setPage(1);
  };

  // Autocomplete: debounced so a typing burst costs one request, not ten.
  const [debouncedTerm, setDebouncedTerm] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedTerm(term.trim()), 250);
    return () => clearTimeout(t);
  }, [term]);
  const suggestionsQuery = useQuery({
    queryKey: ['foods', 'suggest', debouncedTerm],
    queryFn: () => fetchFoodSuggestions(debouncedTerm),
    enabled: debouncedTerm.length >= 2,
    staleTime: 10 * 60 * 1000,
  });
  // Suggesting exactly what is already typed is just noise.
  const suggestions = (suggestionsQuery.data ?? []).filter(
    (s) => s.toLowerCase() !== term.trim().toLowerCase(),
  );

  const localResults = useQuery({
    queryKey: ['foods', 'local', term],
    queryFn: () => searchLocalFoods(term),
    enabled: searching,
  });
  const remoteResults = useQuery({
    queryKey: ['foods', 'off', term, page],
    queryFn: () => searchOpenFoodFacts(term, page),
    enabled: searching,
    staleTime: 10 * 60 * 1000,
    retry: 1,
    // Keep the old page on screen while the next one loads (no flash of empty).
    placeholderData: keepPreviousData,
  });

  // Rank by name relevance to the query; ties keep the remote source's own
  // relevance order (alphabetical sorting buried the obvious match).
  const local = rankFoodsByRelevance(localResults.data ?? [], term);
  // A product already saved locally shouldn't show up twice.
  const localBarcodes = new Set(local.map((f) => f.barcode).filter(Boolean));
  const remote = rankFoodsByRelevance(
    (remoteResults.data?.foods ?? []).filter((s) => !localBarcodes.has(s.barcode)),
    term,
  );

  return {
    term,
    setTerm,
    searching,
    suggestions,
    local,
    remote,
    loading: localResults.isLoading || remoteResults.isLoading,
    /** The online database failed; saved foods still work. */
    remoteFailed: remoteResults.isError,
    page: remoteResults.data?.page ?? page,
    pageCount: remoteResults.data?.pageCount ?? 1,
    setPage,
  };
}
