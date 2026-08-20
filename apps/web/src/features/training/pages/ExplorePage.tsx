import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Check, Download, Sparkles, Star, Users } from 'lucide-react';
import { useSharedPlans } from '@/features/plans/api';
import {
  CATALOG_PLANS,
  CATALOG_WORKOUTS,
  type CatalogPlan,
  type CatalogWorkout,
} from '../catalog';
import {
  DIET_LABELS,
  GOAL_LABELS,
  GOAL_OPTIONS,
  LEVEL_LABELS,
  LEVEL_OPTIONS,
  useTrainingProfile,
  type TrainingGoal,
  type TrainingLevel,
} from '../profile';
import { importCatalogPlan, importCatalogWorkout, recommendPlans } from '../recommend';

const levelTone: Record<TrainingLevel, string> = {
  beginner: 'bg-emerald-500/10 text-emerald-600',
  intermediate: 'bg-amber-500/10 text-amber-600',
  advanced: 'bg-rose-500/10 text-rose-600',
};

function Tag({ children, tone = 'bg-accent-soft text-accent' }: { children: React.ReactNode; tone?: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
      {children}
    </span>
  );
}

/** Explore: the built-in catalog of 40 workouts and 8 weekly plans, filtered
 * through the user's goal profile by default. Recommendations come first;
 * one click copies a workout (or a whole plan) into your own library. */
