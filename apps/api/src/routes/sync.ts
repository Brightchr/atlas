import { Hono } from 'hono';
import { pool, query } from '../db/pool';
import { rateLimit } from '../lib/rate-limit';
import { requireActiveMember, requireAuth, type AppEnv } from '../middleware/auth';

/** Device sync. Each user's devices push local changes and pull everyone
 * else's (i.e. their other devices'), ordered by a per-user cursor. The
 * server is a dumb replica log: it stores whole rows as JSON and resolves
 * concurrent edits by last-write-wins on the client's changed_at — it never
 * needs to understand what a diary entry or shopping item is. */

const MAX_CHANGES_PER_PUSH = 400;
const MAX_PAYLOAD_BYTES = 16_000;
const PULL_PAGE_SIZE = 300;
// The entity allowlist: exactly the client tables that sync (keep in step
// with SYNCED_TABLES / EXTRA_SYNC_TABLES / TRAINING_SYNC_TABLES in
// apps/web/src/lib/db/schema.ts). An open pattern here would let any account
// fill the log under arbitrary keys forever.
const ALLOWED_ENTITIES = new Set([
  'foods',
  'diary_entries',
  'recipes',
  'recipe_ingredients',
  'meal_plan_items',
  'shopping_items',
  'body_weight_logs',
  'goals',
  'settings',
  'workouts',
  'workout_exercises',
  'training_plans',
  'training_plan_days',
  'workout_sessions',
  'logged_sets',
]);
// Storage quota: a generous ceiling for real usage (years of daily logging
// sits far below it), a hard wall for abuse.
const MAX_ROWS_PER_USER = 200_000;
// A device clock ahead of the server would win every last-write-wins conflict
// forever. Timestamps further ahead than this are clamped to server time.
const MAX_CLOCK_SKEW_MS = 2 * 60 * 1000;

export const syncRoutes = new Hono<AppEnv>();

syncRoutes.use('*', requireAuth);
syncRoutes.use('*', requireActiveMember);
// Sync is chatty by design (bursts after offline periods); the cap exists to
// stop a runaway client loop, not to throttle normal use.
syncRoutes.use('*', rateLimit({ windowMs: 60 * 1000, max: 120 }));

interface PushChange {
  entity?: string;
  rowId?: string;
  payload?: Record<string, unknown> | null;
  deleted?: boolean;
  changedAt?: string;
}

/** "300 g" + "200 g" → "500 g" (mirrors the client's addNeededItem merge);
 * anything unparseable joins with " + " so nothing is silently dropped. */
function mergeQuantities(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  const grams = /^(\d+(?:\.\d+)?)\s*g$/i;
  const ma = grams.exec(a.trim());
  const mb = grams.exec(b.trim());
  if (ma?.[1] && mb?.[1]) return `${Math.round((Number(ma[1]) + Number(mb[1])) * 10) / 10} g`;
  return `${a} + ${b}`;
}

/** Two devices adding "Bananas" offline create two rows LWW can never
 * reconcile (different row ids). The server is the only place that sees both,
 * so it merges: quantities fold into the row with the smallest id (a
 * deterministic keeper), the rest become tombstones, and the rewritten rows
 * are attributed to device 'server' so every device converges on them. */
async function mergeDuplicateShoppingItems(
  client: { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }> },
  userId: string,
): Promise<void> {
  const { rows } = (await client.query(
    `SELECT row_id, payload FROM sync_rows
      WHERE user_id = $1 AND entity = 'shopping_items' AND deleted = false
        AND payload->>'status' = 'needed'`,
    [userId],
  )) as { rows: { row_id: string; payload: Record<string, unknown> }[] };

  const groups = new Map<string, { row_id: string; payload: Record<string, unknown> }[]>();
  for (const r of rows) {
    const name = String(r.payload.name ?? '').trim().toLowerCase();
    if (!name) continue;
    const list = groups.get(name) ?? [];
    list.push(r);
    groups.set(name, list);
  }

  for (const list of groups.values()) {
    if (list.length < 2) continue;
    list.sort((x, y) => (x.row_id < y.row_id ? -1 : 1));
    const keeper = list[0]!;
    let quantity = (keeper.payload.quantity as string | null) ?? null;
    for (const dup of list.slice(1)) {
      quantity = mergeQuantities(quantity, (dup.payload.quantity as string | null) ?? null);
    }
    const mergedPayload = { ...keeper.payload, quantity };
    await client.query(
      `UPDATE sync_rows
          SET payload = $1::jsonb, changed_at = now(), device_id = 'server',
              seq = nextval('sync_rows_seq')
        WHERE user_id = $2 AND entity = 'shopping_items' AND row_id = $3`,
      [JSON.stringify(mergedPayload), userId, keeper.row_id],
    );
    for (const dup of list.slice(1)) {
      await client.query(
        `UPDATE sync_rows
            SET payload = NULL, deleted = true, changed_at = now(), device_id = 'server',
                seq = nextval('sync_rows_seq')
          WHERE user_id = $1 AND entity = 'shopping_items' AND row_id = $2`,
        [userId, dup.row_id],
      );
    }
  }
}

/** Accept a batch of changes from one device. Last-write-wins: an incoming
 * change only replaces the stored row when its changed_at is not older. */
