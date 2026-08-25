import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import type { AuthUser } from '@arcadia/shared';
import { query } from '../db/pool';
import { getSessionForToken } from '../lib/session';

export const SESSION_COOKIE = 'arcadia_session';

export type AppEnv = {
  Variables: {
    user: AuthUser | null;
    /** Admin user id when this session is a masquerade, else null. */
    impersonatorId: string | null;
  };
};

export function extractToken(c: {
  req: { header: (name: string) => string | undefined };
}): string | undefined {
  const bearer = (c.req.header('Authorization') ?? '').trim();
  return bearer.startsWith('Bearer ') ? bearer.slice('Bearer '.length) : undefined;
}

// Presence touch, throttled in memory so it costs one UPDATE per user per
// couple of minutes instead of one per request. Fire-and-forget: presence
// must never slow down or fail a real request.
const PRESENCE_TOUCH_MS = 2 * 60 * 1000;
const lastTouch = new Map<string, number>();

function touchPresence(userId: string): void {
  const now = Date.now();
  if (now - (lastTouch.get(userId) ?? 0) < PRESENCE_TOUCH_MS) return;
  lastTouch.set(userId, now);
  void query('UPDATE users SET last_seen_at = now() WHERE id = $1', [userId]).catch(() => {
    lastTouch.delete(userId);
  });
  // Bounded: prune entries older than an hour once the map grows.
  if (lastTouch.size > 10_000) {
    for (const [id, at] of lastTouch) if (now - at > 60 * 60 * 1000) lastTouch.delete(id);
  }
}

/** Reads the session token (cookie for browsers, Bearer header for the native
 * app) and attaches the user — or null — to the request context. */
export const sessionMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE) ?? extractToken(c);
  const session = token ? await getSessionForToken(token) : null;
  c.set('user', session?.user ?? null);
  c.set('impersonatorId', session?.impersonatorId ?? null);
  if (session) touchPresence(session.user.id);
  await next();
};

/** Gate for routes that need a signed-in user. */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get('user')) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  await next();
};

/** Gate for paid features. Admins pass automatically (they need to see what
 * they sell); expiry is already applied when the session loads. */
export const requirePro: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get('user');
  if (!user || (user.plan !== 'pro' && user.role !== 'admin')) {
    return c.json({ error: 'Pro membership required', upgrade: true }, 402);
  }
  await next();
};

/** Gate for the app's core features, which are paid-after-trial: an unexpired
 * trial or an active pro plan passes. Staff always pass (they administer what
 * they sell). 402 + upgrade:true tells the client to show the paywall.
 * Auth-adjacent groups (auth, notifications, profiles, billing) stay open so
 * an expired user can still sign in, read notices, and subscribe. */
export const requireActiveMember: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  const staff = user.role === 'admin' || user.role === 'moderator';
  if (!staff && user.membership === 'expired') {
    return c.json({ error: 'Trial ended — a subscription is required', upgrade: true }, 402);
  }
  await next();
};

/** Gate for moderation/admin routes. Admins may do anything moderators can. */
export function requireRole(role: 'moderator' | 'admin'): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = c.get('user');
    const allowed =
      user && (user.role === 'admin' || (role === 'moderator' && user.role === 'moderator'));
    if (!allowed) {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }
    await next();
  };
}
