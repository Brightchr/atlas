import { NavLink } from 'react-router';
import type { LucideIcon } from 'lucide-react';

export interface SegmentTab {
  to: string;
  label: string;
  Icon: LucideIcon;
  /** Match only the exact path (for a section's index tab). */
  end?: boolean;
  /** Extra path prefixes that keep this tab lit (detail routes). */
  match?: string[];
}

/** The one sub-navigation pattern: a pill bar at the top of a section's
 * top-level pages (Eat, Progress). Each pill is 44px tall. On narrow phones
 * the icons drop out so four labels still fit without truncating. */
export function SegmentedTabs({ tabs, pathname }: { tabs: SegmentTab[]; pathname: string }) {
  return (
    <nav
      aria-label="Section tabs"
      className="grid gap-1 rounded-2xl border border-line bg-surface p-1 shadow-sm"
      style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
    >
      {tabs.map(({ to, label, Icon, end, match }) => {
        const active = end
          ? pathname === to
          : pathname.startsWith(to) || (match ?? []).some((p) => pathname.startsWith(p));
        return (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={`springy inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-1 text-sm font-semibold ${
              active
                ? 'bg-linear-to-r from-accent to-accent-2 text-accent-ink shadow-sm'
                : 'text-muted hover:bg-elev hover:text-ink'
            }`}
          >
            <Icon size={16} strokeWidth={1.9} className="hidden shrink-0 sm:block" aria-hidden />
            <span className="truncate">{label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
