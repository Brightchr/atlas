import { useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { TriangleAlert } from 'lucide-react';
import { dbStatusStore, getDb } from '@/lib/db';

/** Shown only when the local database failed to open — a loud, actionable
 * signal instead of features silently not saving. */
export function DbStatusBanner() {
  const status = useSyncExternalStore(dbStatusStore.subscribe, dbStatusStore.getStatus);
  const error = useSyncExternalStore(dbStatusStore.subscribe, dbStatusStore.getError);
  const queryClient = useQueryClient();

  if (status !== 'error') return null;

  const retry = async () => {
    try {
      await getDb();
      await queryClient.invalidateQueries();
    } catch {
      // Status store already reflects the failure; banner stays up.
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 bg-rose-500/15 px-4 py-2 text-sm font-medium text-rose-600">
      <span className="inline-flex min-w-0 items-center gap-2">
        <TriangleAlert size={16} className="shrink-0" aria-hidden />
        <span className="truncate">
          Local storage failed to start — workouts and nutrition will not save.
          {error ? ` (${error})` : ''}
        </span>
      </span>
      <button
        type="button"
        onClick={retry}
        className="shrink-0 rounded-lg border border-rose-500/40 px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-rose-500/20"
      >
        Retry
      </button>
    </div>
  );
}