export function ExplorePage() {
  const profile = useTrainingProfile();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [goal, setGoal] = useState<TrainingGoal | 'all' | null>(null);
  const [level, setLevel] = useState<TrainingLevel | 'all' | null>(null);
  const activeGoal = goal ?? profile.data?.goal ?? 'all';
  const activeLevel = level ?? profile.data?.level ?? 'all';

  const workouts = useMemo(
    () =>
      CATALOG_WORKOUTS.filter(
        (w) =>
          (activeGoal === 'all' || w.goal === activeGoal) &&
          (activeLevel === 'all' || w.level === activeLevel),
      ),
    [activeGoal, activeLevel],
  );
  const recommended = profile.data ? recommendPlans(profile.data, 3) : CATALOG_PLANS.slice(0, 3);
  // Community plans carry real ratings — surface the best-reviewed first.
  const sharedQuery = useSharedPlans();
  const communityPlans = [...(sharedQuery.data?.plans ?? [])]
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.reviewCount - a.reviewCount)
    .slice(0, 6);

  const addWorkout = useMutation({
    mutationFn: (w: CatalogWorkout) => importCatalogWorkout(w),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workouts'] }),
  });
  const usePlan = useMutation({
    mutationFn: (p: CatalogPlan) => importCatalogPlan(p),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      navigate('/train/schedule');
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-bold">Explore</h1>
        <p className="text-sm text-muted">
          {profile.data
            ? `Curated for “${GOAL_LABELS[profile.data.goal]}” at ${LEVEL_LABELS[profile.data.level].toLowerCase()} level — adjust the filters to look around.`
            : 'Curated workouts and weekly plans for every goal.'}
        </p>
      </header>

      <section>
        <div className="mb-2 flex items-center gap-2">
          <Sparkles size={16} className="text-accent" aria-hidden />
          <h2 className="text-sm font-semibold">Recommended plans</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {recommended.map((p) => (
            <div
              key={p.key}
              className="springy flex flex-col rounded-2xl border border-line bg-surface p-4 shadow-sm hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="mb-1.5 flex flex-wrap gap-1.5">
                <Tag tone={levelTone[p.level]}>{LEVEL_LABELS[p.level]}</Tag>
                <Tag>{GOAL_LABELS[p.goal]}</Tag>
                <Tag tone="bg-elev text-muted">{DIET_LABELS[p.diet]}</Tag>
              </div>
              <Link
                to={`/train/explore/plan/${p.key}`}
                className="font-semibold hover:text-accent hover:underline"
              >
                {p.name}
              </Link>
              <p className="mb-3 grow text-xs text-muted">{p.description}</p>
              <div className="flex items-center justify-between">
                <Link
                  to={`/train/explore/plan/${p.key}`}
                  className="flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                >
                  <CalendarDays size={13} aria-hidden />
                  {p.daysPerWeek} days/week — see inside
                </Link>
                <button
                  type="button"
                  disabled={usePlan.isPending}
                  onClick={() => usePlan.mutate(p)}
                  className="springy rounded-lg bg-linear-to-r from-accent to-accent-2 px-3 py-1.5 text-xs font-semibold text-accent-ink shadow-sm hover:opacity-90 disabled:opacity-50"
                >
                  Use this plan
                </button>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted/70">
          “Use this plan” copies the plan and its workouts into your library — everything stays
          editable, and you can <Link to="/train/schedule" className="text-accent underline">share it</Link>{' '}
          when you make it yours.
        </p>
      </section>

      {communityPlans.length > 0 && (
        <section>
          <div className="mb-2 flex items-center gap-2">
            <Users size={16} className="text-accent" aria-hidden />
            <h2 className="text-sm font-semibold">From the community</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {communityPlans.map((p) => (
              <Link
                key={p.id}
                to={`/plans/community/${p.id}`}
                className="springy flex flex-col rounded-2xl border border-line bg-surface p-4 shadow-sm hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="mb-1.5 flex flex-wrap gap-1.5">
                  <Tag tone={levelTone[p.difficulty]}>{LEVEL_LABELS[p.difficulty]}</Tag>
                  <Tag>{GOAL_LABELS[p.goal]}</Tag>
                  {p.diet && <Tag tone="bg-elev text-muted">{DIET_LABELS[p.diet]}</Tag>}
                </div>
                <p className="font-semibold">{p.name}</p>
                <p className="mb-2 grow text-xs text-muted">by {p.owner}</p>
                <span className="flex items-center gap-1 text-xs">
                  {p.rating !== null ? (
                    <>
                      <Star size={12} className="fill-amber-400 text-amber-400" aria-hidden />
                      <span className="font-semibold tabular-nums">{p.rating}</span>
                      <span className="text-muted">({p.reviewCount} reviews)</span>
                    </>
                  ) : (
                    <span className="text-muted">No reviews yet</span>
                  )}
                  <span className="ml-auto font-medium text-accent">see inside →</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold">All workouts</h2>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {(['all', ...GOAL_OPTIONS.map((g) => g.id)] as const).map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={activeGoal === g}
              onClick={() => setGoal(g)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                activeGoal === g
                  ? 'border-transparent bg-accent text-accent-ink shadow-sm'
                  : 'border-line bg-surface text-muted hover:text-ink'
              }`}
            >
              {g === 'all' ? 'All goals' : GOAL_LABELS[g]}
            </button>
          ))}
          <span className="mx-1 border-l border-line" aria-hidden />
          {(['all', ...LEVEL_OPTIONS.map((l) => l.id)] as const).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={activeLevel === l}
              onClick={() => setLevel(l)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                activeLevel === l
                  ? 'border-transparent bg-accent text-accent-ink shadow-sm'
                  : 'border-line bg-surface text-muted hover:text-ink'
              }`}
            >
              {l === 'all' ? 'All levels' : LEVEL_LABELS[l]}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {workouts.map((w) => {
            const added = addWorkout.variables?.key === w.key && addWorkout.isSuccess;
            return (
              <div
                key={w.key}
                className="springy flex flex-col rounded-2xl border border-line bg-surface p-4 shadow-sm hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="mb-1.5 flex flex-wrap gap-1.5">
                  <Tag tone={levelTone[w.level]}>{LEVEL_LABELS[w.level]}</Tag>
                  <Tag>{GOAL_LABELS[w.goal]}</Tag>
                </div>
                <Link
                  to={`/train/explore/workout/${w.key}`}
                  className="font-semibold hover:text-accent hover:underline"
                >
                  {w.name}
                </Link>
                <p className="mb-2 grow text-xs text-muted">{w.description}</p>
                <div className="flex items-center justify-between">
                  <Link
                    to={`/train/explore/workout/${w.key}`}
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    {w.exercises.length} exercises — see inside
                  </Link>
                  <button
                    type="button"
                    disabled={addWorkout.isPending}
                    onClick={() => addWorkout.mutate(w)}
                    className="springy flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold hover:bg-elev disabled:opacity-50"
                  >
                    {added ? <Check size={13} className="text-accent" aria-hidden /> : <Download size={13} aria-hidden />}
                    {added ? 'Added' : 'Add'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {workouts.length === 0 && (
          <p className="rounded-2xl border border-line bg-surface p-6 text-center text-sm text-muted">
            Nothing at this exact goal + level combination — widen a filter.
          </p>
        )}
      </section>
    </div>
  );
}
