import { Minus, Plus } from 'lucide-react';

/** A number you can change without the keyboard: big minus and plus either
 * side of a field that still accepts typing (and opens the numeric keypad
 * when it does). Built for sweaty thumbs: the buttons are 48px.
 *
 * The value is a string so the field can be empty or mid-edit ("12."). */
export function Stepper({
  label,
  value,
  onChange,
  step,
  min = 0,
  decimals = false,
  placeholder = '0',
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  step: number;
  min?: number;
  /** Allow a decimal point (weights) rather than whole numbers (reps). */
  decimals?: boolean;
  placeholder?: string;
}) {
  const nudge = (direction: 1 | -1) => {
    const current = Number(value) || 0;
    const next = Math.max(min, current + direction * step);
    // Avoid float noise like 42.50000001.
    onChange(String(Math.round(next * 100) / 100));
  };
  const button =
    'springy flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-elev text-ink active:bg-accent-soft';

  return (
    <div className="min-w-0 flex-1">
      <span className="mb-1 block text-center text-xs font-semibold tracking-wide text-muted uppercase">
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label={`Less ${label}`}
          onClick={() => nudge(-1)}
          className={button}
        >
          <Minus size={20} aria-hidden />
        </button>
        <input
          type="text"
          inputMode={decimals ? 'decimal' : 'numeric'}
          aria-label={label}
          value={value}
          placeholder={placeholder}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const cleaned = e.target.value.replace(decimals ? /[^0-9.]/g : /[^0-9]/g, '');
            onChange(cleaned);
          }}
          className="h-12 w-full min-w-0 rounded-xl border border-line bg-bg text-center text-xl font-bold tabular-nums outline-none placeholder:text-muted/50 focus:border-accent"
        />
        <button
          type="button"
          aria-label={`More ${label}`}
          onClick={() => nudge(1)}
          className={button}
        >
          <Plus size={20} aria-hidden />
        </button>
      </div>
    </div>
  );
}
