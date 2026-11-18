import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import {
  Apple,
  Dumbbell,
  History,
  House,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  UserRound,
  VenetianMask,
} from 'lucide-react';
import { TopBar } from '@/app/layout/TopBar';
import { DbStatusBanner } from '@/components/DbStatusBanner';
import { useStopImpersonation } from '@/features/admin/api';
import { TrialBanner } from '@/features/billing/components/TrialBanner';
import { VerifyEmailBanner } from '@/features/auth/components/VerifyEmailBanner';
import { useCurrentUser, useSession } from '@/features/auth/api';
import { FriendsRail } from '@/features/social/components/FriendsRail';
import { startStatsPublisher } from '@/features/social/stats';
import { startSync } from '@/lib/sync/engine';
import { useSyncState } from '@/lib/sync/useSync';
import { useOnboardingState, useTrainingProfile } from '@/features/training/profile';

// The 5-tab shell: Home, Workout, History, Eat, You — the shape every
// workout app converges on, so starting or reviewing a workout is one tap
// from anywhere. `match` lists extra path prefixes (detail and legacy
// routes) that keep the tab lit.
interface NavItem {
  to: string;
  label: string;
  Icon: typeof House;
  end?: boolean;
  match?: string[];
}

const navItems: NavItem[] = [
  { to: '/', label: 'Home', Icon: House, end: true },
  {
    to: '/train',
    label: 'Workout',
    Icon: Dumbbell,
    match: ['/workouts', '/exercises', '/plans', '/training'],
  },
  { to: '/history', label: 'History', Icon: History },
  { to: '/eat', label: 'Eat', Icon: Apple, match: ['/nutrition', '/shopping'] },
  // Profile and Settings are account pages under the top-bar avatar menu,
  // so they deliberately don't light this tab. Friends lives in You.
  { to: '/you', label: 'You', Icon: UserRound, match: ['/goals', '/friends', '/groups'] },
];

/** Shown while a fresh device waits for its first pull to decide whether the
 * intro wizard is still owed. Brief — bounded by the sync pass. */
function SettingUpSplash() {
  return (
    <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <img src="/favicon/android-chrome-192x192.png" alt="" className="h-12 w-12 animate-pulse" />
      <p className="text-sm text-muted">Setting things up…</p>
    </div>
  );
}

function isItemActive(item: NavItem, pathname: string): boolean {
  if (item.end) return pathname === item.to;
  return (
    pathname.startsWith(item.to) || (item.match ?? []).some((prefix) => pathname.startsWith(prefix))
  );
}

const COLLAPSE_KEY = 'arcadia-sidebar';

/** Amber bar shown while an admin views the app as another user. */
function ImpersonationBanner() {
  const session = useSession();
  const stop = useStopImpersonation();
  const navigate = useNavigate();

  if (!session.data?.impersonated) return null;
  return (
    <div className="flex items-center justify-between gap-3 bg-amber-500/15 px-4 py-2 text-sm font-medium text-amber-600">
      <span className="inline-flex items-center gap-2">
        <VenetianMask size={16} aria-hidden />
        Viewing as {session.data.user.username} (admin masquerade)
      </span>
      <button
        type="button"
        onClick={() => stop.mutate(undefined, { onSuccess: () => navigate('/admin') })}
        className="rounded-lg border border-amber-500/40 px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-amber-500/20"
      >
        Return to admin
      </button>
    </div>
  );
}

/** App shell: collapsible sidebar on md+ screens, floating glass tab bar on mobile,
 * top bar with theme/notifications/messages/profile on all breakpoints.
 * All colors come from theme tokens — see index.css. */
