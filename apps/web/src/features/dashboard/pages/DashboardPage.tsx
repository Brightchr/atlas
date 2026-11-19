import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, Flame, Scale, Trophy, type LucideIcon } from 'lucide-react';
import { WeekStrip } from '@/components/WeekStrip';
import { adherenceStats, recentPersonalRecords, weightTrend } from '@/features/training/stats';
import { FriendsCard } from '@/features/social/components/FriendsCard';
import { TodayWorkout } from '@/features/training/TodayWorkout';
import { formatWeight, useUnits } from '@/lib/units';
import { GoalsCard, VolumeCard, WeightCard } from '../components/ProgressCards';
import { PromoBanner } from '../components/PromoBanner';
import { PlannedNudges, SuggestedExercises } from '../components/TodayExtras';
import { TodayFoodCard } from '../components/TodayFoodCard';
import { WeeklyPulse } from '../components/WeeklyPulse';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** One number with a label: small enough that four sit in a row on a phone
 * (two rows of two), and each is a door to the screen that explains it. */
function Stat({
  to,
  Icon,
  value,
  label,
  short,
}: {
  to: string;
  Icon: LucideIcon;
  value: string;
  label: string;
  /** A shorter label for phone width, where the full one would be cut off. */
  short: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-3 transition-colors hover:bg-elev"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
        <Icon size={17} strokeWidth={1.9} aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-lg leading-tight font-bold tabular-nums">{value}</span>
        <span className="block truncate text-xs text-muted">
          <span className="sm:hidden">{short}</span>
          <span className="hidden sm:inline">{label}</span>
        </span>
      </span>
    </Link>
  );
}

/** Today: what to do now, and how it is going.
 *
 * Top to bottom on a phone: a row of headline numbers, the workout your plan
 * says to do, today's food, then the tracking cards (week, weight, volume,
 * goals). On a wide screen the same cards sit in two columns — action on the
 * left, tracking on the right — so nothing is stretched into a giant bar.
 * Every card is a summary with a link to the tab that owns the detail; each
 * fetches its own data, so this file is only layout. */
export function DashboardPage() {
  const units = useUnits();
  // Same query keys the Plan and Progress tabs use, so results come from cache.
  const adherence = useQuery({
    queryKey: ['stats', 'adherence'],
    queryFn: () => adherenceStats(4),
  });
  const weights = useQuery({ queryKey: ['stats', 'weight'], queryFn: () => weightTrend(90) });
  const records = useQuery({
    queryKey: ['stats', 'records', 30],
    queryFn: () => recentPersonalRecords(30, 50),
  });

  // The last row is the current week.
  const thisWeek = adherence.data?.weeks[adherence.data.weeks.length - 1];
  const weekDone = thisWeek?.days.filter((d) => d.status === 'done').length ?? 0;
  const weekMissed = thisWeek?.days.filter((d) => d.status === 'missed').length ?? 0;
  // Everything the plan put on this week, whatever became of it.
  const weekPlanned = thisWeek?.days.filter((d) => d.status !== 'off').length ?? 0;
  const latestWeight = weights.data?.[weights.data.length - 1];

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h1 className="text-2xl font-bold">{greeting()}</h1>
        <p className="text-sm text-muted">
          {new Date().toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat
          to="/train"
          Icon={CalendarCheck}
          value={weekPlanned > 0 ? `${weekDone} / ${weekPlanned}` : String(weekDone)}
          label="Workouts this week"
          short="This week"
        />
        <Stat
          to="/train/schedule"
          Icon={Flame}
          value={String(adherence.data?.streak ?? 0)}
          label="Session streak"
          short="Streak"
        />
        <Stat
          to="/progress"
          Icon={Trophy}
          value={String(records.data?.length ?? 0)}
          label="Records, last 30 days"
          short="Records (30d)"
        />
        <Stat
          to="/progress/goals"
          Icon={Scale}
          value={latestWeight ? formatWeight(latestWeight.weightKg, units) : '—'}
          label="Body weight"
          short="Weight"
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-5">
        {/* Action: what to do today. */}
        <div className="min-w-0 space-y-4 lg:col-span-3">
          <TodayWorkout />
          <TodayFoodCard />
          {/* Planned meals / shopping list, only when there is something. */}
          <PlannedNudges />
          <VolumeCard />
        </div>

        {/* Tracking: how the week and the longer run are going. */}
        <div className="min-w-0 space-y-4 lg:col-span-2">
          {thisWeek && <WeekStrip days={thisWeek.days} done={weekDone} missed={weekMissed} />}
          {/* The week in words, with a quick weigh-in. */}
          <WeeklyPulse />
          <WeightCard />
          {/* Renders nothing when there are no goals. */}
          <GoalsCard />
          {/* Who is online and what they last trained. */}
          <FriendsCard />
        </div>
      </div>

      <SuggestedExercises />

      {/* Only renders while a promotion is live, and is dismissible. Last on
          the page so it never pushes today's content down. */}
      <PromoBanner />
    </div>
  );
}
