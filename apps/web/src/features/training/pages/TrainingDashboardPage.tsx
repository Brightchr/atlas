import { Link, useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BedDouble,
  CalendarRange,
  Check,
  ChevronRight,
  Compass,
  Dumbbell,
  Pencil,
  Play,
  Plus,
  Search,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { Workout } from '@arcadia/shared';
import { Button, buttonClasses, Card, PageHeader, SectionLabel } from '@/components/ui';
import { getActivePlanId, listPlans } from '@/features/plans/repository';
import { listWorkouts, startSession } from '@/features/workouts/repository';
import { localDayOfWeek } from '@/lib/dates';
import { GOAL_LABELS, LEVEL_LABELS, useEffectiveTrainingProfile } from '../profile';
import { adherenceStats, listSessionHistory, type DayStatus } from '../stats';
import { useTodayWorkout } from '../TodayCard';

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? 'last week' : `${weeks} weeks ago`;
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function LinkRow({
  to,
  Icon,
  label,
  hint,
}: {
  to: string;
  Icon: LucideIcon;
  label: string;
  hint: string;
}) {
  return (
    <Link
      to={to}
      className="flex min-h-14 items-center gap-3 px-4 py-2 transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-elev"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
        <Icon size={19} strokeWidth={1.8} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{label}</span>
        <span className="block truncate text-sm text-muted">{hint}</span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
    </Link>
  );
}

/** The little status mark at the end of a day row. */
function DayMark({ status, isNext }: { status: DayStatus | undefined; isNext: boolean }) {
  if (status === 'done') {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
        <Check size={15} strokeWidth={3} aria-label="Done" />
      </span>
    );
  }
  if (isNext) {
    return (
      <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent">
        Next
      </span>
    );
  }
  if (status === 'missed') {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-400/15 text-rose-400">
        <X size={14} strokeWidth={3} aria-label="Missed" />
      </span>
    );
  }
  return null;
}

/** The Plan tab: your week at a glance — which routine sits on which day,
 * what is done, what is next — plus the tools that change it. Workouts are
 * STARTED from Today; this screen is where the plan is read and edited. */
