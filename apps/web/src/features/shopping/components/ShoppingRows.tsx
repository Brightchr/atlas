import { Check, RotateCcw, Trash2 } from 'lucide-react';
import type { ShoppingItem } from '@arcadia/shared';
import { IconButton } from '@/components/ui';
import { formatDate } from '@/lib/dates';

function lastBoughtLabel(iso: string | null): string {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return formatDate(iso);
}

// Both rows share one shape: a big button that fills the row (the tick), and
// a small remove button beside it. They are siblings, not nested, because a
// <button> inside a <button> is invalid HTML and confuses screen readers.
const rowClasses = 'flex items-center gap-1 border-b border-line pr-2 last:border-b-0';
const tickClasses =
  'flex min-h-13 min-w-0 flex-1 items-center gap-3 py-2 pl-4 text-left transition-colors hover:bg-elev active:bg-elev';
const boxClasses = 'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2';

/** Something still to buy. Tapping anywhere on the row ticks it off. */
export function NeededRow({
  item,
  onBought,
  onRemove,
}: {
  item: ShoppingItem;
  onBought: () => void;
  onRemove: () => void;
}) {
  return (
    <li className={rowClasses}>
      <button
        type="button"
        role="checkbox"
        aria-checked={false}
        aria-label={`Mark ${item.name} as bought`}
        onClick={onBought}
        className={tickClasses}
      >
        <span className={`${boxClasses} border-muted/60`} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{item.name}</span>
          {(item.quantity || item.timesBought > 0) && (
            <span className="block truncate text-xs text-muted tabular-nums">
              {[item.quantity, item.timesBought > 0 ? `bought ×${item.timesBought}` : null]
                .filter(Boolean)
                .join(' · ')}
            </span>
          )}
        </span>
      </button>
      <IconButton label={`Remove ${item.name}`} onClick={onRemove}>
        <Trash2 size={16} aria-hidden />
      </IconButton>
    </li>
  );
}

/** A past purchase. Tapping the row un-ticks it: it goes back on "To buy". */
export function BoughtRow({
  item,
  onRebuy,
  onRemove,
}: {
  item: ShoppingItem;
  onRebuy: () => void;
  onRemove: () => void;
}) {
  return (
    <li className={rowClasses}>
      <button
        type="button"
        role="checkbox"
        aria-checked
        aria-label={`Put ${item.name} back on the list`}
        onClick={onRebuy}
        className={tickClasses}
      >
        <span className={`${boxClasses} border-accent bg-accent text-accent-ink`} aria-hidden>
          <Check size={16} strokeWidth={3} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-muted">{item.name}</span>
          <span className="block truncate text-xs text-muted tabular-nums">
            ×{item.timesBought} · last {lastBoughtLabel(item.lastBoughtAt)}
          </span>
        </span>
        {/* A visible hint, because "un-tick to buy again" is not obvious. */}
        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-accent">
          <RotateCcw size={14} aria-hidden />
          Rebuy
        </span>
      </button>
      <IconButton label={`Delete ${item.name} from history`} onClick={onRemove}>
        <Trash2 size={16} aria-hidden />
      </IconButton>
    </li>
  );
}
