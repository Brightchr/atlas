import type { Context, MiddlewareHandler } from 'hono';
import { env } from './env';
import type { AppEnv } from '../middleware/auth';

/** Minimal in-memory sliding-window rate limiter. Good enough for a single
 * instance; swap the store for Redis when the API scales past one process
 * (at N instances the effective limit is N× looser).
 *
 * IP extraction: trusted proxies (Railway edge, our nginx) APPEND to
 * x-forwarded-for, so entries from the right are proxy-added and the
 * leftmost values are client-controlled garbage. Taking the leftmost — the
 * common mistake — lets a client mint fresh "IPs" per request and walk past
 * every limit, including the login brute-force guard. Walking from the
 * right, private/internal addresses are our own hops (nginx reaches the API
 * over the private network); the first PUBLIC address from the right is the
 * nearest untrusted client. */
const PRIVATE_IP =
  /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|::1$|fc|fd|fe80|::ffff:(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.))/i;

export function clientIp(c: Context): string {
  // Behind Cloudflare, every request's XFF ends in a Cloudflare edge address
  // (public — the walk below would stop there and rate-limit/ban the edge).
  // CF-Connecting-IP is the actual client; trusted only when the operator
  // says Cloudflare fronts the origin, because anyone can send the header.
  if (env.trustCfProxy) {
    const cf = c.req.header('cf-connecting-ip');
    if (cf) return cf.trim();
  }
  const xff = c.req.header('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',').map((p) => p.trim()).filter(Boolean);
    for (let i = parts.length - 1; i >= 0; i--) {
      if (!PRIVATE_IP.test(parts[i]!)) return parts[i]!;
    }
    // All private: direct LAN/dev traffic — the rightmost is the real peer.
    if (parts.length > 0) return parts[parts.length - 1]!;
  }
  return c.req.header('x-real-ip') ?? 'unknown';
}

interface RateLimitOptions {
  windowMs: number;
  max: number;
  /** 'ip' (default) for pre-auth routes; 'user' keys on the signed-in user id
   * (falling back to IP) — the right axis for authenticated abuse. */
  by?: 'ip' | 'user';
}

export function rateLimit(options: RateLimitOptions): MiddlewareHandler<AppEnv> {
  const hits = new Map<string, number[]>();

  // Entries whose newest timestamp fell out of the window are dead weight —
  // without a sweep, unique keys (e.g. rotating IPs) accumulate forever.
  const SWEEP_MS = 10 * 60 * 1000;
  setInterval(() => {
    const cutoff = Date.now() - options.windowMs;
    for (const [key, timestamps] of hits) {
      if ((timestamps[timestamps.length - 1] ?? 0) <= cutoff) hits.delete(key);
    }
  }, SWEEP_MS).unref?.();

  return async (c, next) => {
    const subject =
      options.by === 'user' ? (c.get('user')?.id ?? clientIp(c)) : clientIp(c);
    const key = `${subject}:${c.req.path}`;
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
