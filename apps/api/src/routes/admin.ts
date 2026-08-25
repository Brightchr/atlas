import { Hono, type Context } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { effectivePlan, resolveMembership, type AuthUser, type MembershipPlan, type UserRole } from '@arcadia/shared';
import { query } from '../db/pool';
import { logAudit } from '../lib/audit';
import { env } from '../lib/env';
import { invalidateIpBlockCache } from '../lib/ip-block';
import { clientIp } from '../lib/rate-limit';
import { createSession, deleteSession } from '../lib/session';
import { requireAuth, requireRole, SESSION_COOKIE, extractToken, type AppEnv } from '../middleware/auth';

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
interface AuthUserRow {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  plan: MembershipPlan;
  plan_expires_at: string | null;
  trial_ends_at: string | null;
  created_at: string;
}
const AUTH_USER_COLUMNS =
  'id, email, username, role, plan, plan_expires_at, trial_ends_at, created_at';

function toAuthUser(row: AuthUserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    role: row.role,
    plan: effectivePlan(row.plan, row.plan_expires_at),
    trialEndsAt: row.trial_ends_at,
    membership: resolveMembership(row.plan, row.plan_expires_at, row.trial_ends_at),
    createdAt: row.created_at,
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
  const rows = await query<AuthUserRow>(
    `SELECT ${AUTH_USER_COLUMNS} FROM users WHERE id = $1`,
    [impersonatorId],
  );
  return c.json({ user: rows[0] ? toAuthUser(rows[0]) : null, token: adminToken });
});

adminRoutes.use('*', requireRole('admin'));

adminRoutes.get('/stats', async (c) => {
  const [stats] = await query<{
    users: string;
    active_sessions: string;
    signups_7d: string;
    notifications: string;
  }>(
    `SELECT
       (SELECT count(*) FROM users) AS users,
       (SELECT count(*) FROM sessions WHERE expires_at > now()) AS active_sessions,
       (SELECT count(*) FROM users WHERE created_at > now() - interval '7 days') AS signups_7d,
       (SELECT count(*) FROM notifications) AS notifications`,
  );
  return c.json({
    users: Number(stats!.users),
    activeSessions: Number(stats!.active_sessions),
    signups7d: Number(stats!.signups_7d),
    notifications: Number(stats!.notifications),
  });
});

adminRoutes.get('/users', async (c) => {
  const q = c.req.query('q')?.trim() ?? '';
  const users = await query<{
    id: string;
    email: string;
    username: string;
    role: string;
    plan: string;
    plan_expires_at: string | null;
    trial_ends_at: string | null;
    status: string;
    banned_at: string | null;
    ban_reason: string | null;
    created_at: string;
    active_sessions: string;
    last_login: string | null;
    last_ip: string | null;
  }>(
    `SELECT u.id, u.email, u.username, u.role, u.plan, u.plan_expires_at, u.trial_ends_at,
            u.status, u.banned_at, u.ban_reason, u.created_at,
            count(s.id) FILTER (WHERE s.expires_at > now()) AS active_sessions,
            max(s.created_at) AS last_login,
            (array_agg(s.ip ORDER BY s.created_at DESC) FILTER (WHERE s.ip IS NOT NULL))[1] AS last_ip
       FROM users u
       LEFT JOIN sessions s ON s.user_id = u.id
      WHERE $1 = '' OR u.email ILIKE '%' || $1 || '%' OR u.username ILIKE '%' || $1 || '%'
      GROUP BY u.id
      ORDER BY u.created_at DESC
      LIMIT 100`,
    [q],
  );
  return c.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      username: u.username,
      role: u.role,
      plan: u.plan,
      planExpiresAt: u.plan_expires_at,
      trialEndsAt: u.trial_ends_at,
      status: u.status,
      bannedAt: u.banned_at,
      banReason: u.ban_reason,
      createdAt: u.created_at,
      activeSessions: Number(u.active_sessions),
      lastLogin: u.last_login,
      lastIp: u.last_ip,
    })),
  });
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
  const rows = await query<{ id: string }>(
    `UPDATE users SET status = 'banned', banned_at = now(), ban_reason = $2
      WHERE id = $1 AND role <> 'admin' AND status = 'active'
      RETURNING id`,
    [targetId, reason],
  );
  if (rows.length === 0) {
    return c.json({ error: 'User not found, already banned, or an admin' }, 404);
  }

  // Collect IPs BEFORE deleting the sessions that hold them.
  let blockedIps = 0;
  if (blockIps) {
    const inserted = await query<{ ip: string }>(
      `INSERT INTO ip_blocks (ip, reason, created_by)
       SELECT DISTINCT s.ip, $2, $3
         FROM sessions s
        WHERE s.user_id = $1 AND s.ip IS NOT NULL AND s.ip <> 'unknown'
          AND s.created_at > now() - interval '30 days'
       ON CONFLICT (ip) DO NOTHING
       RETURNING ip`,
      [targetId, `Banned account: ${reason || 'no reason given'}`, admin.id],
    );
    blockedIps = inserted.length;
    invalidateIpBlockCache();
  }

  // The session-lookup filter already locks them out; deleting is hygiene so
  // dead tokens don't linger for 30 days.
  await query('DELETE FROM sessions WHERE user_id = $1', [targetId]);
  await logAudit(admin.id, 'ban_user', 'user', targetId, { reason, blockedIps });
  return c.json({ ok: true, blockedIps });
});

