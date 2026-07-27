import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { query } from '../db/pool';
import { env } from '../lib/env';
import { createNotification } from '../lib/notify';
import { DUMMY_HASH_PROMISE, hashPassword, verifyPassword } from '../lib/password';
import { rateLimit } from '../lib/rate-limit';
import { createSession, deleteSession } from '../lib/session';
import { requireAuth, SESSION_COOKIE, type AppEnv } from '../middleware/auth';

const registerSchema = z.object({
  email: z.email().max(254),
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers and underscores only'),
  // Length is the only rule that measurably helps; composition rules just
  // annoy users (NIST 800-63B). Max prevents hashing-DoS with huge inputs.
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(128),
});

function setSessionCookie(c: Context, token: string, expiresAt: Date) {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true, // JS can never read it — neutralizes XSS token theft
    secure: env.isProd, // HTTPS-only in production
    sameSite: 'Lax', // blocks CSRF on cross-site POSTs
    path: '/',
    expires: expiresAt,
  });
}

export const authRoutes = new Hono<AppEnv>();

// 10 attempts per 15 min per IP — slows credential stuffing and signup spam.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

authRoutes.post('/register', authLimiter, zValidator('json', registerSchema), async (c) => {
  const body = c.req.valid('json');
  const email = body.email.trim().toLowerCase();
  const passwordHash = await hashPassword(body.password);

  const rows = await query<{ id: string; created_at: string }>(
    `INSERT INTO users (email, username, password_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING
     RETURNING id, created_at`,
    [email, body.username, passwordHash],
  );
  if (rows.length === 0) {
    return c.json({ error: 'Email or username is already in use' }, 409);
  }

  const { token, expiresAt } = await createSession(rows[0]!.id);
  setSessionCookie(c, token, expiresAt);
  await createNotification(
    rows[0]!.id,
    'welcome',
    'Welcome to Arcadia Atlas',
    'Set up your first workout to start tracking progress.',
  );
  return c.json(
    {
      user: {
        id: rows[0]!.id,
        email,
        username: body.username,
        role: 'user',
        createdAt: rows[0]!.created_at,
      },
      // Also returned in the body for the native app, which uses Bearer auth
      // (Capacitor webviews don't share browser cookies reliably).
      token,
    },
    201,
  );
});

authRoutes.post('/login', authLimiter, zValidator('json', loginSchema), async (c) => {
  const body = c.req.valid('json');
  const email = body.email.trim().toLowerCase();

  const rows = await query<{
    id: string;
    email: string;
    username: string;
    role: string;
    created_at: string;
    password_hash: string;
  }>('SELECT id, email, username, role, created_at, password_hash FROM users WHERE email = $1', [
    email,
  ]);
  const user = rows[0];

  // Verify against a dummy hash when the user doesn't exist so both paths take
  // the same time — response timing must not reveal which emails are registered.
  const valid = user
    ? await verifyPassword(user.password_hash, body.password)
    : (await verifyPassword(await DUMMY_HASH_PROMISE, body.password), false);

  if (!user || !valid) {
    // One generic message for both wrong-email and wrong-password.
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  const { token, expiresAt } = await createSession(user.id);
  setSessionCookie(c, token, expiresAt);
  return c.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      createdAt: user.created_at,
    },
    token,
  });
});

authRoutes.post('/logout', async (c) => {
  const bearer = c.req.header('Authorization');
  const token =
    getCookie(c, SESSION_COOKIE) ??
    (bearer?.startsWith('Bearer ') ? bearer.slice('Bearer '.length) : undefined);
  if (token) {
    await deleteSession(token); // revoke server-side, not just in the browser
  }
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.json({ ok: true });
});

authRoutes.get('/me', requireAuth, (c) => {
  return c.json({ user: c.get('user'), impersonated: c.get('impersonatorId') !== null });
});
