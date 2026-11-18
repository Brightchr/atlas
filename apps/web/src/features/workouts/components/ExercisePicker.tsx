import { useState } from 'react';
import { Dumbbell, Search, X } from 'lucide-react';
import type { Exercise } from '@arcadia/shared';
import { filterExercises } from '@/lib/exercise-db/client';
import { useExerciseCatalog } from '@/features/exercises/api';

/** Inline catalog search for adding exercises — to a routine or to a live
 * session. Picking clears the search and keeps the picker open, so adding
 * five exercises is one flow (the Hevy pattern), with an "Added ✓" flash as
 * feedback instead of a silent list mutation somewhere above. */
export function ExercisePicker({
  onPick,
  onClose,
}: {
  onPick: (e: Exercise) => void;
  onClose: () => void;
}) {
  const [term, setTerm] = useState('');
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const catalog = useExerciseCatalog();
  const matches =
    term.trim().length >= 2 ? filterExercises(catalog.data ?? [], term).slice(0, 8) : [];

  const pick = (exercise: Exercise) => {
    onPick(exercise);
    setLastAdded(exercise.name);
    setTerm('');
  };

  return (
    <div className="space-y-2 rounded-2xl border border-line bg-surface p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <input
            type="search"
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={
              lastAdded
                ? `Added ${lastAdded} ✓ — search for the next one…`
                : 'Search the exercise catalog…'
            }
            className="w-full rounded-xl border border-line bg-surface py-2 pr-3 pl-9 text-sm outline-none placeholder:text-muted/70 focus:border-accent"
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-elev hover:text-ink"
        >
          <X size={15} aria-hidden />
        </button>
      </div>
      <ul className="space-y-1">
        {matches.map((exercise) => (
          <li key={exercise.id}>
            <button
              type="button"
              onClick={() => pick(exercise)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-elev"
            >
              {exercise.imageUrls[0] ? (
                <img
                  src={exercise.imageUrls[0]}
                  alt=""
                  loading="lazy"
                  className="h-9 w-9 shrink-0 rounded-lg bg-white object-contain"
                />
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-elev text-muted">
                  <Dumbbell size={15} aria-hidden />
                </span>
              )}
              <span className="min-w-0 flex-1 truncate">{exercise.name}</span>
              <span className="shrink-0 text-xs text-muted">
                {exercise.primaryMuscles[0]?.commonName}
              </span>
            </button>
          </li>
        ))}
        {term.trim().length >= 2 && matches.length === 0 && (
          <li className="px-1 text-xs text-muted">No exercises match.</li>
        )}
      </ul>
    </div>
  );
}
