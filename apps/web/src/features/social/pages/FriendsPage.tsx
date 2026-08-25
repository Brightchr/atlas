import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  ChevronRight,
  Plus,
  Scale,
  UserPlus,
  Users,
  UsersRound,
  X,
} from 'lucide-react';
import type { FriendEntry } from '@arcadia/shared';
import {
  useAcceptRequest,
  useCancelRequest,
  useCreateGroup,
  useDeclineGroupInvite,
  useDeclineRequest,
  useFriends,
  useGroups,
  useJoinGroup,
  useSendFriendRequest,
  useSetFriendSharing,
  useUnfriend,
} from '../api';
import { isWeightSharingEnabled, setWeightSharingEnabled } from '../stats';
import { Avatar, StatChips } from '../components/StatChips';

function FriendCard({ entry }: { entry: FriendEntry }) {
  const setSharing = useSetFriendSharing();
  const unfriend = useUnfriend();
  const [confirming, setConfirming] = useState(false);
  const name = entry.user.displayName ?? entry.user.username;

  return (
    <li className="rounded-2xl border border-line bg-surface p-3.5 shadow-sm">
      <div className="flex items-start gap-3">
        <Avatar name={entry.user.username} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link to={`/users/${entry.user.username}`} className="truncate text-sm font-semibold hover:underline">
              {name}
            </Link>
            {entry.user.displayName && (
              <span className="truncate text-xs text-muted">@{entry.user.username}</span>
            )}
          </div>
          {entry.stats ? (
            <div className="mt-1.5">
              <StatChips stats={entry.stats} updatedAt={entry.statsUpdatedAt} />
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted/80">
              {entry.sharingToMe
                ? 'No stats published yet.'
                : "Isn't sharing stats with you (yet)."}
            </p>
          )}
        </div>
        {confirming ? (
          <span className="flex shrink-0 items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => unfriend.mutate(entry.user.id)}
              className="rounded-lg bg-rose-500/10 px-2 py-1 font-semibold text-rose-600"
            >
              Remove
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="rounded-lg px-1.5 py-1 text-muted hover:text-ink">
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label={`Remove ${name} as a friend`}
            className="shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-elev hover:text-ink"
          >
            <X size={14} aria-hidden />
          </button>
        )}
      </div>
      <label className="mt-2.5 flex cursor-pointer items-center gap-2 border-t border-line pt-2.5 text-xs text-muted">
        <input
          type="checkbox"
          checked={entry.sharingToThem}
          disabled={setSharing.isPending}
          onChange={(e) => setSharing.mutate({ userId: entry.user.id, enabled: e.target.checked })}
          className="h-3.5 w-3.5"
        />
        Share my stats with {name}
      </label>
    </li>
  );
}

/** Friends: Discord-style add + pending sections, friend cards with shared
 * stats, and workout groups. Declines are silent (the other side is never
 * notified) — straight from the research. */
