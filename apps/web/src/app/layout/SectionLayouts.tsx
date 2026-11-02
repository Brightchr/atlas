import { Link, Outlet, useLocation } from 'react-router';
import {
  ChevronLeft,
  NotebookPen,
  Salad,
  ShoppingCart,
  Soup,
  Target,
  TrendingUp,
  UsersRound,
} from 'lucide-react';
import { SegmentedTabs, type SegmentTab } from '@/components/SegmentedTabs';

/** The section layouts of the 5-tab shell. Eat and You own a pill bar; the
 * Workout section is one hub page with drill-downs, so it gets a back link
 * instead. All animate content in with the shared spring, so moving within
 * a section feels like moving within one surface. */

function Section({ tabs }: { tabs: SegmentTab[] }) {
  const { pathname } = useLocation();
  return (
    <div>
      <div className="mx-auto max-w-5xl px-4 pt-4 md:px-6">
        <SegmentedTabs tabs={tabs} pathname={pathname} />
      </div>
      <div key={pathname} className="page-enter">
        <Outlet />
      </div>
    </div>
  );
}

/** No pills: the hub at /train is the whole section, everything else is a
 * drill-down with one back link (rendered here, once). The live session
 * page gets none — Finish, Save and Discard are its exits. */
export function TrainLayout() {
  const { pathname } = useLocation();
  const showBack = pathname !== '/train' && !pathname.startsWith('/workouts/session/');
  return (
    <div>
      {showBack && (
        <div className="mx-auto max-w-5xl px-4 pt-4 md:px-6">
          <Link
            to="/train"
            className="inline-flex items-center gap-1 text-sm font-medium text-muted transition-colors hover:text-ink"
          >
            <ChevronLeft size={16} aria-hidden />
            Workout
          </Link>
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
  { to: '/eat/meal-plan', label: 'Meal plan', Icon: Salad },
  { to: '/eat/recipes', label: 'Recipes', Icon: Soup },
  { to: '/eat/shopping', label: 'Shopping', Icon: ShoppingCart },
];

export function EatLayout() {
  return <Section tabs={eatTabs} />;
}

// Profile and Settings live under the top-bar avatar menu, not here — this
// section is you: your progress, your goals, your people.
const youTabs: SegmentTab[] = [
  { to: '/you', label: 'Progress', Icon: TrendingUp, end: true },
  { to: '/you/goals', label: 'Goals', Icon: Target },
  { to: '/friends', label: 'Friends', Icon: UsersRound, match: ['/groups'] },
];

export function YouLayout() {
  return <Section tabs={youTabs} />;
}
