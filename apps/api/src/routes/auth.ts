import { randomBytes } from 'node:crypto';
import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { effectivePlan, resolveMembership } from '@arcadia/shared';
import { query } from '../db/pool';
import { exchangeGoogleCode, googleAuthUrl, googleConfigured } from '../lib/google-auth';
import { env } from '../lib/env';
import { createNotification } from '../lib/notify';
import { DUMMY_HASH_PROMISE, hashPassword, verifyPassword } from '../lib/password';
import { clientIp, rateLimit } from '../lib/rate-limit';
import { createSession, deleteOtherSessions, deleteSession } from '../lib/session';
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

  const rows = await query<{ id: string; created_at: string; trial_ends_at: string }>(
    `INSERT INTO users (email, username, password_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING
     RETURNING id, created_at, trial_ends_at`,
    [email, body.username, passwordHash],
  );
  if (rows.length === 0) {
    return c.json({ error: 'Email or username is already in use' }, 409);
  }

  const { token, expiresAt } = await createSession(rows[0]!.id, undefined, undefined, clientIp(c));
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
        plan: 'free',
        trialEndsAt: rows[0]!.trial_ends_at,
        membership: 'trial', // the INSERT default just started the 7-day window
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
    plan: 'free' | 'pro';
    plan_expires_at: string | null;
    trial_ends_at: string | null;
    comped: boolean;
    status: string;
    created_at: string;
    password_hash: string | null;
  }>(
    `SELECT id, email, username, role, plan, plan_expires_at, trial_ends_at, comped, status,
            created_at, password_hash
       FROM users WHERE email = $1`,
    [email],
  );
  const user = rows[0];

  // Verify against a dummy hash when the user doesn't exist — or exists but
  // is Google-only (no password) — so every failure path takes the same time
  // and returns the same message: timing and wording must not reveal which
  // emails are registered or how they sign in.
  const valid = user?.password_hash
    ? await verifyPassword(user.password_hash, body.password)
    : (await verifyPassword(await DUMMY_HASH_PROMISE, body.password), false);

  if (!user || !valid) {
    // One generic message for both wrong-email and wrong-password.
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  // Checked only after the password verified — the ban must not be
  // discoverable by someone who doesn't hold the credentials.
  if (user.status === 'banned') {
    return c.json({ error: 'This account has been suspended' }, 403);
  }

  const { token, expiresAt } = await createSession(user.id, undefined, undefined, clientIp(c));
  setSessionCookie(c, token, expiresAt);
  return c.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      plan: effectivePlan(user.plan, user.plan_expires_at),
      trialEndsAt: user.trial_ends_at,
      membership: resolveMembership(user.plan, user.plan_expires_at, user.trial_ends_at, user.comped),
      createdAt: user.created_at,
    },
    token,
  });
});

/* ------------------------- Google sign-in (OAuth) ------------------------- */

const OAUTH_STATE_COOKIE = 'arcadia_oauth_state';
const GOOGLE_USER_COLUMNS =
  'id, email, username, role, plan, plan_expires_at, trial_ends_at, comped, status, created_at';

interface GoogleUserRow {
  id: string;
  status: string;
}

/** Email local part → available username: sanitized, padded to the minimum
 * length, numeric suffix on collision. */
async function availableUsername(email: string): Promise<string> {
  let base = email.split('@')[0]!.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 24);
  if (base.length < 3) base = `athlete_${base}`;
  for (let i = 0; i < 6; i++) {
    const candidate = i === 0 ? base : `${base}${Math.floor(Math.random() * 10_000)}`;
    const taken = await query<{ id: string }>(
      'SELECT id FROM users WHERE lower(username) = lower($1)',
      [candidate],
    );
    if (taken.length === 0) return candidate;
  }
  return `athlete_${randomBytes(4).toString('hex')}`;
}

authRoutes.get('/google/start', authLimiter, (c) => {
  if (!googleConfigured()) {
    return c.redirect(`${env.publicUrl}/signin?error=google-unavailable`);
  }
  // Random state, echoed back by Google and checked against this cookie —
  // the standard OAuth CSRF defense.
  const state = randomBytes(16).toString('base64url');
  setCookie(c, OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'Lax',
    path: '/',
    maxAge: 600,
  });
  return c.redirect(googleAuthUrl(state));
});

authRoutes.get('/google/callback', authLimiter, async (c) => {
  const fail = (reason: string) => c.redirect(`${env.publicUrl}/signin?error=${reason}`);

  const expected = getCookie(c, OAUTH_STATE_COOKIE);
  deleteCookie(c, OAUTH_STATE_COOKIE, { path: '/' });
  const state = c.req.query('state');
  const code = c.req.query('code');
  if (!expected || !state || state !== expected || !code) return fail('google');

  const identity = await exchangeGoogleCode(code).catch(() => null);
  // Unverified emails could hijack an existing account by address alone.
  if (!identity || !identity.emailVerified) return fail('google');

  // Known Google account → straight in. Known EMAIL (Google-verified) →
  // link. Otherwise a brand-new account — no password, trial starts now.
  let rows = await query<GoogleUserRow>(
    `SELECT ${GOOGLE_USER_COLUMNS} FROM users WHERE google_id = $1`,
    [identity.sub],
  );
  if (rows.length === 0) {
    rows = await query<GoogleUserRow>(
      `UPDATE users SET google_id = $1 WHERE email = $2 AND google_id IS NULL
       RETURNING ${GOOGLE_USER_COLUMNS}`,
      [identity.sub, identity.email],
    );
  }
  if (rows.length === 0) {
    const username = await availableUsername(identity.email);
    try {
      rows = await query<GoogleUserRow>(
        `INSERT INTO users (email, username, google_id, display_name)
         VALUES ($1, $2, $3, $4) RETURNING ${GOOGLE_USER_COLUMNS}`,
        [identity.email, username, identity.sub, identity.name.slice(0, 60) || null],
      );
    } catch {
      return fail('google'); // e.g. a race on the email unique index
    }
    await createNotification(
      rows[0]!.id,
      'welcome',
      'Welcome to Arcadia Atlas',
      'Set up your first workout to start tracking progress.',
    );
  }

  const user = rows[0]!;
  if (user.status === 'banned') return fail('suspended');

  const { token, expiresAt } = await createSession(user.id, undefined, undefined, clientIp(c));
  setSessionCookie(c, token, expiresAt);
  return c.redirect(`${env.publicUrl}/`);
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

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});

/** Change password: requires the current one (a walked-away-from laptop must
 * not be enough), rehashes, and revokes every other session so anything
 * stolen dies with the old password. */
authRoutes.post(
  '/change-password',
  requireAuth,
  authLimiter,
  zValidator('json', changePasswordSchema),
  async (c) => {
    const user = c.get('user')!;
    const body = c.req.valid('json');

    const rows = await query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE id = $1',
      [user.id],
    );
    const valid = rows[0] && (await verifyPassword(rows[0].password_hash, body.currentPassword));
    if (!valid) return c.json({ error: 'Current password is incorrect' }, 401);

    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [
      await hashPassword(body.newPassword),
      user.id,
    ]);

    const bearer = c.req.header('Authorization');
    const token =
      getCookie(c, SESSION_COOKIE) ??
      (bearer?.startsWith('Bearer ') ? bearer.slice('Bearer '.length) : undefined);
    if (token) await deleteOtherSessions(user.id, token);

    await createNotification(
      user.id,
      'security',
      'Your password was changed',
      'All other signed-in devices were signed out. If this wasn’t you, change your password again immediately.',
    );
    return c.json({ ok: true });
  },
);
