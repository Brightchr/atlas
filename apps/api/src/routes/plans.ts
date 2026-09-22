import { Hono } from 'hono';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/db';
import { planReviews, planShares, sharedPlans, users } from '../db/schema';
import { createNotification } from '../lib/notify';
import { rateLimit } from '../lib/rate-limit';
import { requireActiveMember, requireAuth, type AppEnv } from '../middleware/auth';

/** Shared workout plans. Devices publish a plan as one JSON payload (days +
 * embedded workout definitions); other users browse public ones and import
 * the payload into their local database. Plans carry discovery metadata
 * (goal, difficulty, paired diet), accumulate reviews, and can be sent
 * directly to another user — direct shares grant that user (and only them)
 * view/import access, which requires being signed in by construction.
 * 'friends' visibility resolves through the friendships table: accepted
 * friends of the owner see the plan. */

const VISIBILITIES = new Set(['private', 'friends', 'public']);
const DIFFICULTIES = new Set(['beginner', 'intermediate', 'advanced']);
const GOALS = new Set(['build_muscle', 'lose_weight', 'get_stronger', 'general']);
const DIETS = new Set(['high_protein', 'calorie_deficit', 'balanced', 'performance']);
const MAX_PAYLOAD_BYTES = 200_000;
const MAX_COMMENT_LENGTH = 1_000;

export const planRoutes = new Hono<AppEnv>();

planRoutes.use('*', requireAuth);
planRoutes.use('*', requireActiveMember);
// Per-user ceiling on publish/review/share churn — generous for humans,
// a wall for notification-spam loops.
planRoutes.use('*', rateLimit({ windowMs: 60 * 1000, max: 120, by: 'user' }));

/** Visibility rule: plans the caller may see — public, their own, sent to
 * them directly, or friends-only plans of an accepted friend. A sql fragment
 * (not a builder expression) because it nests EXISTS subqueries; every
 * interpolation is a bound parameter. */
const visibleTo = (userId: string) => sql`(
  ${sharedPlans.visibility} = 'public'
  OR ${sharedPlans.ownerUserId} = ${userId}
  OR EXISTS (SELECT 1 FROM plan_shares s
              WHERE s.plan_id = ${sharedPlans.id} AND s.to_user_id = ${userId})
  OR (${sharedPlans.visibility} = 'friends' AND EXISTS (
        SELECT 1 FROM friendships f
         WHERE f.status = 'accepted'
           AND ((f.requester_id = ${sharedPlans.ownerUserId} AND f.addressee_id = ${userId})
             OR (f.addressee_id = ${sharedPlans.ownerUserId} AND f.requester_id = ${userId}))))
)`;

const sharedToMe = (userId: string) =>
  sql<boolean>`EXISTS (SELECT 1 FROM plan_shares s
                        WHERE s.plan_id = ${sharedPlans.id} AND s.to_user_id = ${userId})`;

const summaryColumns = {
  id: sharedPlans.id,
  name: sharedPlans.name,
  description: sharedPlans.description,
  visibility: sharedPlans.visibility,
  difficulty: sharedPlans.difficulty,
  goal: sharedPlans.goal,
  diet: sharedPlans.diet,
  ownerUserId: sharedPlans.ownerUserId,
  username: users.username,
  updatedAt: sharedPlans.updatedAt,
};

interface SummaryRow {
  id: string;
  name: string;
  description: string;
  visibility: string;
  difficulty: string;
  goal: string;
  diet: string | null;
  ownerUserId: string;
  username: string;
  updatedAt: Date;
  avgRating: string | null;
  reviewCount: number;
  sharedToMe: boolean;
}

function toSummary(r: SummaryRow, userId: string) {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    visibility: r.visibility,
    difficulty: r.difficulty,
    goal: r.goal,
    diet: r.diet,
    owner: r.username,
    mine: r.ownerUserId === userId,
    sharedToMe: r.sharedToMe,
    rating: r.avgRating === null ? null : Math.round(Number(r.avgRating) * 10) / 10,
    reviewCount: r.reviewCount,
    updatedAt: r.updatedAt,
  };
}

/** Public plans, the caller's own shares, and plans sent to them directly. */
planRoutes.get('/', async (c) => {
  const user = c.get('user')!;
  const rows = await db
    .select({
      ...summaryColumns,
      avgRating: sql<string | null>`AVG(${planReviews.rating})`,
      reviewCount: sql<number>`COUNT(${planReviews.id})::int`,
      sharedToMe: sharedToMe(user.id),
    })
    .from(sharedPlans)
    .innerJoin(users, eq(users.id, sharedPlans.ownerUserId))
    .leftJoin(planReviews, eq(planReviews.planId, sharedPlans.id))
    .where(visibleTo(user.id))
    .groupBy(sharedPlans.id, users.username)
    .orderBy(desc(sharedPlans.updatedAt))
    .limit(100);
  return c.json({ plans: rows.map((r) => toSummary(r, user.id)) });
});

