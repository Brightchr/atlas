import { Link } from 'react-router';
import { ChevronRight, UserPlus, Users } from 'lucide-react';
import type { FriendEntry } from '@arcadia/shared';
import { Card } from '@/components/ui';
import { AvatarIcon } from '@/features/profile/avatars';
import { useFriends } from '../api';

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function subline(f: FriendEntry): string {
  if (f.stats?.lastWorkout) {
    return `${f.stats.lastWorkout.name} · ${timeAgo(f.stats.lastWorkout.at)}`;
  }
  if (f.online === true) return 'Online';
  if (f.online === false) return 'Away';
  return '';
}

/** How many friend requests are waiting for an answer. Shared by this card
 * and the You tab's badge, so both come from the same cached request. */
export function useIncomingRequestCount(): number {
  return useFriends().data?.incoming.length ?? 0;
}

/** Friends at a glance on Today: who is online and what they last trained.
 *
 * This replaces the old desktop-only right-hand rail. Same information —
 * online count, online-first order, presence dots, last workout, a badge
 * for waiting requests — but as a card, so phones get it too. Managing
 * friends (requests, groups, sharing) still happens on the Friends page. */
export function FriendsCard({ limit = 6 }: { limit?: number }) {
  const friendsQuery = useFriends();
  const friends = [...(friendsQuery.data?.friends ?? [])].sort(
    (a, b) =>
      Number(b.online === true) - Number(a.online === true) ||
      a.user.username.localeCompare(b.user.username),
  );
  const incoming = friendsQuery.data?.incoming.length ?? 0;
  const onlineCount = friends.filter((f) => f.online === true).length;
  const shown = friends.slice(0, limit);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Users size={15} strokeWidth={1.8} aria-hidden />
          </span>
          Friends
          {onlineCount > 0 && (
            <span className="text-xs font-medium text-emerald-500 tabular-nums">
              {onlineCount} online
            </span>
          )}
        </h2>
        <Link
          to="/friends"
          className="flex min-h-11 shrink-0 items-center gap-0.5 text-xs font-medium text-accent hover:underline md:min-h-0"
        >
          Manage
          <ChevronRight size={14} aria-hidden />
        </Link>
      </div>

      {incoming > 0 && (
        <Link
          to="/friends"
          className="mt-2 flex min-h-11 items-center gap-2 rounded-xl bg-accent-soft px-3 text-sm font-semibold text-accent"
        >
          <UserPlus size={16} aria-hidden />
          {incoming} friend request{incoming === 1 ? '' : 's'} waiting
        </Link>
      )}

      {friendsQuery.isSuccess && friends.length === 0 ? (
        <p className="mt-2 text-sm text-muted">
          No friends yet.{' '}
          <Link to="/friends" className="font-medium text-accent hover:underline">
            Add someone
          </Link>{' '}
          and their status shows up here.
        </p>
      ) : (
        <ul className="mt-2 grid gap-x-3 sm:grid-cols-2 lg:grid-cols-1">
          {shown.map((f) => {
            const name = f.user.displayName ?? f.user.username;
            const sub = subline(f);
            return (
              <li key={f.user.id}>
                <Link
                  to={`/users/${f.user.username}`}
                  className="-mx-2 flex min-h-12 items-center gap-2.5 rounded-xl px-2 transition-colors hover:bg-elev"
                >
                  <AvatarIcon
                    name={f.user.username}
                    icon={f.user.avatarIcon}
                    tone={f.user.avatarTone}
                    online={f.online}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{name}</span>
                    {sub && <span className="block truncate text-xs text-muted">{sub}</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {friends.length > shown.length && (
        <Link
          to="/friends"
          className="mt-1 flex min-h-11 items-center justify-center text-sm font-semibold text-accent md:min-h-9"
        >
          All {friends.length} friends
        </Link>
      )}
    </Card>
  );
}