adminRoutes.post('/users/:id/unban', async (c) => {
  const admin = c.get('user')!;
  const targetId = c.req.param('id');
  const rows = await query<{ id: string }>(
    `UPDATE users SET status = 'active', banned_at = NULL, ban_reason = NULL
      WHERE id = $1 AND status = 'banned'
      RETURNING id`,
    [targetId],
  );
  if (rows.length === 0) return c.json({ error: 'User not found or not banned' }, 404);
  await logAudit(admin.id, 'unban_user', 'user', targetId, {});
  return c.json({ ok: true });
});

/* ---- IP blocks: network-level lockout, enforced before authentication ---- */

adminRoutes.get('/ip-blocks', async (c) => {
  const rows = await query<{
    id: string;
    ip: string;
    reason: string;
    created_at: string;
    expires_at: string | null;
    created_by_username: string | null;
  }>(
    `SELECT b.id, b.ip, b.reason, b.created_at, b.expires_at, u.username AS created_by_username
       FROM ip_blocks b LEFT JOIN users u ON u.id = b.created_by
      ORDER BY b.created_at DESC
      LIMIT 200`,
  );
  return c.json({
    blocks: rows.map((b) => ({
      id: b.id,
      ip: b.ip,
      reason: b.reason,
      createdAt: b.created_at,
      expiresAt: b.expires_at,
      createdBy: b.created_by_username,
    })),
  });
});

const ipBlockSchema = z.object({
  ip: z.union([z.ipv4(), z.ipv6()]),
  reason: z.string().trim().max(300).default(''),
  /** Hours until the block lifts itself; omitted = permanent. */
  expiresInHours: z.number().int().min(1).max(24 * 365).optional(),
});

adminRoutes.post('/ip-blocks', zValidator('json', ipBlockSchema), async (c) => {
  const admin = c.get('user')!;
  const body = c.req.valid('json');
  const rows = await query<{ id: string }>(
    `INSERT INTO ip_blocks (ip, reason, created_by, expires_at)
     VALUES ($1, $2, $3, CASE WHEN $4::int IS NULL THEN NULL
                              ELSE now() + make_interval(hours => $4::int) END)
     ON CONFLICT (ip) DO NOTHING RETURNING id`,
    [body.ip, body.reason, admin.id, body.expiresInHours ?? null],
  );
  if (rows.length === 0) return c.json({ error: 'This IP is already blocked' }, 409);
  invalidateIpBlockCache();
  await logAudit(admin.id, 'block_ip', 'ip', body.ip, { reason: body.reason });
  return c.json({ ok: true }, 201);
});

adminRoutes.delete('/ip-blocks/:id', async (c) => {
  const admin = c.get('user')!;
  const rows = await query<{ ip: string }>('DELETE FROM ip_blocks WHERE id = $1 RETURNING ip', [
    c.req.param('id'),
  ]);
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
  const rows = await query<{ id: string }>(
    'UPDATE users SET plan = $1, plan_expires_at = NULL WHERE id = $2 RETURNING id',
    [plan, targetId],
  );
  if (rows.length === 0) return c.json({ error: 'User not found' }, 404);
  await logAudit(admin.id, 'set_plan', 'user', targetId, { plan });
  return c.json({ ok: true, plan });
});

/* ---- Promotions (structure for launches/discounts; payment wiring later) ---- */

