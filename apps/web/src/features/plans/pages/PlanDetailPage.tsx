import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  BedDouble,
  CalendarDays,
  Download,
  Dumbbell,
  ShoppingCart,
  Star,
  Trash2,
  UtensilsCrossed,
  Wrench,
} from 'lucide-react';
import { formatDate } from '@/lib/dates';
import { fetchAllExercises } from '@/lib/exercise-db/client';
import { DIET_LABELS, GOAL_LABELS, LEVEL_LABELS } from '@/features/training/profile';
import { addDietStaplesToShoppingList, DIET_BLURBS, DIET_STAPLES } from '../dietStaples';
import {
  useDeleteSharedPlan,
  useImportSharedPlan,
  usePlanReviews,
  useSharedPlanDetail,
  useSubmitReview,
} from '../api';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex" aria-label={`Rated ${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={14}
          className={i <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-line'}
          aria-hidden
        />
      ))}
    </span>
  );
}

/** Everything about one community plan in one place: what you'll do (workouts
 * and their exact exercises), what you'll need (equipment, groceries), how
 * it's rated, and who made it. The antidote to "everything is separate". */
export function PlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const plan = useSharedPlanDetail(id);
  const reviews = usePlanReviews(id ?? null);
  const importPlan = useImportSharedPlan();
  const submit = useSubmitReview();
  const navigate = useNavigate();
  const removeShare = useDeleteSharedPlan();
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  const exerciseIndex = useQuery({
    queryKey: ['exercise-index'],
    queryFn: async () => new Map((await fetchAllExercises()).map((e) => [e.id, e])),
    staleTime: Infinity,
  });

  const addStaples = useMutation({ mutationFn: addDietStaplesToShoppingList });

  if (plan.isError) {
    return (
      <div className="mx-auto max-w-3xl p-6 text-center text-sm text-muted">
        This plan isn't available — it may be private or deleted.{' '}
        <Link to="/train/schedule" className="text-accent hover:underline">
          Back to plans
        </Link>
      </div>
    );
  }
  if (!plan.data) return null;

  const p = plan.data;
  const workouts = p.payload.days.flatMap((d) => (d.workout ? [d.workout] : []));
  const uniqueWorkouts = [...new Map(workouts.map((w) => [w.name, w])).values()];
  const equipment = new Set<string>();
  if (exerciseIndex.data) {
    for (const w of uniqueWorkouts) {
      for (const e of w.exercises) {
        for (const eq of exerciseIndex.data.get(e.exerciseId)?.equipment ?? []) {
          if (eq.name !== 'Body only') equipment.add(eq.name);
        }
      }
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-6">
      <header className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-1.5 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
                {GOAL_LABELS[p.goal]}
              </span>
              <span className="rounded-full bg-elev px-2 py-0.5 text-[11px] font-semibold text-muted">
                {LEVEL_LABELS[p.difficulty]}
              </span>
              {p.diet && (
                <span className="rounded-full bg-elev px-2 py-0.5 text-[11px] font-semibold text-muted">
                  {DIET_LABELS[p.diet]}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold">{p.name}</h1>
            <p className="mt-0.5 text-sm text-muted">
              by{' '}
              <Link to={`/users/${p.owner}`} className="font-medium text-accent hover:underline">
                {p.owner}
              </Link>
              {p.rating !== null && (
                <span className="ml-2 inline-flex items-center gap-1.5 align-middle">
                  <Stars rating={p.rating} />
                  <span className="text-xs font-semibold text-ink">{p.rating}</span>
                  <span className="text-xs">({p.reviewCount} reviews)</span>
                </span>
              )}
            </p>
          </div>
          <span className="flex items-center gap-2">
            {p.mine &&
              (confirmingRemove ? (
                <span className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={removeShare.isPending}
                    onClick={() =>
                      removeShare.mutate(p.id, {
                        onSuccess: () => void navigate('/train/schedule'),
                      })
                    }
                    className="rounded-xl bg-rose-500/10 px-3 py-2.5 text-sm font-semibold text-rose-600 disabled:opacity-50"
                  >
                    {removeShare.isPending ? 'Removing…' : 'Unpublish'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingRemove(false)}
                    className="rounded-xl px-2.5 py-2.5 text-sm text-muted hover:text-ink"
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingRemove(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm font-semibold shadow-sm transition-colors hover:bg-elev"
                >
                  <Trash2 size={14} aria-hidden />
                  Unpublish
                </button>
              ))}
            <button
              type="button"
              disabled={importPlan.isPending}
              onClick={() => importPlan.mutate(p.id)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-linear-to-r from-accent to-accent-2 px-4 py-2.5 text-sm font-semibold text-accent-ink shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              <Download size={15} aria-hidden />
              {importPlan.isSuccess ? 'In your plans ✓' : 'Use this plan'}
            </button>
          </span>
        </div>
        {p.mine && (
          <p className="mt-2 text-xs text-muted">
            This is your listing. To change it, edit your copy in My Plans and publish again —
            it updates in place. Unpublishing removes it for everyone; your own copy stays.
          </p>
        )}
        {p.description && <p className="mt-3 text-sm">{p.description}</p>}
      </header>

      <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <h2 className="mb-2.5 flex items-center gap-2 text-sm font-semibold">
          <CalendarDays size={15} className="text-accent" aria-hidden />
          The week
        </h2>
        <div className="grid grid-cols-7 gap-1.5 text-center">
          {DAYS.map((label, i) => {
            const day = p.payload.days.find((d) => d.dayOfWeek === i);
            return (
              <div key={label} className="rounded-xl bg-elev px-1 py-2">
                <p className="text-[10px] font-bold tracking-wide text-muted uppercase">{label}</p>
                {day?.workout ? (
                  <p className="mt-1 text-[11px] leading-tight font-medium" title={day.workout.name}>
                    {day.workout.name}
                  </p>
                ) : day?.isRestDay ? (
                  <BedDouble size={13} className="mx-auto mt-1.5 text-muted" aria-hidden />
                ) : (
                  <p className="mt-1 text-[11px] text-muted/60">—</p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <h2 className="mb-2.5 flex items-center gap-2 text-sm font-semibold">
          <Dumbbell size={15} className="text-accent" aria-hidden />
          Workouts &amp; exercises included
        </h2>
        <div className="space-y-3">
          {uniqueWorkouts.map((w) => (
            <div key={w.name}>
              <p className="text-sm font-semibold">{w.name}</p>
              <ul className="mt-1 space-y-0.5">
                {w.exercises.map((e) => (
                  <li key={`${w.name}-${e.position}`} className="flex items-baseline justify-between gap-2 text-xs">
                    <Link to={`/exercises/${e.exerciseId}`} className="truncate text-accent hover:underline">
                      {e.exerciseName}
                    </Link>
                    <span className="shrink-0 tabular-nums text-muted">
                      {e.targetDurationSec
                        ? `${e.targetSets} × ${Math.round(e.targetDurationSec / 60)} min`
                        : `${e.targetSets} × ${e.targetReps ?? '—'}`}
                      {e.restSec ? ` · rest ${e.restSec}s` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {equipment.size > 0 && (
          <p className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-3 text-xs text-muted">
            <Wrench size={12} aria-hidden />
            You'll need:
            {[...equipment].map((eq) => (
              <span key={eq} className="rounded-full bg-elev px-1.5 py-0.5 font-medium">
                {eq}
              </span>
            ))}
          </p>
        )}
      </section>

      {p.diet && (
        <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <UtensilsCrossed size={15} className="text-accent" aria-hidden />
            Eats with: {DIET_LABELS[p.diet]}
          </h2>
          <p className="text-xs text-muted">{DIET_BLURBS[p.diet]}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={addStaples.isPending}
              onClick={() => addStaples.mutate(p.diet!)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold hover:bg-elev disabled:opacity-50"
            >
              <ShoppingCart size={13} aria-hidden />
              {addStaples.isSuccess
                ? `${DIET_STAPLES[p.diet].length} staples on your list ✓`
                : 'Add staples to shopping list'}
            </button>
            <Link
              to="/eat/meal-plan"
              className="text-xs font-medium text-accent hover:underline"
            >
              Build the meal plan →
            </Link>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <h2 className="mb-2.5 text-sm font-semibold">
          Reviews {p.reviewCount > 0 && <span className="text-muted">({p.reviewCount})</span>}
        </h2>
        <div className="space-y-3">
          {(reviews.data?.reviews ?? []).map((r) => (
            <div key={r.id} className="border-b border-line pb-2.5 last:border-none last:pb-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold">{r.author}</span>
                <Stars rating={r.rating} />
                <span className="text-[10px] text-muted">{formatDate(r.updatedAt)}</span>
              </div>
              {r.comment && <p className="mt-1 text-xs text-muted">{r.comment}</p>}
            </div>
          ))}
          {reviews.data?.reviews.length === 0 && (
            <p className="text-xs text-muted">No reviews yet — train it and be the first.</p>
          )}
          {!p.mine && (
            <div className="space-y-2 rounded-xl bg-elev p-3">
              <div className="flex items-center gap-1" role="radiogroup" aria-label="Your rating">
                {[1, 2, 3, 4, 5].map((i) => (
                  <button
                    key={i}
                    type="button"
                    role="radio"
                    aria-checked={rating === i}
                    aria-label={`${i} star${i > 1 ? 's' : ''}`}
                    onClick={() => setRating(i)}
                  >
                    <Star
                      size={20}
                      className={i <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted'}
                      aria-hidden
                    />
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="What worked, what didn't? (optional)"
                  maxLength={1000}
                  className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-xs outline-none focus:border-accent"
                />
                <button
                  type="button"
                  disabled={rating === 0 || submit.isPending}
                  onClick={() =>
                    submit.mutate(
                      { planId: p.id, rating, comment },
                      { onSuccess: () => setComment('') },
                    )
                  }
                  className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-accent-ink disabled:opacity-50"
                >
                  {submit.isSuccess ? 'Saved ✓' : 'Review'}
                </button>
              </div>
              {submit.isError && <p className="text-xs text-rose-500">{submit.error.message}</p>}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
