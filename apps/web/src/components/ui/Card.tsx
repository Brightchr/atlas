import type { HTMLAttributes, ReactNode } from 'react';

/** The standard surface: rounded, bordered, on the theme's surface color. */
export function Card({
  className = '',
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={`rounded-2xl border border-line bg-surface shadow-sm ${className}`} {...rest}>
      {children}
    </div>
  );
}

/** Small uppercase label above a group of cards. */
export function SectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-3 px-1">
      <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">{children}</h2>
      {action}
    </div>
  );
}
