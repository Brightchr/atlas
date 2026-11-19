import { Link } from 'react-router';
import { BookOpenText, Sparkles } from 'lucide-react';
import { buttonClasses, Card } from '@/components/ui';
import { formatDate } from '@/lib/dates';
import type { ActiveMealPlan } from '../../activeMealPlan';
import { MEAL_PLAN_TEMPLATES, templateArtNames } from '../../mealPlanCatalog';
import { NamesArtStrip } from '../RecipeArt';

/** The two ways to get a plan. They are links (they change the URL), styled
 * with `buttonClasses` so they look exactly like the app's buttons. */
function PlanLinks({ emphasize }: { emphasize: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Link
        to="/eat/meal-plan/browse"
        // Only the empty state makes this the screen's primary action; once
        // a week exists, "log the day" is primary and this steps back.
        className={buttonClasses(emphasize ? 'primary' : 'secondary')}
      >
        <BookOpenText size={16} aria-hidden />
        {emphasize ? 'Browse plans' : 'Switch plan'}
      </Link>
      <Link to="/eat/meal-plan/build" className={buttonClasses('secondary')}>
        <Sparkles size={16} aria-hidden />
        Build a plan
      </Link>
    </div>
  );
}

/** What the week is based on, and the way to change it. Three states:
 * nothing planned yet, a week applied from a template / saved plan, or a
 * week filled in by hand (no recorded source). */
export function PlanCard({
  activePlan,
  hasItems,
  className = '',
}: {
  activePlan: ActiveMealPlan | null;
  hasItems: boolean;
  className?: string;
}) {
  if (!hasItems) {
    return (
      // glow-ring: with an empty week, this card is what the screen is about.
      <Card className={`glow-ring space-y-3 p-4 ${className}`}>
        <div>
          <h2 className="text-base font-bold">No meals planned yet</h2>
          <p className="mt-1 text-sm text-muted">
            Pick one of {MEAL_PLAN_TEMPLATES.length} ready-made weeks, build one from meals you
            like, or switch to Day and plan by hand.
          </p>
        </div>
        <PlanLinks emphasize />
      </Card>
    );
  }

  const template = activePlan?.key
    ? MEAL_PLAN_TEMPLATES.find((t) => t.key === activePlan.key)
    : undefined;

  return (
    <Card className={`overflow-hidden ${className}`}>
      {template && <NamesArtStrip names={templateArtNames(template)} className="h-12" />}
      <div className="space-y-3 p-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Your plan</p>
          <h2 className="truncate text-base font-bold">{activePlan?.name ?? 'Hand-built week'}</h2>
          {activePlan && (
            <p className="text-sm text-muted tabular-nums">
              Since {formatDate(activePlan.appliedAt)}
              {template &&
                ` · ~${template.kcalPerDay.toLocaleString()} kcal · ${template.proteinPerDay} g protein / day`}
            </p>
          )}
        </div>
        {template && (
          <div className="flex flex-wrap gap-1.5">
            {template.style.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        <PlanLinks emphasize={false} />
      </div>
    </Card>
  );
}
