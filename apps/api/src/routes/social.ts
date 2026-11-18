import { Hono } from 'hono';
import { and, eq, or, sql } from 'drizzle-orm';
import type {
  FriendEntry,
  FriendRequestEntry,
  FriendStats,
  FriendUser,
  FriendsResponse,
  GroupDetail,
  GroupMemberEntry,
  GroupSummary,
} from '@arcadia/shared';
import { db } from '../db/db';
import { friendships, groupMembers, groups, statGrants, userStats, users } from '../db/schema';
import { createNotification } from '../lib/notify';
import { rateLimit } from '../lib/rate-limit';
import { requireActiveMember, requireAuth, type AppEnv } from '../middleware/auth';
import { ONLINE_WINDOW_MS } from './profile';

/** The friends system: Discord-style mutual requests, workout groups, and
 * opt-in stat sharing.
 *
 * Privacy model — the load-bearing part:
 * - A friendship alone reveals NOTHING beyond the public profile.
 * - Stats become visible person-to-person only via an explicit grant
 *   (stat_grants row, owner → grantee), toggled per friend.
 * - Groups are the social exception: joining one shares your stats into it
 *   by default (that's their whole point, and the invite UI says so), with
 *   a per-group off-switch (group_members.share_stats).
 * - The snapshot itself is client-computed; sensitive extras (weight trend)
 *   are simply absent from the payload unless their owner opted in. */

const MAX_STATS_BYTES = 8_000;

export const socialRoutes = new Hono<AppEnv>();

// Scoped to this group's own prefixes — a use('*') here would become a /v1/*
// middleware at the mount point and gate unrelated routes by accident.
for (const prefix of ['/friends', '/friends/*', '/groups', '/groups/*', '/stats']) {
  socialRoutes.use(prefix, requireAuth);
  socialRoutes.use(prefix, requireActiveMember);
  socialRoutes.use(prefix, rateLimit({ windowMs: 60 * 1000, max: 120, by: 'user' }));
}

export interface UserRow {
  id: string;
  username: string;
  displayName: string | null;
  profile?: unknown;
  lastSeenAt?: Date | null;
}

/** Avatar + presence-visibility straight from the profile document (same
 * shape normalizeProfile in profile.ts validates on write). */
function profileBits(raw: unknown): {
  icon: string | null;
  tone: string | null;
  showOnline: boolean;
} {
  const doc = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const show = (typeof doc.show === 'object' && doc.show !== null ? doc.show : {}) as Record<
    string,
    unknown
  >;
  return {
    icon: typeof doc.avatarIcon === 'string' && doc.avatarIcon ? doc.avatarIcon : null,
    tone: typeof doc.avatarTone === 'string' && doc.avatarTone ? doc.avatarTone : null,
    showOnline: show.online !== false,
  };
}

export const toFriendUser = (r: UserRow): FriendUser => {
  const bits = profileBits(r.profile);
  return {
    id: r.id,
    username: r.username,
    displayName: r.displayName,
    avatarIcon: bits.icon,
    avatarTone: bits.tone,
  };
};

/** Presence, respecting the owner's show.online switch (null = hidden). */
function onlineOf(r: UserRow): boolean | null {
  if (!profileBits(r.profile).showOnline) return null;
  return r.lastSeenAt != null && Date.now() - r.lastSeenAt.getTime() < ONLINE_WINDOW_MS;
}

async function findUserByUsername(username: string): Promise<UserRow | null> {
  const rows = await db
    .select({ id: users.id, username: users.username, displayName: users.displayName })
    .from(users)
    .where(sql`lower(${users.username}) = lower(${username.trim()})`);
  return rows[0] ?? null;
}

/** Both directions of an accepted friendship between two users. */
const acceptedBetween = (a: string, b: string) =>
  and(
    eq(friendships.status, 'accepted'),
    or(
      and(eq(friendships.requesterId, a), eq(friendships.addresseeId, b)),
      and(eq(friendships.requesterId, b), eq(friendships.addresseeId, a)),
    ),
  )!;

