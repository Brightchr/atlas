import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../app';
import { runMigrations } from '../db/migrations';
import { pool } from '../db/pool';

/** Integration tests for the sync log — they run against the local Postgres
 * (docker-compose db) through the real Hono app, no port binding needed.
 * Each run registers a throwaway user and removes it afterwards. */

const email = `synctest-${Date.now()}@test.dev`;
let token = '';

interface Change {
  entity: string;
  rowId: string;
  payload: Record<string, unknown> | null;
  deleted: boolean;
  changedAt: string;
}

function req(path: string, init?: RequestInit) {
  return app.request(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
}

function push(deviceId: string, changes: Change[]) {
  return req('/v1/sync/push', { method: 'POST', body: JSON.stringify({ deviceId, changes }) });
}

async function pull(deviceId: string, since = '0') {
  const res = await req(`/v1/sync/pull?since=${since}&deviceId=${deviceId}`);
  expect(res.status).toBe(200);
  return (await res.json()) as { changes: Change[]; cursor: string; hasMore: boolean };
}

const upsert = (
  entity: string,
  rowId: string,
  payload: Record<string, unknown>,
  changedAt = new Date().toISOString(),
): Change => ({ entity, rowId, payload: { id: rowId, ...payload }, deleted: false, changedAt });

beforeAll(async () => {
  await runMigrations();
  const res = await app.request('/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, username: `sync${Date.now()}`, password: 'testpass1234' }),
  });
  expect(res.status).toBe(201);
  token = ((await res.json()) as { token: string }).token;
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email = $1', [email]);
  await pool.end();
});

describe('sync push/pull', () => {
  it('rejects unauthenticated pushes', async () => {
    const res = await app.request('/v1/sync/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: 'x', changes: [] }),
    });
    expect(res.status).toBe(401);
  });

  it('round-trips a change and never echoes it to its own device', async () => {
    const res = await push('device-a', [upsert('foods', 'food-1', { name: 'Oats', kcal: 380 })]);
    expect(res.status).toBe(200);

    const asOther = await pull('device-b');
    const mine = asOther.changes.find((c) => c.rowId === 'food-1');
    expect(mine?.payload?.name).toBe('Oats');

    const asSelf = await pull('device-a');
    expect(asSelf.changes.find((c) => c.rowId === 'food-1')).toBeUndefined();
    // ...but the cursor still advances past own rows (no permanent re-scan).
    expect(Number(asSelf.cursor)).toBeGreaterThan(0);
  });

  it('resolves conflicts by last write wins, not arrival order', async () => {
    const newer = new Date().toISOString();
    const older = new Date(Date.now() - 60_000).toISOString();
    await push('device-a', [upsert('foods', 'food-lww', { name: 'Fresh edit' }, newer)]);
    // The stale offline edit arrives later — it must lose.
    await push('device-b', [upsert('foods', 'food-lww', { name: 'Stale edit' }, older)]);

    const seen = await pull('device-c');
    const row = seen.changes.find((c) => c.rowId === 'food-lww');
    expect(row?.payload?.name).toBe('Fresh edit');
  });

  it('clamps timestamps from clocks running ahead', async () => {
    const farFuture = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await push('device-a', [upsert('foods', 'food-clock', { name: 'Time traveler' }, farFuture)]);

    const seen = await pull('device-b');
    const row = seen.changes.find((c) => c.rowId === 'food-clock');
    expect(row).toBeDefined();
    expect(Date.parse(row!.changedAt)).toBeLessThanOrEqual(Date.now() + 5 * 60 * 1000);
  });

  it('propagates deletes as tombstones', async () => {
    await push('device-a', [upsert('foods', 'food-del', { name: 'Doomed' })]);
    await push('device-a', [
      { entity: 'foods', rowId: 'food-del', payload: null, deleted: true, changedAt: new Date().toISOString() },
    ]);
    const seen = await pull('device-b');
    const row = seen.changes.find((c) => c.rowId === 'food-del');
    expect(row?.deleted).toBe(true);
    expect(row?.payload).toBeNull();
  });

  it('merges same-name shopping items from different devices', async () => {
    await push('device-a', [
      upsert('shopping_items', 'shop-a', { name: 'Bananas', quantity: '300 g', status: 'needed' }),
    ]);
    await push('device-b', [
      upsert('shopping_items', 'shop-b', { name: 'bananas ', quantity: '200 g', status: 'needed' }),
    ]);

    const seen = await pull('device-c');
    const bananas = seen.changes.filter((c) => c.entity === 'shopping_items');
    const kept = bananas.filter((c) => !c.deleted);
    const gone = bananas.filter((c) => c.deleted);
    expect(kept).toHaveLength(1);
    expect(kept[0]!.rowId).toBe('shop-a'); // deterministic keeper: smallest id
    expect(kept[0]!.payload?.quantity).toBe('500 g');
    expect(gone.map((c) => c.rowId)).toContain('shop-b');

    // Server-authored rows reach BOTH originating devices too.
    const asA = await pull('device-a');
    expect(asA.changes.find((c) => c.rowId === 'shop-a')?.payload?.quantity).toBe('500 g');
  });

  it('rejects malformed payloads and oversized batches', async () => {
    const nested = await push('device-a', [
      upsert('foods', 'food-bad', { name: { nested: true } as unknown as string }),
    ]);
    expect(nested.status).toBe(400);

    const mismatched = await push('device-a', [
      { entity: 'foods', rowId: 'row-x', payload: { id: 'row-y' }, deleted: false, changedAt: new Date().toISOString() },
    ]);
    expect(mismatched.status).toBe(400);

    const tooMany = await push(
      'device-a',
      Array.from({ length: 401 }, (_, i) => upsert('foods', `bulk-${i}`, { name: 'x' })),
    );
    expect(tooMany.status).toBe(413);
  });

  it('erases the server copy on request', async () => {
    const res = await req('/v1/sync/data', { method: 'DELETE' });
    expect(res.status).toBe(200);
    const seen = await pull('device-b');
    expect(seen.changes).toHaveLength(0);
  });
});
