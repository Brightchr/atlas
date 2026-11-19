import { useState } from 'react';
import { Copy, Trash2 } from 'lucide-react';
import type { DiaryEntry } from '@arcadia/shared';
import { Button, Sheet, Stepper } from '@/components/ui';
import { mealLabel } from './meals';
import { StatsGrid } from './StatsGrid';

/** Everything you can do to one logged entry: change the amount, log it
 * again, or delete it. Opens when an entry row is tapped.
 *
 * The page renders this with `key={entry.id}`, so the amount field starts
 * fresh for each entry without an effect to reset it. */
export function EntrySheet({
  entry,
  busy,
  onSaveGrams,
  onLogAgain,
  onDelete,
  onClose,
}: {
  entry: DiaryEntry;
  /** A save / log-again / delete is in flight — disables the buttons. */
  busy: boolean;
  onSaveGrams: (grams: number) => void;
  onLogAgain: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  // A string, because the Stepper's field can be empty or mid-edit ("12.").
  const [grams, setGrams] = useState(String(entry.grams));
  const parsed = Number(grams);
  const valid = Number.isFinite(parsed) && parsed > 0 && parsed <= 5000;
  const changed = valid && parsed !== entry.grams;

  // Preview the new numbers before saving: the entry's macros are already
  // scaled to entry.grams, so scale them again by new / old.
  const ratio = valid && entry.grams > 0 ? parsed / entry.grams : 1;
  const previewKcal = Math.round(entry.macros.kcal * ratio);

  return (
    <Sheet
      title={entry.foodName}
      onClose={onClose}
      footer={
        <div className="grid gap-2">
          <Button
            size="lg"
            block
            disabled={!changed || busy}
            onClick={() => onSaveGrams(Math.round(parsed * 10) / 10)}
          >
            {changed ? `Save ${parsed} g · ${previewKcal} kcal` : 'Save amount'}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" disabled={busy} onClick={onLogAgain}>
              <Copy size={16} aria-hidden />
              Log again
            </Button>
            <Button variant="danger" disabled={busy} onClick={onDelete}>
              <Trash2 size={16} aria-hidden />
              Delete
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">
          {mealLabel(entry.meal)} · {entry.grams} g · {entry.macros.kcal} kcal
        </p>
        <Stepper label="Amount (g)" value={grams} onChange={setGrams} step={10} min={1} decimals />
        {/* The prop is named per100g, but with a caption it just prints the
            numbers it is given — here the entry's already-scaled macros. */}
        <StatsGrid per100g={entry.macros} caption={`for ${entry.grams} g logged`} />
      </div>
    </Sheet>
  );
}
