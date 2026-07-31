import { NavLink } from 'react-router';
import { BookOpenText, CalendarRange, NotebookPen } from 'lucide-react';

const tabs = [
  { to: '/nutrition', label: 'Diary', Icon: NotebookPen, end: true },
  { to: '/nutrition/meal-plan', label: 'Meal plan', Icon: CalendarRange, end: false },
  { to: '/nutrition/recipes', label: 'Recipes', Icon: BookOpenText, end: false },
];

/** Sub-nav for the nutrition hub: the diary, the weekly meal plan and recipes
 * all live under one roof for easy transitions. */
export function NutritionTabs() {
  return (
    <nav aria-label="Nutrition sections" className="flex gap-1.5">
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
