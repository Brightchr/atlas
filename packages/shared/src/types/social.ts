/** The friends system: Discord-style mutual requests, workout groups, and
 * opt-in stat sharing. Stats are a compact snapshot the CLIENT computes and
 * publishes — the server only stores and gates who may read it. */

export interface FriendUser {
  id: string;
  username: string;
  displayName: string | null;
}

/** The client-published stats snapshot. Everything optional beyond the core
 * so older clients stay valid; weight trend only appears when its owner
 * explicitly shares it. */
export interface FriendStats {
  week: {
    workouts: number;
    volumeKg: number;
    cardioMin: number;
  };
  streakDays: number;
  /** Days/week the user committed to (their training profile), for x-of-y. */
  weeklyTargetDays: number | null;
  lastWorkout: { name: string; at: string } | null;
  /** kg change over ~7 days, negative = down. Absent unless shared. */
  weightDeltaKg?: number;
}

export interface FriendEntry {
  user: FriendUser;
  friendedAt: string;
  /** I share my stats with them. */
  sharingToThem: boolean;
  /** They share their stats with me (stats is null when false). */
  sharingToMe: boolean;
  stats: FriendStats | null;
  statsUpdatedAt: string | null;
}

export interface FriendRequestEntry {
  id: string;
  user: FriendUser;
  createdAt: string;
}

export interface FriendsResponse {
  friends: FriendEntry[];
  incoming: FriendRequestEntry[];
  outgoing: FriendRequestEntry[];
}

export interface GroupSummary {
  id: string;
  name: string;
  owner: string;
  memberCount: number;
  /** The caller's relationship to this group. */
  membership: 'owner' | 'member' | 'invited';
  /** Whether the caller shares their stats into this group. */
  sharingStats: boolean;
}

export interface GroupMemberEntry {
  user: FriendUser;
  role: 'owner' | 'member';
  stats: FriendStats | null;
  statsUpdatedAt: string | null;
  joinedAt: string | null;
}

export interface GroupDetail extends GroupSummary {
  members: GroupMemberEntry[];
  invited: FriendUser[];
}