planRoutes.get('/:id', async (c) => {
  const user = c.get('user')!;
  const rows = await db
    .select({
      ...summaryColumns,
      payload: sharedPlans.payload,
      avgRating: sql<
        string | null
      >`(SELECT AVG(rating) FROM plan_reviews WHERE plan_id = ${sharedPlans.id})`,
      reviewCount: sql<
        number
      >`(SELECT COUNT(*) FROM plan_reviews WHERE plan_id = ${sharedPlans.id})::int`,
      sharedToMe: sharedToMe(user.id),
    })
    .from(sharedPlans)
    .innerJoin(users, eq(users.id, sharedPlans.ownerUserId))
    .where(and(eq(sharedPlans.id, c.req.param('id')), visibleTo(user.id)));
  const row = rows[0];
  if (!row) return c.json({ error: 'Plan not found' }, 404);
  return c.json({ ...toSummary(row, user.id), payload: row.payload });
});

/** Publish (or republish) a local plan. Idempotent per (owner, local plan). */
planRoutes.put('/', async (c) => {
  const user = c.get('user')!;
  const body = (await c.req.json().catch(() => null)) as {
    localPlanId?: string;
    name?: string;
    description?: string;
    visibility?: string;
    difficulty?: string;
    goal?: string;
    diet?: string | null;
    payload?: unknown;
  } | null;

  const name = body?.name?.trim();
  const localPlanId = body?.localPlanId?.trim();
  const visibility = body?.visibility ?? 'private';
  const difficulty = body?.difficulty ?? 'intermediate';
  const goal = body?.goal ?? 'general';
  const diet = body?.diet ?? null;
  if (!body || !name || !localPlanId || !body.payload) {
    return c.json({ error: 'localPlanId, name and payload are required' }, 400);
  }
  if (name.length > 120) return c.json({ error: 'Name too long' }, 400);
  if (!VISIBILITIES.has(visibility)) return c.json({ error: 'Invalid visibility' }, 400);
  if (!DIFFICULTIES.has(difficulty)) return c.json({ error: 'Invalid difficulty' }, 400);
  if (!GOALS.has(goal)) return c.json({ error: 'Invalid goal' }, 400);
  if (diet !== null && !DIETS.has(diet)) return c.json({ error: 'Invalid diet' }, 400);
  const payloadJson = JSON.stringify(body.payload);
  if (payloadJson.length > MAX_PAYLOAD_BYTES) return c.json({ error: 'Plan too large' }, 413);

  const rows = await db
    .insert(sharedPlans)
    .values({
      ownerUserId: user.id,
      localPlanId,
      name,
      description: body.description?.trim() ?? '',
      visibility: visibility as 'private' | 'friends' | 'public',
      difficulty: difficulty as 'beginner' | 'intermediate' | 'advanced',
      goal: goal as 'build_muscle' | 'lose_weight' | 'get_stronger' | 'general',
      diet: diet as 'high_protein' | 'calorie_deficit' | 'balanced' | 'performance' | null,
      payload: body.payload,
    })
    .onConflictDoUpdate({
      target: [sharedPlans.ownerUserId, sharedPlans.localPlanId],
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        visibility: sql`excluded.visibility`,
        difficulty: sql`excluded.difficulty`,
        goal: sql`excluded.goal`,
        diet: sql`excluded.diet`,
        payload: sql`excluded.payload`,
        updatedAt: sql`now()`,
      },
    })
    .returning({ id: sharedPlans.id });
  return c.json({ id: rows[0]!.id });
});

/* -------------------------------- Reviews -------------------------------- */

planRoutes.get('/:id/reviews', async (c) => {
  const user = c.get('user')!;
  const visible = await db
    .select({ id: sharedPlans.id })
    .from(sharedPlans)
    .where(and(eq(sharedPlans.id, c.req.param('id')), visibleTo(user.id)));
  if (!visible[0]) return c.json({ error: 'Plan not found' }, 404);

  const rows = await db
    .select({
      id: planReviews.id,
      rating: planReviews.rating,
      comment: planReviews.comment,
      userId: planReviews.userId,
      username: users.username,
      updatedAt: planReviews.updatedAt,
    })
    .from(planReviews)
    .innerJoin(users, eq(users.id, planReviews.userId))
    .where(eq(planReviews.planId, c.req.param('id')))
    .orderBy(desc(planReviews.updatedAt))
    .limit(50);
  return c.json({
    reviews: rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      author: r.username,
      mine: r.userId === user.id,
      updatedAt: r.updatedAt,
    })),
  });
});

