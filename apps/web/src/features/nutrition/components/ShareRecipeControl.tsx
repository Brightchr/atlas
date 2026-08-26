import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { Globe, X } from 'lucide-react';
import type { SharedRecipeIngredient } from '@arcadia/shared';
import {
  useCommunityRecipe,
  useMySharedRecipes,
  usePublishRecipe,
  useUnpublishRecipe,
} from '../communityRecipes';
import { getFoodsByIds } from '../repository';
import type { RecipeDetails } from '../recipes';

/** Share (publish/update/unshare) a local recipe to the community browser.
 * Publishing snapshots the CURRENT ingredients — edit and hit Update to push
 * changes; unsharing removes it (and its ratings) for everyone. */
export function ShareRecipeControl({ recipe }: { recipe: RecipeDetails }) {
  const mine = useMySharedRecipes();
  const shared = mine.data?.shared.find((s) => s.localRecipeId === recipe.id);
  const publishMutation = usePublishRecipe();
  const unpublish = useUnpublishRecipe();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState<string | null>(null);

  // Prefill the description from the published copy when updating.
  const publishedDetail = useCommunityRecipe(open && shared ? shared.id : undefined);
  const descriptionValue = description ?? publishedDetail.data?.description ?? '';

  const publish = useMutation({
    mutationFn: async () => {
      const foods = await getFoodsByIds(recipe.ingredients.map((i) => i.foodId));
      const ingredients: SharedRecipeIngredient[] = recipe.ingredients.flatMap((i) => {
        const food = foods.get(i.foodId);
        if (!food) return [];
        const { id: _localId, ...snapshot } = food;
        return [{ grams: i.grams, food: snapshot }];
      });
      if (ingredients.length === 0) throw new Error('Add at least one ingredient first.');
      await publishMutation.mutateAsync({
        localRecipeId: recipe.id,
        name: recipe.name,
        description: descriptionValue.trim(),
        servings: recipe.servings,
        instructions: recipe.instructions,
        ingredients,
      });
    },
    onSuccess: () => setOpen(false),
  });

  return (
    <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Globe size={15} className="text-accent" aria-hidden />
          {shared ? 'Shared with the community' : 'Share with the community'}
        </p>
        <div className="flex items-center gap-2">
          {shared && (
            <>
              <Link
                to={`/eat/recipes/community/${shared.id}`}
                className="text-xs font-medium text-accent hover:underline"
              >
                View public page →
              </Link>
              <button
                type="button"
                disabled={unpublish.isPending}
                onClick={() => unpublish.mutate(shared.id)}
                className="rounded-lg border border-rose-500/40 px-2.5 py-1.5 text-xs font-medium text-rose-500 transition-colors hover:bg-rose-500/10 disabled:opacity-50"
              >
                Unshare
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="rounded-lg bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent/20"
          >
            {shared ? 'Update shared copy' : 'Share'}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={descriptionValue}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            placeholder="One line about this recipe (shown in the browser)"
            className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none placeholder:text-muted/70 focus:border-accent"
          />
          <button
            type="button"
            disabled={publish.isPending || recipe.ingredients.length === 0}
            onClick={() => publish.mutate()}
            className="rounded-xl bg-linear-to-r from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {shared ? 'Update' : 'Publish'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cancel sharing"
            className="rounded-xl p-2 text-muted hover:bg-elev hover:text-ink"
          >
            <X size={15} aria-hidden />
          </button>
          {recipe.ingredients.length === 0 && (
            <p className="w-full text-xs text-muted">Add ingredients before sharing.</p>
          )}
          {publish.isError && (
            <p className="w-full text-xs text-rose-500">{publish.error.message}</p>
          )}
        </div>
      )}
    </section>
  );
}
