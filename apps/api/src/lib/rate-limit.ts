import type { MiddlewareHandler } from 'hono';

/** Minimal in-memory sliding-window rate limiter, keyed by IP + route. Good
 * enough for a single instance; swap the store for Redis when the API scales
 * past one process. Applied to auth endpoints to slow credential stuffing. */
export function rateLimit(options: { windowMs: number; max: number }): MiddlewareHandler {
  const hits = new Map<string, number[]>();

  return async (c, next) => {
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      c.req.header('x-real-ip') ??
      'unknown';
    const key = `${ip}:${c.req.path}`;
    const now = Date.now();
    const windowStart = now - options.windowMs;

    const timestamps = (hits.get(key) ?? []).filter((t) => t > windowStart);
    if (timestamps.length >= options.max) {
      return c.json({ error: 'Too many attempts — try again later' }, 429);
    }
    timestamps.push(now);
    hits.set(key, timestamps);
    await next();
  };
}
