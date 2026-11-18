import { Hono, type Context } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { and, desc, eq, getTableColumns, ne, sql } from 'drizzle-orm';
import { effectivePlan, resolveMembership, type AuthUser } from '@arcadia/shared';
import { db } from '../db/db';
import {
  auditLog,
  curatedFoods,
  ipBlocks,
  promoRedemptions,
  promotions,
  sessions,
  sharedRecipes,
  users,
} from '../db/schema';
import { logAudit } from '../lib/audit';
import { env } from '../lib/env';
import { invalidateIpBlockCache } from '../lib/ip-block';
import { clientIp, rateLimit } from '../lib/rate-limit';
import { createSession, deleteSession } from '../lib/session';
import { sharedRecipeIngredientSchema } from './recipes';
import {
  requireAuth,
  requireRole,
  SESSION_COOKIE,
  extractToken,
  type AppEnv,
} from '../middleware/auth';

function setSessionCookie(c: Context, token: string, expiresAt: Date) {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'Lax',
    path: '/',
    expires: expiresAt,
  });
}

export const adminRoutes = new Hono<AppEnv>();

/** Row → AuthUser for endpoints whose response lands in the client's session
 * cache (impersonation) — must match what /auth/me returns. */
const authUserColumns = {
  id: users.id,
  email: users.email,
  username: users.username,
  role: users.role,
  plan: users.plan,
  planExpiresAt: users.planExpiresAt,
  trialEndsAt: users.trialEndsAt,
  comped: users.comped,
  emailVerified: users.emailVerified,
  hasPassword: sql<boolean>`${users.passwordHash} IS NOT NULL`,
  createdAt: users.createdAt,
};

interface AuthUserRow {
  id: string;
  email: string;
  username: string;
  role: 'user' | 'moderator' | 'admin';
  plan: 'free' | 'pro';
  planExpiresAt: Date | null;
  trialEndsAt: Date | null;
  comped: boolean;
  emailVerified: boolean;
  hasPassword: boolean;
  createdAt: Date;
}

