import pg from 'pg';
import { env } from '../lib/env';

/** Single connection pool for the whole process. Always use parameterized
 * queries ($1, $2, …) — never interpolate values into SQL strings.
 *
 * Sizing: instances × max (10) + one migration connection must stay under
 * the Postgres plan's connection limit. TLS: Railway's internal hostname is
 * a private network (no TLS needed); any OTHER production host gets TLS so
 * credentials never cross the public internet in plaintext. */
export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  max: 10,
  // Fail fast when the pool is saturated instead of queueing forever.
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
  ssl:
    env.isProd &&
    !env.databaseUrl.includes('railway.internal') &&
    !env.databaseUrl.includes('sslmode=')
      ? { rejectUnauthorized: false }
      : undefined,
});

export async function query<T extends pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await pool.query<T>(text, params);
  return result.rows;
}
