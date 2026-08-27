import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import type { MealType } from '@arcadia/shared';
import { applyMealPlanTemplate } from '../mealPlan';
import {
  MEAL_PLAN_TEMPLATES,
  templateArtNames,
  templateSlotsForDay,
  type TemplateSlot,
} from '../mealPlanCatalog';
import { catalogPerServing, catalogRecipe } from '../recipeCatalog';
import { NamesArtStrip, RecipeThumb } from '../components/RecipeArt';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MEALS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

const slotKcal = (slot: TemplateSlot): number => {
  const entry = catalogRecipe(slot.recipe);
  return entry ? Math.round(catalogPerServing(entry).kcal * (slot.servings ?? 1)) : 0;
};

/** One starter plan in full: the pitch, then all seven days meal by meal —
 * so "Use this plan" is never a leap of faith. */
export function MealPlanTemplatePage() {
  const { key } = useParams<{ key: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const template = MEAL_PLAN_TEMPLATES.find((t) => t.key === key);

  const apply = useMutation({
    mutationFn: () => applyMealPlanTemplate(template!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['mealPlan'] });
      void queryClient.invalidateQueries({ queryKey: ['recipes'] });
      void queryClient.invalidateQueries({ queryKey: ['foods'] });
      void navigate('/eat/meal-plan');
    },
  });

  if (!template) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 p-4 md:p-6">
        <p className="text-sm text-muted">This plan doesn't exist.</p>
        <Link to="/eat/meal-plan/browse" className="text-sm font-medium text-accent hover:underline">
          ← All meal plans
        </Link>
      </div>
    );
  }

  const days = DAYS.map((_, i) => {
    const slots = templateSlotsForDay(template, i);
    const kcal = MEALS.reduce(
      (sum, meal) => sum + slots[meal].reduce((s, slot) => s + slotKcal(slot), 0),
      0,
    );
    return { slots, kcal };
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <div>
        <Link
          to="/eat/meal-plan/browse"
          className="inline-flex items-center gap-1 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-elev"
        >
          <ChevronLeft size={14} aria-hidden />
          All meal plans
        </Link>
      </div>

      <header className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <NamesArtStrip names={templateArtNames(template)} className="h-24 md:h-32" />
        <div className="space-y-2 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">{template.name}</h1>
              <p className="text-sm text-muted tabular-nums">
                ~{template.kcalPerDay.toLocaleString()} kcal · {template.proteinPerDay} g protein
                per day
              </p>
            </div>
            {confirming ? (
              <span className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={apply.isPending}
                  onClick={() => apply.mutate()}
                  className="rounded-xl bg-rose-500/15 px-3.5 py-2 text-sm font-semibold text-rose-500 disabled:opacity-50"
                >
                  {apply.isPending ? 'Building…' : 'Replace my week'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="rounded-xl px-2.5 py-2 text-sm text-muted hover:text-ink"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="springy inline-flex items-center gap-1.5 rounded-xl bg-linear-to-r from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-accent-ink shadow-sm hover:opacity-90"
              >
                <Check size={15} aria-hidden />
                Use this plan
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {template.style.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent"
              >
                {tag}
              </span>
            ))}
          </div>
          <p className="text-sm text-muted">{template.tagline}</p>
          {confirming && (
            <p className="rounded-xl bg-elev p-2.5 text-xs text-muted">
              Applying replaces everything currently planned this week. Every slot stays editable
              after.
            </p>
          )}
          {template.note && (
            <p className="rounded-xl bg-elev p-2.5 text-xs leading-relaxed text-muted">
              {template.note}
            </p>
          )}
          {apply.isError && (
            <p className="text-sm text-rose-500">Could not apply the plan — try again.</p>
          )}
        </div>
      </header>

      <section className="space-y-4">
        {DAYS.map((label, i) => (
          <div key={label}>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="font-display text-lg font-bold tracking-tight">{label}</h2>
              <span className="text-xs text-muted tabular-nums">{days[i]!.kcal} kcal</span>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-3 shadow-sm">
              <ul className="space-y-2">
                {MEALS.flatMap((meal) =>
                  days[i]!.slots[meal].map((slot, j) => (
                    <li key={`${meal}-${j}`}>
                      <Link
                        to={`/eat/recipes/catalog/${encodeURIComponent(slot.recipe)}`}
                        className="group flex items-center gap-2.5 text-sm"
                      >
                        <RecipeThumb name={slot.recipe} className="h-9 w-9 rounded-lg text-base" />
                        <span className="w-16 shrink-0 text-[10px] font-semibold tracking-wider text-muted uppercase">
                          {meal}
                        </span>
                        <span className="min-w-0 flex-1 truncate group-hover:text-accent group-hover:underline">
                          {slot.recipe}
                          {(slot.servings ?? 1) !== 1 && (
                            <span className="text-muted"> · {slot.servings} servings</span>
                          )}
                        </span>
                        <span className="shrink-0 text-xs text-muted tabular-nums">
                          {slotKcal(slot)} kcal
                        </span>
                        <ChevronRight
                          size={14}
                          className="shrink-0 text-muted"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  )),
                )}
              </ul>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
