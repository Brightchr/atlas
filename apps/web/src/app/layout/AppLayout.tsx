import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useNavigationType } from 'react-router';
import {
  Apple,
  ClipboardList,
  LineChart,
  UserRound,
  VenetianMask,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { TopBar } from '@/app/layout/TopBar';
import { DbStatusBanner } from '@/components/DbStatusBanner';
import { useStopImpersonation } from '@/features/admin/api';
import { TrialBanner } from '@/features/billing/components/TrialBanner';
import { VerifyEmailBanner } from '@/features/auth/components/VerifyEmailBanner';
import { useCurrentUser, useSession } from '@/features/auth/api';
import { useIncomingRequestCount } from '@/features/social/components/FriendsCard';
import { ActiveWorkoutBar, useOpenSession } from '@/features/workouts/components/ActiveWorkoutBar';
import { useRestAlarm } from '@/features/workouts/restTimer';
import { startStatsPublisher } from '@/features/social/stats';
import { startSync } from '@/lib/sync/engine';
import { useSyncState } from '@/lib/sync/useSync';
import { useOnboardingState, useTrainingProfile } from '@/features/training/profile';

// The 5-tab shell: Today, Plan, Eat, Progress, You.
//   Today    — what the plan says to do now, and what is left to eat.
//   Plan     — the week, its routines, building or picking a plan.
//   Eat      — the food diary, meal plan, recipes, shopping.
//   Progress — everything you look back on: charts, history, goals.
//   You      — the account.
// `match` lists extra path prefixes (detail and legacy routes) that keep a
// tab lit.
interface NavItem {
  to: string;
  label: string;
  Icon: LucideIcon;
  end?: boolean;
  match?: string[];
}

const navItems: NavItem[] = [
  { to: '/', label: 'Today', Icon: Zap, end: true },
  {
    to: '/train',
    label: 'Plan',
    Icon: ClipboardList,
    match: ['/workouts', '/exercises', '/plans', '/training'],
  },
  { to: '/eat', label: 'Eat', Icon: Apple, match: ['/nutrition', '/shopping'] },
  { to: '/progress', label: 'Progress', Icon: LineChart, match: ['/history'] },
  {
    to: '/you',
    label: 'You',
    Icon: UserRound,
    match: ['/profile', '/settings', '/friends', '/groups', '/users', '/upgrade', '/admin'],
  },
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
        className="min-h-11 rounded-lg border border-amber-500/40 px-3 text-sm font-semibold transition-colors hover:bg-amber-500/20"
      >
        Return to admin
      </button>
    </div>
  );
}

/** App shell: a top bar and one column of content. The five tabs are a
 * bottom bar on phones (thumb reach) and move into the top bar on wider
 * screens (where the pointer already is). There is no sidebar.
 *
 * The live workout screen is the one exception: it hides the tabs so a stray
 * thumb cannot navigate away mid-set. All colors come from theme tokens —
 * see index.css. */
export function AppLayout() {
  const { data: user } = useCurrentUser();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const mainRef = useRef<HTMLElement>(null);
  const { data: openSession } = useOpenSession();
  // Workout mode: the live session screen owns the screen.
  const inWorkout = pathname.startsWith('/workouts/session/');
  const showWorkoutBar = Boolean(openSession) && !inWorkout;

  // Waiting friend requests put a dot on the You tab (the old friends rail
  // used to carry this badge).
  const friendRequests = useIncomingRequestCount();

  // Sounds the end-of-rest alarm on whatever screen the user is on.
  useRestAlarm();

  // <main> is the scroll container, so the browser's own "scroll to top on
  // navigation" never happens. Do it here for forward navigation; on Back
  // (POP) leave the position alone.
  useEffect(() => {
    if (navigationType !== 'POP') mainRef.current?.scrollTo({ top: 0 });
  }, [pathname, navigationType]);

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

  return (
    <div className="flex h-full flex-col">
      {/* System banners span the full width, above everything — they push the
          layout down instead of covering the top bar. */}
      <DbStatusBanner />
      <ImpersonationBanner />
      <TrialBanner />
      <VerifyEmailBanner />

      <div className={inWorkout ? 'hidden md:block' : ''}>
        <TopBar
          nav={
            <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
              {navItems.map((item) => {
                const active = isItemActive(item, pathname);
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={`flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors ${
                      active ? 'bg-elev text-ink' : 'text-muted hover:bg-elev/60 hover:text-ink'
                    }`}
                  >
                    <item.Icon size={16} strokeWidth={active ? 2.2 : 1.8} aria-hidden />
                    {item.label}
                    {item.to === '/you' && friendRequests > 0 && (
                      <span
                        aria-label={`${friendRequests} friend requests`}
                        className="h-2 w-2 rounded-full bg-accent"
                      />
                    )}
                  </NavLink>
                );
              })}
            </nav>
          }
        />
      </div>

      {/* overflow-x-hidden: one over-wide component must never give the whole
          app a sideways scroll on phones — wide content scrolls inside its
          own overflow-x-auto container instead. The bottom padding keeps the
          last card clear of the tab bar (and the workout bar when shown). */}
      <main
        ref={mainRef}
        className={`min-h-0 flex-1 overflow-x-hidden overflow-y-auto ${
          inWorkout ? 'pb-0' : showWorkoutBar ? 'pb-44 md:pb-28' : 'pb-28 md:pb-10'
        }`}
      >
        {settingUp ? <SettingUpSplash /> : <Outlet />}
      </main>

      {showWorkoutBar && <ActiveWorkoutBar />}

      {/* Phone tab bar: icon AND label, five 64px-tall targets in the thumb
          zone. The active tab is marked with a beam of light along its top
          edge (.glow-beam in index.css). From md up the same five tabs sit in
          the top bar instead (see the `nav` passed to TopBar above). Hidden
          in workout mode. */}
      {!inWorkout && (
        <nav
          aria-label="Primary"
          className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
        >
          {navItems.map((item) => {
            const active = isItemActive(item, pathname);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={`flex h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors ${
                  active ? 'glow-beam text-accent' : 'text-muted hover:text-ink'
                }`}
              >
                <span className="relative">
                  <item.Icon size={22} strokeWidth={active ? 2.2 : 1.8} aria-hidden />
                  {item.to === '/you' && friendRequests > 0 && (
                    <span
                      aria-label={`${friendRequests} friend requests`}
                      className="absolute -top-0.5 -right-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-accent"
                    />
                  )}
                </span>
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      )}
    </div>
  );
}
