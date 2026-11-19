import { Outlet, useLocation } from 'react-router';
import {
  ChevronLeft,
  History,
  NotebookPen,
  Salad,
  ShoppingCart,
  Soup,
  Target,
  TrendingUp,
} from 'lucide-react';
import { SegmentedTabs, type SegmentTab } from '@/components/SegmentedTabs';
import { useBack } from '@/components/ui';

/** Section layouts. One rule for the whole app:
 *
 *   - a section's TOP-LEVEL pages show its pill bar (Eat, Progress);
 *   - every DRILL-DOWN page shows a PageHeader with a back button instead.
 *
 * Never both, so there is exactly one way "up" on any screen. Content
 * animates in with the shared spring so moving inside a section feels like
 * moving within one surface. */

function Section({ tabs }: { tabs?: SegmentTab[] }) {
  const { pathname } = useLocation();
  // Pills only on the section's own top-level pages.
  const onTopLevel = tabs?.some((t) => t.to === pathname) ?? false;
  return (
    <div>
      {tabs && onTopLevel && (
        <div className="mx-auto max-w-5xl px-4 pt-4 md:px-6">
          <SegmentedTabs tabs={tabs} pathname={pathname} />
        </div>
      )}
      <div key={pathname} className="page-enter">
        <Outlet />
      </div>
    </div>
  );
}

/** Workout: the hub at /train is the whole section. Its drill-downs (routine,
 * explore, exercise pages) share ONE back button, rendered here, that goes
 * back the way you came. The live session has its own header instead. */
export function TrainLayout() {
  const { pathname } = useLocation();
  const goBack = useBack('/train');
  const showBack = pathname !== '/train' && !pathname.startsWith('/workouts/session/');
  return (
    <div>
      {showBack && (
        <div className="mx-auto max-w-5xl px-2 pt-2 md:px-4">
          <button
            type="button"
            onClick={goBack}
            className="springy inline-flex min-h-11 items-center gap-1 rounded-xl pr-4 pl-2 text-base font-semibold text-muted hover:bg-elev hover:text-ink"
          >
            <ChevronLeft size={22} aria-hidden />
            Back
          </button>
        </div>
      )}
      <div key={pathname} className="page-enter">
        <Outlet />
      </div>
    </div>
  );
}

const eatTabs: SegmentTab[] = [
  { to: '/eat', label: 'Diary', Icon: NotebookPen, end: true },
  { to: '/eat/meal-plan', label: 'Meal plan', Icon: Salad, end: true },
  { to: '/eat/recipes', label: 'Recipes', Icon: Soup, end: true },
  { to: '/eat/shopping', label: 'Shopping', Icon: ShoppingCart, end: true },
];

export function EatLayout() {
  return <Section tabs={eatTabs} />;
}

// Everything you look back on: charts, the workout log, and the goals the
// charts are measured against.
const progressTabs: SegmentTab[] = [
  { to: '/progress', label: 'Overview', Icon: TrendingUp, end: true },
  { to: '/history', label: 'History', Icon: History, end: true },
  { to: '/progress/goals', label: 'Goals', Icon: Target, end: true },
];

export function ProgressLayout() {
  return <Section tabs={progressTabs} />;
}

/** You: a hub page plus account drill-downs (profile, friends, settings). */
export function YouLayout() {
  return <Section />;
}
