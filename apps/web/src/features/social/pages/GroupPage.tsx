import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Crown, LogOut, Trash2, UserPlus } from 'lucide-react';
import type { GroupMemberEntry } from '@arcadia/shared';
import { Button, Card, ConfirmSheet, IconButton, PageHeader, SectionLabel } from '@/components/ui';
import { displayWeight, useUnits, weightUnit } from '@/lib/units';
import {
  useDeleteGroup,
  useGroup,
  useInviteToGroup,
  useLeaveGroup,
  useSetGroupSharing,
} from '../api';
import { AvatarIcon } from '@/features/profile/avatars';
import { StatChips } from '../components/StatChips';

/** Normalized effort: percent of the member's OWN weekly goal — a 3x/week
 * beginner who hit 3 ties a 6x/week vet who hit 6 (the Apple-competition
 * fairness model from the research). Falls back to raw count when no goal. */
function effortPct(m: GroupMemberEntry): number {
  if (!m.stats) return -1;
  const target = m.stats.weeklyTargetDays;
  if (!target) return Math.min(1, m.stats.week.workouts / 5) * 0.99;
  return Math.min(1.5, m.stats.week.workouts / target);
}

export function GroupPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const units = useUnits();
  const groupQuery = useGroup(id);
  const invite = useInviteToGroup();
  const leave = useLeaveGroup();
  const deleteGroup = useDeleteGroup();
  const setSharing = useSetGroupSharing();
  const [username, setUsername] = useState('');
  // Which confirmation sheet is open, if any.
  const [confirming, setConfirming] = useState<'delete' | 'leave' | null>(null);

  const group = groupQuery.data;
  if (groupQuery.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
        <PageHeader title="Group" back="/friends" />
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }
  if (!group) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
        <PageHeader title="Group" back="/friends" />
        <p className="text-sm text-muted">Group not found — it may have been deleted.</p>
      </div>
    );
  }

  const ranked = [...group.members].sort((a, b) => effortPct(b) - effortPct(a));
  const totals = group.members.reduce(
    (acc, m) => ({
      workouts: acc.workouts + (m.stats?.week.workouts ?? 0),
      volumeKg: acc.volumeKg + (m.stats?.week.volumeKg ?? 0),
      cardioMin: acc.cardioMin + (m.stats?.week.cardioMin ?? 0),
    }),
    { workouts: 0, volumeKg: 0, cardioMin: 0 },
  );

  const submitInvite = () => {
    const name = username.trim();
    if (!name) return;
    invite.mutate({ groupId: group.id, username: name }, { onSuccess: () => setUsername('') });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <PageHeader
        title={group.name}
        subtitle={`${group.memberCount} member${group.memberCount === 1 ? '' : 's'} · run by ${group.owner}`}
        back="/friends"
        actions={
          group.membership === 'owner' && (
            <IconButton
              label="Delete group"
              variant="danger"
              onClick={() => setConfirming('delete')}
            >
              <Trash2 size={18} aria-hidden />
            </IconButton>
          )
        }
      />

      {/* Co-op aggregate — the number everyone contributed to. */}
      <Card className="p-4">
        <p className="text-sm">
          This week the crew logged{' '}
          <span className="font-bold tabular-nums">{totals.workouts}</span> workout
          {totals.workouts === 1 ? '' : 's'}
          {totals.volumeKg > 0 && (
            <>
              {' '}
              and lifted{' '}
              <span className="font-bold tabular-nums">
                {Math.round(displayWeight(totals.volumeKg, units)).toLocaleString()}{' '}
                {weightUnit(units)}
              </span>{' '}
              total
            </>
          )}
          {totals.cardioMin > 0 && (
            <>
              {' '}
              with <span className="font-bold tabular-nums">{totals.cardioMin}</span> cardio minutes
            </>
          )}
          .
        </p>
      </Card>

      <section className="space-y-2">
        <SectionLabel>This week</SectionLabel>
        <ul className="space-y-2">
          {ranked.map((m, i) => {
            const pct = effortPct(m);
            return (
              <li key={m.user.id}>
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <span className="w-5 shrink-0 text-center text-sm font-bold text-muted tabular-nums">
                      {pct >= 0 ? i + 1 : '·'}
                    </span>
                    <AvatarIcon
                      name={m.user.username}
                      icon={m.user.avatarIcon}
                      tone={m.user.avatarTone}
                      online={m.online}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {m.user.displayName ?? m.user.username}
                      {m.role === 'owner' && (
                        <Crown
                          size={14}
                          aria-label="Group owner"
                          className="mb-0.5 ml-1.5 inline text-accent"
                        />
                      )}
                    </span>
                    {pct >= 1 && (
                      <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent">
                        Goal hit
                      </span>
                    )}
                  </div>
                  {m.stats ? (
                    <>
                      <div className="mt-2 ml-8">
                        <StatChips stats={m.stats} updatedAt={m.statsUpdatedAt} />
                      </div>
                      {m.stats.weeklyTargetDays ? (
                        <div className="mt-2 ml-8 h-2 overflow-hidden rounded-full bg-elev">
                          <div
                            className="h-full rounded-full bg-linear-to-r from-accent to-accent-2 transition-[width] duration-500"
                            style={{ width: `${Math.min(100, Math.round(pct * 100))}%` }}
                          />
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="mt-1.5 ml-8 text-sm text-muted">Not sharing stats.</p>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      {group.invited.length > 0 && (
        <p className="text-sm text-muted">
          Invited, not joined yet:{' '}
          {group.invited.map((u) => u.displayName ?? u.username).join(', ')}
        </p>
      )}

      {group.membership !== 'invited' && (
        <section className="space-y-3">
          <SectionLabel>Invite</SectionLabel>
          {/* A real <form> so the phone keyboard's Go/Enter key submits. */}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submitInvite();
            }}
          >
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Invite by username"
              aria-label="Invite by username"
              autoCapitalize="none"
              autoCorrect="off"
              className="min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-base outline-none placeholder:text-muted/70 focus:border-accent"
            />
            <Button
              type="submit"
              className="shrink-0"
              disabled={!username.trim() || invite.isPending}
            >
              <UserPlus size={18} aria-hidden />
              Invite
            </Button>
          </form>
          {invite.isError && <p className="text-sm text-rose-500">{invite.error.message}</p>}

          <label className="flex min-h-11 cursor-pointer items-center gap-3 px-1 text-sm text-muted">
            <input
              type="checkbox"
              checked={group.sharingStats}
              disabled={setSharing.isPending}
              onChange={(e) => setSharing.mutate({ groupId: group.id, enabled: e.target.checked })}
              className="h-5 w-5 shrink-0 accent-accent"
            />
            Share my stats with this group
          </label>

          {group.membership === 'member' && (
            <Button variant="danger" block onClick={() => setConfirming('leave')}>
              <LogOut size={18} aria-hidden />
              Leave group
            </Button>
          )}
        </section>
      )}

      {confirming === 'delete' && (
        <ConfirmSheet
          title="Delete this group?"
          body={`"${group.name}" will be removed for all ${group.memberCount} member${
            group.memberCount === 1 ? '' : 's'
          }. This can't be undone.`}
          confirmLabel="Delete group"
          pending={deleteGroup.isPending}
          onConfirm={() =>
            deleteGroup.mutate(group.id, { onSuccess: () => void navigate('/friends') })
          }
          onClose={() => setConfirming(null)}
        />
      )}
      {confirming === 'leave' && (
        <ConfirmSheet
          title="Leave this group?"
          body={`You'll stop seeing "${group.name}" and its members' stats.`}
          confirmLabel="Leave group"
          pending={leave.isPending}
          onConfirm={() => leave.mutate(group.id, { onSuccess: () => void navigate('/friends') })}
          onClose={() => setConfirming(null)}
        />
      )}
    </div>
  );
}