function toAuthUser(row: AuthUserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    role: row.role,
    plan: effectivePlan(row.plan, row.planExpiresAt),
    trialEndsAt: row.trialEndsAt?.toISOString() ?? null,
    membership: resolveMembership(row.plan, row.planExpiresAt, row.trialEndsAt, row.comped),
    emailVerified: row.emailVerified,
    hasPassword: row.hasPassword,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Ending a masquerade must work for the *impersonated* (non-admin) session,
 * so it only requires auth — everything else below requires the admin role. */
adminRoutes.post('/impersonation/stop', requireAuth, async (c) => {
  const impersonatorId = c.get('impersonatorId');
  if (!impersonatorId) {
    return c.json({ error: 'Not impersonating' }, 400);
  }
  const token = getCookie(c, SESSION_COOKIE) ?? extractToken(c);
  if (token) await deleteSession(token);

  // Hand the admin a fresh session of their own so they land back seamlessly.
  const { token: adminToken, expiresAt } = await createSession(
    impersonatorId,
    undefined,
    undefined,
    clientIp(c),
  );
  setSessionCookie(c, adminToken, expiresAt);
  const rows = await db.select(authUserColumns).from(users).where(eq(users.id, impersonatorId));
  return c.json({ user: rows[0] ? toAuthUser(rows[0]) : null, token: adminToken });
});

adminRoutes.use('*', requireRole('admin'));
// Admins are trusted, their credentials aren't — a stolen admin session
// shouldn't get unlimited throughput on bulk endpoints.
adminRoutes.use('*', rateLimit({ windowMs: 60 * 1000, max: 120, by: 'user' }));

adminRoutes.get('/stats', async (c) => {
  // Raw SQL: nine scalar subqueries in one round trip.
  const [stats] = (
    await db.execute(sql`
      SELECT
        (SELECT count(*)::int FROM users) AS users,
        (SELECT count(*)::int FROM sessions WHERE expires_at > now()) AS "activeSessions",
        (SELECT count(*)::int FROM users WHERE created_at > now() - interval '7 days') AS "signups7d",
        (SELECT count(*)::int FROM notifications) AS notifications,
        (SELECT count(*)::int FROM users
          WHERE plan = 'pro' AND (plan_expires_at IS NULL OR plan_expires_at > now())) AS "proUsers",
        (SELECT count(*)::int FROM users
          WHERE trial_ends_at > now() AND status = 'active'
            AND NOT (plan = 'pro' AND (plan_expires_at IS NULL OR plan_expires_at > now()))) AS "trialUsers",
        (SELECT count(*)::int FROM users WHERE status = 'banned') AS "bannedUsers",
        (SELECT count(*)::int FROM reports WHERE status = 'open') AS "openReports",
        (SELECT count(*)::int FROM ip_blocks
          WHERE expires_at IS NULL OR expires_at > now()) AS "ipBlocks"`)
  ).rows as unknown as {
    users: number;
    activeSessions: number;
    signups7d: number;
    notifications: number;
    proUsers: number;
    trialUsers: number;
    bannedUsers: number;
    openReports: number;
    ipBlocks: number;
  }[];
  return c.json(stats!);
});

adminRoutes.get('/users', async (c) => {
  const q = c.req.query('q')?.trim() ?? '';
  // Raw SQL: the FILTERed aggregates and array_agg-first trick for last IP.
  const rows = (
    await db.execute(sql`
      SELECT u.id, u.email, u.username, u.role, u.plan,
             u.plan_expires_at AS "planExpiresAt", u.trial_ends_at AS "trialEndsAt",
             u.comped, u.status, u.banned_at AS "bannedAt", u.ban_reason AS "banReason",
             u.created_at AS "createdAt",
             count(s.id) FILTER (WHERE s.expires_at > now())::int AS "activeSessions",
             max(s.created_at) AS "lastLogin",
             (array_agg(s.ip ORDER BY s.created_at DESC) FILTER (WHERE s.ip IS NOT NULL))[1] AS "lastIp"
        FROM users u
        LEFT JOIN sessions s ON s.user_id = u.id
       WHERE ${q} = '' OR u.email ILIKE '%' || ${q} || '%' OR u.username ILIKE '%' || ${q} || '%'
       GROUP BY u.id
       ORDER BY u.created_at DESC
       LIMIT 100`)
  ).rows;
  return c.json({ users: rows });
});

const exemptSchema = z.object({ comped: z.boolean() });

/** Complimentary access: full membership without a subscription (owner,
 * friends, partners). Takes effect on the target's next session load. */
adminRoutes.patch('/users/:id/exempt', zValidator('json', exemptSchema), async (c) => {
  const admin = c.get('user')!;
  const targetId = c.req.param('id');
  const { comped } = c.req.valid('json');
  const rows = await db
    .update(users)
    .set({ comped })
    .where(eq(users.id, targetId))
    .returning({ id: users.id });
  if (rows.length === 0) return c.json({ error: 'User not found' }, 404);
  await logAudit(admin.id, 'set_comped', 'user', targetId, { comped });
  return c.json({ ok: true, comped });
});

/* ---- Bans: account-level lockout, effective on the next request ---- */

const banSchema = z.object({
  reason: z.string().trim().max(300).default(''),
  /** Also block every IP the account signed in from (last 30 days). */
  blockIps: z.boolean().default(false),
});

adminRoutes.post('/users/:id/ban', zValidator('json', banSchema), async (c) => {
  const admin = c.get('user')!;
  const targetId = c.req.param('id');
  const { reason, blockIps } = c.req.valid('json');
  if (targetId === admin.id) return c.json({ error: 'You cannot ban yourself' }, 400);

  // role <> 'admin' in the WHERE, not a pre-check — admins stay unbannable
  // even if two requests race a concurrent promotion.
  const rows = await db
    .update(users)
    .set({ status: 'banned', bannedAt: sql`now()`, banReason: reason })
    .where(and(eq(users.id, targetId), ne(users.role, 'admin'), eq(users.status, 'active')))
    .returning({ id: users.id });
  if (rows.length === 0) {
    return c.json({ error: 'User not found, already banned, or an admin' }, 404);
  }

  // Collect IPs BEFORE deleting the sessions that hold them. Raw SQL:
  // INSERT ... SELECT DISTINCT from another table.
  let blockedIps = 0;
  if (blockIps) {
    const inserted = (
      await db.execute(sql`
        INSERT INTO ip_blocks (ip, reason, created_by)
        SELECT DISTINCT s.ip, ${`Banned account: ${reason || 'no reason given'}`}, ${admin.id}
          FROM sessions s
         WHERE s.user_id = ${targetId} AND s.ip IS NOT NULL AND s.ip <> 'unknown'
           AND s.created_at > now() - interval '30 days'
        ON CONFLICT (ip) DO NOTHING
        RETURNING ip`)
    ).rows;
    blockedIps = inserted.length;
    invalidateIpBlockCache();
  }

  // The session-lookup filter already locks them out; deleting is hygiene so
  // dead tokens don't linger for 30 days.
  await db.delete(sessions).where(eq(sessions.userId, targetId));
  await logAudit(admin.id, 'ban_user', 'user', targetId, { reason, blockedIps });
  return c.json({ ok: true, blockedIps });
});

adminRoutes.post('/users/:id/unban', async (c) => {
  const admin = c.get('user')!;
  const targetId = c.req.param('id');
  const rows = await db
    .update(users)
    .set({ status: 'active', bannedAt: null, banReason: null })
    .where(and(eq(users.id, targetId), eq(users.status, 'banned')))
    .returning({ id: users.id });
  if (rows.length === 0) return c.json({ error: 'User not found or not banned' }, 404);
  await logAudit(admin.id, 'unban_user', 'user', targetId, {});
  return c.json({ ok: true });
});

/* ---- IP blocks: network-level lockout, enforced before authentication ---- */

adminRoutes.get('/ip-blocks', async (c) => {
  const rows = await db
    .select({
      id: ipBlocks.id,
      ip: ipBlocks.ip,
      reason: ipBlocks.reason,
      createdAt: ipBlocks.createdAt,
      expiresAt: ipBlocks.expiresAt,
      createdBy: users.username,
    })
    .from(ipBlocks)
    .leftJoin(users, eq(users.id, ipBlocks.createdBy))
    .orderBy(desc(ipBlocks.createdAt))
    .limit(200);
  return c.json({ blocks: rows });
});

const ipBlockSchema = z.object({
  ip: z.union([z.ipv4(), z.ipv6()]),
  reason: z.string().trim().max(300).default(''),
  /** Hours until the block lifts itself; omitted = permanent. */
  expiresInHours: z
    .number()
    .int()
    .min(1)
    .max(24 * 365)
    .optional(),
});

adminRoutes.post('/ip-blocks', zValidator('json', ipBlockSchema), async (c) => {
  const admin = c.get('user')!;
  const body = c.req.valid('json');
  const rows = await db
    .insert(ipBlocks)
    .values({
      ip: body.ip,
      reason: body.reason,
      createdBy: admin.id,
      expiresAt:
        body.expiresInHours === undefined
          ? null
          : sql`now() + make_interval(hours => ${body.expiresInHours})`,
    })
    .onConflictDoNothing({ target: ipBlocks.ip })
    .returning({ id: ipBlocks.id });
  if (rows.length === 0) return c.json({ error: 'This IP is already blocked' }, 409);
  invalidateIpBlockCache();
  await logAudit(admin.id, 'block_ip', 'ip', body.ip, { reason: body.reason });
  return c.json({ ok: true }, 201);
});

adminRoutes.delete('/ip-blocks/:id', async (c) => {
  const admin = c.get('user')!;
  const rows = await db
    .delete(ipBlocks)
    .where(eq(ipBlocks.id, c.req.param('id')))
    .returning({ ip: ipBlocks.ip });
  if (rows.length === 0) return c.json({ error: 'Block not found' }, 404);
  invalidateIpBlockCache();
  await logAudit(admin.id, 'unblock_ip', 'ip', rows[0]!.ip, {});
  return c.json({ ok: true });
});

const planSchema = z.object({ plan: z.enum(['free', 'pro']) });

adminRoutes.patch('/users/:id/plan', zValidator('json', planSchema), async (c) => {
  const admin = c.get('user')!;
  const targetId = c.req.param('id');
  const { plan } = c.req.valid('json');
  const rows = await db
    .update(users)
    .set({ plan, planExpiresAt: null })
    .where(eq(users.id, targetId))
    .returning({ id: users.id });
  if (rows.length === 0) return c.json({ error: 'User not found' }, 404);
  await logAudit(admin.id, 'set_plan', 'user', targetId, { plan });
  return c.json({ ok: true, plan });
});

/* ---- Promotions (structure for launches/discounts) ---- */

adminRoutes.get('/promotions', async (c) => {
  const rows = await db
    .select({
      ...getTableColumns(promotions),
      redemptions: sql<number>`count(${promoRedemptions.id})::int`,
    })
    .from(promotions)
    .leftJoin(promoRedemptions, eq(promoRedemptions.promotionId, promotions.id))
    .groupBy(promotions.id)
    .orderBy(desc(promotions.createdAt))
    .limit(100);
  return c.json({
    promotions: rows.map((p) => ({
      id: p.id,
      code: p.code,
      description: p.description,
      discountPercent: p.discountPercent,
      active: p.active,
      startsAt: p.startsAt,
      endsAt: p.endsAt,
      maxRedemptions: p.maxRedemptions,
      grantDays: p.grantDays,
      redemptions: p.redemptions,
    })),
  });
});

const promotionSchema = z.object({
  code: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[A-Z0-9_-]+$/i, 'Letters, numbers, dashes'),
  description: z.string().max(200).default(''),
  discountPercent: z.number().int().min(1).max(100),
  maxRedemptions: z.number().int().min(1).max(1_000_000).nullish(),
  grantDays: z.number().int().min(1).max(3650).nullish(),
});

