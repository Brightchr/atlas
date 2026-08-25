import { Hono } from 'hono';
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
import { query } from '../db/pool';
import { createNotification } from '../lib/notify';
import { requireAuth, type AppEnv } from '../middleware/auth';

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

socialRoutes.use('*', requireAuth);

interface UserRow {
  id: string;
  username: string;
  display_name: string | null;
}

const toFriendUser = (r: UserRow): FriendUser => ({
  id: r.id,
  username: r.username,
  displayName: r.display_name,
});

async function findUserByUsername(username: string): Promise<UserRow | null> {
  const rows = await query<UserRow>(
    'SELECT id, username, display_name FROM users WHERE lower(username) = lower($1)',
    [username.trim()],
  );
  return rows[0] ?? null;
}

/** Stats snapshots for the given owners that `viewerId` may read: an explicit
 * grant, or a shared group where the owner's share switch is on. */
async function visibleStats(
  viewerId: string,
  ownerIds: string[],
): Promise<Map<string, { stats: FriendStats; updatedAt: string }>> {
  if (ownerIds.length === 0) return new Map();
  const rows = await query<{ user_id: string; payload: FriendStats; updated_at: string }>(
    `SELECT s.user_id, s.payload, s.updated_at
       FROM user_stats s
      WHERE s.user_id = ANY($2)
        AND (
          EXISTS (SELECT 1 FROM stat_grants g
                   WHERE g.owner_user_id = s.user_id AND g.grantee_user_id = $1)
          OR EXISTS (SELECT 1 FROM group_members mine
                      JOIN group_members theirs ON theirs.group_id = mine.group_id
                     WHERE mine.user_id = $1 AND mine.status = 'member'
                       AND theirs.user_id = s.user_id AND theirs.status = 'member'
                       AND theirs.share_stats)
        )`,
    [viewerId, ownerIds],
  );
  return new Map(rows.map((r) => [r.user_id, { stats: r.payload, updatedAt: r.updated_at }]));
}

/* -------------------------------- Friends -------------------------------- */

