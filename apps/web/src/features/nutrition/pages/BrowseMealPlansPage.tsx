import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft, Dumbbell, Pencil, Sparkles, Trash2 } from 'lucide-react';
import { formatDate } from '@/lib/dates';
import { DIET_BLURBS } from '@/features/plans/dietStaples';
import { getActivePlanId, listPlans } from '@/features/plans/repository';
import { CATALOG_PLANS } from '@/features/training/catalog';
import { MEAL_PLAN_TEMPLATES, templateArtNames, type MealPlanTemplate } from '../mealPlanCatalog';
import {
  applySavedMealPlan,
  deleteSavedMealPlan,
  listSavedMealPlans,
  renameSavedMealPlan,
  type SavedMealPlan,
} from '../savedMealPlans';
import { NamesArtStrip } from '../components/RecipeArt';

/** One template as a catalog card — art strip, name, one-line pitch. Depth
 * (the full week, notes, the apply flow) lives on the detail page. */
function TemplateCard({ template }: { template: MealPlanTemplate }) {
  const navigate = useNavigate();
  return (
    <li>
      <button
        type="button"
        onClick={() => void navigate(`/eat/meal-plan/browse/${template.key}`)}
        className={`springy flex h-full w-full flex-col rounded-2xl border bg-surface p-4 text-left shadow-sm hover:-translate-y-0.5 hover:shadow-md ${
          template.key === 'comeback-phase1' ? 'border-accent/60 ring-1 ring-accent/25' : 'border-line'
        }`}
      >
        <NamesArtStrip names={templateArtNames(template)} className="-mx-4 -mt-4 mb-3 h-20 rounded-t-2xl" />
        <p className="font-semibold">{template.name}</p>
        <p className="mb-2 line-clamp-2 grow text-xs text-muted">{template.tagline}</p>
        <p className="text-xs text-muted tabular-nums">
          ~{template.kcalPerDay.toLocaleString()} kcal · {template.proteinPerDay} g protein / day
        </p>
      </button>
    </li>
  );
}

/** The three art tiles for a saved plan: its first distinct meals. */
function savedArtNames(plan: SavedMealPlan): string[] {
  const names: string[] = [];
  for (const item of plan.items) {
    if (!names.includes(item.name)) names.push(item.name);
    if (names.length >= 3) break;
  }
  return names;
}

/** One saved plan: apply, rename, delete — all inline, all yours only. */
function SavedPlanCard({ plan }: { plan: SavedMealPlan }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'idle' | 'confirm-apply' | 'confirm-delete' | 'rename'>('idle');
  const [name, setName] = useState(plan.name);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['mealPlan'] });
  };
  const apply = useMutation({
    mutationFn: () => applySavedMealPlan(plan.id),
    onSuccess: () => {
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ['recipes'] });
      void navigate('/eat/meal-plan');
    },
  });
  const rename = useMutation({
    mutationFn: () => renameSavedMealPlan(plan.id, name),
    onSuccess: () => {
      setMode('idle');
      invalidate();
    },
  });
  const remove = useMutation({
    mutationFn: () => deleteSavedMealPlan(plan.id),
    onSuccess: invalidate,
  });

  return (
    <li className="flex flex-col rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <NamesArtStrip names={savedArtNames(plan)} className="-mx-4 -mt-4 mb-3 h-20 rounded-t-2xl" />
      {mode === 'rename' ? (
        <div className="mb-1 flex items-center gap-1.5">
          <input
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && name.trim() && rename.mutate()}
            aria-label="Plan name"
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-accent"
          />
          <button
            type="button"
            disabled={!name.trim() || rename.isPending}
            onClick={() => rename.mutate()}
            aria-label="Save name"
            className="rounded-lg bg-accent p-1.5 text-accent-ink disabled:opacity-50"
          >
            <Check size={14} aria-hidden />
          </button>
        </div>
      ) : (
        <p className="font-semibold">{plan.name}</p>
      )}
      <p className="mb-3 grow text-xs text-muted tabular-nums">
        ~{plan.kcalPerDay.toLocaleString()} kcal / day · saved {formatDate(plan.savedAt)}
      </p>
      <div className="flex items-center gap-1.5">
        {mode === 'confirm-apply' ? (
          <>
            <button
              type="button"
              disabled={apply.isPending}
              onClick={() => apply.mutate()}
              className="rounded-lg bg-rose-500/15 px-2.5 py-1.5 text-xs font-semibold text-rose-500 disabled:opacity-50"
            >
              {apply.isPending ? 'Applying…' : 'Replace my week'}
            </button>
            <button
              type="button"
              onClick={() => setMode('idle')}
              className="rounded-lg px-2 py-1.5 text-xs text-muted hover:text-ink"
            >
              Cancel
            </button>
          </>
        ) : mode === 'confirm-delete' ? (
          <>
            <button
              type="button"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
              className="rounded-lg bg-rose-500/15 px-2.5 py-1.5 text-xs font-semibold text-rose-500 disabled:opacity-50"
            >
              Delete plan
            </button>
            <button
              type="button"
              onClick={() => setMode('idle')}
              className="rounded-lg px-2 py-1.5 text-xs text-muted hover:text-ink"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setMode('confirm-apply')}
              className="rounded-lg bg-linear-to-r from-accent to-accent-2 px-3 py-1.5 text-xs font-semibold text-accent-ink shadow-sm hover:opacity-90"
            >
              Use this plan
            </button>
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => {
                setName(plan.name);
                setMode('rename');
              }}
              aria-label={`Rename ${plan.name}`}
              className="rounded-lg p-1.5 text-muted transition-colors hover:bg-elev hover:text-ink"
            >
              <Pencil size={13} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setMode('confirm-delete')}
              aria-label={`Delete ${plan.name}`}
              className="rounded-lg p-1.5 text-muted transition-colors hover:bg-elev hover:text-ink"
            >
              <Trash2 size={13} aria-hidden />
            </button>
          </>
        )}
      </div>
      {apply.isError && <p className="mt-1.5 text-xs text-rose-500">Could not apply — try again.</p>}
    </li>
  );
}

