import { useState } from 'react';
import { Home } from 'lucide-react';
import { EMPTY_FILTERS, hasActiveFilters, type ExerciseFilters } from '@/lib/exercise-db/client';
import { useTrainingSetup } from '@/lib/trainingSetup';
import { Pagination } from '@/components/Pagination';
import { TrainingTabs } from '@/components/TrainingTabs';
import { PAGE_SIZE, useExerciseCatalog, useExercisePage, useFilteredExercises } from '../api';
import { ExerciseCard } from '../components/ExerciseCard';
import { FilterBar } from '../components/FilterBar';

export function ExerciseListPage() {
  const [term, setTerm] = useState('');
  const [filters, setFilters] = useState<ExerciseFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(0);
  const setup = useTrainingSetup();

  const filtering = term.trim().length >= 2 || hasActiveFilters(filters);
  // The ownership filter only makes sense with a home setup on file.
  const ownedActive = filters.ownedEquipmentIds !== null;
  const showOwnedToggle = setup.location !== 'gym';
  const toggleOwned = () =>
    setFilters({
      ...filters,
      ownedEquipmentIds: ownedActive ? null : setup.homeEquipmentIds,
    });

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

      <TrainingTabs />

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <FilterBar
            exercises={catalogQuery.data ?? []}
            filters={filters}
            onChange={setFilters}
          />
        </div>
        {showOwnedToggle && (
          <button
            type="button"
            aria-pressed={ownedActive}
            title="Only exercises doable with your home equipment (set it in Settings)"
            onClick={toggleOwned}
            className={`inline-flex shrink-0 items-center gap-1.5 self-start rounded-xl border px-3 py-2 text-sm font-medium shadow-sm transition-colors ${
              ownedActive
                ? 'border-accent/40 bg-accent-soft text-accent'
                : 'border-line bg-surface text-muted hover:text-ink'
            }`}
          >
            <Home size={15} strokeWidth={1.8} aria-hidden />
            My equipment
          </button>
        )}
      </div>

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
            Exercise data &amp; images from{' '}
            <a
              href="https://github.com/yuhonas/free-exercise-db"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Free Exercise DB
            </a>{' '}
            (public domain).
          </p>
          {pageQuery.data && (
            <Pagination
              page={page + 1}
              pageCount={Math.ceil(pageQuery.data.total / PAGE_SIZE)}
              onChange={(p) => {
                setPage(p - 1);
                window.scrollTo({ top: 0 });
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