adminRoutes.post('/promotions', zValidator('json', promotionSchema), async (c) => {
  const admin = c.get('user')!;
  const body = c.req.valid('json');
  const rows = await db
    .insert(promotions)
    .values({
      code: body.code.toUpperCase(),
      description: body.description,
      discountPercent: body.discountPercent,
      maxRedemptions: body.maxRedemptions ?? null,
      grantDays: body.grantDays ?? null,
    })
    .onConflictDoNothing({ target: promotions.code })
    .returning({ id: promotions.id });
  if (rows.length === 0) return c.json({ error: 'Code already exists' }, 409);
  await logAudit(admin.id, 'create_promotion', 'promotion', rows[0]!.id, { code: body.code });
  return c.json({ ok: true }, 201);
});

adminRoutes.patch('/promotions/:id', zValidator('json', z.object({ active: z.boolean() })), async (c) => {
  const admin = c.get('user')!;
  const { active } = c.req.valid('json');
  const rows = await db
    .update(promotions)
    .set({ active })
    .where(eq(promotions.id, c.req.param('id')))
    .returning({ id: promotions.id });
  if (rows.length === 0) return c.json({ error: 'Promotion not found' }, 404);
  await logAudit(admin.id, 'toggle_promotion', 'promotion', rows[0]!.id, { active });
  return c.json({ ok: true });
});

