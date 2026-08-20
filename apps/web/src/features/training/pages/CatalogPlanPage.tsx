import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  BedDouble,
  CalendarDays,
  Download,
  Dumbbell,
  ShoppingCart,
  UtensilsCrossed,
} from 'lucide-react';
import { addNeededItem } from '@/features/shopping/repository';
import { DIET_LABELS, GOAL_LABELS, LEVEL_LABELS } from '../profile';
import { CATALOG_PLANS, CATALOG_WORKOUTS, type CatalogPlan } from '../catalog';
import { importCatalogPlan } from '../recommend';
import { PLAN_GUIDES, type DietItem } from '../writeups';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** A built-in plan's full profile: the week, every workout inside it (each a
 * door to its own profile), the paired diet with its reasoning, and the
 * groceries — one page that explains the whole package before you take it. */
export function CatalogPlanPage() {
  const { key } = useParams<{ key: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const plan = CATALOG_PLANS.find((p) => p.key === key);

  const usePlanMutation = useMutation({
    mutationFn: (p: CatalogPlan) => importCatalogPlan(p),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      navigate('/train/schedule');
    },
  });
  const addGroceries = useMutation({
    mutationFn: async (items: DietItem[]) => {
      for (const item of items) await addNeededItem(item.name, item.quantity);
      return items.length;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shopping'] }),
  });

  if (!plan) {
    return (
      <div className="mx-auto max-w-3xl p-6 text-center text-sm text-muted">
        This plan isn't in the catalog.{' '}
        <Link to="/train/explore" className="text-accent hover:underline">
          Back to Explore
        </Link>
      </div>
    );
  }

  const workoutKeys = [...new Set(plan.days.filter((d) => d !== 'rest'))];
  const workouts = workoutKeys.flatMap((k) => {
    const w = CATALOG_WORKOUTS.find((cw) => cw.key === k);
    return w ? [w] : [];
  });
  const guide = PLAN_GUIDES[plan.key];

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <Link
        to="/train/explore"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
      >
        <ArrowLeft size={15} aria-hidden />
        Explore
      </Link>

      <header className="rounded-2xl bg-linear-to-br from-accent to-accent-2 p-5 text-accent-ink shadow-lg">
        <div className="mb-2 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-accent-ink/15 px-2.5 py-0.5 text-[11px] font-bold">
            {GOAL_LABELS[plan.goal]}
          </span>
          <span className="rounded-full bg-accent-ink/15 px-2.5 py-0.5 text-[11px] font-bold">
            {LEVEL_LABELS[plan.level]}
          </span>
          <span className="rounded-full bg-accent-ink/15 px-2.5 py-0.5 text-[11px] font-bold">
            {DIET_LABELS[plan.diet]}
          </span>
        </div>
        <h1 className="text-2xl font-bold">{plan.name}</h1>
        <p className="mt-1 max-w-md text-sm opacity-90">{plan.description}</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold opacity-90">
            <CalendarDays size={13} aria-hidden />
            {plan.daysPerWeek} days/week · built-in plan by Atlas Coaching
          </span>
          <button
            type="button"
            disabled={usePlanMutation.isPending}
            onClick={() => usePlanMutation.mutate(plan)}
            className="springy inline-flex items-center gap-1.5 rounded-xl bg-accent-ink/15 px-4 py-2.5 text-sm font-bold backdrop-blur-sm hover:bg-accent-ink/25 disabled:opacity-50"
          >
            <Download size={15} aria-hidden />
            Use this plan — gets everything
          </button>
        </div>
      </header>

      {guide && (
        <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold">The thinking behind this plan</h2>
          <div className="space-y-2.5">
            {guide.writeup.map((paragraph, i) => (
              <p key={i} className="text-sm leading-relaxed text-muted">
                {paragraph}
              </p>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <h2 className="mb-2.5 text-sm font-semibold">The week</h2>
        <div className="grid grid-cols-7 gap-1.5 text-center">
          {DAYS.map((label, i) => {
            const slot = plan.days[i];
            const workout = slot && slot !== 'rest' ? CATALOG_WORKOUTS.find((w) => w.key === slot) : null;
            return (
              <div key={label} className="rounded-xl bg-elev px-1 py-2">
                <p className="text-[10px] font-bold tracking-wide text-muted uppercase">{label}</p>
                {workout ? (
                  <Link
                    to={`/train/explore/workout/${workout.key}`}
                    className="mt-1 block text-[11px] leading-tight font-medium text-accent hover:underline"
                  >
                    {workout.name}
                  </Link>
                ) : (
                  <BedDouble size={13} className="mx-auto mt-1.5 text-muted" aria-hidden />
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
          <Dumbbell size={15} className="text-accent" aria-hidden />
          Workouts in this plan
        </h2>
        <p className="mb-1 text-xs text-muted">
          Each has its own profile with coach directions and every exercise's how-to.
        </p>
        <ul className="divide-y divide-line">
          {workouts.map((w) => (
            <li key={w.key}>
              <Link
                to={`/train/explore/workout/${w.key}`}
                className="springy flex items-center gap-3 rounded-xl px-1 py-2.5 hover:bg-elev"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <Dumbbell size={16} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{w.name}</p>
                  <p className="truncate text-xs text-muted">{w.description}</p>
                </div>
                <span className="shrink-0 text-xs text-muted">{w.exercises.length} exercises</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {guide && (
        <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <h2 className="mb-0.5 flex items-center gap-2 text-sm font-semibold">
            <UtensilsCrossed size={15} className="text-accent" aria-hidden />
            The diet plan: {DIET_LABELS[plan.diet]}
          </h2>
          <p className="mb-2.5 text-xs font-medium text-accent">{guide.diet.headline}</p>

          <div className="space-y-2.5">
            {guide.diet.why.map((paragraph, i) => (
              <p key={i} className="text-sm leading-relaxed text-muted">
                {paragraph}
              </p>
            ))}
          </div>

          <p className="mt-3 rounded-xl bg-accent-soft px-3 py-2 text-xs font-medium text-accent">
            The numbers: {guide.diet.macros}
          </p>

          <h3 className="mt-4 mb-1.5 text-xs font-bold tracking-wide text-muted uppercase">
            What a day looks like
          </h3>
          <ul className="space-y-1.5">
            {guide.diet.dayShape.map((slot) => (
              <li key={slot.meal} className="flex gap-2 text-sm">
                <span className="w-28 shrink-0 font-semibold">{slot.meal}</span>
                <span className="text-muted">{slot.guidance}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold tracking-wide text-muted uppercase">
              The shopping list ({guide.diet.shopping.length} items)
            </h3>
            <button
              type="button"
              disabled={addGroceries.isPending}
              onClick={() => addGroceries.mutate(guide.diet.shopping)}
              className="springy inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold hover:bg-elev disabled:opacity-50"
            >
              <ShoppingCart size={13} aria-hidden />
              {addGroceries.isSuccess ? 'On your list ✓' : 'Add all to shopping list'}
            </button>
          </div>
          <ul className="mt-2 divide-y divide-line">
            {guide.diet.shopping.map((item) => (
              <li key={item.name} className="flex items-baseline gap-3 py-1.5">
                <span className="w-44 shrink-0 text-sm font-medium">
                  {item.name}
                  <span className="ml-1.5 text-xs font-normal text-muted">{item.quantity}</span>
                </span>
                <span className="text-xs text-muted">{item.why}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted/70">
            Everything lands on your living{' '}
            <Link to="/eat/shopping" className="text-accent hover:underline">
              shopping list
            </Link>{' '}
            with quantities merged — then{' '}
            <Link to="/eat/meal-plan" className="text-accent hover:underline">
              build the week's meal plan
            </Link>{' '}
            from it.
          </p>
        </section>
      )}
    </div>
  );
}