export function FriendsPage() {
  const friendsQuery = useFriends();
  const groupsQuery = useGroups();
  const sendRequest = useSendFriendRequest();
  const accept = useAcceptRequest();
  const decline = useDeclineRequest();
  const cancel = useCancelRequest();
  const joinGroup = useJoinGroup();
  const declineInvite = useDeclineGroupInvite();
  const createGroup = useCreateGroup();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [username, setUsername] = useState('');
  const [groupName, setGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);

  const weightSharing = useQuery({
    queryKey: ['social', 'weight-sharing'],
    queryFn: isWeightSharingEnabled,
  });
  const toggleWeightSharing = useMutation({
    mutationFn: setWeightSharingEnabled,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['social', 'weight-sharing'] }),
  });

  const data = friendsQuery.data;
  const groups = groupsQuery.data?.groups ?? [];
  const invited = groups.filter((g) => g.membership === 'invited');
  const memberOf = groups.filter((g) => g.membership !== 'invited');

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-bold">Friends</h1>
        <p className="text-sm text-muted">
          Train together from anywhere — friends see only the stats you choose to share.
        </p>
      </header>

      <div className="relative">
        <UserPlus size={15} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" aria-hidden />
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && username.trim()) {
              sendRequest.mutate(username.trim(), { onSuccess: () => setUsername('') });
            }
          }}
          placeholder="Add a friend by username…"
          aria-label="Add a friend by username"
          className="w-full rounded-2xl border border-line bg-surface py-2.5 pr-24 pl-10 text-sm shadow-sm outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        <button
          type="button"
          disabled={!username.trim() || sendRequest.isPending}
          onClick={() => sendRequest.mutate(username.trim(), { onSuccess: () => setUsername('') })}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-xl bg-linear-to-r from-accent to-accent-2 px-3 py-1.5 text-xs font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Send
        </button>
      </div>
      {sendRequest.isError && <p className="text-xs text-rose-500">{sendRequest.error.message}</p>}
      {sendRequest.data?.accepted && (
        <p className="text-xs text-accent">They'd already added you — you're friends now ✓</p>
      )}

      {(data?.incoming.length ?? 0) > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-bold tracking-wide text-muted uppercase">
            Incoming — {data!.incoming.length}
          </h2>
          <ul className="space-y-1.5">
            {data!.incoming.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-surface p-3 shadow-sm">
                <Avatar name={r.user.username} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {r.user.displayName ?? r.user.username}
                </span>
                <button
                  type="button"
                  onClick={() => accept.mutate(r.id)}
                  disabled={accept.isPending}
                  className="inline-flex items-center gap-1 rounded-xl bg-linear-to-r from-accent to-accent-2 px-3 py-1.5 text-xs font-semibold text-accent-ink shadow-sm hover:opacity-90 disabled:opacity-50"
                >
                  <Check size={13} aria-hidden />
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => decline.mutate(r.id)}
                  disabled={decline.isPending}
                  className="rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold hover:bg-elev disabled:opacity-50"
                >
                  Ignore
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(data?.outgoing.length ?? 0) > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-bold tracking-wide text-muted uppercase">
            Outgoing — {data!.outgoing.length}
          </h2>
          <ul className="space-y-1.5">
            {data!.outgoing.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-sm">
                <Avatar name={r.user.username} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm text-muted">
                  {r.user.displayName ?? r.user.username} — pending
                </span>
                <button
                  type="button"
                  onClick={() => cancel.mutate(r.id)}
                  className="rounded-xl px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-elev hover:text-ink"
                >
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="mb-2 flex items-center gap-2">
          <Users size={15} className="text-accent" aria-hidden />
          <h2 className="text-sm font-semibold">
            Friends {data && <span className="font-normal text-muted">({data.friends.length})</span>}
          </h2>
        </div>
        {friendsQuery.isError && (
          <p className="rounded-2xl border border-line bg-surface p-4 text-sm text-rose-500">
            Couldn't reach the server — friends need a connection.
          </p>
        )}
        {data?.friends.length === 0 && (
          <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
            No friends yet — send a request above. Friends can see each other's shared workout
            stats and plans.
          </p>
        )}
        <ul className="grid items-start gap-2.5 md:grid-cols-2">
          {data?.friends.map((entry) => (
            <FriendCard key={entry.user.id} entry={entry} />
          ))}
        </ul>
        {(data?.friends.length ?? 0) > 0 && (
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={weightSharing.data ?? false}
              disabled={toggleWeightSharing.isPending}
              onChange={(e) => toggleWeightSharing.mutate(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            <Scale size={13} aria-hidden />
            Include my weight trend in shared stats (direction only — never the number)
          </label>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center gap-2">
          <UsersRound size={15} className="text-accent" aria-hidden />
          <h2 className="text-sm font-semibold">Workout groups</h2>
          <button
            type="button"
            onClick={() => setCreatingGroup(!creatingGroup)}
            className="ml-auto inline-flex items-center gap-1 rounded-xl border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold shadow-sm hover:bg-elev"
          >
            <Plus size={13} aria-hidden />
            New group
          </button>
        </div>

        {creatingGroup && (
          <div className="mb-2.5 flex gap-2">
            <input
              value={groupName}
              autoFocus
              onChange={(e) => setGroupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && groupName.trim()) {
                  createGroup.mutate(groupName.trim(), {
                    onSuccess: (r) => {
                      setGroupName('');
                      setCreatingGroup(false);
                      void navigate(`/you/groups/${r.id}`);
                    },
                  });
                }
              }}
              placeholder="Group name — e.g. Morning Crew"
              className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm shadow-sm outline-none placeholder:text-muted/70 focus:border-accent"
            />
            <button
              type="button"
              disabled={!groupName.trim() || createGroup.isPending}
              onClick={() =>
                createGroup.mutate(groupName.trim(), {
                  onSuccess: (r) => {
                    setGroupName('');
                    setCreatingGroup(false);
                    void navigate(`/you/groups/${r.id}`);
                  },
                })
              }
              className="rounded-xl bg-linear-to-r from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-accent-ink shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              Create
            </button>
          </div>
        )}

        {invited.map((g) => (
          <div key={g.id} className="mb-2 flex flex-wrap items-center gap-2.5 rounded-2xl border border-accent/30 bg-surface p-3 shadow-sm">
            <UsersRound size={15} className="shrink-0 text-accent" aria-hidden />
            <span className="min-w-0 flex-1 text-sm">
              <span className="font-semibold">{g.name}</span>
              <span className="text-muted"> — {g.owner} invited you</span>
              <span className="block text-xs text-muted">
                Joining shares your workout stats with the group (you can switch that off).
              </span>
            </span>
            <button
              type="button"
              onClick={() => joinGroup.mutate(g.id)}
              disabled={joinGroup.isPending}
              className="rounded-xl bg-linear-to-r from-accent to-accent-2 px-3 py-1.5 text-xs font-semibold text-accent-ink shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              Join
            </button>
            <button
              type="button"
              onClick={() => declineInvite.mutate(g.id)}
              className="rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold hover:bg-elev"
            >
              Decline
            </button>
          </div>
        ))}

        {memberOf.length === 0 && invited.length === 0 && !creatingGroup && (
          <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
            No groups yet — create one and invite your crew. Everyone in a group sees each
            other's weekly effort.
          </p>
        )}
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {memberOf.map((g) => (
            <li key={g.id}>
              <Link
                to={`/you/groups/${g.id}`}
                className="springy flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 shadow-sm hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <UsersRound size={17} strokeWidth={1.8} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{g.name}</span>
                  <span className="block text-xs text-muted">
                    {g.memberCount} member{g.memberCount === 1 ? '' : 's'}
                    {g.membership === 'owner' ? ' · yours' : ''}
                  </span>
                </span>
                <ChevronRight size={15} className="shrink-0 text-muted" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