/** Stats snapshots for the given owners that `viewerId` may read: an explicit
 * grant, or a shared group where the owner's share switch is on. Raw SQL —
 * the double EXISTS over grants and shared groups is the privacy rule itself,
 * kept in one visible place. */
async function visibleStats(
  viewerId: string,
  ownerIds: string[],
): Promise<Map<string, { stats: FriendStats; updatedAt: Date }>> {
  if (ownerIds.length === 0) return new Map();
  const { rows } = await db.execute(sql`
    SELECT s.user_id AS "userId", s.payload, s.updated_at AS "updatedAt"
      FROM user_stats s
     WHERE s.user_id = ANY(${ownerIds})
       AND (
         EXISTS (SELECT 1 FROM stat_grants g
                  WHERE g.owner_user_id = s.user_id AND g.grantee_user_id = ${viewerId})
         OR EXISTS (SELECT 1 FROM group_members mine
                     JOIN group_members theirs ON theirs.group_id = mine.group_id
                    WHERE mine.user_id = ${viewerId} AND mine.status = 'member'
                      AND theirs.user_id = s.user_id AND theirs.status = 'member'
                      AND theirs.share_stats)
       )`);
  const typed = rows as unknown as { userId: string; payload: FriendStats; updatedAt: Date }[];
  return new Map(typed.map((r) => [r.userId, { stats: r.payload, updatedAt: r.updatedAt }]));
}

/* -------------------------------- Friends -------------------------------- */

socialRoutes.get('/friends', async (c) => {
  const me = c.get('user')!;

  // Raw SQL: the CASE join picks "the other person" from either side of the
  // friendship row in one pass.
  const accepted = (
    await db.execute(sql`
      SELECT u.id, u.username, u.display_name AS "displayName", u.profile,
             u.last_seen_at AS "lastSeenAt",
             f.id AS "friendshipId", f.responded_at AS "respondedAt", f.created_at AS "createdAt"
        FROM friendships f
        JOIN users u ON u.id = CASE WHEN f.requester_id = ${me.id} THEN f.addressee_id
                                    ELSE f.requester_id END
       WHERE (f.requester_id = ${me.id} OR f.addressee_id = ${me.id}) AND f.status = 'accepted'
       ORDER BY u.username`)
  ).rows as unknown as (UserRow & {
    friendshipId: string;
    respondedAt: Date | null;
    createdAt: Date;
  })[];

  const requestColumns = {
    id: users.id,
    username: users.username,
    displayName: users.displayName,
    profile: users.profile,
    friendshipId: friendships.id,
    createdAt: friendships.createdAt,
  };
  const incoming = await db
    .select(requestColumns)
    .from(friendships)
    .innerJoin(users, eq(users.id, friendships.requesterId))
    .where(and(eq(friendships.addresseeId, me.id), eq(friendships.status, 'pending')))
    .orderBy(sql`${friendships.createdAt} DESC`);
  const outgoing = await db
    .select(requestColumns)
    .from(friendships)
    .innerJoin(users, eq(users.id, friendships.addresseeId))
    .where(and(eq(friendships.requesterId, me.id), eq(friendships.status, 'pending')))
    .orderBy(sql`${friendships.createdAt} DESC`);

  const friendIds = accepted.map((r) => r.id);
  const myGrants = new Set(
    (
      await db
        .select({ granteeUserId: statGrants.granteeUserId })
        .from(statGrants)
        .where(eq(statGrants.ownerUserId, me.id))
    ).map((r) => r.granteeUserId),
  );
  const stats = await visibleStats(me.id, friendIds);
  const grantsToMe = new Set(
    (
      await db
        .select({ ownerUserId: statGrants.ownerUserId })
        .from(statGrants)
        .where(eq(statGrants.granteeUserId, me.id))
    ).map((r) => r.ownerUserId),
  );

  const response: FriendsResponse = {
    friends: accepted.map(
      (r): FriendEntry => ({
        user: toFriendUser(r),
        friendedAt: (r.respondedAt ?? r.createdAt).toISOString(),
        online: onlineOf(r),
        sharingToThem: myGrants.has(r.id),
        sharingToMe: grantsToMe.has(r.id) || stats.has(r.id),
        stats: stats.get(r.id)?.stats ?? null,
        statsUpdatedAt: stats.get(r.id)?.updatedAt.toISOString() ?? null,
      }),
    ),
    incoming: incoming.map(
      (r): FriendRequestEntry => ({
        id: r.friendshipId,
        user: toFriendUser(r),
        createdAt: r.createdAt.toISOString(),
      }),
    ),
    outgoing: outgoing.map(
      (r): FriendRequestEntry => ({
        id: r.friendshipId,
        user: toFriendUser(r),
        createdAt: r.createdAt.toISOString(),
      }),
    ),
  };
  return c.json(response);
});

