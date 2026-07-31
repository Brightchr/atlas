import { useState } from 'react';
import { EMPTY_FILTERS, hasActiveFilters, type ExerciseFilters } from '@/lib/wger/client';
import { useExerciseCatalog, useExercisePage, useFilteredExercises } from '../api';
import { ExerciseCard } from '../components/ExerciseCard';
import { FilterBar } from '../components/FilterBar';

export function ExerciseListPage() {
  const [term, setTerm] = useState('');
  const [filters, setFilters] = useState<ExerciseFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(0);

  const filtering = term.trim().length >= 2 || hasActiveFilters(filters);

  const catalogQuery = useExerciseCatalog();
  const pageQuery = useExercisePage(page);
  const resultsQuery = useFilteredExercises(term, filters);

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Exercises</h1>
          <p className="text-sm text-muted">Look up any exercise — muscles, equipment, how-to.</p>
        </div>
        <input
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search exercises (e.g. squat)…"
          className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 shadow-sm outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20 md:w-80"
        />
      </header>

      <FilterBar
        exercises={catalogQuery.data ?? []}
        filters={filters}
        onChange={setFilters}
      />

      {filtering ? (
        <>
          {resultsQuery.isLoading && <p className="text-muted">Searching…</p>}
          {resultsQuery.data && (
            <p className="text-sm text-muted tabular-nums">
              {resultsQuery.data.length} exercise{resultsQuery.data.length === 1 ? '' : 's'} found
            </p>
          )}
          {resultsQuery.data?.length === 0 && (
            <p className="text-muted">No exercises match — try removing a filter.</p>
          )}
          <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {resultsQuery.data?.map((exercise) => (
              <li key={exercise.id}>
                <ExerciseCard exercise={exercise} />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          {pageQuery.isLoading && (
            <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 9 }, (_, i) => (
                <li key={i} className="h-20 animate-pulse rounded-2xl bg-elev" />
              ))}
            </ul>
          )}
          {pageQuery.isError && (
            <p className="text-rose-500">
              Could not reach the exercise database. Check your connection and try again.
            </p>
          )}
          <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {pageQuery.data?.exercises.map((exercise) => (
              <li key={exercise.id}>
                <ExerciseCard exercise={exercise} />
              </li>
            ))}
          </ul>
          <p className="pt-2 text-xs text-muted/70">
            Exercise data from{' '}
            <a href="https://wger.de" target="_blank" rel="noreferrer" className="underline">
              wger
            </a>{' '}
            (CC-BY-SA).
          </p>
          {pageQuery.data && (
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-xl border border-line bg-surface px-4 py-2 font-medium shadow-sm hover:bg-elev disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-muted tabular-nums">Page {page + 1}</span>
              <button
                type="button"
                disabled={!pageQuery.data.hasMore}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-xl border border-line bg-surface px-4 py-2 font-medium shadow-sm hover:bg-elev disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
