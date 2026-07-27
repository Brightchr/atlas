import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import type { AuthUser } from '@arcadia/shared';
import { getUserForToken } from '../lib/session';

export const SESSION_COOKIE = 'arcadia_session';

export type AppEnv = {
  Variables: {
    user: AuthUser | null;
  };
};

/** Reads the session token (cookie for browsers, Bearer header for the native
 * app) and attaches the user — or null — to the request context. */
export const sessionMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const bearer = c.req.header('Authorization');
  const token =
    getCookie(c, SESSION_COOKIE) ??
    (bearer?.startsWith('Bearer ') ? bearer.slice('Bearer '.length) : undefined);

  c.set('user', token ? await getUserForToken(token) : null);
  await next();
};

/** Gate for routes that need a signed-in user. */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get('user')) {
    return c.json({ error: 'Authentication required' }, 401);
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
