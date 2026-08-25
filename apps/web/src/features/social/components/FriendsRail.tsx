import { useState } from 'react';
import { Link } from 'react-router';
import { PanelRightClose, PanelRightOpen, UserPlus, Users } from 'lucide-react';
import type { FriendEntry } from '@arcadia/shared';
import { AvatarIcon } from '@/features/profile/avatars';
import { useFriends } from '../api';

const COLLAPSE_KEY = 'arcadia-friends-rail-collapsed';

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

/** The right-hand friends rail (desktop): who's online and what they last
 * trained, one glance from anywhere in the app. Collapsible to an avatar
 * strip; friend management (requests, groups, sharing) lives on the Friends
 * page — this is the presence surface, not the control panel. */
export function FriendsRail() {
  const friendsQuery = useFriends();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === '1',
  );
  const toggle = () => {
    setCollapsed((prev) => {
      localStorage.setItem(COLLAPSE_KEY, prev ? '0' : '1');
      return !prev;
    });
  };

  const friends = [...(friendsQuery.data?.friends ?? [])].sort(
    (a, b) =>
      Number(b.online === true) - Number(a.online === true) ||
      a.user.username.localeCompare(b.user.username),
  );
  const incoming = friendsQuery.data?.incoming.length ?? 0;
  const onlineCount = friends.filter((f) => f.online === true).length;

  return (
    <aside
      aria-label="Friends"
      className={`hidden shrink-0 flex-col border-l border-line bg-surface transition-[width] duration-200 lg:flex ${
        collapsed ? 'w-[64px]' : 'w-64'
      }`}
    >
      <div
        className={`flex items-center border-b border-line py-3 ${
          collapsed ? 'justify-center px-0' : 'gap-2 px-4'
        }`}
      >
        {!collapsed && (
          <>
            <Users size={16} className="shrink-0 text-accent" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">
              Friends
              {onlineCount > 0 && (
                <span className="ml-1.5 text-xs font-medium text-emerald-500 tabular-nums">
                  {onlineCount} online
                </span>
              )}
            </span>
          </>
        )}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? 'Expand friends' : 'Collapse friends'}
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-elev hover:text-ink"
        >
          {collapsed ? (
            <PanelRightOpen size={16} strokeWidth={1.8} aria-hidden />
          ) : (
            <PanelRightClose size={16} strokeWidth={1.8} aria-hidden />
          )}
        </button>
      </div>

      <div className={`flex-1 overflow-y-auto py-2 ${collapsed ? 'px-2' : 'px-2.5'}`}>
        {incoming > 0 && (
          <Link
            to="/friends"
            title={`${incoming} friend request${incoming === 1 ? '' : 's'}`}
            className={`mb-1.5 flex items-center gap-2 rounded-xl bg-accent-soft px-2 py-1.5 text-xs font-semibold text-accent ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <UserPlus size={14} aria-hidden />
            {!collapsed && (
              <span>
                {incoming} request{incoming === 1 ? '' : 's'}
              </span>
            )}
          </Link>
        )}

        {friends.length === 0 && !collapsed && (
          <p className="px-1.5 py-3 text-xs text-muted">
            No friends yet —{' '}
            <Link to="/friends" className="text-accent hover:underline">
              add someone
            </Link>{' '}
            and their status shows up here.
          </p>
        )}

        <ul className="space-y-0.5">
          {friends.map((f) => {
            const name = f.user.displayName ?? f.user.username;
            return (
              <li key={f.user.id}>
                <Link
                  to={`/users/${f.user.username}`}
                  title={collapsed ? `${name}${f.online === true ? ' — online' : ''}` : undefined}
                  className={`flex items-center gap-2.5 rounded-xl py-1.5 transition-colors hover:bg-elev ${
                    collapsed ? 'justify-center px-0' : 'px-2'
                  }`}
                >
                  <AvatarIcon
                    name={f.user.username}
                    icon={f.user.avatarIcon}
                    tone={f.user.avatarTone}
                    online={f.online}
                    size="sm"
                  />
                  {!collapsed && (
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{name}</span>
                      {subline(f) && (
                        <span className="block truncate text-[11px] text-muted">{subline(f)}</span>
                      )}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {!collapsed && (
        <div className="border-t border-line px-4 py-2.5">
          <Link to="/friends" className="text-xs font-medium text-accent hover:underline">
            Manage friends & groups →
          </Link>
        </div>
      )}
    </aside>
  );
}
