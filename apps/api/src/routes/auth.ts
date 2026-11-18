import { randomBytes } from 'node:crypto';
import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { effectivePlan, resolveMembership } from '@arcadia/shared';
import { db } from '../db/db';
import { users } from '../db/schema';
import { DELETION_GRACE_DAYS, cancelStripeForUser } from '../lib/account';
import { logAudit } from '../lib/audit';
import {
  accountDeletionEmail,
  emailConfigured,
  passwordResetEmail,
  sendEmail,
  verifyEmailEmail,
} from '../lib/email';
import { consumeEmailToken, createEmailToken } from '../lib/email-tokens';
import { exchangeGoogleCode, googleAuthUrl, googleConfigured } from '../lib/google-auth';
import { env } from '../lib/env';
import { createNotification } from '../lib/notify';
import { DUMMY_HASH_PROMISE, hashPassword, verifyPassword } from '../lib/password';
import { clientIp, rateLimit } from '../lib/rate-limit';
import {
  createSession,
  deleteAllSessions,
  deleteOtherSessions,
  deleteSession,
} from '../lib/session';
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

  const rows = await db
    .insert(users)
    .values({ email, username: body.username, passwordHash })
    .onConflictDoNothing()
    .returning({ id: users.id, createdAt: users.createdAt, trialEndsAt: users.trialEndsAt });
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
  // Best-effort: signup must never fail because the mail provider hiccuped.
  sendVerificationEmail(rows[0]!.id, email).catch((err) =>
    console.warn('signup verification email failed:', err),
  );
  return c.json(
    {
      user: {
        id: rows[0]!.id,
        email,
        username: body.username,
        role: 'user',
        plan: 'free',
        trialEndsAt: rows[0]!.trialEndsAt?.toISOString() ?? null,
        membership: 'trial', // the INSERT default just started the 7-day window
        emailVerified: false,
        hasPassword: true,
        createdAt: rows[0]!.createdAt.toISOString(),
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

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      role: users.role,
      plan: users.plan,
      planExpiresAt: users.planExpiresAt,
      trialEndsAt: users.trialEndsAt,
      comped: users.comped,
      status: users.status,
      emailVerified: users.emailVerified,
      deletedAt: users.deletedAt,
      createdAt: users.createdAt,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.email, email));
  const user = rows[0];

  // Verify against a dummy hash when the user doesn't exist — or exists but
  // is Google-only (no password) — so every failure path takes the same time
  // and returns the same message: timing and wording must not reveal which
  // emails are registered or how they sign in.
  const valid = user?.passwordHash
    ? await verifyPassword(user.passwordHash, body.password)
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

  // Signing in during the deletion grace window restores the account —
  // proving the credentials IS the recovery flow.
  if (user.deletedAt !== null) {
    await db.update(users).set({ deletedAt: null }).where(eq(users.id, user.id));
    await logAudit(user.id, 'account_restored', 'user', user.id);
    await createNotification(
      user.id,
      'account',
      'Welcome back',
      'Your account was restored — deletion has been cancelled.',
    );
  }

  const { token, expiresAt } = await createSession(user.id, undefined, undefined, clientIp(c));
  setSessionCookie(c, token, expiresAt);
  return c.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      plan: effectivePlan(user.plan, user.planExpiresAt),
      trialEndsAt: user.trialEndsAt?.toISOString() ?? null,
      membership: resolveMembership(user.plan, user.planExpiresAt, user.trialEndsAt, user.comped),
      emailVerified: user.emailVerified,
      hasPassword: user.passwordHash !== null,
      createdAt: user.createdAt.toISOString(),
    },
    token,
  });
});

/* --------------------- Password reset & email verify ---------------------- */

/** Creates a fresh verify link and emails it. Shared by signup and the
 * re-send endpoint; throws on send failure — callers pick the policy. */
