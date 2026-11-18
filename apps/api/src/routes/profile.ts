import { Hono } from 'hono';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/db';
import { planReviews, sharedPlans, users } from '../db/schema';
import { recentSharedSessions } from './sessions';
import { rateLimit } from '../lib/rate-limit';
import { requireAuth, type AppEnv } from '../middleware/auth';

/** User profiles: a customizable public page (banner, avatar, per-section
 * privacy, opt-in goal sharing) plus self-service editing. Email is never
 * exposed on public profiles — usernames are the only public identifier,
 * and every section can be switched off by its owner. */

export const profileRoutes = new Hono<AppEnv>();

profileRoutes.use('*', requireAuth);
// Public profiles are browsable, so this also caps scraping other users'
// pages ('user' keys on the caller, falling back to IP).
profileRoutes.use('*', rateLimit({ windowMs: 60 * 1000, max: 60, by: 'user' }));

const BANNERS = new Set(['indigo', 'tide', 'ember', 'meadow', 'sunset', 'mono']);
// Keep in step with AVATAR_ICONS / AVATAR_TONES in
// apps/web/src/features/profile/avatars.tsx — icons render client-side.
const AVATAR_ICONS = new Set([
  'dumbbell',
  'mountain',
  'flame',
  'zap',
  'heart-pulse',
  'trophy',
  'target',
  'bike',
  'footprints',
  'medal',
  'rocket',
  'swords',
  'shield',
  'star',
  'waves',
  'anchor',
]);
const AVATAR_TONES = new Set([
  'indigo',
  'teal',
  'orange',
  'sky',
  'rose',
  'emerald',
  'amber',
  'violet',
]);

/** "Online now" horizon over users.last_seen_at. */
export const ONLINE_WINDOW_MS = 5 * 60 * 1000;