socialRoutes.post('/friends/requests', async (c) => {
  const me = c.get('user')!;
  const { username } = (await c.req.json().catch(() => ({}))) as { username?: string };
  if (!username?.trim()) return c.json({ error: 'Username required' }, 400);

  const target = await findUserByUsername(username);
  if (!target) return c.json({ error: 'No user with that username' }, 404);
  if (target.id === me.id) return c.json({ error: "That's you" }, 400);

  const existing = await db
    .select({ id: friendships.id, status: friendships.status, requesterId: friendships.requesterId })
    .from(friendships)
    .where(
      or(
        and(eq(friendships.requesterId, me.id), eq(friendships.addresseeId, target.id)),
        and(eq(friendships.requesterId, target.id), eq(friendships.addresseeId, me.id)),
      ),
    );
  const found = existing[0];
  if (found) {
    if (found.status === 'accepted') return c.json({ error: 'Already friends' }, 409);
    if (found.requesterId === me.id) return c.json({ error: 'Request already sent' }, 409);
    // They asked first — this "request" is really an acceptance.
    await db
      .update(friendships)
      .set({ status: 'accepted', respondedAt: sql`now()` })
      .where(eq(friendships.id, found.id));
    await createNotification(
      target.id,
      'friend_accepted',
      `${me.username} accepted your friend request`,
    );
    return c.json({ ok: true, accepted: true });
  }

  await db.insert(friendships).values({ requesterId: me.id, addresseeId: target.id });
  await createNotification(
    target.id,
    'friend_request',
    `${me.username} sent you a friend request`,
    'Accept it from the Friends page.',
  );
  return c.json({ ok: true, accepted: false });
});

socialRoutes.post('/friends/requests/:id/accept', async (c) => {
  const me = c.get('user')!;
  const updated = await db
    .update(friendships)
    .set({ status: 'accepted', respondedAt: sql`now()` })
    .where(
      and(
        eq(friendships.id, c.req.param('id')),
        eq(friendships.addresseeId, me.id),
        eq(friendships.status, 'pending'),
      ),
    )
    .returning({ requesterId: friendships.requesterId });
  if (!updated[0]) return c.json({ error: 'Request not found' }, 404);
  await createNotification(
    updated[0].requesterId,
    'friend_accepted',
    `${me.username} accepted your friend request`,
  );
  return c.json({ ok: true });
});

socialRoutes.post('/friends/requests/:id/decline', async (c) => {
  const me = c.get('user')!;
  const deleted = await db
    .delete(friendships)
    .where(
      and(
        eq(friendships.id, c.req.param('id')),
        eq(friendships.addresseeId, me.id),
        eq(friendships.status, 'pending'),
      ),
    )
    .returning({ id: friendships.id });
  if (!deleted[0]) return c.json({ error: 'Request not found' }, 404);
  return c.json({ ok: true });
});

socialRoutes.delete('/friends/requests/:id', async (c) => {
  const me = c.get('user')!;
  const deleted = await db
    .delete(friendships)
    .where(
      and(
        eq(friendships.id, c.req.param('id')),
        eq(friendships.requesterId, me.id),
        eq(friendships.status, 'pending'),
      ),
    )
    .returning({ id: friendships.id });
  if (!deleted[0]) return c.json({ error: 'Request not found' }, 404);
  return c.json({ ok: true });
});