export function AppLayout() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === 'collapsed',
  );
  const { data: user } = useCurrentUser();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const items: NavItem[] =
    user?.role === 'admin'
      ? [...navItems, { to: '/admin', label: 'Admin', Icon: ShieldCheck }]
      : navItems;

  // Sync runs for the whole signed-in session: pull/push on start, then on
  // reconnect, tab focus, after writes (debounced), and on a slow interval.
  useEffect(() => {
    if (!user?.id) return;
    return startSync(user.id);
  }, [user?.id]);

  // The friends stats snapshot publishes on the same lifecycle (throttled;
  // no-ops when the user shares with nobody — the server gates visibility).
  useEffect(() => {
    if (!user?.id) return;
    return startStatsPublisher();
  }, [user?.id]);

  // New-user onboarding: the intro wizard shows once per account — until a
  // training profile exists OR the user has finished/skipped it. Both live
  // in the synced settings table, so we wait for the first sync pass: a
  // device that lost (or never had) local data usually gets them back from
  // the server, and asking the questions again would be wrong twice —
  // annoying AND a lie. Until that pass settles, an undecided device shows a
  // splash instead of flashing the dashboard under the wizard.
  const profile = useTrainingProfile();
  const onboarding = useOnboardingState();
  const sync = useSyncState();
  const settled =
    profile.isSuccess && !profile.isFetching && onboarding.isSuccess && !onboarding.isFetching;
  const undecided = settled && profile.data === null && onboarding.data === null;
  const onWelcome = pathname === '/welcome';
  useEffect(() => {
    if (sync.firstSyncDone && undecided && !onWelcome) {
      navigate('/welcome', { replace: true });
    }
  }, [sync.firstSyncDone, undecided, onWelcome, navigate]);
  // Keyed on data, not fetch state: background refetches must never flash
  // the splash over a working screen. Once the first pass is done it's gone.
  // A broken local database shows the app's own error state, not a splash.
  const noEvidence = profile.data == null && onboarding.data == null;
  const settingUp =
    !onWelcome && !sync.firstSyncDone && noEvidence && !profile.isError && !onboarding.isError;

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      localStorage.setItem(COLLAPSE_KEY, prev ? 'expanded' : 'collapsed');
      return !prev;
    });
  };

  return (
    <div className="flex h-full flex-col">
      {/* System banners span the full width, above everything — they push the
          layout down instead of covering the sidebar or top bar. */}
      <DbStatusBanner />
      <ImpersonationBanner />
      <TrialBanner />
      <VerifyEmailBanner />

      <div className="flex min-h-0 flex-1">
        {/* Sidebar — desktop only */}
        <aside
          className={`hidden shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 md:flex ${
            collapsed ? 'w-[76px]' : 'w-64'
          }`}
        >
          <div className={`flex items-center py-6 ${collapsed ? 'justify-center px-0' : 'px-5'}`}>
            {collapsed ? (
              <img
                src="/favicon/android-chrome-192x192.png"
                alt="Arcadia Atlas"
                className="h-9 w-9 shrink-0"
              />
            ) : (
              <img src="/assets/logo/atlas_logo.png" alt="Arcadia Atlas" className="h-10 w-auto" />
            )}
          </div>

          <nav className="flex flex-1 flex-col gap-1 px-3">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition-colors ${
                  collapsed ? 'justify-center px-0' : 'px-3.5'
                } ${
                  isItemActive(item, pathname)
                    ? 'bg-linear-to-r from-accent to-accent-2 text-accent-ink shadow-sm'
                    : 'text-muted hover:bg-elev hover:text-ink'
                }`}
              >
                <item.Icon size={18} strokeWidth={1.8} className="shrink-0" aria-hidden />
                {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
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
          {/* overflow-x-hidden: one over-wide component must never give the
              whole app a sideways scroll on phones — wide content scrolls
              inside its own overflow-x-auto container instead. */}
          <main className="flex-1 overflow-x-hidden overflow-y-auto pb-28 md:pb-6">
            {settingUp ? <SettingUpSplash /> : <Outlet />}
          </main>
        </div>

        {/* Friends rail — desktop only, collapsible, presence + last workout. */}
        <FriendsRail />
      </div>

      {/* Floating glass tab bar — mobile only */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-between rounded-2xl border border-line bg-surface/80 px-3 py-2 shadow-lg shadow-black/10 backdrop-blur-xl md:hidden"
      >
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            aria-label={item.label}
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
              isItemActive(item, pathname)
                ? 'bg-linear-to-br from-accent to-accent-2 text-accent-ink shadow-sm'
                : 'text-muted'
            }`}
          >
            <item.Icon size={20} strokeWidth={1.8} aria-hidden />
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
