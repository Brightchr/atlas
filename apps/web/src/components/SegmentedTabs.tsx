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

/** The one sub-navigation pattern of the redesign: a springy pill bar at the
 * top of each section (Train, Eat, You). Detail pages keep their section's
 * bar lit via `match`, so drilling down never loses the chrome. */
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
            className={`springy inline-flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold sm:text-sm ${
              active
                ? 'bg-linear-to-r from-accent to-accent-2 text-accent-ink shadow-sm'
                : 'text-muted hover:bg-elev hover:text-ink'
            }`}
          >
            <Icon size={14} strokeWidth={1.9} aria-hidden />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