socialRoutes.delete('/friends/:userId', async (c) => {
  const me = c.get('user')!;
  const other = c.req.param('userId');
  const deleted = await db
    .delete(friendships)
    .where(acceptedBetween(me.id, other))
    .returning({ id: friendships.id });
  if (!deleted[0]) return c.json({ error: 'Not friends' }, 404);
  // Unfriending revokes stat visibility in both directions.
  await db
    .delete(statGrants)
    .where(
      or(
        and(eq(statGrants.ownerUserId, me.id), eq(statGrants.granteeUserId, other)),
        and(eq(statGrants.ownerUserId, other), eq(statGrants.granteeUserId, me.id)),
      ),
    );
  return c.json({ ok: true });
});

socialRoutes.put('/friends/:userId/sharing', async (c) => {
  const me = c.get('user')!;
  const other = c.req.param('userId');
  const { enabled } = (await c.req.json().catch(() => ({}))) as { enabled?: boolean };
  const friends = await db
    .select({ id: friendships.id })
    .from(friendships)
    .where(acceptedBetween(me.id, other));
  if (!friends[0]) return c.json({ error: 'Not friends' }, 404);
  if (enabled) {
    await db
      .insert(statGrants)
      .values({ ownerUserId: me.id, granteeUserId: other })
      .onConflictDoNothing();
  } else {
    await db
      .delete(statGrants)
      .where(and(eq(statGrants.ownerUserId, me.id), eq(statGrants.granteeUserId, other)));
  }
  return c.json({ ok: true });
});

/* --------------------------------- Groups --------------------------------- */

async function groupSummaries(userId: string): Promise<GroupSummary[]> {
  const rows = await db
    .select({
      id: groups.id,
      name: groups.name,
      ownerUserId: groups.ownerUserId,
      owner: users.username,
      status: groupMembers.status,
      shareStats: groupMembers.shareStats,
      memberCount: sql<number>`(SELECT count(*)::int FROM group_members m
                                 WHERE m.group_id = ${groups.id} AND m.status = 'member')`,
    })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .innerJoin(users, eq(users.id, groups.ownerUserId))
    .where(eq(groupMembers.userId, userId))
    .orderBy(groups.name);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    owner: r.owner,
    memberCount: r.memberCount,
    membership:
      r.status === 'invited' ? 'invited' : r.ownerUserId === userId ? 'owner' : 'member',
    sharingStats: r.shareStats,
  }));
}

socialRoutes.get('/groups', async (c) => {
  const me = c.get('user')!;
  return c.json({ groups: await groupSummaries(me.id) });
});

socialRoutes.post('/groups', async (c) => {
  const me = c.get('user')!;
  const { name } = (await c.req.json().catch(() => ({}))) as { name?: string };
  const trimmed = (name ?? '').trim();
  if (trimmed.length < 1 || trimmed.length > 60) {
    return c.json({ error: 'Group name must be 1-60 characters' }, 400);
  }
  const created = await db
    .insert(groups)
    .values({ name: trimmed, ownerUserId: me.id })
    .returning({ id: groups.id });
  await db.insert(groupMembers).values({
    groupId: created[0]!.id,
    userId: me.id,
    status: 'member',
    joinedAt: sql`now()`,
  });
  return c.json({ ok: true, id: created[0]!.id });
});

