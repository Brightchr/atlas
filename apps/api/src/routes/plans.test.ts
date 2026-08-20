import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../app';
import { runMigrations } from '../db/migrations';
import { pool } from '../db/pool';

/** Integration tests for plan social features (tags, reviews, direct shares)
 * and profiles/password change. Two throwaway users, removed afterwards. */

const stamp = Date.now();
const users = {
  owner: { email: `plantest-a-${stamp}@test.dev`, username: `plana${stamp}`, token: '' },
  viewer: { email: `plantest-b-${stamp}@test.dev`, username: `planb${stamp}`, token: '' },
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

const payload = { name: 'Test plan', description: '', days: [] };

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
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`plantest-%-${stamp}@test.dev`]);
  await pool.end();
});

async function publish(visibility: string, localPlanId: string, extra: object = {}) {
  const res = await req('/v1/plans', users.owner.token, {
    method: 'PUT',
    body: JSON.stringify({
      localPlanId,
      name: `Plan ${localPlanId}`,
      visibility,
      difficulty: 'beginner',
      goal: 'build_muscle',
      diet: 'high_protein',
      payload,
      ...extra,
    }),
  });
  expect(res.status).toBe(200);
  return ((await res.json()) as { id: string }).id;
}

describe('plan tags, reviews and shares', () => {
  it('publishes with tags and lists them with rating aggregates', async () => {
    await publish('public', 'local-1');
    const res = await req('/v1/plans', users.viewer.token);
    const { plans } = (await res.json()) as { plans: Record<string, unknown>[] };
    const plan = plans.find((p) => p.name === 'Plan local-1');
    expect(plan).toMatchObject({
      difficulty: 'beginner',
      goal: 'build_muscle',
      diet: 'high_protein',
      rating: null,
      reviewCount: 0,
    });
  });

  it('rejects invalid tags', async () => {
    const res = await req('/v1/plans', users.owner.token, {
      method: 'PUT',
      body: JSON.stringify({ localPlanId: 'x', name: 'X', payload, difficulty: 'insane' }),
    });
    expect(res.status).toBe(400);
  });

  it('accepts reviews from viewers but not the owner, and aggregates ratings', async () => {
    const id = await publish('public', 'local-2');

    const own = await req(`/v1/plans/${id}/reviews`, users.owner.token, {
      method: 'POST',
      body: JSON.stringify({ rating: 5 }),
    });
    expect(own.status).toBe(400);

    const review = await req(`/v1/plans/${id}/reviews`, users.viewer.token, {
      method: 'POST',
      body: JSON.stringify({ rating: 4, comment: 'Solid beginner plan' }),
    });
    expect(review.status).toBe(200);

    // Re-reviewing updates instead of duplicating.
    await req(`/v1/plans/${id}/reviews`, users.viewer.token, {
      method: 'POST',
      body: JSON.stringify({ rating: 5, comment: 'Even better on week two' }),
    });

    const list = await req(`/v1/plans/${id}/reviews`, users.owner.token);
    const { reviews } = (await list.json()) as { reviews: { rating: number; author: string }[] };
    expect(reviews).toHaveLength(1);
    expect(reviews[0]!.rating).toBe(5);

    const summary = await req(`/v1/plans/${id}`, users.viewer.token);
    expect(((await summary.json()) as { rating: number }).rating).toBe(5);
  });

  it('hides private plans until directly shared, then grants view access', async () => {
    const id = await publish('private', 'local-3');

    const before = await req(`/v1/plans/${id}`, users.viewer.token);
    expect(before.status).toBe(404);

    const share = await req(`/v1/plans/${id}/share`, users.owner.token, {
      method: 'POST',
      body: JSON.stringify({ username: users.viewer.username.toUpperCase() }),
    });
    expect(share.status).toBe(200);

    const after = await req(`/v1/plans/${id}`, users.viewer.token);
    expect(after.status).toBe(200);
    expect(((await after.json()) as { sharedToMe: boolean }).sharedToMe).toBe(true);

    // The recipient got an in-app notification about it.
    const notif = await req('/v1/notifications', users.viewer.token);
    const { notifications } = (await notif.json()) as { notifications: { type: string }[] };
    expect(notifications.some((n) => n.type === 'plan_shared')).toBe(true);
  });

  it('rejects sharing to unknown users and to yourself', async () => {
    const id = await publish('private', 'local-4');
    const nobody = await req(`/v1/plans/${id}/share`, users.owner.token, {
      method: 'POST',
      body: JSON.stringify({ username: 'does-not-exist-xyz' }),
    });
    expect(nobody.status).toBe(404);
    const self = await req(`/v1/plans/${id}/share`, users.owner.token, {
      method: 'POST',
      body: JSON.stringify({ username: users.owner.username }),
    });
    expect(self.status).toBe(400);
  });
});

describe('profiles', () => {
  it('updates own profile and serves it publicly with published plans', async () => {
    const patch = await req('/v1/profiles/me', users.owner.token, {
      method: 'PATCH',
      body: JSON.stringify({ displayName: 'Coach A', bio: 'I lift things up.' }),
    });
    expect(patch.status).toBe(200);

    const pub = await req(`/v1/profiles/${users.owner.username}`, users.viewer.token);
    expect(pub.status).toBe(200);
    const profile = (await pub.json()) as {
      displayName: string;
      bio: string;
      plans: { name: string }[];
    };
    expect(profile.displayName).toBe('Coach A');
    expect(profile.plans.some((p) => p.name === 'Plan local-1')).toBe(true);
    // Private plans never appear on a public profile.
    expect(profile.plans.some((p) => p.name === 'Plan local-3')).toBe(false);
  });
});

describe('password change', () => {
  it('requires the current password, then invalidates it', async () => {
    const wrong = await req('/v1/auth/change-password', users.viewer.token, {
      method: 'POST',
      body: JSON.stringify({ currentPassword: 'not-it', newPassword: 'newpass12345' }),
    });
    expect(wrong.status).toBe(401);

    const right = await req('/v1/auth/change-password', users.viewer.token, {
      method: 'POST',
      body: JSON.stringify({ currentPassword: 'testpass1234', newPassword: 'newpass12345' }),
    });
    expect(right.status).toBe(200);

    const oldLogin = await app.request('/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: users.viewer.email, password: 'testpass1234' }),
    });
    expect(oldLogin.status).toBe(401);

    const newLogin = await app.request('/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: users.viewer.email, password: 'newpass12345' }),
    });
    expect(newLogin.status).toBe(200);
  });
});