adminRoutes.post('/users/:id/impersonate', async (c) => {
  const admin = c.get('user')!;
  const targetId = c.req.param('id');

  const rows = await db.select(authUserColumns).from(users).where(eq(users.id, targetId));
  const target = rows[0];
  if (!target) return c.json({ error: 'User not found' }, 404);
  // Admins cannot masquerade as other admins — limits blast radius of one
  // compromised admin account.
  if (target.role === 'admin') return c.json({ error: 'Cannot impersonate an admin' }, 403);

  await logAudit(admin.id, 'impersonate', 'user', target.id, { username: target.username });
  // Masquerade tokens are bearer credentials for someone ELSE's account —
  // they live one hour, not the standard thirty days.
  const { token, expiresAt } = await createSession(
    target.id,
    admin.id,
    60 * 60 * 1000,
    clientIp(c),
  );
  setSessionCookie(c, token, expiresAt);
  return c.json({ user: toAuthUser(target), token });
});

const roleSchema = z.object({ role: z.enum(['user', 'moderator', 'admin']) });

adminRoutes.patch('/users/:id/role', zValidator('json', roleSchema), async (c) => {
  const admin = c.get('user')!;
  const targetId = c.req.param('id');
  const { role } = c.req.valid('json');

  if (targetId === admin.id) {
    return c.json({ error: 'You cannot change your own role' }, 400);
  }
  const rows = await db
    .update(users)
    .set({ role })
    .where(eq(users.id, targetId))
    .returning({ id: users.id, role: users.role });
  if (rows.length === 0) return c.json({ error: 'User not found' }, 404);

  await logAudit(admin.id, 'set_role', 'user', targetId, { role });
  return c.json({ ok: true, role: rows[0]!.role });
});

/* ---- Curated foods: our own food DB, merged into search ---- */

