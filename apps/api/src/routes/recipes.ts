import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { SharedRecipeCard, SharedRecipePayload } from '@arcadia/shared';
import { query } from '../db/pool';
import { createNotification } from '../lib/notify';
import { rateLimit } from '../lib/rate-limit';
import { minTokenHits, tokenizeSearch } from '../lib/search-tokens';
import { requireActiveMember, requireAuth, type AppEnv } from '../middleware/auth';

/** Community recipes: publish (upsert by owner + local id), browse, rate,
 * unpublish. Same shape as shared workout plans — payloads are opaque
 * snapshots the server validates at the boundary but never interprets
 * beyond the browse-card fields. */

export const recipeRoutes = new Hono<AppEnv>();

recipeRoutes.use('*', requireAuth);
recipeRoutes.use('*', requireActiveMember);
recipeRoutes.use('*', rateLimit({ windowMs: 60_000, max: 120, by: 'user' }));

/* ------------------------------ Validation ------------------------------ */

const macrosSchema = z.object({
  kcal: z.number().min(0).max(950),
  proteinG: z.number().min(0).max(100),
  carbsG: z.number().min(0).max(100),
  fatG: z.number().min(0).max(100),
  sugarG: z.number().min(0).max(100).optional(),
  fiberG: z.number().min(0).max(100).optional(),
  saturatedFatG: z.number().min(0).max(100).optional(),
  sodiumG: z.number().min(0).max(40).optional(),
});

const ingredientFoodSchema = z.object({
  name: z.string().trim().min(1).max(150),
  brand: z.string().max(60).nullable(),
  barcode: z.string().max(20).nullable(),
  source: z.enum(['user', 'usda', 'off', 'fatsecret', 'curated']),
  per100g: macrosSchema,
  imageUrl: z.string().url().max(500).nullable(),
  servingName: z.string().max(60).nullable(),
  servingGrams: z.number().positive().max(5000).nullable(),
});

export const sharedRecipeIngredientSchema = z.object({
  grams: z.number().positive().max(5000),
  food: ingredientFoodSchema,
});
const ingredientSchema = sharedRecipeIngredientSchema;

const publishSchema = z.object({
  localRecipeId: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).default(''),
  servings: z.number().int().min(1).max(100),
  instructions: z.string().max(2000).nullable(),
  ingredients: z.array(ingredientSchema).min(1).max(40),
});

/* -------------------------------- Publish ------------------------------- */

recipeRoutes.post('/', zValidator('json', publishSchema), async (c) => {
  const user = c.get('user')!;
  const body = c.req.valid('json');

  const payload: SharedRecipePayload = {
    instructions: body.instructions,
    ingredients: body.ingredients,
  };
  const totalKcal = body.ingredients.reduce(
    (sum, i) => sum + (i.food.per100g.kcal * i.grams) / 100,
    0,
  );
  const kcalPerServing = Math.round(totalKcal / body.servings);

  const [row] = await query<{ id: string }>(
    `INSERT INTO shared_recipes
       (owner_user_id, local_recipe_id, name, description, servings, kcal_per_serving, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (owner_user_id, local_recipe_id) DO UPDATE SET
       name = EXCLUDED.name, description = EXCLUDED.description,
       servings = EXCLUDED.servings, kcal_per_serving = EXCLUDED.kcal_per_serving,
       payload = EXCLUDED.payload, updated_at = now()
     RETURNING id`,
    [
      user.id,
      body.localRecipeId,
      body.name,
      body.description,
      body.servings,
      kcalPerServing,
      JSON.stringify(payload),
    ],
  );
  return c.json({ ok: true, id: row!.id }, 201);
});

/** Which of MY local recipes are published — drives the share toggles. */
recipeRoutes.get('/mine', async (c) => {
  const user = c.get('user')!;
  const rows = await query<{ id: string; local_recipe_id: string }>(
    'SELECT id, local_recipe_id FROM shared_recipes WHERE owner_user_id = $1',
    [user.id],
  );
  return c.json({
    shared: rows.map((r) => ({ id: r.id, localRecipeId: r.local_recipe_id })),
  });
});

/* -------------------------------- Browse -------------------------------- */

const PAGE_SIZE = 20;

recipeRoutes.get('/', async (c) => {
  const user = c.get('user')!;
  const q = c.req.query('q')?.trim() ?? '';
  const sort = c.req.query('sort') === 'new' ? 'new' : 'top';
  const page = Math.min(Math.max(Number.parseInt(c.req.query('page') ?? '1', 10) || 1, 1), 50);

  const order =
    sort === 'new'
      ? 'r.updated_at DESC'
      : 'avg_rating DESC NULLS LAST, review_count DESC, r.updated_at DESC';

  // Token-scored matching (same rules as food search): plural-folded,
  // stopword-free words against name+description, one miss forgiven on
  // longer queries.
  const tokens = tokenizeSearch(q);
  let where = 'TRUE';
  const params: string[] = [];
  if (tokens.length > 0) {
    const hitSum = tokens
      .map(
        (_, i) =>
          `(CASE WHEN r.name ILIKE $${i + 1} OR r.description ILIKE $${i + 1} THEN 1 ELSE 0 END)`,
      )
      .join(' + ');
    where = `(${hitSum}) >= ${minTokenHits(tokens.length)}`;
    params.push(...tokens.map((t) => `%${t}%`));
  }
  const rows = await query<{
    id: string;
    name: string;
    description: string;
    servings: number;
    kcal_per_serving: number;
    updated_at: string;
    owner_user_id: string;
    author: string | null;
    avg_rating: string | null;
    review_count: string;
    total: string;
  }>(
    `SELECT r.id, r.name, r.description, r.servings, r.kcal_per_serving, r.updated_at,
            r.owner_user_id, u.username AS author,
            avg(rv.rating) AS avg_rating, count(rv.id) AS review_count,
            count(*) OVER () AS total
       FROM shared_recipes r
       LEFT JOIN users u ON u.id = r.owner_user_id
       LEFT JOIN recipe_reviews rv ON rv.recipe_id = r.id
      WHERE ${where}
      GROUP BY r.id, u.username
      ORDER BY ${order}
      LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`,
    params,
  );
  const total = Number(rows[0]?.total ?? 0);
  const recipes: SharedRecipeCard[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    author: r.author,
    servings: r.servings,
    kcalPerServing: r.kcal_per_serving,
    avgRating: r.avg_rating === null ? null : Math.round(Number(r.avg_rating) * 10) / 10,
    reviewCount: Number(r.review_count),
    updatedAt: r.updated_at,
    mine: r.owner_user_id === user.id,
  }));
  return c.json({ recipes, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) });
});

