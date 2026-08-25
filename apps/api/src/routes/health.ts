import { Hono } from 'hono';
import { query } from '../db/pool';

export const healthRoutes = new Hono();

/** Readiness: verifies the database, so the platform stops routing traffic
 * to an instance whose Postgres connection died. */
healthRoutes.get('/', async (c) => {
  try {
    await Promise.race([
      query('SELECT 1'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3_000)),
    ]);
  } catch {
    return c.json({ status: 'degraded', service: 'arcadia-api', db: 'unreachable' }, 503);
  }
  return c.json({ status: 'ok', service: 'arcadia-api', time: new Date().toISOString() });
});