const curatedFoodSchema = z.object({
  name: z.string().trim().min(1).max(150),
  brand: z.string().trim().max(60).nullish(),
  barcode: z.string().trim().max(20).nullish(),
  /** Per 100 g — or per serving with servingGrams=100 for label-only items. */
  kcal: z.number().min(0).max(2000),
  proteinG: z.number().min(0).max(500).default(0),
  carbsG: z.number().min(0).max(500).default(0),
  fatG: z.number().min(0).max(500).default(0),
  sugarG: z.number().min(0).max(500).nullish(),
  fiberG: z.number().min(0).max(200).nullish(),
  saturatedFatG: z.number().min(0).max(500).nullish(),
  sodiumG: z.number().min(0).max(50).nullish(),
  servingName: z.string().trim().max(60).nullish(),
  servingGrams: z.number().positive().max(5000).nullish(),
});

const foodImportSchema = z.object({ foods: z.array(curatedFoodSchema).min(1).max(200) });

/** Bulk import (clients chunk big guides into batches). Upsert by
 * name+brand. Raw SQL: the conflict target is an EXPRESSION index
 * (lower(name), coalesce(lower(brand), '')), which the builder can't name. */
adminRoutes.post('/foods', zValidator('json', foodImportSchema), async (c) => {
  const admin = c.get('user')!;
  const { foods } = c.req.valid('json');
  for (const f of foods) {
    await db.execute(sql`
      INSERT INTO curated_foods
        (name, brand, barcode, kcal, protein_g, carbs_g, fat_g, sugar_g, fiber_g,
         saturated_fat_g, sodium_g, serving_name, serving_grams, created_by)
      VALUES (${f.name}, ${f.brand ?? null}, ${f.barcode ?? null}, ${f.kcal}, ${f.proteinG},
              ${f.carbsG}, ${f.fatG}, ${f.sugarG ?? null}, ${f.fiberG ?? null},
              ${f.saturatedFatG ?? null}, ${f.sodiumG ?? null}, ${f.servingName ?? null},
              ${f.servingGrams ?? null}, ${admin.id})
      ON CONFLICT (lower(name), coalesce(lower(brand), '')) DO UPDATE SET
        barcode = EXCLUDED.barcode, kcal = EXCLUDED.kcal,
        protein_g = EXCLUDED.protein_g, carbs_g = EXCLUDED.carbs_g,
        fat_g = EXCLUDED.fat_g, sugar_g = EXCLUDED.sugar_g,
        fiber_g = EXCLUDED.fiber_g, saturated_fat_g = EXCLUDED.saturated_fat_g,
        sodium_g = EXCLUDED.sodium_g, serving_name = EXCLUDED.serving_name,
        serving_grams = EXCLUDED.serving_grams, created_by = EXCLUDED.created_by`);
  }
  await logAudit(admin.id, 'import_foods', 'curated_foods', 'bulk', { count: foods.length });
  return c.json({ ok: true, imported: foods.length }, 201);
});

adminRoutes.get('/foods', async (c) => {
  const q = c.req.query('q')?.trim() ?? '';
  const pattern = `%${q}%`;
  const rows = await db
    .select({
      id: curatedFoods.id,
      name: curatedFoods.name,
      brand: curatedFoods.brand,
      kcal: curatedFoods.kcal,
      servingName: curatedFoods.servingName,
      createdAt: curatedFoods.createdAt,
    })
    .from(curatedFoods)
    .where(
      sql`${q} = '' OR ${curatedFoods.name} ILIKE ${pattern}
          OR coalesce(${curatedFoods.brand}, '') ILIKE ${pattern}`,
    )
    .orderBy(desc(curatedFoods.createdAt), curatedFoods.name)
    .limit(100);
  const [total] = await db.select({ n: sql<number>`count(*)::int` }).from(curatedFoods);
  return c.json({ total: total?.n ?? 0, foods: rows });
});

adminRoutes.delete('/foods/:id', async (c) => {
  const admin = c.get('user')!;
  const rows = await db
    .delete(curatedFoods)
    .where(eq(curatedFoods.id, c.req.param('id')))
    .returning({ name: curatedFoods.name });
  if (rows.length === 0) return c.json({ error: 'Food not found' }, 404);
  await logAudit(admin.id, 'delete_food', 'curated_foods', c.req.param('id'), {
    name: rows[0]!.name,
  });
  return c.json({ ok: true });
});

/* ---- Community recipe seeding: bulk import owned by the importing admin ---- */

const adminRecipeSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).default(''),
  servings: z.number().int().min(1).max(100),
  instructions: z.string().max(2000).nullable(),
  ingredients: z.array(sharedRecipeIngredientSchema).min(1).max(40),
});

/** Seed the community recipe browser (clients chunk large sets). Upserts by
 * a slug of the name, so re-importing an updated set refreshes in place. */
