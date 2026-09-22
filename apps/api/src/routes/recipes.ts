import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { SharedRecipeCard, SharedRecipePayload } from '@arcadia/shared';
import { db } from '../db/db';
import { recipeReviews, sharedRecipes, users } from '../db/schema';
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

  const [row] = await db
    .insert(sharedRecipes)
    .values({
      ownerUserId: user.id,
      localRecipeId: body.localRecipeId,
      name: body.name,
      description: body.description,
      servings: body.servings,
      kcalPerServing,
      payload,
    })
    .onConflictDoUpdate({
      target: [sharedRecipes.ownerUserId, sharedRecipes.localRecipeId],
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        servings: sql`excluded.servings`,
        kcalPerServing: sql`excluded.kcal_per_serving`,
        payload: sql`excluded.payload`,
        updatedAt: sql`now()`,
      },
    })
    .returning({ id: sharedRecipes.id });
  return c.json({ ok: true, id: row!.id }, 201);
});

/** Which of MY local recipes are published — drives the share toggles. */
recipeRoutes.get('/mine', async (c) => {
  const user = c.get('user')!;
  const rows = await db
    .select({ id: sharedRecipes.id, localRecipeId: sharedRecipes.localRecipeId })
    .from(sharedRecipes)
    .where(eq(sharedRecipes.ownerUserId, user.id));
  return c.json({ shared: rows });
});

/* -------------------------------- Browse -------------------------------- */

const PAGE_SIZE = 20;

recipeRoutes.get('/', async (c) => {
  const user = c.get('user')!;
  const q = c.req.query('q')?.trim() ?? '';
  const sort = c.req.query('sort') === 'new' ? 'new' : 'top';
  const page = Math.min(Math.max(Number.parseInt(c.req.query('page') ?? '1', 10) || 1, 1), 50);

  // Raw SQL by choice: window-function total, aggregate-alias ordering and
  // token scoring in one statement. Both ORDER variants are fixed strings
  // (sql.raw is never fed user input); tokens bind as parameters.
  const order =
    sort === 'new'
      ? 'r.updated_at DESC'
      : 'avg_rating DESC NULLS LAST, review_count DESC, r.updated_at DESC';

  const tokens = tokenizeSearch(q);
  const where =
    tokens.length > 0
      ? sql`(${sql.join(
          tokens.map((t) => {
            const pattern = `%${t}%`;
            return sql`(CASE WHEN r.name ILIKE ${pattern} OR r.description ILIKE ${pattern} THEN 1 ELSE 0 END)`;
          }),
          sql` + `,
        )}) >= ${minTokenHits(tokens.length)}`
      : sql`TRUE`;

  const rows = (
    await db.execute(sql`
      SELECT r.id, r.name, r.description, r.servings, r.kcal_per_serving, r.updated_at,
             r.owner_user_id, u.username AS author,
             avg(rv.rating) AS avg_rating, count(rv.id) AS review_count,
             count(*) OVER () AS total
        FROM shared_recipes r
        LEFT JOIN users u ON u.id = r.owner_user_id
        LEFT JOIN recipe_reviews rv ON rv.recipe_id = r.id
       WHERE ${where}
       GROUP BY r.id, u.username
       ORDER BY ${sql.raw(order)}
       LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`)
  ).rows as unknown as {
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
  }[];
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
  const rows = await db
    .select({
      id: sharedRecipes.id,
      name: sharedRecipes.name,
      description: sharedRecipes.description,
      servings: sharedRecipes.servings,
      kcalPerServing: sharedRecipes.kcalPerServing,
      payload: sharedRecipes.payload,
      updatedAt: sharedRecipes.updatedAt,
      ownerUserId: sharedRecipes.ownerUserId,
      author: users.username,
    })
    .from(sharedRecipes)
    .leftJoin(users, eq(users.id, sharedRecipes.ownerUserId))
    .where(eq(sharedRecipes.id, id));
  const recipe = rows[0];
  if (!recipe) return c.json({ error: 'Recipe not found' }, 404);

  const reviews = await db
    .select({
      id: recipeReviews.id,
      userId: recipeReviews.userId,
      username: users.username,
      rating: recipeReviews.rating,
      comment: recipeReviews.comment,
      updatedAt: recipeReviews.updatedAt,
    })
    .from(recipeReviews)
    .leftJoin(users, eq(users.id, recipeReviews.userId))
    .where(eq(recipeReviews.recipeId, id))
    .orderBy(desc(recipeReviews.updatedAt))
    .limit(50);
  const mine = reviews.find((r) => r.userId === user.id);
  const ratings = reviews.map((r) => r.rating);

  return c.json({
    id: recipe.id,
    name: recipe.name,
    description: recipe.description,
    author: recipe.author,
    servings: recipe.servings,
    kcalPerServing: recipe.kcalPerServing,
    avgRating:
      ratings.length === 0
        ? null
        : Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10,
    reviewCount: ratings.length,
    updatedAt: recipe.updatedAt,
    mine: recipe.ownerUserId === user.id,
    payload: recipe.payload as SharedRecipePayload,
    reviews: reviews.map((r) => ({
      id: r.id,
      username: r.username,
      rating: r.rating,
      comment: r.comment,
      updatedAt: r.updatedAt,
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

  const [recipe] = await db
    .select({ ownerUserId: sharedRecipes.ownerUserId, name: sharedRecipes.name })
    .from(sharedRecipes)
    .where(eq(sharedRecipes.id, id));
  if (!recipe) return c.json({ error: 'Recipe not found' }, 404);
  if (recipe.ownerUserId === user.id) {
    return c.json({ error: 'You cannot review your own recipe' }, 400);
  }

  const [row] = await db
    .insert(recipeReviews)
    .values({ recipeId: id, userId: user.id, rating, comment })
    .onConflictDoUpdate({
      target: [recipeReviews.recipeId, recipeReviews.userId],
      set: { rating: sql`excluded.rating`, comment: sql`excluded.comment`, updatedAt: sql`now()` },
    })
    .returning({ createdAt: recipeReviews.createdAt, updatedAt: recipeReviews.updatedAt });
  // Notify the owner on FIRST review only — edits shouldn't re-ping.
  if (row && row.createdAt.getTime() === row.updatedAt.getTime()) {
    await createNotification(
      recipe.ownerUserId,
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
  const rows = await db
    .delete(sharedRecipes)
    .where(
      staff
        ? eq(sharedRecipes.id, c.req.param('id'))
        : and(eq(sharedRecipes.id, c.req.param('id')), eq(sharedRecipes.ownerUserId, user.id)),
    )
    .returning({ id: sharedRecipes.id });
  if (rows.length === 0) return c.json({ error: 'Recipe not found' }, 404);
  return c.json({ ok: true });
});
