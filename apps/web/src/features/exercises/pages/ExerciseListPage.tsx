import { useState } from 'react';
import { Link } from 'react-router';
import { Dumbbell } from 'lucide-react';
import { useExercisePage, useExerciseSearch } from '../api';
import { ExerciseCard } from '../components/ExerciseCard';

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
        <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {searchQuery.isLoading && <p className="text-muted">Searching…</p>}
          {searchQuery.data?.length === 0 && <p className="text-muted">No matches.</p>}
          {searchQuery.data?.map((hit) => (
            <li key={`${hit.exerciseId}-${hit.name}`}>
              <Link
                to={`/exercises/${hit.exerciseId}`}
                className="flex h-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                {hit.thumbnailUrl ? (
                  <img
                    src={hit.thumbnailUrl}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-xl bg-white object-contain"
                  />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                    <Dumbbell size={20} strokeWidth={1.8} aria-hidden />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate font-semibold">{hit.name}</p>
                  <p className="text-sm text-muted">{hit.category}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
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