adminRoutes.post(
  '/recipes',
  zValidator('json', z.object({ recipes: z.array(adminRecipeSchema).min(1).max(50) })),
  async (c) => {
    const admin = c.get('user')!;
    const { recipes } = c.req.valid('json');
    for (const r of recipes) {
      const slug = `seed-${r.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .slice(0, 58)}`;
      const totalKcal = r.ingredients.reduce(
        (sum, i) => sum + (i.food.per100g.kcal * i.grams) / 100,
        0,
      );
      await db
        .insert(sharedRecipes)
        .values({
          ownerUserId: admin.id,
          localRecipeId: slug,
          name: r.name,
          description: r.description,
          servings: r.servings,
          kcalPerServing: Math.round(totalKcal / r.servings),
          payload: { instructions: r.instructions, ingredients: r.ingredients },
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
        });
    }
    await logAudit(admin.id, 'import_recipes', 'shared_recipes', 'bulk', {
      count: recipes.length,
    });
    return c.json({ ok: true, imported: recipes.length }, 201);
  },
);

/* ---- Moderation queue: user-filed reports ---- */

adminRoutes.get('/reports', async (c) => {
  const status = c.req.query('status') ?? 'open';
  if (!['open', 'resolved', 'dismissed', 'all'].includes(status)) {
    return c.json({ error: 'Invalid status filter' }, 400);
  }
  // Raw SQL: four role-joins against users/recipes with ::text id matching.
  const rows = (
    await db.execute(sql`
      SELECT r.id, r.target_type AS "targetType", r.target_id AS "targetId",
             r.reason, r.detail, r.status,
             r.created_at AS "createdAt", r.resolved_at AS "resolvedAt",
             r.resolution_note AS "resolutionNote",
             reporter.username AS reporter,
             resolver.username AS "resolvedBy",
             -- Best-effort display label; reports on deleted targets keep the raw id.
             CASE WHEN r.target_type = 'user' THEN target_user.username
                  WHEN r.target_type = 'recipe' THEN target_recipe.name
                  WHEN r.target_type = 'session' THEN target_session.name END AS "targetLabel"
        FROM reports r
        LEFT JOIN users reporter ON reporter.id = r.reporter_user_id
        LEFT JOIN users resolver ON resolver.id = r.resolved_by
        LEFT JOIN users target_user
               ON r.target_type = 'user' AND target_user.id::text = r.target_id
        LEFT JOIN shared_recipes target_recipe
               ON r.target_type = 'recipe' AND target_recipe.id::text = r.target_id
        LEFT JOIN shared_sessions target_session
               ON r.target_type = 'session' AND target_session.id::text = r.target_id
       WHERE ${status} = 'all' OR r.status = ${status}
       ORDER BY r.created_at DESC
       LIMIT 200`)
  ).rows;
  return c.json({ reports: rows });
});

const reportUpdateSchema = z.object({
  status: z.enum(['open', 'resolved', 'dismissed']),
  note: z.string().trim().max(500).default(''),
});

adminRoutes.patch('/reports/:id', zValidator('json', reportUpdateSchema), async (c) => {
  const admin = c.get('user')!;
  const { status, note } = c.req.valid('json');
  const reopened = status === 'open';
  const rows = (
    await db.execute(sql`
      UPDATE reports
         SET status = ${status},
             resolution_note = ${reopened ? '' : note},
             resolved_by = CASE WHEN ${reopened} THEN NULL ELSE ${admin.id}::uuid END,
             resolved_at = CASE WHEN ${reopened} THEN NULL ELSE now() END
       WHERE id = ${c.req.param('id')}
       RETURNING id`)
  ).rows as unknown as { id: string }[];
  if (rows.length === 0) return c.json({ error: 'Report not found' }, 404);
  await logAudit(admin.id, 'update_report', 'report', rows[0]!.id, { status, note });
  return c.json({ ok: true });
});

adminRoutes.get('/audit', async (c) => {
  // Response keys stay snake_case — the admin UI reads them as delivered.
  const entries = await db
    .select({
      id: auditLog.id,
      actor_id: auditLog.actorId,
      actor_username: users.username,
      action: auditLog.action,
      target_type: auditLog.targetType,
      target_id: auditLog.targetId,
      detail: auditLog.detail,
      created_at: auditLog.createdAt,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorId))
    .orderBy(desc(auditLog.createdAt))
    .limit(100);
  return c.json({ entries });
});
