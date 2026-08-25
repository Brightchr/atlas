import { Hono, type Context } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { query } from '../db/pool';
import { logAudit } from '../lib/audit';
import { env } from '../lib/env';
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
  const { token: adminToken, expiresAt } = await createSession(impersonatorId);
  setSessionCookie(c, adminToken, expiresAt);
  const rows = await query<{ id: string; email: string; username: string; role: string; plan: string; created_at: string }>(
    'SELECT id, email, username, role, plan, created_at FROM users WHERE id = $1',
    [impersonatorId],
  );
  return c.json({ user: rows[0] ?? null, token: adminToken });
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
    created_at: string;
    active_sessions: string;
    last_login: string | null;
  }>(
    `SELECT u.id, u.email, u.username, u.role, u.plan, u.plan_expires_at, u.created_at,
            count(s.id) FILTER (WHERE s.expires_at > now()) AS active_sessions,
            max(s.created_at) AS last_login
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
      createdAt: u.created_at,
      activeSessions: Number(u.active_sessions),
      lastLogin: u.last_login,
    })),
  });
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
  }>('SELECT * FROM promotions ORDER BY created_at DESC LIMIT 100');
  return c.json({
    promotions: rows.map((p) => ({
      id: p.id,
      code: p.code,
      description: p.description,
      discountPercent: p.discount_percent,
      active: p.active,
      startsAt: p.starts_at,
      endsAt: p.ends_at,
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
});

adminRoutes.post('/promotions', zValidator('json', promotionSchema), async (c) => {
  const admin = c.get('user')!;
  const body = c.req.valid('json');
  const rows = await query<{ id: string }>(
    `INSERT INTO promotions (code, description, discount_percent)
     VALUES ($1, $2, $3) ON CONFLICT (code) DO NOTHING RETURNING id`,
    [body.code.toUpperCase(), body.description, body.discountPercent],
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

  const rows = await query<{ id: string; email: string; username: string; role: string; plan: string; created_at: string }>(
    'SELECT id, email, username, role, plan, created_at FROM users WHERE id = $1',
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
  const { token, expiresAt } = await createSession(target.id, admin.id, 60 * 60 * 1000);
  setSessionCookie(c, token, expiresAt);
  return c.json({ user: target, token });
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
