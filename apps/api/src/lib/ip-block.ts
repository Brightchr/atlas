import type { MiddlewareHandler } from 'hono';
import { query } from '../db/pool';
import { clientIp } from './rate-limit';
import type { AppEnv } from '../middleware/auth';

/** The blocklist is tiny and hot (checked on every /v1 request), so it lives
 * in process memory and refreshes at most once a minute. Admin mutations call
 * invalidateIpBlockCache() so their own instance applies changes immediately;
 * other instances converge within the refresh window. */
const REFRESH_MS = 60_000;

let blocked = new Set<string>();
let loadedAt = 0;
let refreshing: Promise<void> | null = null;

async function refresh(): Promise<void> {
  const rows = await query<{ ip: string }>(
    'SELECT ip FROM ip_blocks WHERE expires_at IS NULL OR expires_at > now()',
  );
  blocked = new Set(rows.map((r) => r.ip));
  loadedAt = Date.now();
}

export function invalidateIpBlockCache(): void {
  loadedAt = 0;
}

export const ipBlockMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (Date.now() - loadedAt > REFRESH_MS) {
    refreshing ??= refresh().finally(() => {
      refreshing = null;
    });
    try {
      await refreshing;
    } catch {
      // DB hiccup: fail open with the last known list rather than taking the
      // whole API down; the next request retries the refresh.
    }
  }
  if (blocked.size > 0 && blocked.has(clientIp(c))) {
    return c.json({ error: 'Access blocked' }, 403);
  }
  await next();
};
