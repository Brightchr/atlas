import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, Dumbbell, Sparkles } from 'lucide-react';
import { DIET_BLURBS } from '@/features/plans/dietStaples';
import { getActivePlanId, listPlans } from '@/features/plans/repository';
import { CATALOG_PLANS } from '@/features/training/catalog';
import { MEAL_PLAN_TEMPLATES, templateArtNames, type MealPlanTemplate } from '../mealPlanCatalog';
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