async function sendVerificationEmail(userId: string, email: string): Promise<void> {
  if (!emailConfigured()) return;
  const token = await createEmailToken(userId, 'email_verify', 24 * 60);
  const message = verifyEmailEmail(
    `${env.publicUrl}/verify-email?token=${encodeURIComponent(token)}`,
  );
  await sendEmail(email, message.subject, message.html);
}

const forgotSchema = z.object({ email: z.email().max(254) });

/** Always answers the same way, immediately: whether the account exists must
 * not be readable from the response, its wording, or its timing — so the
 * lookup-and-send runs after the response, fire-and-forget. */
authRoutes.post(
  '/forgot-password',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 5 }),
  zValidator('json', forgotSchema),
  async (c) => {
    if (!emailConfigured()) {
      return c.json({ error: 'Password reset isn’t available yet' }, 501);
    }
    const email = c.req.valid('json').email.trim().toLowerCase();
    void (async () => {
      const rows = await db
        .select({ id: users.id, status: users.status })
        .from(users)
        .where(eq(users.email, email));
      const user = rows[0];
      if (!user || user.status === 'banned') return;
      const token = await createEmailToken(user.id, 'password_reset', 30);
      const message = passwordResetEmail(
        `${env.publicUrl}/reset-password?token=${encodeURIComponent(token)}`,
      );
      await sendEmail(email, message.subject, message.html);
    })().catch((err) => console.error('password reset email failed:', err));
    return c.json({ ok: true });
  },
);

const resetSchema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(8).max(128),
});

authRoutes.post('/reset-password', authLimiter, zValidator('json', resetSchema), async (c) => {
  const { token, password } = c.req.valid('json');
  const userId = await consumeEmailToken(token, 'password_reset');
  if (!userId) {
    return c.json({ error: 'This link is invalid or has expired — request a new one' }, 400);
  }
  const passwordHash = await hashPassword(password);
  // Completing a reset proves the person controls the email address.
  await db.update(users).set({ passwordHash, emailVerified: true }).where(eq(users.id, userId));
  // Every session dies — including any held by whoever prompted the reset.
  await deleteAllSessions(userId);
  await logAudit(userId, 'password_reset', 'user', userId);
  return c.json({ ok: true });
});

authRoutes.post(
  '/send-verification',
  requireAuth,
  rateLimit({ windowMs: 15 * 60 * 1000, max: 3, by: 'user' }),
  async (c) => {
    if (!emailConfigured()) {
      return c.json({ error: 'Email verification isn’t available yet' }, 501);
    }
    const user = c.get('user')!;
    if (user.emailVerified) return c.json({ ok: true, alreadyVerified: true });
    await sendVerificationEmail(user.id, user.email);
    return c.json({ ok: true });
  },
);

/* ---------------------------- Account deletion ---------------------------- */

const deleteAccountSchema = z.object({
  /** Required for accounts with a password. */
  password: z.string().max(128).optional(),
  /** Google-only accounts type DELETE instead — no password exists to check. */
  confirm: z.string().max(20).optional(),
});

/** Soft delete: access ends now, billing ends now, data survives a grace
 * window (signing back in restores everything), then the daily sweep purges
 * it permanently. */
authRoutes.post(
  '/delete-account',
  requireAuth,
  rateLimit({ windowMs: 15 * 60 * 1000, max: 5, by: 'user' }),
  zValidator('json', deleteAccountSchema),
  async (c) => {
    const user = c.get('user')!;
    const body = c.req.valid('json');

    const [row] = await db
      .select({ passwordHash: users.passwordHash, role: users.role })
      .from(users)
      .where(eq(users.id, user.id));
    if (!row) return c.json({ error: 'User not found' }, 404);
    // The last admin deleting themselves would orphan the instance.
    if (row.role === 'admin') {
      return c.json({ error: 'Admin accounts can’t self-delete — demote the role first' }, 403);
    }

    // Deletion is the most destructive action an account has, so holding a
    // session isn't enough — re-prove it: password, or for Google-only
    // accounts (nothing to verify against) an explicit typed phrase.
    if (row.passwordHash !== null) {
      const valid = body.password
        ? await verifyPassword(row.passwordHash, body.password)
        : false;
      if (!valid) return c.json({ error: 'Incorrect password' }, 403);
    } else if (body.confirm !== 'DELETE') {
      return c.json({ error: 'Type DELETE to confirm' }, 400);
    }

    await cancelStripeForUser(user.id);
    await db.update(users).set({ deletedAt: sql`now()` }).where(eq(users.id, user.id));
    await deleteAllSessions(user.id);
    await logAudit(user.id, 'account_delete_requested', 'user', user.id, {
      graceDays: DELETION_GRACE_DAYS,
    });
    if (emailConfigured()) {
      const message = accountDeletionEmail(DELETION_GRACE_DAYS);
      sendEmail(user.email, message.subject, message.html).catch((err) =>
        console.warn('deletion email failed:', err),
      );
    }
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return c.json({ ok: true, graceDays: DELETION_GRACE_DAYS });
  },
);

