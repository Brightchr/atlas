import { NavLink } from 'react-router';
import { CalendarDays, ClipboardList, Dumbbell, LayoutDashboard } from 'lucide-react';

const tabs = [
  { to: '/training', label: 'Overview', Icon: LayoutDashboard, end: true },
  { to: '/plans', label: 'Plans', Icon: CalendarDays, end: false },
  { to: '/workouts', label: 'Workouts', Icon: ClipboardList, end: false },
  { to: '/exercises', label: 'Exercises', Icon: Dumbbell, end: false },
];

/** Sub-nav for the training hub: overview dashboard, weekly plans, workouts
 * and the exercise catalog all live under one roof. (Shared component because
 * the tabs span several features.) */
export function TrainingTabs() {
  return (
    <nav aria-label="Training sections" className="flex flex-wrap gap-1.5">
      {tabs.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-linear-to-r from-accent to-accent-2 text-accent-ink shadow-sm'
                : 'border border-line bg-surface text-muted shadow-sm hover:bg-elev hover:text-ink'
            }`
          }
        >
          <Icon size={15} strokeWidth={1.8} aria-hidden />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