socialRoutes.get('/groups/:id', async (c) => {
  const me = c.get('user')!;
  const groupId = c.req.param('id');
  const mine = await db
    .select({ status: groupMembers.status, shareStats: groupMembers.shareStats })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, me.id)));
  if (!mine[0]) return c.json({ error: 'Group not found' }, 404);

  // Raw SQL: two joins against users under different roles (member vs owner).
  const rows = (
    await db.execute(sql`
      SELECT u.id, u.username, u.display_name AS "displayName", u.profile,
             u.last_seen_at AS "lastSeenAt", gm.status, gm.joined_at AS "joinedAt",
             g.owner_user_id AS "ownerUserId", g.name, ou.username AS owner
        FROM group_members gm
        JOIN groups g ON g.id = gm.group_id
        JOIN users ou ON ou.id = g.owner_user_id
        JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = ${groupId}
       ORDER BY u.username`)
  ).rows as unknown as (UserRow & {
    status: string;
    joinedAt: Date | null;
    ownerUserId: string;
    name: string;
    owner: string;
  })[];
  const first = rows[0];
  if (!first) return c.json({ error: 'Group not found' }, 404);

  const memberRows = rows.filter((r) => r.status === 'member');
  // Invited-but-not-joined callers see the roster, not the stats.
  const stats =
    mine[0].status === 'member'
      ? await visibleStats(me.id, memberRows.map((r) => r.id))
      : new Map<string, { stats: FriendStats; updatedAt: Date }>();

  const detail: GroupDetail = {
    id: groupId,
    name: first.name,
    owner: first.owner,
    memberCount: memberRows.length,
    membership:
      mine[0].status === 'invited' ? 'invited' : first.ownerUserId === me.id ? 'owner' : 'member',
    sharingStats: mine[0].shareStats,
    members: memberRows.map(
      (r): GroupMemberEntry => ({
        user: toFriendUser(r),
        role: r.id === first.ownerUserId ? 'owner' : 'member',
        online: onlineOf(r),
        stats: stats.get(r.id)?.stats ?? null,
        statsUpdatedAt: stats.get(r.id)?.updatedAt.toISOString() ?? null,
        joinedAt: r.joinedAt?.toISOString() ?? null,
      }),
    ),
    invited: rows.filter((r) => r.status === 'invited').map(toFriendUser),
  };
  return c.json(detail);
});

socialRoutes.post('/groups/:id/invites', async (c) => {
  const me = c.get('user')!;
  const groupId = c.req.param('id');
  const { username } = (await c.req.json().catch(() => ({}))) as { username?: string };
  if (!username?.trim()) return c.json({ error: 'Username required' }, 400);

  const membership = await db
    .select({ status: groupMembers.status, name: groups.name })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, me.id),
        eq(groupMembers.status, 'member'),
      ),
    );
  if (!membership[0]) return c.json({ error: 'Group not found' }, 404);

  const target = await findUserByUsername(username);
  if (!target) return c.json({ error: 'No user with that username' }, 404);
  if (target.id === me.id) return c.json({ error: "That's you" }, 400);

  const inserted = await db
    .insert(groupMembers)
    .values({ groupId, userId: target.id, status: 'invited', invitedBy: me.id })
    .onConflictDoNothing()
    .returning({ userId: groupMembers.userId });
  if (!inserted[0]) return c.json({ error: 'Already invited or a member' }, 409);
  await createNotification(
    target.id,
    'group_invite',
    `${me.username} invited you to the group “${membership[0].name}”`,
    'Joining a group shares your workout stats with its members (you can switch that off per group).',
  );
  return c.json({ ok: true });
});

socialRoutes.post('/groups/:id/join', async (c) => {
  const me = c.get('user')!;
  const updated = await db
    .update(groupMembers)
    .set({ status: 'member', joinedAt: sql`now()` })
    .where(
      and(
        eq(groupMembers.groupId, c.req.param('id')),
        eq(groupMembers.userId, me.id),
        eq(groupMembers.status, 'invited'),
      ),
    )
    .returning({ groupId: groupMembers.groupId });
  if (!updated[0]) return c.json({ error: 'No invite for this group' }, 404);
  return c.json({ ok: true });
});

socialRoutes.post('/groups/:id/decline', async (c) => {
  const me = c.get('user')!;
  const deleted = await db
    .delete(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, c.req.param('id')),
        eq(groupMembers.userId, me.id),
        eq(groupMembers.status, 'invited'),
      ),
    )
    .returning({ groupId: groupMembers.groupId });
  if (!deleted[0]) return c.json({ error: 'No invite for this group' }, 404);
  return c.json({ ok: true });
});