const verifySchema = z.object({ token: z.string().min(20).max(200) });

authRoutes.post('/verify-email', authLimiter, zValidator('json', verifySchema), async (c) => {
  const userId = await consumeEmailToken(c.req.valid('json').token, 'email_verify');
  if (!userId) {
    return c.json({ error: 'This link is invalid or has expired' }, 400);
  }
  await db.update(users).set({ emailVerified: true }).where(eq(users.id, userId));
  return c.json({ ok: true });
});

/* ------------------------- Google sign-in (OAuth) ------------------------- */

const OAUTH_STATE_COOKIE = 'arcadia_oauth_state';
const googleUserColumns = {
  id: users.id,
  status: users.status,
  deletedAt: users.deletedAt,
};

/** Email local part → available username: sanitized, padded to the minimum
 * length, numeric suffix on collision. */
async function availableUsername(email: string): Promise<string> {
  let base = email
    .split('@')[0]!
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .slice(0, 24);
  if (base.length < 3) base = `athlete_${base}`;
  for (let i = 0; i < 6; i++) {
    const candidate = i === 0 ? base : `${base}${Math.floor(Math.random() * 10_000)}`;
    const taken = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.username}) = lower(${candidate})`);
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
  let rows = await db
    .select(googleUserColumns)
    .from(users)
    .where(eq(users.googleId, identity.sub));
  if (rows.length === 0) {
    rows = await db
      .update(users)
      .set({ googleId: identity.sub, emailVerified: true })
      .where(and(eq(users.email, identity.email), isNull(users.googleId)))
      .returning(googleUserColumns);
  }
  let created = false;
  if (rows.length === 0) {
    created = true;
    const username = await availableUsername(identity.email);
    try {
      rows = await db
        .insert(users)
        .values({
          email: identity.email,
          username,
          googleId: identity.sub,
          displayName: identity.name.slice(0, 60) || null,
          emailVerified: true,
        })
        .returning(googleUserColumns);
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

  // Same recovery rule as password login: signing in restores the account.
  if (user.deletedAt !== null) {
    await db.update(users).set({ deletedAt: null }).where(eq(users.id, user.id));
    await logAudit(user.id, 'account_restored', 'user', user.id);
    await createNotification(
      user.id,
      'account',
      'Welcome back',
      'Your account was restored — deletion has been cancelled.',
    );
  }

  const { token, expiresAt } = await createSession(user.id, undefined, undefined, clientIp(c));
  setSessionCookie(c, token, expiresAt);
  // Brand-new accounts start at the intro wizard (skippable); returning users
  // land on the dashboard.
  return c.redirect(`${env.publicUrl}/${created ? 'welcome' : ''}`);
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

    const rows = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, user.id));
    const valid =
      rows[0]?.passwordHash != null &&
      (await verifyPassword(rows[0].passwordHash, body.currentPassword));
    if (!valid) return c.json({ error: 'Current password is incorrect' }, 401);

    await db
      .update(users)
      .set({ passwordHash: await hashPassword(body.newPassword) })
      .where(eq(users.id, user.id));

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
