import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BookmarkPlus, CalendarPlus, Trash2 } from 'lucide-react';
import type { MealType, SharedRecipeDetail } from '@arcadia/shared';
import { formatDate } from '@/lib/dates';
import { ReportButton } from '@/features/reports/components/ReportButton';
import {
  importSharedRecipe,
  useCommunityRecipe,
  useReviewRecipe,
  useUnpublishRecipe,
} from '../communityRecipes';
import { addMealPlanItem } from '../mealPlan';
import { scaleMacros } from '../repository';
import { RecipeThumb } from '../components/RecipeArt';
import { StarPicker, Stars } from '../components/Stars';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MEALS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

function perServingMacros(detail: SharedRecipeDetail) {
  const totals = detail.payload.ingredients.reduce(
    (acc, i) => {
      const m = scaleMacros(i.food.per100g, i.grams);
      return {
        kcal: acc.kcal + m.kcal,
        proteinG: acc.proteinG + m.proteinG,
        carbsG: acc.carbsG + m.carbsG,
        fatG: acc.fatG + m.fatG,
      };
    },
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
  const d = Math.max(1, detail.servings);
  return {
    kcal: Math.round(totals.kcal / d),
    proteinG: +(totals.proteinG / d).toFixed(1),
    carbsG: +(totals.carbsG / d).toFixed(1),
    fatG: +(totals.fatG / d).toFixed(1),
  };
}

function chip(tone: string, text: string) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${tone}`}>
      {text}
    </span>
  );
}

/** One shared recipe: full detail, reviews, and the two doors back into your
 * own kitchen — save a local copy, or slot it straight into the meal plan. */
export function CommunityRecipePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const detailQuery = useCommunityRecipe(id);
  const review = useReviewRecipe(id ?? '');
  const unpublish = useUnpublishRecipe();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [planPicker, setPlanPicker] = useState(false);
  const [planDay, setPlanDay] = useState(0);
  const [planMeal, setPlanMeal] = useState<MealType>('dinner');
  const [planServings, setPlanServings] = useState('1');
  // One local copy per visit, however many actions the user takes.
  const importedIdRef = useRef<string | null>(null);

  const importOnce = async (detail: SharedRecipeDetail): Promise<string> => {
    if (!importedIdRef.current) {
      importedIdRef.current = await importSharedRecipe(detail);
      void queryClient.invalidateQueries({ queryKey: ['recipes'] });
    }
    return importedIdRef.current;
  };

  const save = useMutation({
    mutationFn: (detail: SharedRecipeDetail) => importOnce(detail),
  });
  const addToPlan = useMutation({
    mutationFn: async (detail: SharedRecipeDetail) => {
      const localId = await importOnce(detail);
      await addMealPlanItem({
        dayOfWeek: planDay,
        meal: planMeal,
        kind: 'recipe',
        refId: localId,
        name: detail.name,
        grams: null,
        servings: Math.max(0.5, Number(planServings) || 1),
      });
      void queryClient.invalidateQueries({ queryKey: ['mealPlan'] });
    },
    onSuccess: () => setPlanPicker(false),
  });

  if (detailQuery.isError) {
    return (
      <div className="mx-auto max-w-2xl p-6 text-center text-sm text-muted">
        This recipe is gone — it may have been unshared.{' '}
        <Link to="/eat/recipes" className="text-accent hover:underline">
          Back to recipes
        </Link>
      </div>
    );
  }
  const detail = detailQuery.data;
  if (!detail) return <p className="p-6 text-muted">Loading…</p>;

  const per = perServingMacros(detail);
  const myRating = rating || detail.myReview?.rating || 0;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <Link
        to="/eat/recipes"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
      >
        <ArrowLeft size={15} aria-hidden />
        All recipes
      </Link>

      <header className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <RecipeThumb name={detail.name} className="h-11 w-11 rounded-2xl text-2xl" />
          <div className="min-w-0 grow">
            <h1 className="text-xl font-bold">{detail.name}</h1>
            <p className="text-sm text-muted">
              by{' '}
              {detail.author ? (
                <Link to={`/users/${detail.author}`} className="text-accent hover:underline">
                  {detail.author}
                </Link>
              ) : (
                'deleted user'
              )}{' '}
              · makes {detail.servings} serving{detail.servings === 1 ? '' : 's'}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
              {detail.avgRating !== null ? (
                <>
                  <Stars rating={detail.avgRating} size={15} />
                  {detail.avgRating} · {detail.reviewCount} rating
                  {detail.reviewCount === 1 ? '' : 's'}
                </>
              ) : (
                'No ratings yet'
              )}
            </p>
          </div>
        </div>
        {detail.description && <p className="mt-3 text-sm">{detail.description}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate(detail)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-linear-to-r from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <BookmarkPlus size={15} aria-hidden />
            {save.isSuccess ? 'Saved to my recipes' : 'Save to my recipes'}
          </button>
          <button
            type="button"
            onClick={() => setPlanPicker(!planPicker)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line px-4 py-2 text-sm font-semibold transition-colors hover:bg-elev"
          >
            <CalendarPlus size={15} aria-hidden />
            Add to meal plan
          </button>
          {detail.mine && (
            <button
              type="button"
              disabled={unpublish.isPending}
              onClick={() =>
                unpublish.mutate(detail.id, {
                  onSuccess: () => void navigate('/eat/recipes'),
                })
              }
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/40 px-4 py-2 text-sm font-medium text-rose-500 transition-colors hover:bg-rose-500/10 disabled:opacity-50"
            >
              <Trash2 size={15} aria-hidden />
              Unshare
            </button>
          )}
          {!detail.mine && (
            <ReportButton targetType="recipe" targetId={detail.id} label={`“${detail.name}”`} />
          )}
        </div>

        {planPicker && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-accent/40 bg-elev p-3">
            <select
              value={planDay}
              onChange={(e) => setPlanDay(Number(e.target.value))}
              aria-label="Day"
              className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent"
            >
              {DAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
            <select
              value={planMeal}
              onChange={(e) => setPlanMeal(e.target.value as MealType)}
              aria-label="Meal"
              className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm capitalize outline-none focus:border-accent"
            >
              {MEALS.map((m) => (
                <option key={m} value={m} className="capitalize">
                  {m}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={planServings}
              onChange={(e) => setPlanServings(e.target.value)}
              aria-label="Servings"
              className="w-20 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent"
            />
            <span className="text-xs text-muted">servings</span>
            <button
              type="button"
              disabled={addToPlan.isPending}
              onClick={() => addToPlan.mutate(detail)}
              className="rounded-lg bg-linear-to-r from-accent to-accent-2 px-3 py-1.5 text-sm font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        )}
        {addToPlan.isSuccess && (
          <p className="mt-2 text-sm text-emerald-500">
            Planned — it's on your <Link to="/eat/meal-plan" className="underline">meal plan</Link>{' '}
            (saved to your recipes too).
          </p>
        )}
        {(save.isError || addToPlan.isError) && (
          <p className="mt-2 text-sm text-rose-500">Something went wrong — try again.</p>
        )}
      </header>

      <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold">Per serving</h2>
        <div className="flex flex-wrap gap-1.5">
          {chip('bg-orange-500/10 text-orange-500', `${per.kcal} kcal`)}
          {chip('bg-rose-500/10 text-rose-500', `${per.proteinG} g protein`)}
          {chip('bg-amber-500/10 text-amber-600', `${per.carbsG} g carbs`)}
          {chip('bg-sky-500/10 text-sky-600', `${per.fatG} g fat`)}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold">
          Ingredients ({detail.payload.ingredients.length})
        </h2>
        <ul className="divide-y divide-line">
          {detail.payload.ingredients.map((i, idx) => (
            <li key={idx} className="flex items-baseline justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 truncate">
                {i.food.name}
                {i.food.brand && <span className="text-muted"> · {i.food.brand}</span>}
              </span>
              <span className="shrink-0 tabular-nums text-muted">{i.grams} g</span>
            </li>
          ))}
        </ul>
      </section>

      {detail.payload.instructions && (
        <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold">Instructions</h2>
          <p className="text-sm whitespace-pre-wrap">{detail.payload.instructions}</p>
        </section>
      )}

      <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold">Ratings</h2>
        {!detail.mine && (
          <div className="mb-4 space-y-2 rounded-xl bg-elev p-3">
            <StarPicker value={myRating} onChange={setRating} />
            <div className="flex gap-2">
              <input
                value={comment || detail.myReview?.comment || ''}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Say something helpful (optional)"
                maxLength={500}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none placeholder:text-muted/70 focus:border-accent"
              />
              <button
                type="button"
                disabled={myRating === 0 || review.isPending}
                onClick={() => review.mutate({ rating: myRating, comment: comment.trim() })}
                className="shrink-0 rounded-xl bg-linear-to-r from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {detail.myReview ? 'Update' : 'Rate'}
              </button>
            </div>
            {review.isError && <p className="text-sm text-rose-500">{review.error.message}</p>}
          </div>
        )}
        {detail.reviews.length === 0 && (
          <p className="text-sm text-muted">No ratings yet — be the first.</p>
        )}
        <ul className="space-y-3">
          {detail.reviews.map((r) => (
            <li key={r.id} className="text-sm">
              <p className="flex items-center gap-2">
                <Stars rating={r.rating} />
                <span className="font-medium">{r.username ?? 'deleted user'}</span>
                <span className="text-xs text-muted">
                  {formatDate(r.updatedAt)}
                </span>
              </p>
              {r.comment && <p className="mt-0.5 text-muted">{r.comment}</p>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
