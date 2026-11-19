import { Archive, Plus } from 'lucide-react';
import type { GoalProgress } from '@arcadia/shared';
import { Button, Card, IconButton } from '@/components/ui';

/** Active goals, each with a progress bar. Archiving is only requested here;
 * the page owns the "are you sure?" sheet. */
export function GoalList({
  goals,
  onArchive,
  onAdd,
}: {
  /** undefined while the first load is in flight. */
  goals: GoalProgress[] | undefined;
  onArchive: (goal: { id: string; title: string }) => void;
  onAdd: () => void;
}) {
  // Render nothing while loading, so the empty state does not flash first.
  if (!goals) return null;

  if (goals.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line p-6 text-center">
        <p className="text-sm text-muted">
          No goals yet. Pick something to aim for and your progress shows up here and on Home.
        </p>
        <Button variant="soft" className="mt-3" onClick={onAdd}>
          <Plus size={18} aria-hidden />
          Add a goal
        </Button>
      </div>
    );
  }

  return (
    // One card with divided rows, not a card per goal: less chrome to read past.
    <Card className="overflow-hidden">
      <ul className="divide-y divide-line">
        {goals.map(({ goal, fraction, label }) => {
          const percent = Math.round(fraction * 100);
          return (
            <li key={goal.id} className="flex items-center gap-1 py-2.5 pr-2 pl-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-semibold">{goal.title}</p>
                  <span className="shrink-0 text-xs font-bold text-accent tabular-nums">
                    {percent}%
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-elev">
                  <div
                    className="h-full rounded-full bg-linear-to-r from-accent to-accent-2 transition-[width] duration-500"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="mt-1 truncate text-xs text-muted tabular-nums">{label}</p>
              </div>
              <IconButton
                label={`Archive ${goal.title}`}
                onClick={() => onArchive({ id: goal.id, title: goal.title })}
              >
                <Archive size={18} aria-hidden />
              </IconButton>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
