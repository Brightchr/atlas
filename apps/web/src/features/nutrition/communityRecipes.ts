import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  SharedRecipeCard,
  SharedRecipeDetail,
  SharedRecipeIngredient,
} from '@arcadia/shared';
import { apiFetch } from '@/lib/api';
import { getDb, newId, persist } from '@/lib/db';
import { importFood } from './repository';

/** Community recipes: typed hooks over the /v1/recipes API plus the local
 * import that turns a shared recipe back into a real device recipe. */

export interface CommunityRecipePage {
  recipes: SharedRecipeCard[];
  page: number;
  pageCount: number;
}

export function useCommunityRecipes(q: string, sort: 'top' | 'new', page: number) {
  return useQuery({
    queryKey: ['recipes', 'community', q, sort, page],
    queryFn: () =>
      apiFetch<CommunityRecipePage>(
        `/v1/recipes?q=${encodeURIComponent(q)}&sort=${sort}&page=${page}`,
      ),
    staleTime: 60 * 1000,
  });
}

export function useCommunityRecipe(id: string | undefined) {
  return useQuery({
    queryKey: ['recipes', 'community', 'detail', id],
    queryFn: () => apiFetch<SharedRecipeDetail>(`/v1/recipes/${id}`),
    enabled: Boolean(id),
  });
}

export function useReviewRecipe(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { rating: number; comment: string }) =>
      apiFetch<{ ok: boolean }>(`/v1/recipes/${id}/review`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['recipes', 'community'] }),
  });
}

/** Which of my local recipes are published (share-toggle state). */
export function useMySharedRecipes() {
  return useQuery({
    queryKey: ['recipes', 'shared-mine'],
    queryFn: () =>
      apiFetch<{ shared: { id: string; localRecipeId: string }[] }>('/v1/recipes/mine'),
  });
}

export interface PublishRecipeInput {
  localRecipeId: string;
  name: string;
  description: string;
  servings: number;
  instructions: string | null;
  ingredients: SharedRecipeIngredient[];
}

export function usePublishRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PublishRecipeInput) =>
      apiFetch<{ ok: boolean; id: string }>('/v1/recipes', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recipes'] }),
  });
}

export function useUnpublishRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: boolean }>(`/v1/recipes/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recipes'] }),
  });
}

/** Rebuild a community recipe on THIS device: import every ingredient's food
 * snapshot (barcode-deduped against foods already here), then create the
 * local recipe. Returns the new local recipe id. */
export async function importSharedRecipe(detail: SharedRecipeDetail): Promise<string> {
  const db = await getDb();
  const localId = newId();
  await db.run('INSERT INTO recipes (id, name, instructions, servings) VALUES (?, ?, ?, ?)', [
    localId,
    detail.name,
    detail.payload.instructions,
    detail.servings,
  ]);
  for (const ingredient of detail.payload.ingredients) {
    const food = await importFood(ingredient.food);
    await db.run(
      'INSERT INTO recipe_ingredients (id, recipe_id, food_id, food_name, grams) VALUES (?, ?, ?, ?, ?)',
      [newId(), localId, food.id, food.name, ingredient.grams],
    );
  }
  await persist();
  return localId;
}
