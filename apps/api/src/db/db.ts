import { drizzle } from 'drizzle-orm/node-postgres';
import { pool } from './pool';
import * as schema from './schema';

/** The Drizzle client, wrapping the app's single pg pool — same connections,
 * same limits, same TLS posture as before the ORM. Raw SQL stays available
 * through db.execute(sql\`...\`) for the few queries Drizzle can't express
 * (xmax-based upsert detection, GREATEST entitlement math). The migration
 * runner deliberately keeps using the bare pool. */
export const db = drizzle(pool, { schema });
