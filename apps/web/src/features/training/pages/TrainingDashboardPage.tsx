import { Link, useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  CalendarPlus,
  ChevronRight,
  ClipboardList,
  Compass,
  Dumbbell,
  Play,
  Plus,
  Search,
} from 'lucide-react';
import type { Workout } from '@arcadia/shared';
import { WeekStrip } from '@/components/WeekStrip';
import { getActivePlanId, listPlans } from '@/features/plans/repository';
import { listWorkouts, startEmptySession, startSession } from '@/features/workouts/repository';
import { GOAL_LABELS, LEVEL_LABELS, useEffectiveTrainingProfile } from '../profile';
import { adherenceStats, listSessionHistory } from '../stats';
import { TodayCard } from '../TodayCard';

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? 'last week' : `${weeks} weeks ago`;
}

function SectionHeading({
  title,
  action,
}: {
  title: string;
  action?: { to: string; label: string };
}) {
  return (
    <div className="flex items-center justify-between px-1">
      <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">{title}</h2>
      {action && (
        <Link to={action.to} className="text-xs font-semibold text-accent hover:underline">
          {action.label}
        </Link>
      )}
    </div>
  );
}

function LinkRow({
  to,
  Icon,
  label,
  hint,
}: {
  to: string;
  Icon: typeof Dumbbell;
  label: string;
  hint: string;
}) {
  return (
    <Link
      to={to}
      className="springy flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
        <Icon size={18} strokeWidth={1.8} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{label}</span>
        <span className="block truncate text-xs text-muted">{hint}</span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-muted" aria-hidden />
    </Link>
  );
}

/** The Workout tab: everything about starting a workout on one scroll —
 * quick start, today's planned session, your routines with a Start button
 * each, the plan, exercises and recent history. Hevy's "Workout" tab shape,
 * because it's the one every lifter already knows. */
