import { useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import {
  Apple,
  CalendarDays,
  ClipboardList,
  Dumbbell,
  House,
  Mountain,
  PanelLeftClose,
  PanelLeftOpen,
  ShoppingCart,
} from 'lucide-react';
import { TopBar } from '@/app/layout/TopBar';

const navItems = [
  { to: '/', label: 'Home', Icon: House, end: true },
  { to: '/exercises', label: 'Exercises', Icon: Dumbbell },
  { to: '/workouts', label: 'Workouts', Icon: ClipboardList },
  { to: '/nutrition', label: 'Nutrition', Icon: Apple },
  { to: '/plans', label: 'Plans', Icon: CalendarDays },
  { to: '/shopping', label: 'Shopping', Icon: ShoppingCart },
];

const COLLAPSE_KEY = 'arcadia-sidebar';

/** App shell: collapsible sidebar on md+ screens, floating glass tab bar on mobile,
 * top bar with theme/notifications/messages/profile on all breakpoints.
 * All colors come from theme tokens — see index.css. */
export function AppLayout() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === 'collapsed',
  );

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      localStorage.setItem(COLLAPSE_KEY, prev ? 'expanded' : 'collapsed');
      return !prev;
    });
  };

  return (
    <div className="flex h-full">
      {/* Sidebar — desktop only */}
      <aside
        className={`hidden shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 md:flex ${
          collapsed ? 'w-[76px]' : 'w-64'
        }`}
      >
        <div
          className={`flex items-center py-6 ${collapsed ? 'justify-center px-0' : 'gap-3 px-5'}`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-accent to-accent-2 text-accent-ink shadow-sm">
            <Mountain size={18} aria-hidden />
          </span>
          {!collapsed && (
            <span className="font-display text-lg font-bold tracking-tight whitespace-nowrap">
              Arcadia Atlas
            </span>
          )}
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3">
          {navItems.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition-colors ${
                  collapsed ? 'justify-center px-0' : 'px-3.5'
                } ${
                  isActive
                    ? 'bg-linear-to-r from-accent to-accent-2 text-accent-ink shadow-sm'
                    : 'text-muted hover:bg-elev hover:text-ink'
                }`
              }
            >
              <Icon size={18} strokeWidth={1.8} className="shrink-0" aria-hidden />
              {!collapsed && <span className="whitespace-nowrap">{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className={`border-t border-line py-3 ${collapsed ? 'px-3' : 'px-3'}`}>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`flex w-full items-center gap-3 rounded-xl py-2 text-sm font-medium text-muted transition-colors hover:bg-elev hover:text-ink ${
              collapsed ? 'justify-center px-0' : 'px-3.5'
            }`}
          >
            {collapsed ? (
              <PanelLeftOpen size={18} strokeWidth={1.8} aria-hidden />
            ) : (
              <>
                <PanelLeftClose size={18} strokeWidth={1.8} aria-hidden />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto pb-28 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Floating glass tab bar — mobile only */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-between rounded-2xl border border-line bg-surface/80 px-3 py-2 shadow-lg shadow-black/10 backdrop-blur-xl md:hidden"
      >
        {navItems.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            aria-label={label}
            className={({ isActive }) =>
              `flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                isActive
                  ? 'bg-linear-to-br from-accent to-accent-2 text-accent-ink shadow-sm'
                  : 'text-muted'
              }`
            }
          >
            <Icon size={20} strokeWidth={1.8} aria-hidden />
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