/* -------------------------------- Detail -------------------------------- */

recipeRoutes.get('/:id', async (c) => {
  const user = c.get('user')!;
  const id = c.req.param('id');
  const rows = await query<{
    id: string;
    name: string;
    description: string;
    servings: number;
    kcal_per_serving: number;
    payload: SharedRecipePayload;
    updated_at: string;
    owner_user_id: string;
    author: string | null;
  }>(
    `SELECT r.id, r.name, r.description, r.servings, r.kcal_per_serving, r.payload,
            r.updated_at, r.owner_user_id, u.username AS author
       FROM shared_recipes r LEFT JOIN users u ON u.id = r.owner_user_id
      WHERE r.id = $1`,
    [id],
  );
  const recipe = rows[0];
  if (!recipe) return c.json({ error: 'Recipe not found' }, 404);

  const reviews = await query<{
    id: string;
    user_id: string;
    username: string | null;
    rating: number;
    comment: string;
    updated_at: string;
  }>(
    `SELECT rv.id, rv.user_id, u.username, rv.rating, rv.comment, rv.updated_at
       FROM recipe_reviews rv LEFT JOIN users u ON u.id = rv.user_id
      WHERE rv.recipe_id = $1
      ORDER BY rv.updated_at DESC
      LIMIT 50`,
    [id],
  );
  const mine = reviews.find((r) => r.user_id === user.id);
  const ratings = reviews.map((r) => r.rating);

  return c.json({
    id: recipe.id,
    name: recipe.name,
    description: recipe.description,
    author: recipe.author,
    servings: recipe.servings,
    kcalPerServing: recipe.kcal_per_serving,
    avgRating:
      ratings.length === 0
        ? null
        : Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10,
    reviewCount: ratings.length,
    updatedAt: recipe.updated_at,
    mine: recipe.owner_user_id === user.id,
    payload: recipe.payload,
    reviews: reviews.map((r) => ({
      id: r.id,
      username: r.username,
      rating: r.rating,
      comment: r.comment,
      updatedAt: r.updated_at,
    })),
    myReview: mine ? { rating: mine.rating, comment: mine.comment } : null,
  });
});

/* -------------------------------- Reviews ------------------------------- */

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).default(''),
});

recipeRoutes.put('/:id/review', zValidator('json', reviewSchema), async (c) => {
  const user = c.get('user')!;
  const id = c.req.param('id');
  const { rating, comment } = c.req.valid('json');

  const [recipe] = await query<{ owner_user_id: string; name: string }>(
    'SELECT owner_user_id, name FROM shared_recipes WHERE id = $1',
    [id],
  );
  if (!recipe) return c.json({ error: 'Recipe not found' }, 404);
  if (recipe.owner_user_id === user.id) {
    return c.json({ error: 'You cannot review your own recipe' }, 400);
  }

  const [row] = await query<{ created_at: string; updated_at: string }>(
    `INSERT INTO recipe_reviews (recipe_id, user_id, rating, comment)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (recipe_id, user_id) DO UPDATE SET
       rating = EXCLUDED.rating, comment = EXCLUDED.comment, updated_at = now()
     RETURNING created_at, updated_at`,
    [id, user.id, rating, comment],
  );
  // Notify the owner on FIRST review only — edits shouldn't re-ping.
  if (row && row.created_at === row.updated_at) {
    await createNotification(
      recipe.owner_user_id,
      'recipe_review',
      `${user.username} rated “${recipe.name}”`,
      `${rating}/5${comment ? ` — ${comment.slice(0, 120)}` : ''}`,
    );
  }
  return c.json({ ok: true });
});

/* ------------------------------- Unpublish ------------------------------ */

recipeRoutes.delete('/:id', async (c) => {
  const user = c.get('user')!;
  const staff = user.role === 'admin' || user.role === 'moderator';
  const rows = await query<{ id: string }>(
    staff
      ? 'DELETE FROM shared_recipes WHERE id = $1 RETURNING id'
      : 'DELETE FROM shared_recipes WHERE id = $1 AND owner_user_id = $2 RETURNING id',
    staff ? [c.req.param('id')] : [c.req.param('id'), user.id],
  );
  if (rows.length === 0) return c.json({ error: 'Recipe not found' }, 404);
  return c.json({ ok: true });
});
