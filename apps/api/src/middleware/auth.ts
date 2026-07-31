import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import type { AuthUser } from '@arcadia/shared';
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

/** Reads the session token (cookie for browsers, Bearer header for the native
 * app) and attaches the user — or null — to the request context. */
export const sessionMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE) ?? extractToken(c);
  const session = token ? await getSessionForToken(token) : null;
  c.set('user', session?.user ?? null);
  c.set('impersonatorId', session?.impersonatorId ?? null);
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
