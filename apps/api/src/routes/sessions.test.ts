import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../app';
import { runMigrations } from '../db/migrations';
import { pool } from '../db/pool';

/** Integration tests for shared workouts: who sees what, upsert semantics,
 * and payload validation. Three throwaway users — A and B become friends,
 * C is a stranger — removed afterwards. */

const stamp = Date.now();
const users = {
  a: { email: `sesstest-a-${stamp}@test.dev`, username: `sessa${stamp}`, token: '' },
  b: { email: `sesstest-b-${stamp}@test.dev`, username: `sessb${stamp}`, token: '' },
  c: { email: `sesstest-c-${stamp}@test.dev`, username: `sessc${stamp}`, token: '' },
};

function req(path: string, token: string, init?: RequestInit) {
  return app.request(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
}

const payload = {
  exercises: [
    {
      name: 'Squat',
      sets: [
        { reps: 5, weightKg: 100, durationSec: null },
        { reps: 5, weightKg: 100, durationSec: null },
      ],
    },
    { name: 'Plank', sets: [{ reps: null, weightKg: null, durationSec: 60 }] },
  ],
  // Deliberately wrong: the server must recompute these.
  totals: { sets: 99, volumeKg: 999_999 },
};

async function share(localSessionId: string, visibility: string, extra: object = {}) {
  return req('/v1/sessions/shared', users.a.token, {
    method: 'PUT',
    body: JSON.stringify({
      localSessionId,
      name: `Session ${localSessionId}`,
      performedAt: new Date().toISOString(),
      durationSec: 3600,
      visibility,
      payload,
      ...extra,
    }),
  });
}

async function feedNames(token: string): Promise<string[]> {
  const res = await req('/v1/sessions/feed', token);
  expect(res.status).toBe(200);
  const { sessions } = (await res.json()) as { sessions: { name: string }[] };
  return sessions.map((s) => s.name);
}

beforeAll(async () => {
  await runMigrations();
  for (const u of Object.values(users)) {
    const res = await app.request('/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: u.email, username: u.username, password: 'testpass1234' }),
    });
    expect(res.status).toBe(201);
    u.token = ((await res.json()) as { token: string }).token;
  }
  // A ↔ B become friends (request then accept via the "request back" path).
  let res = await req('/v1/friends/requests', users.a.token, {
    method: 'POST',
    body: JSON.stringify({ username: users.b.username }),
  });
  expect(res.status).toBe(200);
  res = await req('/v1/friends/requests', users.b.token, {
    method: 'POST',
    body: JSON.stringify({ username: users.a.username }),
  });
  expect(res.status).toBe(200);
  expect(((await res.json()) as { accepted: boolean }).accepted).toBe(true);
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`sesstest-%-${stamp}@test.dev`]);
  await pool.end();
});

describe('shared workouts', () => {
  it('friends-only share: visible to the friend, hidden from a stranger', async () => {
    const res = await share('local-friends', 'friends');
    expect(res.status).toBe(200);
    const row = (await res.json()) as {
      id: string;
      payload: { totals: { sets: number; volumeKg: number } };
    };
    // Totals come from the sets, not the request.
    expect(row.payload.totals).toEqual({ sets: 3, volumeKg: 1000 });

    expect(await feedNames(users.b.token)).toContain('Session local-friends');
    expect(await feedNames(users.c.token)).not.toContain('Session local-friends');
    expect(await feedNames(users.a.token)).toContain('Session local-friends');

    expect((await req(`/v1/sessions/shared/${row.id}`, users.b.token)).status).toBe(200);
    expect((await req(`/v1/sessions/shared/${row.id}`, users.c.token)).status).toBe(404);
  });

  it('public share: on the profile for a stranger, fetchable by id', async () => {
    const res = await share('local-public', 'public');
    expect(res.status).toBe(200);
    const row = (await res.json()) as { id: string };

    const profile = await req(`/v1/profiles/${users.a.username}`, users.c.token);
    expect(profile.status).toBe(200);
    const { recentWorkouts } = (await profile.json()) as { recentWorkouts: { name: string }[] };
    expect(recentWorkouts.map((w) => w.name)).toContain('Session local-public');
    expect(recentWorkouts.map((w) => w.name)).not.toContain('Session local-friends');

    expect((await req(`/v1/sessions/shared/${row.id}`, users.c.token)).status).toBe(200);
    // The stranger's feed is still friends-only.
    expect(await feedNames(users.c.token)).not.toContain('Session local-public');
  });

  it('the friend sees friends-only shares on the profile too', async () => {
    const profile = await req(`/v1/profiles/${users.a.username}`, users.b.token);
    const { recentWorkouts } = (await profile.json()) as { recentWorkouts: { name: string }[] };
    expect(recentWorkouts.map((w) => w.name)).toEqual(
      expect.arrayContaining(['Session local-public', 'Session local-friends']),
    );
  });

  it('re-sharing the same session updates in place', async () => {
    const first = (await (await share('local-upsert', 'friends')).json()) as { id: string };
    const second = (await (await share('local-upsert', 'public', { name: 'Renamed' })).json()) as {
      id: string;
      name: string;
      visibility: string;
    };
    expect(second.id).toBe(first.id);
    expect(second.name).toBe('Renamed');
    expect(second.visibility).toBe('public');
    const rows = await pool.query(
      'SELECT COUNT(*)::int AS n FROM shared_sessions WHERE local_session_id = $1',
      ['local-upsert'],
    );
    expect(rows.rows[0].n).toBe(1);
  });

  it('unsharing removes it from the feed', async () => {
    await share('local-gone', 'friends');
    expect(await feedNames(users.b.token)).toContain('Session local-gone');
    const res = await req('/v1/sessions/shared/local-gone', users.a.token, { method: 'DELETE' });
    expect(res.status).toBe(204);
    expect(await feedNames(users.b.token)).not.toContain('Session local-gone');
  });

  it('rejects bad payloads and visibilities', async () => {
    const tooMany = {
      exercises: Array.from({ length: 41 }, (_, i) => ({ name: `E${i}`, sets: [] })),
      totals: { sets: 0, volumeKg: 0 },
    };
    expect((await share('bad-1', 'friends', { payload: tooMany })).status).toBe(400);
    expect((await share('bad-2', 'everyone')).status).toBe(400);
    expect((await share('bad-3', 'friends', { durationSec: -5 })).status).toBe(400);
    expect(
      (await share('bad-4', 'friends', { payload: { exercises: [{ name: '', sets: [] }] } }))
        .status,
    ).toBe(400);
    expect((await app.request('/v1/sessions/feed')).status).toBe(401);
  });
});