socialRoutes.get('/friends', async (c) => {
  const me = c.get('user')!;

  const accepted = await query<
    UserRow & { friendship_id: string; responded_at: string; created_at: string }
  >(
    `SELECT u.id, u.username, u.display_name, f.id AS friendship_id,
            f.responded_at, f.created_at
       FROM friendships f
       JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id
                                   ELSE f.requester_id END
      WHERE (f.requester_id = $1 OR f.addressee_id = $1) AND f.status = 'accepted'
      ORDER BY u.username`,
    [me.id],
  );
  const incoming = await query<UserRow & { friendship_id: string; created_at: string }>(
    `SELECT u.id, u.username, u.display_name, f.id AS friendship_id, f.created_at
       FROM friendships f JOIN users u ON u.id = f.requester_id
      WHERE f.addressee_id = $1 AND f.status = 'pending'
      ORDER BY f.created_at DESC`,
    [me.id],
  );
  const outgoing = await query<UserRow & { friendship_id: string; created_at: string }>(
    `SELECT u.id, u.username, u.display_name, f.id AS friendship_id, f.created_at
       FROM friendships f JOIN users u ON u.id = f.addressee_id
      WHERE f.requester_id = $1 AND f.status = 'pending'
      ORDER BY f.created_at DESC`,
    [me.id],
  );

  const friendIds = accepted.map((r) => r.id);
  const myGrants = new Set(
    (
      await query<{ grantee_user_id: string }>(
        'SELECT grantee_user_id FROM stat_grants WHERE owner_user_id = $1',
        [me.id],
      )
    ).map((r) => r.grantee_user_id),
  );
  const stats = await visibleStats(me.id, friendIds);
  const grantsToMe = new Set(
    (
      await query<{ owner_user_id: string }>(
        'SELECT owner_user_id FROM stat_grants WHERE grantee_user_id = $1',
        [me.id],
      )
    ).map((r) => r.owner_user_id),
  );

  const response: FriendsResponse = {
    friends: accepted.map(
      (r): FriendEntry => ({
        user: toFriendUser(r),
        friendedAt: r.responded_at ?? r.created_at,
        sharingToThem: myGrants.has(r.id),
        sharingToMe: grantsToMe.has(r.id) || stats.has(r.id),
        stats: stats.get(r.id)?.stats ?? null,
        statsUpdatedAt: stats.get(r.id)?.updatedAt ?? null,
      }),
    ),
    incoming: incoming.map(
      (r): FriendRequestEntry => ({
        id: r.friendship_id,
        user: toFriendUser(r),
        createdAt: r.created_at,
      }),
    ),
    outgoing: outgoing.map(
      (r): FriendRequestEntry => ({
        id: r.friendship_id,
        user: toFriendUser(r),
        createdAt: r.created_at,
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

  const existing = await query<{ id: string; status: string; requester_id: string }>(
    `SELECT id, status, requester_id FROM friendships
      WHERE (requester_id = $1 AND addressee_id = $2)
         OR (requester_id = $2 AND addressee_id = $1)`,
    [me.id, target.id],
  );
  const found = existing[0];
  if (found) {
    if (found.status === 'accepted') return c.json({ error: 'Already friends' }, 409);
    if (found.requester_id === me.id) return c.json({ error: 'Request already sent' }, 409);
    // They asked first — this "request" is really an acceptance.
    await query(
      `UPDATE friendships SET status = 'accepted', responded_at = now() WHERE id = $1`,
      [found.id],
    );
    await createNotification(
      target.id,
      'friend_accepted',
      `${me.username} accepted your friend request`,
    );
    return c.json({ ok: true, accepted: true });
  }

  await query('INSERT INTO friendships (requester_id, addressee_id) VALUES ($1, $2)', [
    me.id,
    target.id,
  ]);
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
  const updated = await query<{ requester_id: string }>(
    `UPDATE friendships SET status = 'accepted', responded_at = now()
      WHERE id = $1 AND addressee_id = $2 AND status = 'pending'
      RETURNING requester_id`,
    [c.req.param('id'), me.id],
  );
  if (!updated[0]) return c.json({ error: 'Request not found' }, 404);
  await createNotification(
    updated[0].requester_id,
    'friend_accepted',
    `${me.username} accepted your friend request`,
  );
  return c.json({ ok: true });
});

socialRoutes.post('/friends/requests/:id/decline', async (c) => {
  const me = c.get('user')!;
  const deleted = await query<{ id: string }>(
    `DELETE FROM friendships WHERE id = $1 AND addressee_id = $2 AND status = 'pending'
     RETURNING id`,
    [c.req.param('id'), me.id],
  );
  if (!deleted[0]) return c.json({ error: 'Request not found' }, 404);
  return c.json({ ok: true });
});

socialRoutes.delete('/friends/requests/:id', async (c) => {
  const me = c.get('user')!;
  const deleted = await query<{ id: string }>(
    `DELETE FROM friendships WHERE id = $1 AND requester_id = $2 AND status = 'pending'
     RETURNING id`,
    [c.req.param('id'), me.id],
  );
  if (!deleted[0]) return c.json({ error: 'Request not found' }, 404);
  return c.json({ ok: true });
});

socialRoutes.delete('/friends/:userId', async (c) => {
  const me = c.get('user')!;
  const other = c.req.param('userId');
  const deleted = await query<{ id: string }>(
    `DELETE FROM friendships
      WHERE status = 'accepted'
        AND ((requester_id = $1 AND addressee_id = $2)
          OR (requester_id = $2 AND addressee_id = $1))
      RETURNING id`,
    [me.id, other],
  );
  if (!deleted[0]) return c.json({ error: 'Not friends' }, 404);
  // Unfriending revokes stat visibility in both directions.
  await query(
    `DELETE FROM stat_grants
      WHERE (owner_user_id = $1 AND grantee_user_id = $2)
         OR (owner_user_id = $2 AND grantee_user_id = $1)`,
    [me.id, other],
  );
  return c.json({ ok: true });
});

socialRoutes.put('/friends/:userId/sharing', async (c) => {
  const me = c.get('user')!;
  const other = c.req.param('userId');
  const { enabled } = (await c.req.json().catch(() => ({}))) as { enabled?: boolean };
  const friends = await query<{ id: string }>(
    `SELECT id FROM friendships
      WHERE status = 'accepted'
        AND ((requester_id = $1 AND addressee_id = $2)
          OR (requester_id = $2 AND addressee_id = $1))`,
    [me.id, other],
  );
  if (!friends[0]) return c.json({ error: 'Not friends' }, 404);
  if (enabled) {
    await query(
      `INSERT INTO stat_grants (owner_user_id, grantee_user_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [me.id, other],
    );
  } else {
    await query('DELETE FROM stat_grants WHERE owner_user_id = $1 AND grantee_user_id = $2', [
      me.id,
      other,
    ]);
  }
  return c.json({ ok: true });
});

/* --------------------------------- Groups --------------------------------- */

async function groupSummaries(userId: string): Promise<GroupSummary[]> {
  const rows = await query<{
    id: string;
    name: string;
    owner_user_id: string;
    owner: string;
    status: string;
    share_stats: boolean;
    member_count: string;
  }>(
    `SELECT g.id, g.name, g.owner_user_id, ou.username AS owner,
            gm.status, gm.share_stats,
            (SELECT count(*) FROM group_members m
              WHERE m.group_id = g.id AND m.status = 'member') AS member_count
       FROM group_members gm
       JOIN groups g ON g.id = gm.group_id
       JOIN users ou ON ou.id = g.owner_user_id
      WHERE gm.user_id = $1
      ORDER BY g.name`,
    [userId],
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    owner: r.owner,
    memberCount: Number(r.member_count),
    membership:
      r.status === 'invited' ? 'invited' : r.owner_user_id === userId ? 'owner' : 'member',
    sharingStats: r.share_stats,
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
  const created = await query<{ id: string }>(
    'INSERT INTO groups (name, owner_user_id) VALUES ($1, $2) RETURNING id',
    [trimmed, me.id],
  );
  await query(
    `INSERT INTO group_members (group_id, user_id, status, joined_at) VALUES ($1, $2, 'member', now())`,
    [created[0]!.id, me.id],
  );
  return c.json({ ok: true, id: created[0]!.id });
});

socialRoutes.get('/groups/:id', async (c) => {
  const me = c.get('user')!;
  const groupId = c.req.param('id');
  const mine = await query<{ status: string; share_stats: boolean }>(
    'SELECT status, share_stats FROM group_members WHERE group_id = $1 AND user_id = $2',
    [groupId, me.id],
  );
  if (!mine[0]) return c.json({ error: 'Group not found' }, 404);

  const rows = await query<
    UserRow & { status: string; joined_at: string | null; owner_user_id: string; name: string; owner: string }
  >(
    `SELECT u.id, u.username, u.display_name, gm.status, gm.joined_at,
            g.owner_user_id, g.name, ou.username AS owner
       FROM group_members gm
       JOIN groups g ON g.id = gm.group_id
       JOIN users ou ON ou.id = g.owner_user_id
       JOIN users u ON u.id = gm.user_id
      WHERE gm.group_id = $1
      ORDER BY u.username`,
    [groupId],
  );
  const first = rows[0];
  if (!first) return c.json({ error: 'Group not found' }, 404);

  const memberRows = rows.filter((r) => r.status === 'member');
  // Invited-but-not-joined callers see the roster, not the stats.
  const stats =
    mine[0].status === 'member'
      ? await visibleStats(me.id, memberRows.map((r) => r.id))
      : new Map<string, { stats: FriendStats; updatedAt: string }>();

  const detail: GroupDetail = {
    id: groupId,
    name: first.name,
    owner: first.owner,
    memberCount: memberRows.length,
    membership:
      mine[0].status === 'invited' ? 'invited' : first.owner_user_id === me.id ? 'owner' : 'member',
    sharingStats: mine[0].share_stats,
    members: memberRows.map(
      (r): GroupMemberEntry => ({
        user: toFriendUser(r),
        role: r.id === first.owner_user_id ? 'owner' : 'member',
        stats: stats.get(r.id)?.stats ?? null,
        statsUpdatedAt: stats.get(r.id)?.updatedAt ?? null,
        joinedAt: r.joined_at,
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

  const membership = await query<{ status: string; name: string }>(
    `SELECT gm.status, g.name FROM group_members gm JOIN groups g ON g.id = gm.group_id
      WHERE gm.group_id = $1 AND gm.user_id = $2 AND gm.status = 'member'`,
    [groupId, me.id],
  );
  if (!membership[0]) return c.json({ error: 'Group not found' }, 404);

  const target = await findUserByUsername(username);
  if (!target) return c.json({ error: 'No user with that username' }, 404);
  if (target.id === me.id) return c.json({ error: "That's you" }, 400);

  const inserted = await query<{ user_id: string }>(
    `INSERT INTO group_members (group_id, user_id, status, invited_by)
     VALUES ($1, $2, 'invited', $3)
     ON CONFLICT (group_id, user_id) DO NOTHING
     RETURNING user_id`,
    [groupId, target.id, me.id],
  );
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
  const updated = await query<{ group_id: string }>(
    `UPDATE group_members SET status = 'member', joined_at = now()
      WHERE group_id = $1 AND user_id = $2 AND status = 'invited'
      RETURNING group_id`,
    [c.req.param('id'), me.id],
  );
  if (!updated[0]) return c.json({ error: 'No invite for this group' }, 404);
  return c.json({ ok: true });
});

socialRoutes.post('/groups/:id/decline', async (c) => {
  const me = c.get('user')!;
  const deleted = await query<{ group_id: string }>(
    `DELETE FROM group_members WHERE group_id = $1 AND user_id = $2 AND status = 'invited'
     RETURNING group_id`,
    [c.req.param('id'), me.id],
  );
  if (!deleted[0]) return c.json({ error: 'No invite for this group' }, 404);
  return c.json({ ok: true });
});

socialRoutes.delete('/groups/:id/members/me', async (c) => {
  const me = c.get('user')!;
  const groupId = c.req.param('id');
  const owner = await query<{ id: string }>(
    'SELECT id FROM groups WHERE id = $1 AND owner_user_id = $2',
    [groupId, me.id],
  );
  if (owner[0]) {
    return c.json({ error: 'Owners delete the group instead of leaving it' }, 400);
  }
  const deleted = await query<{ group_id: string }>(
    'DELETE FROM group_members WHERE group_id = $1 AND user_id = $2 RETURNING group_id',
    [groupId, me.id],
  );
  if (!deleted[0]) return c.json({ error: 'Group not found' }, 404);
  return c.json({ ok: true });
});

socialRoutes.delete('/groups/:id', async (c) => {
  const me = c.get('user')!;
  const deleted = await query<{ id: string }>(
    'DELETE FROM groups WHERE id = $1 AND owner_user_id = $2 RETURNING id',
    [c.req.param('id'), me.id],
  );
  if (!deleted[0]) return c.json({ error: 'Group not found' }, 404);
  return c.json({ ok: true });
});

socialRoutes.put('/groups/:id/sharing', async (c) => {
  const me = c.get('user')!;
  const { enabled } = (await c.req.json().catch(() => ({}))) as { enabled?: boolean };
  const updated = await query<{ group_id: string }>(
    `UPDATE group_members SET share_stats = $3
      WHERE group_id = $1 AND user_id = $2 RETURNING group_id`,
    [c.req.param('id'), me.id, Boolean(enabled)],
  );
  if (!updated[0]) return c.json({ error: 'Group not found' }, 404);
  return c.json({ ok: true });
});

/* ---------------------------------- Stats --------------------------------- */

/** The client publishes its own snapshot; the server stores it opaquely and
 * only decides who may read it. Size-capped like every user payload. */
socialRoutes.put('/stats', async (c) => {
  const me = c.get('user')!;
  const body = await c.req.text();
  if (body.length > MAX_STATS_BYTES) return c.json({ error: 'Stats payload too large' }, 413);
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return c.json({ error: 'Stats must be an object' }, 400);
  }
  await query(
    `INSERT INTO user_stats (user_id, payload, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (user_id) DO UPDATE SET payload = excluded.payload, updated_at = now()`,
    [me.id, JSON.stringify(payload)],
  );
  return c.json({ ok: true });
});