syncRoutes.post('/push', async (c) => {
  const user = c.get('user')!;
  const body = (await c.req.json().catch(() => null)) as {
    deviceId?: string;
    changes?: PushChange[];
  } | null;

  const deviceId = body?.deviceId?.trim();
  if (!body || !deviceId || deviceId.length > 64 || !Array.isArray(body.changes)) {
    return c.json({ error: 'deviceId and changes are required' }, 400);
  }
  if (body.changes.length > MAX_CHANGES_PER_PUSH) {
    return c.json({ error: `At most ${MAX_CHANGES_PER_PUSH} changes per push` }, 413);
  }

  const now = Date.now();
  for (const ch of body.changes) {
    if (!ch.entity || !ALLOWED_ENTITIES.has(ch.entity)) {
      return c.json({ error: 'Invalid entity' }, 400);
    }
    if (!ch.rowId || ch.rowId.length > 128) return c.json({ error: 'Invalid rowId' }, 400);
    const changedAtMs = ch.changedAt ? Date.parse(ch.changedAt) : NaN;
    if (Number.isNaN(changedAtMs)) return c.json({ error: 'Invalid changedAt' }, 400);
    // Clamp clocks running ahead: the server is the authority on "now".
    if (changedAtMs > now + MAX_CLOCK_SKEW_MS) ch.changedAt = new Date(now).toISOString();
    if (!ch.deleted) {
      if (typeof ch.payload !== 'object' || ch.payload === null || Array.isArray(ch.payload)) {
        return c.json({ error: 'Upserts need a payload object' }, 400);
      }
      // Payloads are flat rows: primitive values only, and the embedded id
      // (when present) must agree with the addressed row.
      for (const v of Object.values(ch.payload)) {
        if (v !== null && !['string', 'number', 'boolean'].includes(typeof v)) {
          return c.json({ error: 'Payload values must be primitives' }, 400);
        }
      }
      if ('id' in ch.payload && ch.payload.id !== ch.rowId) {
        return c.json({ error: 'payload.id must match rowId' }, 400);
      }
      if (JSON.stringify(ch.payload).length > MAX_PAYLOAD_BYTES) {
        return c.json({ error: 'Payload too large' }, 413);
      }
    }
  }

  // Quota gate — an index-only count on (user_id, seq). Upserts of existing
  // rows don't grow the table, so only block once the ceiling is truly hit.
  const countRows = await query<{ n: string }>(
    'SELECT count(*) AS n FROM sync_rows WHERE user_id = $1',
    [user.id],
  );
  if (Number(countRows[0]!.n) >= MAX_ROWS_PER_USER) {
    return c.json({ error: 'Sync storage quota exceeded' }, 403);
  }

  // One transaction per batch: a push is all-or-nothing, so the client can
  // safely clear its pending set on success.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const ch of body.changes) {
      await client.query(
        `INSERT INTO sync_rows (user_id, entity, row_id, payload, deleted, changed_at, device_id)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
         ON CONFLICT (user_id, entity, row_id) DO UPDATE
           SET payload = EXCLUDED.payload, deleted = EXCLUDED.deleted,
               changed_at = EXCLUDED.changed_at, device_id = EXCLUDED.device_id,
               seq = nextval('sync_rows_seq')
         WHERE sync_rows.changed_at <= EXCLUDED.changed_at`,
        [
          user.id,
          ch.entity,
          ch.rowId,
          ch.deleted ? null : JSON.stringify(ch.payload),
          ch.deleted === true,
          ch.changedAt,
          deviceId,
        ],
      );
    }
    if (body.changes.some((ch) => ch.entity === 'shopping_items' && !ch.deleted)) {
      await mergeDuplicateShoppingItems(client, user.id);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const rows = await query<{ cursor: string }>(
    'SELECT COALESCE(MAX(seq), 0)::text AS cursor FROM sync_rows WHERE user_id = $1',
    [user.id],
  );
  return c.json({ accepted: body.changes.length, cursor: rows[0]!.cursor });
});

/** Page through this user's log from a cursor. The scan includes the calling
 * device's own rows so the cursor always advances past them (no re-scanning),
 * but they're filtered out of the response — a device never re-downloads what
 * it pushed. */
syncRoutes.get('/pull', async (c) => {
  const user = c.get('user')!;
  const deviceId = c.req.query('deviceId')?.trim();
  const since = c.req.query('since') ?? '0';
  if (!deviceId || deviceId.length > 64) return c.json({ error: 'deviceId is required' }, 400);
  if (!/^\d{1,19}$/.test(since)) return c.json({ error: 'Invalid cursor' }, 400);

  const rows = await query<{
    entity: string;
    row_id: string;
    payload: Record<string, unknown> | null;
    deleted: boolean;
    changed_at: string;
    device_id: string;
    seq: string;
  }>(
    `SELECT entity, row_id, payload, deleted, changed_at, device_id, seq::text
       FROM sync_rows
      WHERE user_id = $1 AND seq > $2
      ORDER BY seq ASC
      LIMIT ${PULL_PAGE_SIZE}`,
    [user.id, since],
  );

  const last = rows[rows.length - 1];
  return c.json({
    changes: rows
      .filter((r) => r.device_id !== deviceId)
      .map((r) => ({
        entity: r.entity,
        rowId: r.row_id,
        payload: r.payload,
        deleted: r.deleted,
        changedAt: r.changed_at,
      })),
    cursor: last ? last.seq : since,
    hasMore: rows.length === PULL_PAGE_SIZE,
  });
});

/** Erase the server copy — offered when a user switches to local-only for
 * privacy. Their devices keep their local databases untouched. */
syncRoutes.delete('/data', async (c) => {
  const user = c.get('user')!;
  await query('DELETE FROM sync_rows WHERE user_id = $1', [user.id]);
  return c.json({ ok: true });
});