export interface ProfileDoc {
  bannerId: string;
  /** Icon-based avatar (design language: icons/SVGs, never emoji). Empty
   * string = show the initial. avatarEmoji remains only for old documents
   * and is no longer surfaced. */
  avatarIcon: string;
  avatarTone: string;
  show: {
    plans: boolean;
    stats: boolean;
    reviews: boolean;
    activity: boolean;
    goals: boolean;
    /** Presence: green dot + last-seen for people who can see your profile. */
    online: boolean;
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
    avatarIcon: AVATAR_ICONS.has(String(doc.avatarIcon)) ? String(doc.avatarIcon) : '',
    avatarTone: AVATAR_TONES.has(String(doc.avatarTone)) ? String(doc.avatarTone) : '',
    show: {
      plans: show.plans !== false,
      stats: show.stats !== false,
      reviews: show.reviews !== false,
      activity: show.activity !== false,
      goals: show.goals === true,
      online: show.online !== false,
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
  const rows = await db
    .select({ displayName: users.displayName, bio: users.bio, profile: users.profile })
    .from(users)
    .where(eq(users.id, user.id));
  return c.json({
    username: user.username,
    email: user.email,
    displayName: rows[0]?.displayName ?? null,
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

  const current = await db
    .select({ displayName: users.displayName, bio: users.bio, profile: users.profile })
    .from(users)
    .where(eq(users.id, user.id));
  const displayName =
    body.displayName !== undefined
      ? body.displayName?.trim() || null
      : (current[0]?.displayName ?? null);
  const bio = body.bio !== undefined ? body.bio.trim() : (current[0]?.bio ?? '');
  const profile =
    body.profile !== undefined
      ? normalizeProfile(body.profile)
      : normalizeProfile(current[0]?.profile);
  if (displayName && displayName.length > 60)
    return c.json({ error: 'Display name too long' }, 400);
  if (bio.length > 500) return c.json({ error: 'Bio too long (500 characters max)' }, 400);

  await db.update(users).set({ displayName, bio, profile }).where(eq(users.id, user.id));
  return c.json({ ok: true });
});

/** Public profile by username: identity, appearance, and only the sections
 * the owner has left visible. */
profileRoutes.get('/:username', async (c) => {
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      bio: users.bio,
      createdAt: users.createdAt,
      profile: users.profile,
      lastSeenAt: users.lastSeenAt,
    })
    .from(users)
    .where(sql`lower(${users.username}) = lower(${c.req.param('username')})`);
  const person = rows[0];
  if (!person) return c.json({ error: 'No such user' }, 404);
  const doc = normalizeProfile(person.profile);

  const base = {
    username: person.username,
    displayName: person.displayName,
    bio: person.bio,
    memberSince: person.createdAt,
    bannerId: doc.bannerId,
    avatarIcon: doc.avatarIcon,
    avatarTone: doc.avatarTone,
    // null = the owner keeps presence private.
    online: doc.show.online
      ? person.lastSeenAt !== null && Date.now() - person.lastSeenAt.getTime() < ONLINE_WINDOW_MS
      : null,
  };

  const publiclyOwned = and(
    eq(sharedPlans.ownerUserId, person.id),
    eq(sharedPlans.visibility, 'public'),
  );

  // Overall reputation: the average across every review on their public plans.
  const stats = doc.show.stats
    ? (
        await db
          .select({
            avgRating: sql<string | null>`AVG(${planReviews.rating})`,
            reviewCount: sql<number>`COUNT(${planReviews.id})::int`,
            planCount: sql<number>`COUNT(DISTINCT ${sharedPlans.id})::int`,
          })
          .from(sharedPlans)
          .leftJoin(planReviews, eq(planReviews.planId, sharedPlans.id))
          .where(publiclyOwned)
      )[0]
    : undefined;

  const plans = doc.show.plans
    ? await db
        .select({
          id: sharedPlans.id,
          name: sharedPlans.name,
          description: sharedPlans.description,
          difficulty: sharedPlans.difficulty,
          goal: sharedPlans.goal,
          diet: sharedPlans.diet,
          updatedAt: sharedPlans.updatedAt,
          avgRating: sql<string | null>`AVG(${planReviews.rating})`,
          reviewCount: sql<number>`COUNT(${planReviews.id})::int`,
        })
        .from(sharedPlans)
        .leftJoin(planReviews, eq(planReviews.planId, sharedPlans.id))
        .where(publiclyOwned)
        .groupBy(sharedPlans.id)
        .orderBy(desc(sharedPlans.updatedAt))
        .limit(50)
    : [];

  // Reviews they have written on public plans.
  const reviews = doc.show.reviews
    ? await db
        .select({
          id: planReviews.id,
          rating: planReviews.rating,
          comment: planReviews.comment,
          planId: sharedPlans.id,
          planName: sharedPlans.name,
          updatedAt: planReviews.updatedAt,
        })
        .from(planReviews)
        .innerJoin(sharedPlans, eq(sharedPlans.id, planReviews.planId))
        .where(and(eq(planReviews.userId, person.id), eq(sharedPlans.visibility, 'public')))
        .orderBy(desc(planReviews.updatedAt))
        .limit(10)
    : [];

  // Activity: published plans and written reviews, one merged timeline.
  // UNION ALL across differently-shaped sources reads best as plain SQL.
  const activity = doc.show.activity
    ? ((
        await db.execute(sql`
          (SELECT 'plan' AS kind, name AS title, '' AS detail, updated_at AS at
              FROM shared_plans WHERE owner_user_id = ${person.id} AND visibility = 'public')
           UNION ALL
           (SELECT 'review' AS kind, p.name AS title, r.rating::text AS detail, r.updated_at AS at
              FROM plan_reviews r JOIN shared_plans p ON p.id = r.plan_id
             WHERE r.user_id = ${person.id} AND p.visibility = 'public')
           ORDER BY at DESC
           LIMIT 12`)
      ).rows as { kind: string; title: string; detail: string; at: string }[])
    : [];

  // Workouts they chose to share: public ones for anyone, friends-only ones
  // for an accepted friend. Independent of the show.* switches — sharing a
  // session is its own explicit act.
  const recentWorkouts = await recentSharedSessions(person.id, c.get('user')?.id ?? null);

  return c.json({
    ...base,
    recentWorkouts,
    stats: stats
      ? {
          rating: stats.avgRating === null ? null : Math.round(Number(stats.avgRating) * 10) / 10,
          reviewCount: stats.reviewCount,
          planCount: stats.planCount,
        }
      : null,
    plans: plans.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      difficulty: p.difficulty,
      goal: p.goal,
      diet: p.diet,
      rating: p.avgRating === null ? null : Math.round(Number(p.avgRating) * 10) / 10,
      reviewCount: p.reviewCount,
      updatedAt: p.updatedAt,
    })),
    reviews,
    activity: activity.map((a) => ({
      kind: a.kind as 'plan' | 'review',
      title: a.title,
      detail: a.detail,
      at: a.at,
    })),
    goals: doc.show.goals ? doc.sharedGoals : [],
  });
});
