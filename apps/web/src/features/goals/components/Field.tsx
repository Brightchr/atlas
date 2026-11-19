import type { ReactNode } from 'react';

/** Shared by every input and select in the goals feature. 44px tall on phones
 * and tighter from `md` up, the same rule the Button primitive follows.
 * text-base (16px) on phones stops iOS Safari zooming in on focus. */
export const fieldClasses =
  'min-h-11 w-full min-w-0 rounded-xl border border-line bg-bg px-3 text-base outline-none placeholder:text-muted/70 focus:border-accent md:min-h-9 md:text-sm';

/** A labeled form field. Wrapping the control in the <label> ties the two
 * together without needing matching id/htmlFor pairs. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}