/** Leave (or update) the caller's review. Owners can't review their own plan. */
planRoutes.post('/:id/reviews', async (c) => {
  const user = c.get('user')!;
  const body = (await c.req.json().catch(() => null)) as {
    rating?: number;
    comment?: string;
  } | null;
  const rating = body?.rating;
  const comment = (body?.comment ?? '').trim();
  if (!rating || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return c.json({ error: 'Rating must be a whole number from 1 to 5' }, 400);
  }
  if (comment.length > MAX_COMMENT_LENGTH) return c.json({ error: 'Comment too long' }, 400);

  const plan = await db
    .select({ id: sharedPlans.id, ownerUserId: sharedPlans.ownerUserId, name: sharedPlans.name })
    .from(sharedPlans)
    .where(and(eq(sharedPlans.id, c.req.param('id')), visibleTo(user.id)));
  if (!plan[0]) return c.json({ error: 'Plan not found' }, 404);
  if (plan[0].ownerUserId === user.id) {
    return c.json({ error: "You can't review your own plan" }, 400);
  }

  // Raw SQL: RETURNING (xmax = 0) distinguishes a fresh INSERT from an upsert
  // UPDATE in one round trip — no builder expresses that.
  const upserted = (
    await db.execute(sql`
      INSERT INTO plan_reviews (plan_id, user_id, rating, comment)
      VALUES (${plan[0].id}, ${user.id}, ${rating}, ${comment})
      ON CONFLICT (plan_id, user_id)
      DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, updated_at = now()
      RETURNING (xmax = 0) AS inserted`)
  ).rows as { inserted: boolean }[];
  // Notify on the FIRST review only — re-saving a review must not let one
  // user generate unlimited notifications for the owner.
  if (upserted[0]?.inserted) {
    await createNotification(
      plan[0].ownerUserId,
      'plan_review',
      `${user.username} rated "${plan[0].name}" ${rating}/5`,
      comment,
    );
  }
  return c.json({ ok: true });
});

/* ----------------------------- Direct shares ----------------------------- */

/** Send a plan to another user by username. Grants them view/import access
 * even when the plan isn't public; they get an in-app notification. */
planRoutes.post('/:id/share', async (c) => {
  const user = c.get('user')!;
  const body = (await c.req.json().catch(() => null)) as { username?: string } | null;
  const username = body?.username?.trim();
  if (!username) return c.json({ error: 'username is required' }, 400);

  const plan = await db
    .select({ id: sharedPlans.id, name: sharedPlans.name })
    .from(sharedPlans)
    .where(and(eq(sharedPlans.id, c.req.param('id')), eq(sharedPlans.ownerUserId, user.id)));
  if (!plan[0]) return c.json({ error: 'Plan not found' }, 404);

  const recipient = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.username}) = lower(${username})`);
  if (!recipient[0]) return c.json({ error: 'No user with that username' }, 404);
  if (recipient[0].id === user.id) return c.json({ error: "That's you" }, 400);

  const inserted = await db
    .insert(planShares)
    .values({ planId: plan[0].id, fromUserId: user.id, toUserId: recipient[0].id })
    .onConflictDoNothing()
    .returning({ id: planShares.id });
  // Only a NEW share notifies — re-sending the same plan in a loop must not
  // become a notification firehose.
  if (inserted[0]) {
    await createNotification(
      recipient[0].id,
      'plan_shared',
      `${user.username} sent you the plan "${plan[0].name}"`,
      'Find it under Training → Plans → Community.',
    );
  }
  return c.json({ ok: true });
});

/** Unshare by the device-local plan id (what the client actually knows). */
planRoutes.delete('/local/:localPlanId', async (c) => {
  const user = c.get('user')!;
  await db
    .delete(sharedPlans)
    .where(
      and(
        eq(sharedPlans.localPlanId, c.req.param('localPlanId')),
        eq(sharedPlans.ownerUserId, user.id),
      ),
    );
  return c.json({ ok: true });
});

planRoutes.delete('/:id', async (c) => {
  const user = c.get('user')!;
  await db
    .delete(sharedPlans)
    .where(and(eq(sharedPlans.id, c.req.param('id')), eq(sharedPlans.ownerUserId, user.id)));
  return c.json({ ok: true });
});
