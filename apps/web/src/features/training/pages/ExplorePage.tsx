import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  Download,
  Dumbbell,
  Flame,
  HeartPulse,
  PersonStanding,
  Search,
  Sparkles,
  Star,
  Users,
  X,
} from 'lucide-react';
import type { SharedPlanSummary } from '@arcadia/shared';
import { useSharedPlans } from '@/features/plans/api';
import {
  CATALOG_PLANS,
  CATALOG_WORKOUTS,
  FEATURED_PLAN_KEYS,
  NEW_PLAN_KEYS,
  NEW_WORKOUT_KEYS,
  WORKOUT_CATEGORY_LABELS,
  type CatalogPlan,
  type CatalogWorkout,
  type WorkoutCategory,
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

/* ------------------------------- Chrome bits ------------------------------- */

const levelTone: Record<TrainingLevel, string> = {
  beginner: 'bg-emerald-500/10 text-emerald-600',
  intermediate: 'bg-amber-500/10 text-amber-600',
  advanced: 'bg-rose-500/10 text-rose-600',
};

const categoryTone: Record<WorkoutCategory, string> = {
  strength: 'bg-indigo-500/10 text-indigo-500',
  cardio: 'bg-sky-500/10 text-sky-600',
  hiit: 'bg-orange-500/10 text-orange-600',
  mobility: 'bg-teal-500/10 text-teal-600',
};

function Tag({ children, tone = 'bg-accent-soft text-accent' }: { children: React.ReactNode; tone?: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
      {children}
    </span>
  );
}

/** A horizontally scrolling shelf with a section header. */
function Shelf({
  icon,
  title,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-accent">{icon}</span>
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {/* Full-bleed scrolling on phones only — on desktop the shelf stays
          flush with the page container like every other section. */}
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        {children}
      </div>
    </section>
  );
}

/* --------------------------------- Cards --------------------------------- */

function PlanCard({
  plan,
  onUse,
  pending,
  shelf = false,
  featured = false,
}: {
  plan: CatalogPlan;
  onUse: () => void;
  pending: boolean;
  shelf?: boolean;
  featured?: boolean;
}) {
  const navigate = useNavigate();
  return (
    <div
      onClick={() => navigate(`/train/explore/plan/${plan.key}`)}
      className={`springy flex cursor-pointer flex-col rounded-2xl border bg-surface p-4 shadow-sm hover:-translate-y-0.5 hover:shadow-md ${
        featured ? 'border-accent/40' : 'border-line'
      } ${shelf ? 'w-72 shrink-0 snap-start' : ''}`}
    >
      <div className="mb-1.5 flex flex-wrap gap-1.5">
        {featured && <Tag tone="bg-linear-to-r from-accent to-accent-2 text-accent-ink">Featured</Tag>}
        <Tag tone={levelTone[plan.level]}>{LEVEL_LABELS[plan.level]}</Tag>
        <Tag>{GOAL_LABELS[plan.goal]}</Tag>
        {!shelf && <Tag tone="bg-elev text-muted">{DIET_LABELS[plan.diet]}</Tag>}
      </div>
      <Link
        to={`/train/explore/plan/${plan.key}`}
        className="font-semibold hover:text-accent hover:underline"
      >
        {plan.name}
      </Link>
      <p className={`mb-3 grow text-xs text-muted ${shelf ? 'line-clamp-3' : ''}`}>{plan.description}</p>
      <div className="flex items-center justify-between">
        <Link
          to={`/train/explore/plan/${plan.key}`}
          className="flex items-center gap-1 text-xs font-medium text-accent hover:underline"
        >
          <CalendarDays size={13} aria-hidden />
          {plan.daysPerWeek} days/week
        </Link>
        <button
          type="button"
          disabled={pending}
          onClick={(e) => {
            e.stopPropagation();
            onUse();
          }}
          className="springy rounded-lg bg-linear-to-r from-accent to-accent-2 px-3 py-1.5 text-xs font-semibold text-accent-ink shadow-sm hover:opacity-90 disabled:opacity-50"
        >
          Use this plan
        </button>
      </div>
    </div>
  );
}

function WorkoutCard({
  workout,
  onAdd,
  pending,
  added,
  shelf = false,
}: {
  workout: CatalogWorkout;
  onAdd: () => void;
  pending: boolean;
  added: boolean;
  shelf?: boolean;
}) {
  const navigate = useNavigate();
  return (
    <div
      onClick={() => navigate(`/train/explore/workout/${workout.key}`)}
      className={`springy flex cursor-pointer flex-col rounded-2xl border border-line bg-surface p-4 shadow-sm hover:-translate-y-0.5 hover:shadow-md ${
        shelf ? 'w-72 shrink-0 snap-start' : ''
      }`}
    >
      <div className="mb-1.5 flex flex-wrap gap-1.5">
        <Tag tone={categoryTone[workout.category]}>{WORKOUT_CATEGORY_LABELS[workout.category]}</Tag>
        <Tag tone={levelTone[workout.level]}>{LEVEL_LABELS[workout.level]}</Tag>
        {!shelf && <Tag>{GOAL_LABELS[workout.goal]}</Tag>}
      </div>
      <Link
        to={`/train/explore/workout/${workout.key}`}
        className="font-semibold hover:text-accent hover:underline"
      >
        {workout.name}
      </Link>
      <p className={`mb-2 grow text-xs text-muted ${shelf ? 'line-clamp-3' : ''}`}>
        {workout.description}
      </p>
      <div className="flex items-center justify-between">
        <Link
          to={`/train/explore/workout/${workout.key}`}
          className="text-xs font-medium text-accent hover:underline"
        >
          {workout.exercises.length} exercises
        </Link>
        <button
          type="button"
          disabled={pending}
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
          className="springy flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold hover:bg-elev disabled:opacity-50"
        >
          {added ? <Check size={13} className="text-accent" aria-hidden /> : <Download size={13} aria-hidden />}
          {added ? 'Added' : 'Add'}
        </button>
      </div>
    </div>
  );
}

function CommunityCard({ plan, shelf = false }: { plan: SharedPlanSummary; shelf?: boolean }) {
  return (
    <Link
      to={`/plans/community/${plan.id}`}
      className={`springy flex flex-col rounded-2xl border border-line bg-surface p-4 shadow-sm hover:-translate-y-0.5 hover:shadow-md ${
        shelf ? 'w-72 shrink-0 snap-start' : ''
      }`}
    >
      <div className="mb-1.5 flex flex-wrap gap-1.5">
        <Tag tone={levelTone[plan.difficulty]}>{LEVEL_LABELS[plan.difficulty]}</Tag>
        <Tag>{GOAL_LABELS[plan.goal]}</Tag>
      </div>
      <p className="font-semibold">{plan.name}</p>
      <p className="mb-2 grow text-xs text-muted">by {plan.owner}</p>
      <span className="flex items-center gap-1 text-xs">
        {plan.rating !== null ? (
          <>
            <Star size={12} className="fill-amber-400 text-amber-400" aria-hidden />
            <span className="font-semibold tabular-nums">{plan.rating}</span>
            <span className="text-muted">({plan.reviewCount} reviews)</span>
          </>
        ) : (
          <span className="text-muted">No reviews yet</span>
        )}
        <span className="ml-auto font-medium text-accent">see inside →</span>
      </span>
    </Link>
  );
}

/* ------------------------------ Browse model ------------------------------ */

type BrowseKey = 'plans' | WorkoutCategory;

const BROWSE_TILES: {
  key: BrowseKey;
  label: string;
  blurb: string;
  gradient: string;
  Icon: typeof Dumbbell;
}[] = [
  {
    key: 'plans',
    label: 'Weekly plans',
    blurb: 'Complete weeks, ready to follow',
    gradient: 'from-accent to-accent-2',
    Icon: CalendarDays,
  },
  {
    key: 'strength',
    label: 'Strength',
    blurb: 'Barbells, dumbbells, muscle',
    gradient: 'from-indigo-500 to-violet-600',
    Icon: Dumbbell,
  },
  {
    key: 'cardio',
    label: 'Cardio',
    blurb: 'Steady engines, long burns',
    gradient: 'from-sky-500 to-blue-600',
    Icon: HeartPulse,
  },
  {
    key: 'hiit',
    label: 'HIIT',
    blurb: 'Short, sharp, breathless',
    gradient: 'from-orange-500 to-rose-500',
    Icon: Flame,
  },
  {
    key: 'mobility',
    label: 'Stretch & mobility',
    blurb: 'Move better, recover faster',
    gradient: 'from-teal-500 to-emerald-600',
    Icon: PersonStanding,
  },
];

/** Multi-word ranked search across names, descriptions, labels and (for
 * workouts) exercise names. Query words are punctuation-stripped,
 * plural-folded, stopword-free, and scored by coverage — "push pull legs
 * beginner" finds a beginner PPL plan even though no single field contains
 * that phrase. Local data, so it runs on every keystroke. */
const SEARCH_STOPWORDS = new Set(['with', 'and', 'the', 'for', 'of', 'on', 'in', 'an', 'a']);

function tokenizeQuery(query: string): string[] {
  return [
    ...new Set(
      query
        .toLowerCase()
        .split(/\s+/)
        .map((t) => t.replace(/[^a-z0-9]/g, ''))
        .filter((t) => t.length >= 2 && !SEARCH_STOPWORDS.has(t))
        .map((t) => (t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t)),
    ),
  ].slice(0, 8);
}

function searchCatalog(query: string): { plans: CatalogPlan[]; workouts: CatalogWorkout[] } {
  const phrase = query.trim().toLowerCase();
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return { plans: [], workouts: [] };
  // At least half the words must land somewhere — one stray word ("dumbbell
  // push day") narrows instead of vetoing.
  const minHits = Math.ceil(tokens.length / 2);

  const textScore = (name: string, description: string, labels: string[], extra = ''): number => {
    const n = name.toLowerCase();
    const hay = `${n} ${description.toLowerCase()} ${labels.join(' ').toLowerCase()} ${extra}`;
    const hits = tokens.filter((t) => hay.includes(t)).length;
    if (hits < minHits) return 0;
    const nameHits = tokens.filter((t) => n.includes(t)).length;
    let score = (hits / tokens.length) * 4 + (nameHits / tokens.length) * 2;
    if (hits === tokens.length) score += 2;
    if (n.includes(phrase)) score += 3;
    if (n.startsWith(phrase)) score += 1;
    return score;
  };

  const plans = CATALOG_PLANS.map((p) => ({
    p,
    s: textScore(p.name, p.description, [GOAL_LABELS[p.goal], LEVEL_LABELS[p.level], DIET_LABELS[p.diet], 'plan']),
  }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.p);

  const workouts = CATALOG_WORKOUTS.map((w) => ({
    w,
    s: textScore(
      w.name,
      w.description,
      [GOAL_LABELS[w.goal], LEVEL_LABELS[w.level], WORKOUT_CATEGORY_LABELS[w.category]],
      w.exercises.map((e) => e.name.toLowerCase()).join(' '),
    ),
  }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.w);

  return { plans, workouts };
}

/* --------------------------------- Page --------------------------------- */

/** Explore: search-first discovery over the catalog. A search box and browse
 * tiles sit at the top; below them, editorial shelves (featured, picks for
 * you, new, community). Opening a tile switches to a filtered grid with
 * dropdown filters — pills don't scale, dropdowns do. */
export function ExplorePage() {
  const profile = useTrainingProfile();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [browse, setBrowse] = useState<BrowseKey | null>(null);
  const [goal, setGoal] = useState<TrainingGoal | 'any'>('any');
  const [level, setLevel] = useState<TrainingLevel | 'any'>('any');

  const searching = query.trim().length > 0;
  const results = useMemo(() => (searching ? searchCatalog(query) : null), [searching, query]);

  const browseItems = useMemo(() => {
    if (!browse) return null;
    if (browse === 'plans') {
      return CATALOG_PLANS.filter(
        (p) => (goal === 'any' || p.goal === goal) && (level === 'any' || p.level === level),
      );
    }
    return CATALOG_WORKOUTS.filter(
      (w) =>
        w.category === browse &&
        (goal === 'any' || w.goal === goal) &&
        (level === 'any' || w.level === level),
    );
  }, [browse, goal, level]);

  const featured = FEATURED_PLAN_KEYS.map((k) => CATALOG_PLANS.find((p) => p.key === k)).filter(
    (p): p is CatalogPlan => Boolean(p),
  );
  const picks = profile.data
    ? recommendPlans(profile.data, 6).filter((p) => !FEATURED_PLAN_KEYS.includes(p.key as never))
    : CATALOG_PLANS.slice(0, 6);
  const newPlans = NEW_PLAN_KEYS.map((k) => CATALOG_PLANS.find((p) => p.key === k)).filter(
    (p): p is CatalogPlan => Boolean(p),
  );
  const newWorkouts = NEW_WORKOUT_KEYS.map((k) => CATALOG_WORKOUTS.find((w) => w.key === k)).filter(
    (w): w is CatalogWorkout => Boolean(w),
  );

  const sharedQuery = useSharedPlans();
  const communityPlans = [...(sharedQuery.data?.plans ?? [])]
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.reviewCount - a.reviewCount)
    .slice(0, 8);

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

  const workoutCard = (w: CatalogWorkout, shelf = false) => (
    <WorkoutCard
      key={w.key}
      workout={w}
      shelf={shelf}
      pending={addWorkout.isPending}
      added={addWorkout.variables?.key === w.key && addWorkout.isSuccess}
      onAdd={() => addWorkout.mutate(w)}
    />
  );
  const planCard = (p: CatalogPlan, opts?: { shelf?: boolean; featured?: boolean }) => (
    <PlanCard
      key={p.key}
      plan={p}
      shelf={opts?.shelf}
      featured={opts?.featured}
      pending={usePlan.isPending}
      onUse={() => usePlan.mutate(p)}
    />
  );

  const openBrowse = (key: BrowseKey) => {
    setBrowse(key);
    setGoal('any');
    setLevel('any');
    setQuery('');
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Explore</h1>
          <p className="text-sm text-muted">
            {profile.data
              ? `Picks tuned for “${GOAL_LABELS[profile.data.goal]}” — search or browse the whole catalog.`
              : 'Search the catalog, or browse by shelf.'}
          </p>
        </div>
      </header>

      <div className="relative">
        <Search size={16} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.trim()) setBrowse(null);
          }}
          placeholder="Search plans, workouts, exercises — “hiit”, “5k”, “stretch”, “kettlebell”…"
          aria-label="Search the catalog"
          className="w-full rounded-2xl border border-line bg-surface py-3 pr-10 pl-11 text-sm shadow-sm outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        {searching && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setQuery('')}
            className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1 text-muted hover:bg-elev hover:text-ink"
          >
            <X size={15} aria-hidden />
          </button>
        )}
      </div>

      {searching && results && (
        <div className="space-y-6">
          {results.plans.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold">
                Plans <span className="font-normal text-muted">({results.plans.length})</span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {results.plans.map((p) => planCard(p))}
              </div>
            </section>
          )}
          {results.workouts.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold">
                Workouts <span className="font-normal text-muted">({results.workouts.length})</span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {results.workouts.map((w) => workoutCard(w))}
              </div>
            </section>
          )}
          {results.plans.length === 0 && results.workouts.length === 0 && (
            <p className="rounded-2xl border border-line bg-surface p-8 text-center text-sm text-muted">
              Nothing matches “{query.trim()}” — try a goal (“lose weight”), a type (“stretch”), or
              an exercise name.
            </p>
          )}
        </div>
      )}

      {!searching && browse && browseItems && (
        <section>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setBrowse(null)}
              className="flex items-center gap-1 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold hover:bg-elev"
            >
              <ChevronLeft size={14} aria-hidden />
              Browse
            </button>
            <h2 className="text-sm font-semibold">
              {BROWSE_TILES.find((t) => t.key === browse)?.label}{' '}
              <span className="font-normal text-muted">({browseItems.length})</span>
            </h2>
            <div className="ml-auto flex gap-2">
              <select
                value={goal}
                onChange={(e) => setGoal(e.target.value as TrainingGoal | 'any')}
                aria-label="Filter by goal"
                className="rounded-xl border border-line bg-surface px-3 py-1.5 text-xs outline-none focus:border-accent"
              >
                <option value="any">Any goal</option>
                {GOAL_OPTIONS.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as TrainingLevel | 'any')}
                aria-label="Filter by level"
                className="rounded-xl border border-line bg-surface px-3 py-1.5 text-xs outline-none focus:border-accent"
              >
                <option value="any">Any level</option>
                {LEVEL_OPTIONS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {browse === 'plans'
              ? (browseItems as CatalogPlan[]).map((p) => planCard(p))
              : (browseItems as CatalogWorkout[]).map((w) => workoutCard(w))}
          </div>
          {browseItems.length === 0 && (
            <p className="rounded-2xl border border-line bg-surface p-8 text-center text-sm text-muted">
              Nothing at this combination — widen a filter.
            </p>
          )}
        </section>
      )}

      {!searching && !browse && (
        <>
          <section aria-label="Browse all">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {BROWSE_TILES.map(({ key, label, blurb, gradient, Icon }) => {
                const count =
                  key === 'plans'
                    ? CATALOG_PLANS.length
                    : CATALOG_WORKOUTS.filter((w) => w.category === key).length;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => openBrowse(key)}
                    className={`springy relative flex h-28 flex-col justify-between overflow-hidden rounded-2xl bg-linear-to-br ${gradient} p-3.5 text-left text-white shadow-sm hover:-translate-y-0.5 hover:shadow-md`}
                  >
                    <Icon size={22} strokeWidth={1.8} className="opacity-90" aria-hidden />
                    <span>
                      <span className="block text-sm leading-tight font-bold">{label}</span>
                      <span className="block text-[11px] leading-snug opacity-85">{blurb}</span>
                    </span>
                    <span className="absolute top-3 right-3 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <Shelf icon={<Star size={16} aria-hidden />} title="Featured">
            {featured.map((p) => planCard(p, { shelf: true, featured: true }))}
          </Shelf>

          <Shelf
            icon={<Sparkles size={16} aria-hidden />}
            title={profile.data ? 'Top picks for you' : 'Top plans'}
            action={
              <button
                type="button"
                onClick={() => openBrowse('plans')}
                className="ml-auto text-xs font-medium text-accent hover:underline"
              >
                All plans →
              </button>
            }
          >
            {picks.map((p) => planCard(p, { shelf: true }))}
          </Shelf>

          <Shelf icon={<Flame size={16} aria-hidden />} title="New this week">
            {newPlans.map((p) => planCard(p, { shelf: true }))}
            {newWorkouts.map((w) => workoutCard(w, true))}
          </Shelf>

          {communityPlans.length > 0 && (
            <Shelf icon={<Users size={16} aria-hidden />} title="Top rated by the community">
              {communityPlans.map((p) => (
                <CommunityCard key={p.id} plan={p} shelf />
              ))}
            </Shelf>
          )}

          <p className="text-xs text-muted/70">
            “Use this plan” copies the plan and its workouts into your library — everything stays
            editable, and you can <Link to="/train/schedule" className="text-accent underline">share it</Link>{' '}
            when you make it yours.
          </p>
        </>
      )}
    </div>
  );
}