function Section({
  title,
  blurb,
  templates,
}: {
  title: string;
  blurb?: string;
  templates: MealPlanTemplate[];
}) {
  if (templates.length === 0) return null;
  return (
    <section>
      <h2 className="font-display text-lg font-bold tracking-tight">{title}</h2>
      {blurb && <p className="mb-2 text-sm text-muted">{blurb}</p>}
      {!blurb && <div className="mb-2" />}
      <ul className="grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <TemplateCard key={t.key} template={t} />
        ))}
      </ul>
    </section>
  );
}

/** The plan the user trains on, with its paired eating style — read locally,
 * so this works offline. */
async function activeTrainingDiet() {
  const activeId = await getActivePlanId();
  if (!activeId) return null;
  const plan = (await listPlans()).find((p) => p.id === activeId);
  if (!plan) return null;
  const catalogPlan =
    plan.basedOnKind === 'catalog' ? CATALOG_PLANS.find((c) => c.key === plan.basedOnRef) : null;
  return catalogPlan ? { planName: plan.name, diet: catalogPlan.diet } : null;
}

function templatesForDiet(diet: string): MealPlanTemplate[] {
  const all = MEAL_PLAN_TEMPLATES.filter((t) => t.key !== 'comeback-phase1');
  switch (diet) {
    case 'high_protein':
      return all.filter((t) => t.style.includes('High protein')).slice(0, 3);
    case 'calorie_deficit':
      return all.filter((t) => t.goal === 'lose').slice(0, 3);
    case 'performance':
      return all.filter((t) => /athlete|performance/i.test(t.name + t.style.join(' '))).slice(0, 3);
    default:
      return all.filter((t) => t.goal === 'maintain').slice(0, 3);
  }
}

/** The meal-plan catalog: templates grouped the way people actually shop for
 * them — what fits your training first, then by goal. */
export function BrowseMealPlansPage() {
  const navigate = useNavigate();
  const trainingQuery = useQuery({ queryKey: ['mealPlan', 'trainingDiet'], queryFn: activeTrainingDiet });
  const training = trainingQuery.data;
  const savedQuery = useQuery({ queryKey: ['mealPlan', 'saved'], queryFn: listSavedMealPlans });
  const saved = savedQuery.data ?? [];

  const templates = MEAL_PLAN_TEMPLATES;
  const program = templates.filter((t) => t.key === 'comeback-phase1');
  const lose = templates.filter((t) => t.goal === 'lose' && t.key !== 'comeback-phase1');
  const gain = templates.filter((t) => t.goal === 'gain');
  const maintain = templates.filter((t) => t.goal === 'maintain');

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void navigate('/eat/meal-plan')}
          aria-label="Back to meal plan"
          className="rounded-xl border border-line bg-surface p-2 shadow-sm transition-colors hover:bg-elev"
        >
          <ChevronLeft size={16} aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">Meal plans</h1>
          <p className="text-sm text-muted">
            A full week of eating, ready to go — open one to see every day before you commit.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void navigate('/eat/meal-plan/build')}
          className="springy inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-2 text-sm font-semibold shadow-sm transition-colors hover:bg-elev"
        >
          <Sparkles size={15} aria-hidden />
          Build your own
        </button>
      </header>

      {saved.length > 0 && (
        <section>
          <h2 className="font-display text-lg font-bold tracking-tight">My plans</h2>
          <p className="mb-2 text-sm text-muted">
            Weeks you saved — private to your account, synced to your devices. Apply one, tweak
            the week, and save it again under the same name to update it.
          </p>
          <ul className="grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {saved.map((p) => (
              <SavedPlanCard key={p.id} plan={p} />
            ))}
          </ul>
        </section>
      )}

      {training && (
        <section className="rounded-2xl border border-accent/40 bg-surface p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Dumbbell size={15} aria-hidden />
            </span>
            <div>
              <h2 className="text-sm font-semibold">Pairs with {training.planName}</h2>
              <p className="text-xs text-muted">{DIET_BLURBS[training.diet]}</p>
            </div>
          </div>
          <ul className="grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templatesForDiet(training.diet).map((t) => (
              <TemplateCard key={t.key} template={t} />
            ))}
          </ul>
        </section>
      )}

      <Section title="Your program" templates={program} />
      <Section
        title="Weight loss"
        blurb="Calorie deficits that keep protein high, so the loss is fat — not muscle."
        templates={lose}
      />
      <Section
        title="Muscle gain"
        blurb="Surpluses from lean to aggressive — pick by how fast you want the scale to move."
        templates={gain}
      />
      <Section
        title="Maintain"
        blurb="Eat well at your current weight — balanced days that are easy to stick to."
        templates={maintain}
      />
    </div>
  );
}