adminRoutes.get('/promotions', async (c) => {
  const rows = await query<{
    id: string;
    code: string;
    description: string;
    discount_percent: number;
    active: boolean;
    starts_at: string;
    ends_at: string | null;
    max_redemptions: number | null;
    grant_days: number | null;
    redemptions: string;
  }>(
    `SELECT p.*, count(r.id) AS redemptions
       FROM promotions p LEFT JOIN promo_redemptions r ON r.promotion_id = p.id
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT 100`,
  );
  return c.json({
    promotions: rows.map((p) => ({
      id: p.id,
      code: p.code,
      description: p.description,
      discountPercent: p.discount_percent,
      active: p.active,
      startsAt: p.starts_at,
      endsAt: p.ends_at,
      maxRedemptions: p.max_redemptions,
      grantDays: p.grant_days,
      redemptions: Number(p.redemptions),
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
  const rows = await query<{ id: string }>(
    `INSERT INTO promotions (code, description, discount_percent, max_redemptions, grant_days)
     VALUES ($1, $2, $3, $4, $5) ON CONFLICT (code) DO NOTHING RETURNING id`,
    [
      body.code.toUpperCase(),
      body.description,
      body.discountPercent,
      body.maxRedemptions ?? null,
      body.grantDays ?? null,
    ],
  );
  if (rows.length === 0) return c.json({ error: 'Code already exists' }, 409);
  await logAudit(admin.id, 'create_promotion', 'promotion', rows[0]!.id, { code: body.code });
  return c.json({ ok: true }, 201);
});

adminRoutes.patch('/promotions/:id', zValidator('json', z.object({ active: z.boolean() })), async (c) => {
  const admin = c.get('user')!;
  const { active } = c.req.valid('json');
  const rows = await query<{ id: string }>(
    'UPDATE promotions SET active = $1 WHERE id = $2 RETURNING id',
    [active, c.req.param('id')],
  );
  if (rows.length === 0) return c.json({ error: 'Promotion not found' }, 404);
  await logAudit(admin.id, 'toggle_promotion', 'promotion', rows[0]!.id, { active });
  return c.json({ ok: true });
});

adminRoutes.post('/users/:id/impersonate', async (c) => {
  const admin = c.get('user')!;
  const targetId = c.req.param('id');

  const rows = await query<AuthUserRow>(
    `SELECT ${AUTH_USER_COLUMNS} FROM users WHERE id = $1`,
    [targetId],
  );
  const target = rows[0];
  if (!target) return c.json({ error: 'User not found' }, 404);
  // Admins cannot masquerade as other admins — limits blast radius of one
  // compromised admin account.
  if (target.role === 'admin') return c.json({ error: 'Cannot impersonate an admin' }, 403);

  await logAudit(admin.id, 'impersonate', 'user', target.id, { username: target.username });
  // Masquerade tokens are bearer credentials for someone ELSE's account —
  // they live one hour, not the standard thirty days.
  const { token, expiresAt } = await createSession(target.id, admin.id, 60 * 60 * 1000, clientIp(c));
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
  const rows = await query<{ id: string; role: string }>(
    'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, role',
    [role, targetId],
  );
  if (rows.length === 0) return c.json({ error: 'User not found' }, 404);

  await logAudit(admin.id, 'set_role', 'user', targetId, { role });
  return c.json({ ok: true, role: rows[0]!.role });
});

/* ---- Moderation queue: user-filed reports ---- */

adminRoutes.get('/reports', async (c) => {
  const status = c.req.query('status') ?? 'open';
  if (!['open', 'resolved', 'dismissed', 'all'].includes(status)) {
    return c.json({ error: 'Invalid status filter' }, 400);
  }
  const rows = await query<{
    id: string;
    target_type: string;
    target_id: string;
    target_label: string | null;
    reason: string;
    detail: string;
    status: string;
    reporter: string | null;
    created_at: string;
    resolved_by: string | null;
    resolved_at: string | null;
    resolution_note: string;
  }>(
    `SELECT r.id, r.target_type, r.target_id, r.reason, r.detail, r.status,
            r.created_at, r.resolved_at, r.resolution_note,
            reporter.username AS reporter,
            resolver.username AS resolved_by,
            -- Best-effort display label; reports on deleted targets keep the raw id.
            CASE WHEN r.target_type = 'user' THEN target_user.username END AS target_label
       FROM reports r
       LEFT JOIN users reporter ON reporter.id = r.reporter_user_id
       LEFT JOIN users resolver ON resolver.id = r.resolved_by
       LEFT JOIN users target_user
              ON r.target_type = 'user' AND target_user.id::text = r.target_id
      WHERE $1 = 'all' OR r.status = $1
      ORDER BY r.created_at DESC
      LIMIT 200`,
    [status],
  );
  return c.json({
    reports: rows.map((r) => ({
      id: r.id,
      targetType: r.target_type,
      targetId: r.target_id,
      targetLabel: r.target_label,
      reason: r.reason,
      detail: r.detail,
      status: r.status,
      reporter: r.reporter,
      createdAt: r.created_at,
      resolvedBy: r.resolved_by,
      resolvedAt: r.resolved_at,
      resolutionNote: r.resolution_note,
    })),
  });
});

const reportUpdateSchema = z.object({
  status: z.enum(['open', 'resolved', 'dismissed']),
  note: z.string().trim().max(500).default(''),
});

adminRoutes.patch('/reports/:id', zValidator('json', reportUpdateSchema), async (c) => {
  const admin = c.get('user')!;
  const { status, note } = c.req.valid('json');
  const reopened = status === 'open';
  const rows = await query<{ id: string }>(
    `UPDATE reports
        SET status = $1,
            resolution_note = $2,
            resolved_by = CASE WHEN $3 THEN NULL ELSE $4::uuid END,
            resolved_at = CASE WHEN $3 THEN NULL ELSE now() END
      WHERE id = $5
      RETURNING id`,
    [status, reopened ? '' : note, reopened, admin.id, c.req.param('id')],
  );
  if (rows.length === 0) return c.json({ error: 'Report not found' }, 404);
  await logAudit(admin.id, 'update_report', 'report', rows[0]!.id, { status, note });
  return c.json({ ok: true });
});

adminRoutes.get('/audit', async (c) => {
  const entries = await query<{
    id: string;
    actor_id: string | null;
    action: string;
    target_type: string;
    target_id: string;
    detail: unknown;
    created_at: string;
  }>('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 100');
  return c.json({ entries });
});
