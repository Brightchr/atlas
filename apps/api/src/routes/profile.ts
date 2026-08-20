import { Hono } from 'hono';
import { query } from '../db/pool';
import { requireAuth, type AppEnv } from '../middleware/auth';

/** User profiles: a customizable public page (banner, avatar, per-section
 * privacy, opt-in goal sharing) plus self-service editing. Email is never
 * exposed on public profiles — usernames are the only public identifier,
 * and every section can be switched off by its owner. */

export const profileRoutes = new Hono<AppEnv>();

profileRoutes.use('*', requireAuth);

const BANNERS = new Set(['indigo', 'tide', 'ember', 'meadow', 'sunset', 'mono']);

export interface ProfileDoc {
  bannerId: string;
  avatarEmoji: string;
  show: {
    plans: boolean;
    stats: boolean;
    reviews: boolean;
    activity: boolean;
    goals: boolean;
  };
  sharedGoals: { title: string; label: string; pct: number }[];
}

function normalizeProfile(raw: unknown): ProfileDoc {
  const doc = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const show = (typeof doc.show === 'object' && doc.show !== null ? doc.show : {}) as Record<
    string,
    unknown
  >;
  const goals = Array.isArray(doc.sharedGoals) ? doc.sharedGoals : [];
  return {
    bannerId: BANNERS.has(String(doc.bannerId)) ? String(doc.bannerId) : 'indigo',
    avatarEmoji: typeof doc.avatarEmoji === 'string' ? doc.avatarEmoji.slice(0, 8) : '',
    show: {
      plans: show.plans !== false,
      stats: show.stats !== false,
      reviews: show.reviews !== false,
      activity: show.activity !== false,
      goals: show.goals === true,
    },
    sharedGoals: goals.slice(0, 6).flatMap((g) => {
      const goal = (typeof g === 'object' && g !== null ? g : {}) as Record<string, unknown>;
      if (typeof goal.title !== 'string' || !goal.title.trim()) return [];
      return [
        {
          title: goal.title.slice(0, 80),
          label: typeof goal.label === 'string' ? goal.label.slice(0, 120) : '',
          pct: Math.max(0, Math.min(100, Math.round(Number(goal.pct) || 0))),
        },
      ];
    }),
  };
}

/** The caller's own profile (includes fields only they may see). */
profileRoutes.get('/me', async (c) => {
  const user = c.get('user')!;
  const rows = await query<{ display_name: string | null; bio: string; profile: unknown }>(
    'SELECT display_name, bio, profile FROM users WHERE id = $1',
    [user.id],
  );
  return c.json({
    username: user.username,
    email: user.email,
    displayName: rows[0]?.display_name ?? null,
    bio: rows[0]?.bio ?? '',
    memberSince: user.createdAt,
    profile: normalizeProfile(rows[0]?.profile),
  });
});

profileRoutes.patch('/me', async (c) => {
  const user = c.get('user')!;
  const body = (await c.req.json().catch(() => null)) as {
    displayName?: string | null;
    bio?: string;
    profile?: unknown;
  } | null;
  if (!body) return c.json({ error: 'Nothing to update' }, 400);

  const current = await query<{ display_name: string | null; bio: string; profile: unknown }>(
    'SELECT display_name, bio, profile FROM users WHERE id = $1',
    [user.id],
  );
  const displayName =
    body.displayName !== undefined
      ? body.displayName?.trim() || null
      : (current[0]?.display_name ?? null);
  const bio = body.bio !== undefined ? body.bio.trim() : (current[0]?.bio ?? '');
  const profile =
    body.profile !== undefined
      ? normalizeProfile(body.profile)
      : normalizeProfile(current[0]?.profile);
  if (displayName && displayName.length > 60) return c.json({ error: 'Display name too long' }, 400);
  if (bio.length > 500) return c.json({ error: 'Bio too long (500 characters max)' }, 400);

  await query('UPDATE users SET display_name = $1, bio = $2, profile = $3::jsonb WHERE id = $4', [
    displayName,
    bio,
    JSON.stringify(profile),
    user.id,
  ]);
  return c.json({ ok: true });
});

/** Public profile by username: identity, appearance, and only the sections
 * the owner has left visible. */
