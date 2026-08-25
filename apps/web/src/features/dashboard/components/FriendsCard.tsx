import { Link } from 'react-router';
import { Users } from 'lucide-react';
import { useFriends } from '@/features/social/api';
import { Avatar, StatChips } from '@/features/social/components/StatChips';

/** The dashboard's glanceable social surface: a few friends with their
 * shared week at a glance. Renders nothing when the user has no friends —
 * the Friends page owns discovery and requests. */
export function FriendsCard() {
  const friendsQuery = useFriends();
  const friends = friendsQuery.data?.friends ?? [];
  const incoming = friendsQuery.data?.incoming.length ?? 0;
  if (friends.length === 0 && incoming === 0) return null;

  const withStats = friends.filter((f) => f.stats !== null).slice(0, 4);

  return (
    <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-accent" aria-hidden />
          <h2 className="text-sm font-semibold">Your crew</h2>
          {incoming > 0 && (
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold text-accent">
              {incoming} request{incoming === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <Link to="/you/friends" className="text-xs font-medium text-accent hover:underline">
          All friends →
        </Link>
      </div>

      {withStats.length === 0 ? (
        <p className="text-xs text-muted">
          {incoming > 0
            ? 'Friend requests are waiting for you.'
            : 'No shared stats yet — nudge your friends to share theirs.'}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {withStats.map((f) => (
            <li key={f.user.id} className="flex items-start gap-2.5">
              <Avatar name={f.user.username} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {f.user.displayName ?? f.user.username}
                </p>
                <StatChips stats={f.stats!} updatedAt={f.statsUpdatedAt} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
