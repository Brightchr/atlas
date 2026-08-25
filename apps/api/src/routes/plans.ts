import { Hono } from 'hono';
import { query } from '../db/pool';
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

/** WHERE fragment: plans the caller may see — public, their own, sent to
 * them directly, or friends-only plans of an accepted friend. The parameter
 * is interpolated as a placeholder reference, never a value. */
const VISIBLE_TO = (userParam: string) => `(
  p.visibility = 'public'
  OR p.owner_user_id = ${userParam}
  OR EXISTS (SELECT 1 FROM plan_shares s WHERE s.plan_id = p.id AND s.to_user_id = ${userParam})
  OR (p.visibility = 'friends' AND EXISTS (
        SELECT 1 FROM friendships f
         WHERE f.status = 'accepted'
           AND ((f.requester_id = p.owner_user_id AND f.addressee_id = ${userParam})
             OR (f.addressee_id = p.owner_user_id AND f.requester_id = ${userParam}))))
)`;

interface SummaryRow {
  id: string;
  name: string;
  description: string;
  visibility: string;
  difficulty: string;
  goal: string;
  diet: string | null;
  owner_user_id: string;
  username: string;
  updated_at: string;
  avg_rating: string | null;
  review_count: string;
  shared_to_me: boolean;
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
    mine: r.owner_user_id === userId,
    sharedToMe: r.shared_to_me,
    rating: r.avg_rating === null ? null : Math.round(Number(r.avg_rating) * 10) / 10,
    reviewCount: Number(r.review_count),
    updatedAt: r.updated_at,
  };
}

/** Public plans, the caller's own shares, and plans sent to them directly. */
planRoutes.get('/', async (c) => {
  const user = c.get('user')!;
  const rows = await query<SummaryRow>(
    `SELECT p.id, p.name, p.description, p.visibility, p.difficulty, p.goal, p.diet,
            p.owner_user_id, u.username, p.updated_at,
            AVG(r.rating) AS avg_rating, COUNT(r.id) AS review_count,
            EXISTS (SELECT 1 FROM plan_shares s
                     WHERE s.plan_id = p.id AND s.to_user_id = $1) AS shared_to_me
       FROM shared_plans p
       JOIN users u ON u.id = p.owner_user_id
       LEFT JOIN plan_reviews r ON r.plan_id = p.id
      WHERE ${VISIBLE_TO('$1')}
      GROUP BY p.id, u.username
      ORDER BY p.updated_at DESC
      LIMIT 100`,
    [user.id],
  );
  return c.json({ plans: rows.map((r) => toSummary(r, user.id)) });
});

planRoutes.get('/:id', async (c) => {
  const user = c.get('user')!;
  const rows = await query<SummaryRow & { payload: unknown }>(
    `SELECT p.*, u.username,
            (SELECT AVG(rating) FROM plan_reviews WHERE plan_id = p.id) AS avg_rating,
            (SELECT COUNT(*) FROM plan_reviews WHERE plan_id = p.id) AS review_count,
            EXISTS (SELECT 1 FROM plan_shares s
                     WHERE s.plan_id = p.id AND s.to_user_id = $2) AS shared_to_me
       FROM shared_plans p JOIN users u ON u.id = p.owner_user_id
      WHERE p.id = $1 AND ${VISIBLE_TO('$2')}`,
    [c.req.param('id'), user.id],
  );
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

  const rows = await query<{ id: string }>(
    `INSERT INTO shared_plans
       (owner_user_id, local_plan_id, name, description, visibility, difficulty, goal, diet, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
     ON CONFLICT (owner_user_id, local_plan_id)
     DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description,
                   visibility = EXCLUDED.visibility, difficulty = EXCLUDED.difficulty,
                   goal = EXCLUDED.goal, diet = EXCLUDED.diet, payload = EXCLUDED.payload,
                   updated_at = now()
     RETURNING id`,
    [
      user.id,
      localPlanId,
      name,
      body.description?.trim() ?? '',
      visibility,
      difficulty,
      goal,
      diet,
      payloadJson,
    ],
  );
  return c.json({ id: rows[0]!.id });
});

/* -------------------------------- Reviews -------------------------------- */

planRoutes.get('/:id/reviews', async (c) => {
  const user = c.get('user')!;
  const visible = await query<{ id: string }>(
    `SELECT p.id FROM shared_plans p WHERE p.id = $1 AND ${VISIBLE_TO('$2')}`,
    [c.req.param('id'), user.id],
  );
  if (!visible[0]) return c.json({ error: 'Plan not found' }, 404);

  const rows = await query<{
    id: string;
    rating: number;
    comment: string;
    username: string;
    user_id: string;
    updated_at: string;
  }>(
    `SELECT r.id, r.rating, r.comment, r.user_id, u.username, r.updated_at
       FROM plan_reviews r JOIN users u ON u.id = r.user_id
      WHERE r.plan_id = $1
      ORDER BY r.updated_at DESC
      LIMIT 50`,
    [c.req.param('id')],
  );
  return c.json({
    reviews: rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      author: r.username,
      mine: r.user_id === user.id,
      updatedAt: r.updated_at,
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

  const plan = await query<{ id: string; owner_user_id: string; name: string }>(
    `SELECT p.id, p.owner_user_id, p.name FROM shared_plans p
      WHERE p.id = $1 AND ${VISIBLE_TO('$2')}`,
    [c.req.param('id'), user.id],
  );
  if (!plan[0]) return c.json({ error: 'Plan not found' }, 404);
  if (plan[0].owner_user_id === user.id) {
    return c.json({ error: "You can't review your own plan" }, 400);
  }

  const upserted = await query<{ inserted: boolean }>(
    `INSERT INTO plan_reviews (plan_id, user_id, rating, comment)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (plan_id, user_id)
     DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, updated_at = now()
     RETURNING (xmax = 0) AS inserted`,
    [plan[0].id, user.id, rating, comment],
  );
  // Notify on the FIRST review only — re-saving a review must not let one
  // user generate unlimited notifications for the owner.
  if (upserted[0]?.inserted) {
    await createNotification(
      plan[0].owner_user_id,
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

  const plan = await query<{ id: string; name: string }>(
    'SELECT id, name FROM shared_plans WHERE id = $1 AND owner_user_id = $2',
    [c.req.param('id'), user.id],
  );
  if (!plan[0]) return c.json({ error: 'Plan not found' }, 404);

  const recipient = await query<{ id: string }>(
    'SELECT id FROM users WHERE lower(username) = lower($1)',
    [username],
  );
  if (!recipient[0]) return c.json({ error: 'No user with that username' }, 404);
  if (recipient[0].id === user.id) return c.json({ error: "That's you" }, 400);

  const inserted = await query<{ id: string }>(
    `INSERT INTO plan_shares (plan_id, from_user_id, to_user_id)
     VALUES ($1, $2, $3) ON CONFLICT (plan_id, to_user_id) DO NOTHING
     RETURNING id`,
    [plan[0].id, user.id, recipient[0].id],
  );
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
  await query('DELETE FROM shared_plans WHERE local_plan_id = $1 AND owner_user_id = $2', [
    c.req.param('localPlanId'),
    user.id,
  ]);
  return c.json({ ok: true });
});

planRoutes.delete('/:id', async (c) => {
  const user = c.get('user')!;
  await query('DELETE FROM shared_plans WHERE id = $1 AND owner_user_id = $2', [
    c.req.param('id'),
    user.id,
  ]);
  return c.json({ ok: true });
});