profileRoutes.get('/:username', async (c) => {
  const rows = await query<{
    id: string;
    username: string;
    display_name: string | null;
    bio: string;
    created_at: string;
    profile: unknown;
  }>(
    'SELECT id, username, display_name, bio, created_at, profile FROM users WHERE lower(username) = lower($1)',
    [c.req.param('username')],
  );
  const person = rows[0];
  if (!person) return c.json({ error: 'No such user' }, 404);
  const doc = normalizeProfile(person.profile);

  const base = {
    username: person.username,
    displayName: person.display_name,
    bio: person.bio,
    memberSince: person.created_at,
    bannerId: doc.bannerId,
    avatarEmoji: doc.avatarEmoji,
  };

  // Overall reputation: the average across every review on their public plans.
  const stats = doc.show.stats
    ? (
        await query<{ avg_rating: string | null; review_count: string; plan_count: string }>(
          `SELECT AVG(r.rating) AS avg_rating, COUNT(r.id) AS review_count,
                  COUNT(DISTINCT p.id) AS plan_count
             FROM shared_plans p
             LEFT JOIN plan_reviews r ON r.plan_id = p.id
            WHERE p.owner_user_id = $1 AND p.visibility = 'public'`,
          [person.id],
        )
      )[0]
    : undefined;

  const plans = doc.show.plans
    ? await query<{
        id: string;
        name: string;
        description: string;
        difficulty: string;
        goal: string;
        diet: string | null;
        avg_rating: string | null;
        review_count: string;
        updated_at: string;
      }>(
        `SELECT p.id, p.name, p.description, p.difficulty, p.goal, p.diet, p.updated_at,
                AVG(r.rating) AS avg_rating, COUNT(r.id) AS review_count
           FROM shared_plans p
           LEFT JOIN plan_reviews r ON r.plan_id = p.id
          WHERE p.owner_user_id = $1 AND p.visibility = 'public'
          GROUP BY p.id
          ORDER BY p.updated_at DESC
          LIMIT 50`,
        [person.id],
      )
    : [];

  // Reviews they have written on public plans.
  const reviews = doc.show.reviews
    ? await query<{
        id: string;
        rating: number;
        comment: string;
        plan_id: string;
        plan_name: string;
        updated_at: string;
      }>(
        `SELECT r.id, r.rating, r.comment, p.id AS plan_id, p.name AS plan_name, r.updated_at
           FROM plan_reviews r
           JOIN shared_plans p ON p.id = r.plan_id
          WHERE r.user_id = $1 AND p.visibility = 'public'
          ORDER BY r.updated_at DESC
          LIMIT 10`,
        [person.id],
      )
    : [];

  // Activity: published plans and written reviews, one merged timeline.
  const activity = doc.show.activity
    ? await query<{ kind: string; title: string; detail: string; at: string }>(
        `(SELECT 'plan' AS kind, name AS title, '' AS detail, updated_at AS at
            FROM shared_plans WHERE owner_user_id = $1 AND visibility = 'public')
         UNION ALL
         (SELECT 'review' AS kind, p.name AS title, r.rating::text AS detail, r.updated_at AS at
            FROM plan_reviews r JOIN shared_plans p ON p.id = r.plan_id
           WHERE r.user_id = $1 AND p.visibility = 'public')
         ORDER BY at DESC
         LIMIT 12`,
        [person.id],
      )
    : [];

  return c.json({
    ...base,
    stats: stats
      ? {
          rating: stats.avg_rating === null ? null : Math.round(Number(stats.avg_rating) * 10) / 10,
          reviewCount: Number(stats.review_count),
          planCount: Number(stats.plan_count),
        }
      : null,
    plans: plans.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      difficulty: p.difficulty,
      goal: p.goal,
      diet: p.diet,
      rating: p.avg_rating === null ? null : Math.round(Number(p.avg_rating) * 10) / 10,
      reviewCount: Number(p.review_count),
      updatedAt: p.updated_at,
    })),
    reviews: reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      planId: r.plan_id,
      planName: r.plan_name,
      updatedAt: r.updated_at,
    })),
    activity: activity.map((a) => ({
      kind: a.kind as 'plan' | 'review',
      title: a.title,
      detail: a.detail,
      at: a.at,
    })),
    goals: doc.show.goals ? doc.sharedGoals : [],
  });
});
