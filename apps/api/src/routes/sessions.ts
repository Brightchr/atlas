import { Hono } from 'hono';
import type { SharedSessionPayload, SharedSessionSummary } from '@arcadia/shared';
import { and, eq, sql, type SQL } from 'drizzle-orm';
import { db } from '../db/db';
import { sharedSessions } from '../db/schema';
import { rateLimit } from '../lib/rate-limit';
import { requireActiveMember, requireAuth, type AppEnv } from '../middleware/auth';
import { toFriendUser } from './social';

/** Shared workouts: a finished session published as one self-contained
 * snapshot. Friends-only rows are visible to accepted friends, public rows
 * to anyone signed in (and on the owner's public profile). The server never
 * reads device data for this — the client sends exactly what it wants seen. */

const MAX_EXERCISES = 40;
const MAX_SETS = 30;
const MAX_NAME = 120;
const MAX_NOTES = 1_000;
const MAX_FUTURE_MS = 24 * 60 * 60 * 1000;

export const sessionRoutes = new Hono<AppEnv>();

sessionRoutes.use('*', requireAuth);
sessionRoutes.use('*', requireActiveMember);
sessionRoutes.use('*', rateLimit({ windowMs: 60 * 1000, max: 120, by: 'user' }));

/** WHERE fragment: rows the viewer may see — own, public, or a friend's
 * friends-only share. The viewer id is bound as a parameter. */
const visibleTo = (viewerId: string): SQL => sql`(
  s.owner_user_id = ${viewerId}
  OR s.visibility = 'public'
  OR (s.visibility = 'friends' AND EXISTS (
        SELECT 1 FROM friendships f
         WHERE f.status = 'accepted'
           AND ((f.requester_id = s.owner_user_id AND f.addressee_id = ${viewerId})
             OR (f.addressee_id = s.owner_user_id AND f.requester_id = ${viewerId}))))
)`;

interface SummaryRow {
  id: string;
  localSessionId: string;
  name: string;
  performedAt: Date | string;
  durationSec: number;
  visibility: 'friends' | 'public';
  payload: SharedSessionPayload;
  createdAt: Date | string;
  updatedAt: Date | string;
  ownerId: string;
  username: string;
  displayName: string | null;
  profile: unknown;
}

/** Raw SQL: the visibility rule is a correlated EXISTS over friendships in
 * either direction. `tail` is everything after the join (WHERE/ORDER/LIMIT). */
async function selectSummaries(tail: SQL): Promise<SummaryRow[]> {
  const res = await db.execute(sql`
    SELECT s.id, s.local_session_id AS "localSessionId", s.name,
           s.performed_at AS "performedAt", s.duration_sec AS "durationSec", s.visibility,
           s.payload, s.created_at AS "createdAt", s.updated_at AS "updatedAt",
           u.id AS "ownerId", u.username, u.display_name AS "displayName", u.profile
      FROM shared_sessions s
      JOIN users u ON u.id = s.owner_user_id
    ${tail}`);
  return res.rows as unknown as SummaryRow[];
}

const iso = (v: Date | string): string => new Date(v).toISOString();

function toSummary(r: SummaryRow): SharedSessionSummary {
  return {
    id: r.id,
    localSessionId: r.localSessionId,
    owner: toFriendUser({
      id: r.ownerId,
      username: r.username,
      displayName: r.displayName,
      profile: r.profile,
    }),
    name: r.name,
    performedAt: iso(r.performedAt),
    durationSec: r.durationSec,
    visibility: r.visibility,
    payload: r.payload,
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function intOrNull(v: unknown, max: number): number | null | undefined {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > max) return undefined;
  return Math.round(v);
}

function numOrNull(v: unknown, max: number): number | null | undefined {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > max) return undefined;
  return Math.round(v * 100) / 100;
}

/** Strict shape check with clamps; totals are recomputed from the sets so a
 * client can't claim a 10-tonne session. Returns null when anything is off. */
function parsePayload(raw: unknown): SharedSessionPayload | null {
  if (!isRecord(raw) || !Array.isArray(raw.exercises)) return null;
  if (raw.exercises.length > MAX_EXERCISES) return null;
  const exercises: SharedSessionPayload['exercises'] = [];
  let totalSets = 0;
  let volume = 0;
  for (const e of raw.exercises) {
    if (!isRecord(e) || typeof e.name !== 'string') return null;
    const name = e.name.trim();
    if (name.length < 1 || name.length > MAX_NAME) return null;
    if (!Array.isArray(e.sets) || e.sets.length > MAX_SETS) return null;
    const sets: SharedSessionPayload['exercises'][number]['sets'] = [];
    for (const s of e.sets) {
      if (!isRecord(s)) return null;
      const reps = intOrNull(s.reps, 1_000);
      const weightKg = numOrNull(s.weightKg, 2_000);
      const durationSec = intOrNull(s.durationSec, 86_400);
      if (reps === undefined || weightKg === undefined || durationSec === undefined) return null;
      sets.push({ reps, weightKg, durationSec });
      totalSets += 1;
      volume += (weightKg ?? 0) * (reps ?? 0);
    }
    exercises.push({ name, sets });
  }
  const out: SharedSessionPayload = {
    exercises,
    totals: { sets: totalSets, volumeKg: Math.round(volume * 10) / 10 },
  };
  if (raw.notes !== undefined) {
    if (typeof raw.notes !== 'string' || raw.notes.length > MAX_NOTES) return null;
    if (raw.notes.trim()) out.notes = raw.notes.trim();
  }
  return out;
}

