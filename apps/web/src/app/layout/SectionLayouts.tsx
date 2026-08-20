import { Outlet, useLocation } from 'react-router';
import {
  CalendarDays,
  ClipboardList,
  Compass,
  NotebookPen,
  Play,
  Salad,
  ShoppingCart,
  Soup,
  Target,
  TrendingUp,
} from 'lucide-react';
import { SegmentedTabs, type SegmentTab } from '@/components/SegmentedTabs';

/** The three section layouts of the 4-tab shell. Each owns its pill bar and
 * animates its content in with the shared spring, so switching segments and
 * drilling into detail pages feels like moving within one surface. */

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

const trainTabs: SegmentTab[] = [
  { to: '/train', label: 'Today', Icon: Play, end: true },
  {
    to: '/train/schedule',
    label: 'Schedule',
    Icon: CalendarDays,
    match: ['/plans'],
  },
  {
    to: '/train/library',
    label: 'Library',
    Icon: ClipboardList,
    match: ['/workouts', '/exercises'],
  },
  { to: '/train/explore', label: 'Explore', Icon: Compass },
];

export function TrainLayout() {
  return <Section tabs={trainTabs} />;
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
// section is your data (progress and goals), the avatar is your account.
const youTabs: SegmentTab[] = [
  {
    to: '/you',
    label: 'Progress',
    Icon: TrendingUp,
    end: true,
    match: ['/you/history'],
  },
  { to: '/you/goals', label: 'Goals', Icon: Target },
];

export function YouLayout() {
  return <Section tabs={youTabs} />;
}
