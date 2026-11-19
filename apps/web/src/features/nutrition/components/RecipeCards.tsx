import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { SharedRecipeCard } from '@arcadia/shared';
import type { RecipeDetails } from '../recipes';
import { RecipeBanner, RecipeThumb } from './RecipeArt';
import { Stars } from './Stars';

/** The shell both recipe cards share. One component, two shapes:
 * - phones: a compact row (square thumbnail on the left, text on the right)
 *   so a screen fits five or six recipes instead of two;
 * - `sm` and up: a catalogue card with the art as a banner across the top.
 *
 * It is a real <Link>, so the whole card is one tap target and "open in new
 * tab" works. Editing lives on the recipe's own page. */
function CardShell({ to, name, children }: { to: string; name: string; children: ReactNode }) {
  return (
    <li>
      <Link
        to={to}
        className="springy flex h-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-sm transition-colors hover:bg-elev sm:flex-col sm:items-stretch sm:gap-0 sm:p-4"
      >
        <RecipeThumb name={name} className="h-16 w-16 rounded-xl text-2xl sm:hidden" />
        {/* RecipeBanner bleeds to the card edges with negative margins that
            assume p-4, which is only the padding from `sm` up. */}
        <div className="hidden sm:block">
          <RecipeBanner name={name} height="h-20" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">{children}</div>
      </Link>
    </li>
  );
}

/** One of your own recipes. */
export function RecipeCard({ recipe }: { recipe: RecipeDetails }) {
  const count = recipe.ingredients.length;
  const preview =
    count === 0
      ? 'No ingredients yet. Open to build it.'
      : recipe.ingredients
          .slice(0, 3)
          .map((i) => i.foodName)
          .join(' · ') + (count > 3 ? ` +${count - 3} more` : '');
  const { kcal, proteinG, carbsG, fatG } = recipe.perServing;

  return (
    <CardShell to={`/eat/recipes/${recipe.id}`} name={recipe.name}>
      <p className="truncate text-sm font-semibold">{recipe.name}</p>
      <p className="truncate text-xs text-muted">
        Makes {recipe.servings} · {count} ingredient{count === 1 ? '' : 's'}
      </p>
      {/* The ingredient preview is the first thing to go on a phone. */}
      <p className="hidden grow text-xs text-muted sm:line-clamp-2">{preview}</p>
      <p className="truncate text-xs text-muted tabular-nums sm:pt-1">
        <span className="font-semibold text-ink">{kcal} kcal</span> · {proteinG} g protein ·{' '}
        {carbsG} g carbs · {fatG} g fat
      </p>
    </CardShell>
  );
}

/** A recipe someone published to the community library. */
export function CommunityCard({ recipe }: { recipe: SharedRecipeCard }) {
  return (
    <CardShell to={`/eat/recipes/community/${recipe.id}`} name={recipe.name}>
      <p className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-sm font-semibold">{recipe.name}</span>
        {recipe.mine && (
          <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">
            yours
          </span>
        )}
      </p>
      <p className="truncate text-xs text-muted">
        by {recipe.author ?? 'deleted user'} · makes {recipe.servings}
      </p>
      {recipe.description && (
        <p className="hidden grow text-xs text-muted sm:line-clamp-2">{recipe.description}</p>
      )}
      <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted tabular-nums sm:mt-auto sm:pt-1">
        {recipe.avgRating !== null ? (
          <span className="inline-flex items-center gap-1">
            <Stars rating={recipe.avgRating} />
            {recipe.avgRating} ({recipe.reviewCount})
          </span>
        ) : (
          <span>No ratings yet</span>
        )}
        <span className="font-semibold text-ink">{recipe.kcalPerServing} kcal / serving</span>
      </p>
    </CardShell>
  );
}