/** Share (or re-share) a finished session. Upsert on the device's id. */
sessionRoutes.put('/shared', async (c) => {
  const me = c.get('user')!;
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return c.json({ error: 'Invalid JSON' }, 400);

  const localSessionId = typeof body.localSessionId === 'string' ? body.localSessionId.trim() : '';
  if (!localSessionId || localSessionId.length > 64) {
    return c.json({ error: 'localSessionId required' }, 400);
  }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (name.length < 1 || name.length > MAX_NAME) return c.json({ error: 'Name required' }, 400);
  const performedAt = typeof body.performedAt === 'string' ? Date.parse(body.performedAt) : NaN;
  if (!Number.isFinite(performedAt) || performedAt > Date.now() + MAX_FUTURE_MS) {
    return c.json({ error: 'Invalid performedAt' }, 400);
  }
  const durationSec = intOrNull(body.durationSec, 86_400);
  if (durationSec === undefined || durationSec === null) {
    return c.json({ error: 'Invalid durationSec' }, 400);
  }
  if (body.visibility !== 'friends' && body.visibility !== 'public') {
    return c.json({ error: 'Invalid visibility' }, 400);
  }
  const payload = parsePayload(body.payload);
  if (!payload) return c.json({ error: 'Invalid payload' }, 400);

  const values = {
    name,
    performedAt: new Date(performedAt),
    durationSec,
    visibility: body.visibility as 'friends' | 'public',
    payload,
  };
  const rows = await db
    .insert(sharedSessions)
    .values({ ownerUserId: me.id, localSessionId, ...values })
    .onConflictDoUpdate({
      target: [sharedSessions.ownerUserId, sharedSessions.localSessionId],
      set: { ...values, updatedAt: sql`now()` },
    })
    .returning({ id: sharedSessions.id });
  const full = await selectSummaries(sql`WHERE s.id = ${rows[0]!.id}`);
  return c.json(toSummary(full[0]!));
});

sessionRoutes.delete('/shared/:localSessionId', async (c) => {
  const me = c.get('user')!;
  await db
    .delete(sharedSessions)
    .where(
      and(
        eq(sharedSessions.ownerUserId, me.id),
        eq(sharedSessions.localSessionId, c.req.param('localSessionId')),
      ),
    );
  return c.body(null, 204);
});

/** Own and friends' shared workouts, newest first. Public shares from
 * non-friends stay out — the feed is your people, not the whole site. */
sessionRoutes.get('/feed', async (c) => {
  const me = c.get('user')!;
  const limit = Math.min(100, Math.max(1, Number(c.req.query('limit')) || 50));
  const rows = await selectSummaries(sql`
      WHERE s.owner_user_id = ${me.id}
         OR EXISTS (
              SELECT 1 FROM friendships f
               WHERE f.status = 'accepted'
                 AND ((f.requester_id = s.owner_user_id AND f.addressee_id = ${me.id})
                   OR (f.addressee_id = s.owner_user_id AND f.requester_id = ${me.id})))
      ORDER BY s.performed_at DESC
      LIMIT ${limit}`);
  return c.json({ sessions: rows.map(toSummary) });
});

sessionRoutes.get('/shared/:id', async (c) => {
  const me = c.get('user')!;
  const rows = await selectSummaries(
    sql`WHERE s.id = ${c.req.param('id')} AND ${visibleTo(me.id)}`,
  ).catch(() => [] as SummaryRow[]); // a malformed uuid is just "not found"
  if (!rows[0]) return c.json({ error: 'Not found' }, 404);
  return c.json(toSummary(rows[0]));
});

/** The owner's recent shares a given viewer may see (profile page). Public
 * ones for anyone; friends-only ones when the viewer is an accepted friend. */
export async function recentSharedSessions(
  ownerId: string,
  viewerId: string | null,
  limit = 10,
): Promise<SharedSessionSummary[]> {
  const rows = viewerId
    ? await selectSummaries(sql`
        WHERE s.owner_user_id = ${ownerId} AND ${visibleTo(viewerId)}
        ORDER BY s.performed_at DESC LIMIT ${limit}`)
    : await selectSummaries(sql`
        WHERE s.owner_user_id = ${ownerId} AND s.visibility = 'public'
        ORDER BY s.performed_at DESC LIMIT ${limit}`);
  return rows.map(toSummary);
}
