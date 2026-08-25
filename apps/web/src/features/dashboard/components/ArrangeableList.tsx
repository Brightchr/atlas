import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import type { DashboardCardId } from '../layout';

export interface ArrangeableItem {
  id: DashboardCardId;
  /** Shown on the arrange-mode overlay and empty-card placeholders. */
  label: string;
  /** Null when the card currently has nothing to show (e.g. no planned
   * meals). It still keeps its slot so it can be positioned. */
  node: ReactNode | null;
}

/** The user-arrangeable card stack. Normal mode renders content untouched.
 * Arrange mode overlays each card with a grip (HTML5 drag on desktop) and
 * up/down buttons (works everywhere, including touch), and disables the
 * content's own links so a drag never triggers a navigation. */
export function ArrangeableList({
  items,
  arranging,
  onMove,
}: {
  items: ArrangeableItem[];
  arranging: boolean;
  onMove: (from: number, to: number) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  if (!arranging) {
    return (
      <>
        {items.map((item) =>
          item.node === null ? null : (
            <div key={item.id} className="min-w-0">
              {item.node}
            </div>
          ),
        )}
      </>
    );
  }

  return (
    <>
      {items.map((item, index) => (
        <div
          key={item.id}
          draggable
          onDragStart={(e) => {
            setDragIndex(index);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragEnd={() => setDragIndex(null)}
          onDragOver={(e) => {
            e.preventDefault();
            if (dragIndex === null || dragIndex === index) return;
            onMove(dragIndex, index);
            setDragIndex(index);
          }}
          className={`relative cursor-grab rounded-2xl transition-opacity ${
            dragIndex === index ? 'opacity-60' : ''
          }`}
        >
          <div className="pointer-events-none rounded-2xl ring-2 ring-accent/35">
            {item.node ?? (
              <div className="flex h-16 items-center justify-center rounded-2xl border border-dashed border-line bg-surface text-sm text-muted">
                {item.label} (nothing to show right now)
              </div>
            )}
          </div>
          <div className="absolute top-2 right-2 flex items-center gap-1 rounded-xl border border-line bg-surface/95 p-1 shadow-md">
            <GripVertical size={15} className="text-muted" aria-hidden />
            <span className="pr-1 text-xs font-semibold">{item.label}</span>
            <button
              type="button"
              aria-label={`Move ${item.label} up`}
              disabled={index === 0}
              onClick={() => onMove(index, index - 1)}
              className="rounded-lg p-1 text-muted transition-colors hover:bg-elev hover:text-ink disabled:opacity-30"
            >
              <ChevronUp size={15} aria-hidden />
            </button>
            <button
              type="button"
              aria-label={`Move ${item.label} down`}
              disabled={index === items.length - 1}
              onClick={() => onMove(index, index + 1)}
              className="rounded-lg p-1 text-muted transition-colors hover:bg-elev hover:text-ink disabled:opacity-30"
            >
              <ChevronDown size={15} aria-hidden />
            </button>
          </div>
        </div>
      ))}
    </>
  );
}
