import { Hono } from 'hono';
import { query } from '../db/pool';
import { requireAuth, type AppEnv } from '../middleware/auth';

/** Shared workout plans. Devices publish a plan as one JSON payload (days +
 * embedded workout definitions); other users browse public ones and import
 * the payload into their local database. 'friends' visibility is accepted but
 * resolves to owner-only until the friends system exists. */

const VISIBILITIES = new Set(['private', 'friends', 'public']);
const MAX_PAYLOAD_BYTES = 200_000;

export const planRoutes = new Hono<AppEnv>();

planRoutes.use('*', requireAuth);

interface SummaryRow {
  id: string;
  name: string;
  description: string;
  visibility: string;
  owner_user_id: string;
  username: string;
  updated_at: string;
}

/** Public plans plus everything the caller shared themselves. */
planRoutes.get('/', async (c) => {
  const user = c.get('user')!;
  const rows = await query<SummaryRow>(
    `SELECT p.id, p.name, p.description, p.visibility, p.owner_user_id, u.username, p.updated_at
       FROM shared_plans p
       JOIN users u ON u.id = p.owner_user_id
      WHERE p.visibility = 'public' OR p.owner_user_id = $1
      ORDER BY p.updated_at DESC
      LIMIT 100`,
    [user.id],
  );
  return c.json({
    plans: rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      visibility: r.visibility,
      owner: r.username,
      mine: r.owner_user_id === user.id,
      updatedAt: r.updated_at,
    })),
  });
});

planRoutes.get('/:id', async (c) => {
  const user = c.get('user')!;
  const rows = await query<SummaryRow & { payload: unknown }>(
    `SELECT p.*, u.username FROM shared_plans p JOIN users u ON u.id = p.owner_user_id
      WHERE p.id = $1 AND (p.visibility = 'public' OR p.owner_user_id = $2)`,
    [c.req.param('id'), user.id],
  );
  const row = rows[0];
  if (!row) return c.json({ error: 'Plan not found' }, 404);
  return c.json({
    id: row.id,
    name: row.name,
    description: row.description,
    visibility: row.visibility,
    owner: row.username,
    mine: row.owner_user_id === user.id,
    payload: row.payload,
  });
});

/** Publish (or republish) a local plan. Idempotent per (owner, local plan). */
planRoutes.put('/', async (c) => {
  const user = c.get('user')!;
  const body = (await c.req.json().catch(() => null)) as {
    localPlanId?: string;
    name?: string;
    description?: string;
    visibility?: string;
    payload?: unknown;
  } | null;

  const name = body?.name?.trim();
  const localPlanId = body?.localPlanId?.trim();
  const visibility = body?.visibility ?? 'private';
  if (!body || !name || !localPlanId || !body.payload) {
    return c.json({ error: 'localPlanId, name and payload are required' }, 400);
  }
  if (name.length > 120) return c.json({ error: 'Name too long' }, 400);
  if (!VISIBILITIES.has(visibility)) return c.json({ error: 'Invalid visibility' }, 400);
  const payloadJson = JSON.stringify(body.payload);
  if (payloadJson.length > MAX_PAYLOAD_BYTES) return c.json({ error: 'Plan too large' }, 413);

  const rows = await query<{ id: string }>(
    `INSERT INTO shared_plans (owner_user_id, local_plan_id, name, description, visibility, payload)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     ON CONFLICT (owner_user_id, local_plan_id)
     DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description,
                   visibility = EXCLUDED.visibility, payload = EXCLUDED.payload,
                   updated_at = now()
     RETURNING id`,
    [user.id, localPlanId, name, body.description?.trim() ?? '', visibility, payloadJson],
  );
  return c.json({ id: rows[0]!.id });
});

/** Unshare by the device-local plan id (what the client actually knows). */
planRoutes.delete('/local/:localPlanId', async (c) => {
  const user = c.get('user')!;
  await query('DELETE FROM shared_plans WHERE local_plan_id = $1 AND owner_user_id = $2', [
    c.req.param('localPlanId'),
    user.id,
  ]);
  return c.json({ ok: true });
});

planRoutes.delete('/:id', async (c) => {
  const user = c.get('user')!;
  await query('DELETE FROM shared_plans WHERE id = $1 AND owner_user_id = $2', [
    c.req.param('id'),
    user.id,
  ]);
  return c.json({ ok: true });
});