export function TrainingDashboardPage() {
  const workouts = useQuery({ queryKey: ['workouts'], queryFn: listWorkouts });
  const plans = useQuery({ queryKey: ['plans'], queryFn: listPlans });
  const activePlanId = useQuery({ queryKey: ['plans', 'active'], queryFn: getActivePlanId });
  const adherence = useQuery({
    queryKey: ['stats', 'adherence'],
    queryFn: () => adherenceStats(4),
  });
  const { nextUp, openSession } = useTodayWorkout();
  const { profile, isSet } = useEffectiveTrainingProfile();
  // Same key the Today card uses, so this comes from cache.
  const recent = useQuery({
    queryKey: ['sessions', 'history', 'recent'],
    queryFn: () => listSessionHistory(20),
  });
  // When each routine was last done.
  const lastDone = new Map<string, string>();
  for (const session of recent.data ?? []) {
    if (session.workoutId && !lastDone.has(session.workoutId)) {
      lastDone.set(session.workoutId, session.startedAt);
    }
  }

  // Any routine can still be started on its own, out of plan order.
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const startRoutine = useMutation({
    mutationFn: (workout: Workout) => startSession(workout),
    onSuccess: (id) => {
      void queryClient.invalidateQueries({ queryKey: ['sessions'] });
      void navigate(`/workouts/session/${id}`);
    },
  });

  const routines = workouts.data ?? [];
  const byId = new Map(routines.map((w) => [w.id, w]));
  const activePlan =
    (plans.data ?? []).find((p) => p.id === activePlanId.data) ?? (plans.data ?? [])[0] ?? null;
  // Monday-first statuses for the current week (the last row).
  const week = adherence.data?.weeks[adherence.data.weeks.length - 1]?.days;
  const today = localDayOfWeek();

  // The Plan tab is about the plan, not the whole library: list the routines
  // the plan uses first, then the most recently edited, and stop at a handful.
  // The rest are one tap away on the Routines page.
  const inPlan = new Set(
    (activePlan?.days ?? []).flatMap((d) => (d.workoutId && !d.isRestDay ? [d.workoutId] : [])),
  );
  const shownRoutines = [
    ...routines.filter((w) => inPlan.has(w.id)),
    ...routines.filter((w) => !inPlan.has(w.id)),
  ].slice(0, Math.max(5, inPlan.size));

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-6">
      <PageHeader
        title="Plan"
        subtitle={
          isSet
            ? `Training to ${GOAL_LABELS[profile.goal].toLowerCase()} · ${LEVEL_LABELS[profile.level]}`
            : undefined
        }
      />

      {/* Wide screens: the week on the left, routines and browsing beside it. */}
      <div className="grid items-start gap-5 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          {activePlan ? (
            <section className="space-y-2">
              <SectionLabel
                action={
                  <Link to="/train/schedule" className={buttonClasses('ghost', 'md', '-mr-2')}>
                    <Pencil size={15} aria-hidden />
                    Edit plan
                  </Link>
                }
              >
                {activePlan.name}
              </SectionLabel>
              <Card className="divide-y divide-line">
                {DAY_NAMES.map((name, day) => {
                  const entry = activePlan.days.find((d) => d.dayOfWeek === day);
                  const workout =
                    entry && !entry.isRestDay && entry.workoutId ? byId.get(entry.workoutId) : null;
                  const isNext =
                    nextUp?.plan.id === activePlan.id &&
                    nextUp.dayOfWeek === day &&
                    !nextUp.doneToday;
                  const row = (
                    <>
                      <span
                        className={`w-11 shrink-0 text-sm font-bold uppercase ${
                          day === today ? 'text-accent' : 'text-muted'
                        }`}
                      >
                        {name.slice(0, 3)}
                      </span>
                      <span className="min-w-0 flex-1">
                        {workout ? (
                          <>
                            <span className="block truncate font-semibold">{workout.name}</span>
                            <span className="block text-sm text-muted">
                              {workout.exercises.length} exercise
                              {workout.exercises.length === 1 ? '' : 's'}
                            </span>
                          </>
                        ) : (
                          <span className="flex items-center gap-2 text-muted">
                            <BedDouble size={16} aria-hidden />
                            Rest
                          </span>
                        )}
                      </span>
                      <DayMark status={week?.[day]?.status} isNext={isNext} />
                      {workout && (
                        <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
                      )}
                    </>
                  );
                  // Rest days are shorter rows, so training days stand out.
                  const rowClass = `flex items-center gap-3 px-4 first:rounded-t-2xl last:rounded-b-2xl ${
                    workout ? 'min-h-14 py-2' : 'min-h-11'
                  }`;
                  return workout ? (
                    <Link
                      key={day}
                      to={`/workouts/${workout.id}`}
                      className={`${rowClass} transition-colors hover:bg-elev`}
                    >
                      {row}
                    </Link>
                  ) : (
                    <div key={day} className={rowClass}>
                      {row}
                    </div>
                  );
                })}
              </Card>
            </section>
          ) : (
            plans.isSuccess && (
              <Card className="glow-ring p-5">
                <p className="text-xs font-semibold tracking-widest text-accent uppercase">
                  No plan yet
                </p>
                <h2 className="mt-2 text-2xl font-bold">Build your week</h2>
                <p className="mt-1 text-sm text-muted">
                  Put your routines on the days you train. Today then shows what to do and keeps
                  your place, even when you miss a day.
                </p>
                <div className="mt-4 grid gap-2">
                  <Link to="/train/schedule" className={buttonClasses('primary', 'xl')}>
                    Build your plan
                  </Link>
                  <Link
                    to="/train/explore?browse=plans"
                    className={buttonClasses('secondary', 'lg')}
                  >
                    Pick a ready-made plan
                  </Link>
                </div>
              </Card>
            )
          )}
        </div>

        <div className="min-w-0 space-y-5 lg:col-span-2">
          <section className="space-y-2">
            <SectionLabel
              action={
                <Link to="/train/library" className={buttonClasses('ghost', 'md', '-mr-2')}>
                  <Plus size={16} aria-hidden />
                  New routine
                </Link>
              }
            >
              Routines
            </SectionLabel>
            {routines.length === 0 ? (
              <Card className="border-dashed p-5 text-center text-sm text-muted">
                No routines yet. A routine is a list of exercises you repeat; a plan puts routines
                on days.
              </Card>
            ) : (
              <Card className="divide-y divide-line">
                {shownRoutines.map((w) => {
                  const last = lastDone.get(w.id);
                  return (
                    // The row opens the routine; Start is its own button
                    // beside it (a button cannot sit inside a link).
                    <div
                      key={w.id}
                      className="flex min-h-14 items-center gap-2 py-1.5 pr-2 pl-4 first:rounded-t-2xl last:rounded-b-2xl"
                    >
                      <Link
                        to={`/workouts/${w.id}`}
                        className="flex min-w-0 flex-1 items-center gap-3"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                          <Dumbbell size={19} strokeWidth={1.8} aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{w.name}</span>
                          <span className="block truncate text-sm text-muted">
                            {w.exercises.length} exercise{w.exercises.length === 1 ? '' : 's'}
                            {last ? ` · last ${timeAgo(last)}` : ' · never done'}
                            {inPlan.has(w.id) ? ' · in your plan' : ''}
                          </span>
                        </span>
                      </Link>
                      <Button
                        variant="soft"
                        // One workout at a time: resume the open one instead.
                        disabled={
                          Boolean(openSession) || startRoutine.isPending || w.exercises.length === 0
                        }
                        onClick={() => startRoutine.mutate(w)}
                        aria-label={`Start ${w.name}`}
                      >
                        <Play size={16} aria-hidden />
                        Start
                      </Button>
                    </div>
                  );
                })}
                {routines.length > shownRoutines.length && (
                  <Link
                    to="/train/library"
                    className="flex min-h-11 items-center justify-center gap-1 text-sm font-semibold text-accent last:rounded-b-2xl hover:bg-elev"
                  >
                    All {routines.length} routines
                    <ChevronRight size={16} aria-hidden />
                  </Link>
                )}
              </Card>
            )}
          </section>

          <section className="space-y-2">
            <SectionLabel>Browse</SectionLabel>
            <Card className="divide-y divide-line">
              <LinkRow
                to="/train/explore?browse=plans"
                Icon={CalendarRange}
                label="Browse plans"
                hint="Ready-made weekly plans, plus community plans"
              />
              <LinkRow
                to="/train/explore"
                Icon={Compass}
                label="Explore"
                hint="Ready-made routines and plans"
              />
              <LinkRow
                to="/exercises"
                Icon={Search}
                label="Exercise catalog"
                hint="Photos, muscles worked and how-to"
              />
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
