import { useState } from 'react';
import { useExercisePage, useExerciseSearch } from '../api';
import { ExerciseCard } from '../components/ExerciseCard';

// TODO(step 4a): Add filter state here (the page owns it, FilterBar just displays it):
//   const [filters, setFilters] = useState<ExerciseFilters>({ muscleIds: [], equipmentIds: [], categoryId: null });
//
// TODO(step 4b): Call your useExerciseCatalog() hook and render <FilterBar> under the header,
// passing catalog data (?? []), filters, and setFilters.
//
// TODO(step 4c): Replace `searching` with: term >= 2 chars OR any filter active — and use
// your new useFilteredExercises(term, filters) for the results.
//
// TODO(step 4d): Above the results, show a count when filtering: "{n} exercise{s} found".
//
// TODO(step 5): When it all works: npm run build, test in the browser (search + each facet +
// combinations + clear all), then commit with a message describing the FEATURE, not the files.
export function ExerciseListPage() {
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(0);
  const searching = term.trim().length >= 2;

  const pageQuery = useExercisePage(page);
  const searchQuery = useExerciseSearch(term);

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

      {searching ? (
        <>
          {searchQuery.isLoading && <p className="text-muted">Searching…</p>}
          {searchQuery.data?.length === 0 && <p className="text-muted">No matches.</p>}
          <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {searchQuery.data?.map((exercise) => (
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