socialRoutes.delete('/groups/:id/members/me', async (c) => {
  const me = c.get('user')!;
  const groupId = c.req.param('id');
  const owner = await db
    .select({ id: groups.id })
    .from(groups)
    .where(and(eq(groups.id, groupId), eq(groups.ownerUserId, me.id)));
  if (owner[0]) {
    return c.json({ error: 'Owners delete the group instead of leaving it' }, 400);
  }
  const deleted = await db
    .delete(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, me.id)))
    .returning({ groupId: groupMembers.groupId });
  if (!deleted[0]) return c.json({ error: 'Group not found' }, 404);
  return c.json({ ok: true });
});

socialRoutes.delete('/groups/:id', async (c) => {
  const me = c.get('user')!;
  const deleted = await db
    .delete(groups)
    .where(and(eq(groups.id, c.req.param('id')), eq(groups.ownerUserId, me.id)))
    .returning({ id: groups.id });
  if (!deleted[0]) return c.json({ error: 'Group not found' }, 404);
  return c.json({ ok: true });
});

socialRoutes.put('/groups/:id/sharing', async (c) => {
  const me = c.get('user')!;
  const { enabled } = (await c.req.json().catch(() => ({}))) as { enabled?: boolean };
  const updated = await db
    .update(groupMembers)
    .set({ shareStats: Boolean(enabled) })
    .where(and(eq(groupMembers.groupId, c.req.param('id')), eq(groupMembers.userId, me.id)))
    .returning({ groupId: groupMembers.groupId });
  if (!updated[0]) return c.json({ error: 'Group not found' }, 404);
  return c.json({ ok: true });
});

/* ---------------------------------- Stats --------------------------------- */

/** Strict shape validation for the snapshot. The payload is echoed to OTHER
 * users' clients, so a malformed one is stored, attacker-controlled data
 * crossing a trust boundary — never store anything but the exact shape, and
 * rebuild the object so unknown keys can't ride along. */
function parseStatsPayload(value: unknown): FriendStats | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const week = v.week as Record<string, unknown> | undefined;
  const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
  if (
    typeof week !== 'object' ||
    week === null ||
    !num(week.workouts) ||
    !num(week.volumeKg) ||
    !num(week.cardioMin) ||
    !num(v.streakDays) ||
    !(v.weeklyTargetDays === null || num(v.weeklyTargetDays)) ||
    !(v.weightDeltaKg === undefined || num(v.weightDeltaKg))
  ) {
    return null;
  }
  let lastWorkout: FriendStats['lastWorkout'] = null;
  if (v.lastWorkout !== null && v.lastWorkout !== undefined) {
    const lw = v.lastWorkout as Record<string, unknown>;
    if (
      typeof lw !== 'object' ||
      typeof lw.name !== 'string' ||
      lw.name.length > 120 ||
      typeof lw.at !== 'string' ||
      Number.isNaN(Date.parse(lw.at))
    ) {
      return null;
    }
    lastWorkout = { name: lw.name, at: lw.at };
  }
  const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
  return {
    week: {
      workouts: clamp(week.workouts, 0, 100),
      volumeKg: clamp(week.volumeKg, 0, 1_000_000),
      cardioMin: clamp(week.cardioMin, 0, 10_000),
    },
    streakDays: clamp(v.streakDays, 0, 10_000),
    weeklyTargetDays: v.weeklyTargetDays === null ? null : clamp(v.weeklyTargetDays, 1, 7),
    lastWorkout,
    ...(v.weightDeltaKg !== undefined && { weightDeltaKg: clamp(v.weightDeltaKg, -50, 50) }),
  };
}

/** The client publishes its own snapshot; the server validates the shape
 * strictly (see parseStatsPayload) and decides who may read it. */
socialRoutes.put('/stats', async (c) => {
  const me = c.get('user')!;
  const body = await c.req.text();
  if (body.length > MAX_STATS_BYTES) return c.json({ error: 'Stats payload too large' }, 413);
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }
  const payload = parseStatsPayload(raw);
  if (!payload) return c.json({ error: 'Stats payload does not match the expected shape' }, 400);
  await db
    .insert(userStats)
    .values({ userId: me.id, payload, updatedAt: sql`now()` })
    .onConflictDoUpdate({
      target: userStats.userId,
      set: { payload: sql`excluded.payload`, updatedAt: sql`now()` },
    });
  return c.json({ ok: true });
});