export function TrainingDashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile, isSet } = useEffectiveTrainingProfile();
  const workouts = useQuery({ queryKey: ['workouts'], queryFn: listWorkouts });
  const plans = useQuery({ queryKey: ['plans'], queryFn: listPlans });
  const activePlanId = useQuery({ queryKey: ['plans', 'active'], queryFn: getActivePlanId });
  const recent = useQuery({
    queryKey: ['sessions', 'history', 'recent'],
    queryFn: () => listSessionHistory(20),
  });
  const adherence = useQuery({
    queryKey: ['stats', 'adherence'],
    queryFn: () => adherenceStats(4),
  });

  const goToSession = (id: string) => {
    void queryClient.invalidateQueries({ queryKey: ['sessions'] });
    void navigate(`/workouts/session/${id}`);
  };
  const startEmpty = useMutation({
    mutationFn: () => startEmptySession(),
    onSuccess: goToSession,
  });
  const startRoutine = useMutation({
    mutationFn: (workout: Workout) => startSession(workout),
    onSuccess: goToSession,
  });

  const lastDone = new Map<string, string>();
  for (const s of recent.data ?? []) {
    if (s.workoutId && !lastDone.has(s.workoutId)) lastDone.set(s.workoutId, s.startedAt);
  }
  const activePlan =
    (plans.data ?? []).find((p) => p.id === activePlanId.data) ?? (plans.data ?? [])[0] ?? null;
  const thisWeek = adherence.data?.weeks[adherence.data.weeks.length - 1];
  const weekDone = thisWeek?.days.filter((d) => d.status === 'done').length ?? 0;
  const weekMissed = thisWeek?.days.filter((d) => d.status === 'missed').length ?? 0;
  const routines = workouts.data ?? [];
  const recentThree = (recent.data ?? []).slice(0, 3);

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-bold">Workout</h1>
        <p className="text-sm text-muted">
          {isSet
            ? `Training to ${GOAL_LABELS[profile.goal].toLowerCase()} · ${LEVEL_LABELS[profile.level]}`
            : 'Start something now, or pick up where the plan left off.'}
        </p>
      </header>

      <section className="space-y-2">
        <SectionHeading title="Quick start" />
        <button
          type="button"
          disabled={startEmpty.isPending}
          onClick={() => startEmpty.mutate()}
          className="springy flex w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-accent to-accent-2 px-5 py-3.5 text-base font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Plus size={18} aria-hidden />
          Start empty workout
        </button>
        <TodayCard />
      </section>

      <section className="space-y-2">
        <SectionHeading
          title="Routines"
          action={{ to: '/train/library', label: routines.length > 0 ? 'Manage' : 'New routine' }}
        />
        {/* Above the list on purpose: with a dozen routines the catalogue
            otherwise sits below the fold and nobody finds it. */}
        <div className="grid gap-2 sm:grid-cols-2">
          <LinkRow
            to="/train/explore"
            Icon={Compass}
            label="Explore"
            hint="Curated routines for your goal"
          />
          <LinkRow
            to="/train/library"
            Icon={ClipboardList}
            label="New routine"
            hint="Build one from the exercise catalog"
          />
        </div>
        {routines.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line p-5 text-center text-sm text-muted">
            No routines yet. Finish an empty workout and save it as one, or{' '}
            <Link to="/train/explore" className="font-medium text-accent hover:underline">
              pick one from Explore
            </Link>
            .
          </div>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {routines.map((w) => {
              const last = lastDone.get(w.id);
              return (
                <li
                  key={w.id}
                  className="flex items-center gap-2 rounded-2xl border border-line bg-surface p-3.5 shadow-sm"
                >
                  <Link to={`/workouts/${w.id}`} className="min-w-0 flex-1">
                    <span className="block truncate font-semibold hover:text-accent">{w.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {w.exercises.length} exercise{w.exercises.length === 1 ? '' : 's'}
                      {last ? ` · last ${timeAgo(last)}` : ' · never done'}
                    </span>
                  </Link>
                  <button
                    type="button"
                    disabled={startRoutine.isPending || w.exercises.length === 0}
                    onClick={() => startRoutine.mutate(w)}
                    className="springy inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-accent-soft px-3 py-2 text-xs font-semibold text-accent transition-colors hover:bg-accent hover:text-accent-ink disabled:opacity-50"
                  >
                    <Play size={13} aria-hidden />
                    Start
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <SectionHeading title="Plan" action={{ to: '/train/schedule', label: 'Schedule' }} />
        {activePlan ? (
          // WeekStrip is a link of its own, so it sits beside the plan row
          // rather than inside it (nested anchors are invalid HTML).
          <>
            <Link
              to="/train/schedule"
              className="springy flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">{activePlan.name}</p>
                <p className="text-xs text-muted">
                  {weekDone} done
                  {weekMissed > 0 ? ` · ${weekMissed} missed` : ''} this week
                </p>
              </div>
              <CalendarDays size={18} className="shrink-0 text-accent" aria-hidden />
            </Link>
            {thisWeek && <WeekStrip days={thisWeek.days} done={weekDone} missed={weekMissed} />}
          </>
        ) : null}
        <LinkRow
          to="/train/explore?browse=plans"
          Icon={Compass}
          label={activePlan ? 'Browse plans' : 'Pick a plan'}
          hint={
            activePlan
              ? 'Beginner to advanced weekly plans, plus community plans'
              : 'A weekly schedule that tells you what to do today'
          }
        />
      </section>

      <section className="space-y-2">
        <SectionHeading title="Exercises" />
        <LinkRow
          to="/exercises"
          Icon={Search}
          label="Exercise catalog"
          hint="Photos, muscles worked and how-to for every movement"
        />
      </section>

      <section className="space-y-2">
        <SectionHeading title="Recent" action={{ to: '/history', label: 'All history' }} />
        {recentThree.length === 0 ? (
          <Link
            to="/history/log"
            className="flex items-center gap-2 rounded-2xl border border-dashed border-line p-4 text-sm text-muted transition-colors hover:bg-elev"
          >
            <CalendarPlus size={16} aria-hidden />
            Nothing logged yet. Log a workout you did without the app.
          </Link>
        ) : (
          <ul className="space-y-2">
            {recentThree.map((s) => (
              <li key={s.id}>
                <Link
                  to={`/history/${s.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{s.workoutName}</span>
                    <span className="block text-xs text-muted tabular-nums">
                      {timeAgo(s.startedAt)}
                      {s.durationMin ? ` · ${s.durationMin} min` : ''} · {s.setCount} set
                      {s.setCount === 1 ? '' : 's'}
                    </span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
