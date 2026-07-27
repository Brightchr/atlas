import pg from 'pg';
import { env } from '../lib/env';

/** Single connection pool for the whole process. Always use parameterized
 * queries ($1, $2, …) — never interpolate values into SQL strings. */
export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  max: 10,
});

export async function query<T extends pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await pool.query<T>(text, params);
  return result.rows;
}
