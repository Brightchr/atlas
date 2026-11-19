/** A small "pick one of two or three" switch (Week / Day, My recipes /
 * Community). Unlike the Eat pill bar this changes what the page shows, not
 * which page you are on, so the options are buttons with `aria-pressed`
 * rather than links.
 *
 * Generic over the option values so `onChange` hands back the exact union
 * type the caller declared (e.g. 'week' | 'day') instead of a plain string. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className = '',
}: {
  /** What the switch chooses, for screen readers. */
  label: string;
  options: readonly (readonly [value: T, label: string])[];
  value: T;
  onChange: (next: T) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`grid gap-1 rounded-xl border border-line bg-surface p-1 shadow-sm ${className}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map(([option, text]) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          // 44px on phones, tighter with a mouse — same rule as Button.
          className={`springy min-h-11 rounded-lg px-3 text-sm font-semibold md:min-h-8 ${
            value === option
              ? 'bg-accent text-accent-ink shadow-sm'
              : 'text-muted hover:bg-elev hover:text-ink'
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
