import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronRight, Plus, UserMinus, UserPlus, UsersRound } from 'lucide-react';
import type { FriendEntry } from '@arcadia/shared';
import { Button, Card, ConfirmSheet, IconButton, PageHeader, SectionLabel } from '@/components/ui';
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
import { AvatarIcon } from '@/features/profile/avatars';
import { StatChips } from '../components/StatChips';
import { SharedWorkoutCard } from '../components/SharedWorkoutCard';
import { useWorkoutFeed } from '../sessions';

// 44px tall; text-base (16px) stops iOS Safari zooming in on focus.
const fieldClasses =
  'min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-base outline-none placeholder:text-muted/70 focus:border-accent';

/** A checkbox whose whole 44px row is the tap target (the label wraps the
 * input, so tapping the text toggles it). */
function CheckRow({
  checked,
  disabled,
  onChange,
  children,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-muted">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 shrink-0 accent-accent"
      />
      <span>{children}</span>
    </label>
  );
}

function FriendCard({ entry }: { entry: FriendEntry }) {
  const setSharing = useSetFriendSharing();
  const unfriend = useUnfriend();
  const [confirming, setConfirming] = useState(false);
  const name = entry.user.displayName ?? entry.user.username;

  return (
    <li>
      <Card className="pt-2 pr-2 pb-1 pl-4">
        <div className="flex items-start gap-3">
          <span className="pt-1.5">
            <AvatarIcon
              name={entry.user.username}
              icon={entry.user.avatarIcon}
              tone={entry.user.avatarTone}
              online={entry.online}
            />
          </span>
          <div className="min-w-0 flex-1">
            <Link
              to={`/users/${entry.user.username}`}
              className="flex min-h-11 flex-col justify-center hover:underline"
            >
              <span className="truncate text-sm font-semibold">{name}</span>
              {entry.user.displayName && (
                <span className="truncate text-sm text-muted">@{entry.user.username}</span>
              )}
            </Link>
            {entry.stats ? (
              <div className="mt-1">
                <StatChips stats={entry.stats} updatedAt={entry.statsUpdatedAt} />
              </div>
            ) : (
              <p className="text-sm text-muted">
                {entry.sharingToMe
                  ? 'No stats published yet.'
                  : "Isn't sharing stats with you (yet)."}
              </p>
            )}
          </div>
          <IconButton label={`Remove ${name} as a friend`} onClick={() => setConfirming(true)}>
            <UserMinus size={18} aria-hidden />
          </IconButton>
        </div>
        <div className="mt-2 mr-2 border-t border-line">
          <CheckRow
            checked={entry.sharingToThem}
            disabled={setSharing.isPending}
            onChange={(enabled) => setSharing.mutate({ userId: entry.user.id, enabled })}
          >
            Share my stats with {name}
          </CheckRow>
        </div>
      </Card>

      {confirming && (
        <ConfirmSheet
          title={`Remove ${name}?`}
          body="You'll stop seeing each other's shared stats and workouts."
          confirmLabel="Remove friend"
          pending={unfriend.isPending}
          onConfirm={() =>
            unfriend.mutate(entry.user.id, { onSettled: () => setConfirming(false) })
          }
          onClose={() => setConfirming(false)}
        />
      )}
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

  const feed = useWorkoutFeed();
  const feedItems = feed.data?.sessions ?? [];
  const data = friendsQuery.data;
  const groups = groupsQuery.data?.groups ?? [];
  const invited = groups.filter((g) => g.membership === 'invited');
  const memberOf = groups.filter((g) => g.membership !== 'invited');

  // One function for both the Send button and the Enter key.
  const submitRequest = () => {
    const name = username.trim();
    if (name) sendRequest.mutate(name, { onSuccess: () => setUsername('') });
  };
  const submitGroup = () => {
    const name = groupName.trim();
    if (!name) return;
    createGroup.mutate(name, {
      onSuccess: (r) => {
        setGroupName('');
        setCreatingGroup(false);
        void navigate(`/groups/${r.id}`);
      },
    });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-6">
      <PageHeader title="Friends" back="/you" />
      <p className="text-sm text-muted">
        Train together from anywhere — friends see only the stats you choose to share.
      </p>

      {/* A real <form> so the phone keyboard's Go/Enter key submits. */}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submitRequest();
        }}
      >
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Add a friend by username"
          aria-label="Add a friend by username"
          autoCapitalize="none"
          autoCorrect="off"
          className={fieldClasses}
        />
        <Button
          type="submit"
          className="shrink-0"
          disabled={!username.trim() || sendRequest.isPending}
        >
          <UserPlus size={18} aria-hidden />
          Send
        </Button>
      </form>
      {sendRequest.isError && <p className="text-sm text-rose-500">{sendRequest.error.message}</p>}
      {sendRequest.data?.accepted && (
        <p className="flex items-center gap-1.5 text-sm text-accent">
          <Check size={16} aria-hidden />
          They'd already added you — you're friends now.
        </p>
      )}

      {(data?.incoming.length ?? 0) > 0 && (
        <section className="space-y-2">
          <SectionLabel>Incoming — {data!.incoming.length}</SectionLabel>
          <ul className="space-y-2">
            {data!.incoming.map((r) => (
              <li key={r.id}>
                <Card className="flex flex-wrap items-center gap-2 border-accent/30 p-3">
                  <AvatarIcon
                    name={r.user.username}
                    icon={r.user.avatarIcon}
                    tone={r.user.avatarTone}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {r.user.displayName ?? r.user.username}
                  </span>
                  <Button onClick={() => accept.mutate(r.id)} disabled={accept.isPending}>
                    <Check size={18} aria-hidden />
                    Accept
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => decline.mutate(r.id)}
                    disabled={decline.isPending}
                  >
                    Ignore
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(data?.outgoing.length ?? 0) > 0 && (
        <section className="space-y-2">
          <SectionLabel>Outgoing — {data!.outgoing.length}</SectionLabel>
          <ul className="space-y-2">
            {data!.outgoing.map((r) => (
              <li key={r.id}>
                <Card className="flex items-center gap-3 py-2 pr-2 pl-3">
                  <AvatarIcon
                    name={r.user.username}
                    icon={r.user.avatarIcon}
                    tone={r.user.avatarTone}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-muted">
                    {r.user.displayName ?? r.user.username} — pending
                  </span>
                  <Button variant="ghost" onClick={() => cancel.mutate(r.id)}>
                    Cancel
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <SectionLabel>Friends{data ? ` — ${data.friends.length}` : ''}</SectionLabel>
        {friendsQuery.isError && (
          <Card className="p-4 text-sm text-rose-500">
            Couldn't reach the server — friends need a connection.
          </Card>
        )}
        {data?.friends.length === 0 && (
          <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
            No friends yet — send a request above. Friends can see each other's shared workout stats
            and plans.
          </p>
        )}
        <ul className="grid items-start gap-2 md:grid-cols-2">
          {[...(data?.friends ?? [])]
            // Online first, then by username.
            .sort(
              (a, b) =>
                Number(b.online === true) - Number(a.online === true) ||
                a.user.username.localeCompare(b.user.username),
            )
            .map((entry) => (
              <FriendCard key={entry.user.id} entry={entry} />
            ))}
        </ul>
        {(data?.friends.length ?? 0) > 0 && (
          <div className="px-1">
            <CheckRow
              checked={weightSharing.data ?? false}
              disabled={toggleWeightSharing.isPending}
              onChange={(enabled) => toggleWeightSharing.mutate(enabled)}
            >
              Include my weight trend in shared stats (direction only — never the number)
            </CheckRow>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <SectionLabel
          action={
            <Button variant="secondary" onClick={() => setCreatingGroup(!creatingGroup)}>
              <Plus size={18} aria-hidden />
              New group
            </Button>
          }
        >
          Workout groups
        </SectionLabel>

        {creatingGroup && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submitGroup();
            }}
          >
            <input
              value={groupName}
              autoFocus
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name — e.g. Morning Crew"
              aria-label="Group name"
              className={fieldClasses}
            />
            <Button
              type="submit"
              className="shrink-0"
              disabled={!groupName.trim() || createGroup.isPending}
            >
              Create
            </Button>
          </form>
        )}

        {invited.map((g) => (
          <Card key={g.id} className="space-y-3 border-accent/30 p-4">
            <p className="text-sm">
              <span className="font-semibold">{g.name}</span>
              <span className="text-muted"> — {g.owner} invited you</span>
              <span className="mt-0.5 block text-muted">
                Joining shares your workout stats with the group (you can switch that off).
              </span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => joinGroup.mutate(g.id)} disabled={joinGroup.isPending}>
                Join
              </Button>
              <Button variant="secondary" onClick={() => declineInvite.mutate(g.id)}>
                Decline
              </Button>
            </div>
          </Card>
        ))}

        {memberOf.length === 0 && invited.length === 0 && !creatingGroup && (
          <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
            No groups yet — create one and invite your crew. Everyone in a group sees each other's
            weekly effort.
          </p>
        )}
        <ul className="grid gap-2 sm:grid-cols-2">
          {memberOf.map((g) => (
            <li key={g.id}>
              <Link
                to={`/groups/${g.id}`}
                className="springy flex min-h-16 items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-sm hover:bg-elev"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <UsersRound size={20} strokeWidth={1.8} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{g.name}</span>
                  <span className="block text-sm text-muted">
                    {g.memberCount} member{g.memberCount === 1 ? '' : 's'}
                    {g.membership === 'owner' ? ' · yours' : ''}
                  </span>
                </span>
                <ChevronRight size={20} className="shrink-0 text-muted" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Activity: workouts you and your friends chose to share. Last on the
          page because it can be long (up to 20 cards) — the things you act on
          stay within reach above it. */}
      {feedItems.length > 0 && (
        <section className="space-y-2">
          <SectionLabel>Activity</SectionLabel>
          <ul className="space-y-2">
            {feedItems.slice(0, 20).map((item) => (
              <SharedWorkoutCard key={item.id} item={item} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
