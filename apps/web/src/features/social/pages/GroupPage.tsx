import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ChevronLeft, Crown, Trash2, UserPlus } from 'lucide-react';
import type { GroupMemberEntry } from '@arcadia/shared';
import { displayWeight, useUnits } from '@/lib/units';
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
  const [confirming, setConfirming] = useState(false);

  const group = groupQuery.data;
  if (groupQuery.isLoading) {
    return <div className="mx-auto max-w-3xl p-4 text-sm text-muted md:p-6">Loading…</div>;
  }
  if (!group) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 p-4 md:p-6">
        <p className="text-sm text-muted">Group not found — it may have been deleted.</p>
        <Link to="/you/friends" className="text-sm font-medium text-accent hover:underline">
          ← Back to friends
        </Link>
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

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <Link
          to="/you/friends"
          className="flex items-center gap-1 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-elev"
        >
          <ChevronLeft size={14} aria-hidden />
          Friends
        </Link>
      </div>

      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{group.name}</h1>
          <p className="text-sm text-muted">
            {group.memberCount} member{group.memberCount === 1 ? '' : 's'} · run by {group.owner}
          </p>
        </div>
        {group.membership === 'owner' &&
          (confirming ? (
            <span className="flex shrink-0 items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() =>
                  deleteGroup.mutate(group.id, { onSuccess: () => void navigate('/you/friends') })
                }
                className="rounded-lg bg-rose-500/10 px-2.5 py-1.5 font-semibold text-rose-600"
              >
                Delete group
              </button>
              <button type="button" onClick={() => setConfirming(false)} className="rounded-lg px-2 py-1.5 text-muted hover:text-ink">
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              aria-label="Delete group"
              className="shrink-0 rounded-lg p-2 text-muted transition-colors hover:bg-elev hover:text-ink"
            >
              <Trash2 size={16} aria-hidden />
            </button>
          ))}
      </header>

      {/* Co-op aggregate — the number everyone contributed to. */}
      <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <p className="text-sm">
          This week the crew logged{' '}
          <span className="font-bold tabular-nums">{totals.workouts}</span> workout
          {totals.workouts === 1 ? '' : 's'}
          {totals.volumeKg > 0 && (
            <>
              {' '}and lifted{' '}
              <span className="font-bold tabular-nums">
                {Math.round(displayWeight(totals.volumeKg, units)).toLocaleString()}
              </span>{' '}
              total
            </>
          )}
          {totals.cardioMin > 0 && (
            <>
              {' '}with <span className="font-bold tabular-nums">{totals.cardioMin}</span> cardio
              minutes
            </>
          )}
          .
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">This week</h2>
        <ul className="space-y-2">
          {ranked.map((m, i) => {
            const pct = effortPct(m);
            return (
              <li key={m.user.id} className="rounded-2xl border border-line bg-surface p-3.5 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="w-5 shrink-0 text-center text-sm font-bold text-muted tabular-nums">
                    {pct >= 0 ? i + 1 : '·'}
                  </span>
                  <AvatarIcon name={m.user.username} icon={m.user.avatarIcon} tone={m.user.avatarTone} online={m.online} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {m.user.displayName ?? m.user.username}
                    {m.role === 'owner' && (
                      <Crown size={12} aria-hidden className="mb-0.5 ml-1.5 inline text-amber-500" />
                    )}
                  </span>
                  {pct >= 1 && (
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold text-accent">
                      goal hit
                    </span>
                  )}
                </div>
                {m.stats ? (
                  <>
                    <div className="mt-2 ml-8">
                      <StatChips stats={m.stats} updatedAt={m.statsUpdatedAt} />
                    </div>
                    {m.stats.weeklyTargetDays ? (
                      <div className="mt-2 ml-8 h-1.5 overflow-hidden rounded-full bg-elev">
                        <div
                          className="h-full rounded-full bg-linear-to-r from-accent to-accent-2 transition-[width] duration-500"
                          style={{ width: `${Math.min(100, Math.round(pct * 100))}%` }}
                        />
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-1.5 ml-8 text-xs text-muted/80">Not sharing stats.</p>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {group.invited.length > 0 && (
        <p className="text-xs text-muted">
          Invited, not joined yet: {group.invited.map((u) => u.displayName ?? u.username).join(', ')}
        </p>
      )}

      {group.membership !== 'invited' && (
        <section className="space-y-3">
          <div className="relative">
            <UserPlus size={15} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" aria-hidden />
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && username.trim()) {
                  invite.mutate(
                    { groupId: group.id, username: username.trim() },
                    { onSuccess: () => setUsername('') },
                  );
                }
              }}
              placeholder="Invite by username…"
              aria-label="Invite by username"
              className="w-full rounded-2xl border border-line bg-surface py-2.5 pr-24 pl-10 text-sm shadow-sm outline-none placeholder:text-muted/70 focus:border-accent"
            />
            <button
              type="button"
              disabled={!username.trim() || invite.isPending}
              onClick={() =>
                invite.mutate(
                  { groupId: group.id, username: username.trim() },
                  { onSuccess: () => setUsername('') },
                )
              }
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-xl bg-linear-to-r from-accent to-accent-2 px-3 py-1.5 text-xs font-semibold text-accent-ink shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              Invite
            </button>
          </div>
          {invite.isError && <p className="text-xs text-rose-500">{invite.error.message}</p>}

          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={group.sharingStats}
              disabled={setSharing.isPending}
              onChange={(e) => setSharing.mutate({ groupId: group.id, enabled: e.target.checked })}
              className="h-3.5 w-3.5"
            />
            Share my stats with this group
          </label>

          {group.membership === 'member' && (
            <button
              type="button"
              onClick={() => leave.mutate(group.id, { onSuccess: () => void navigate('/you/friends') })}
              className="text-xs font-medium text-muted underline-offset-2 hover:text-ink hover:underline"
            >
              Leave group
            </button>
          )}
        </section>
      )}
    </div>
  );
}
