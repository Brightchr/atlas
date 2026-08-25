import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Ban, VenetianMask } from 'lucide-react';
import {
  resolveMembership,
  type AuthUser,
  type MembershipPlan,
  type UserRole,
} from '@arcadia/shared';
import {
  useAdminUsers,
  useBanUser,
  useImpersonate,
  useSetPlan,
  useSetRole,
  useUnbanUser,
  type AdminUser,
} from '../api';

const ROLES: UserRole[] = ['user', 'moderator', 'admin'];
const PLANS: MembershipPlan[] = ['free', 'pro'];

function StatusBadge({ user }: { user: AdminUser }) {
  if (user.status === 'banned') {
    return (
      <span
        className="rounded-full bg-rose-500/15 px-2 py-0.5 text-xs font-semibold text-rose-500"
        title={user.banReason || undefined}
      >
        Banned
      </span>
    );
  }
  const membership = resolveMembership(user.plan, user.planExpiresAt, user.trialEndsAt);
  if (user.role !== 'user') {
    return (
      <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">
        Staff
      </span>
    );
  }
  if (membership === 'pro') {
    return (
      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-500">
        Pro
      </span>
    );
  }
  if (membership === 'trial') {
    return (
      <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-xs font-semibold text-sky-500">
        Trial
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-600">
      Expired
    </span>
  );
}

/** Ban with an inline confirm: reason + the option to also block the
 * account's recent sign-in IPs. */
function BanControl({ user }: { user: AdminUser }) {
  const ban = useBanUser();
  const unban = useUnbanUser();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [blockIps, setBlockIps] = useState(false);

  if (user.status === 'banned') {
    return (
      <button
        type="button"
        disabled={unban.isPending}
        onClick={() => unban.mutate(user.id)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-elev disabled:opacity-50"
      >
        Unban
      </button>
    );
  }
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 px-2.5 py-1.5 text-xs font-medium text-rose-500 transition-colors hover:bg-rose-500/10"
      >
        <Ban size={14} aria-hidden />
        Ban
      </button>
    );
  }
  return (
    <div className="w-56 space-y-2 rounded-xl border border-rose-500/40 bg-elev p-2.5">
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (shown in audit log)"
        maxLength={300}
        className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-xs outline-none placeholder:text-muted/70 focus:border-accent"
      />
      <label className="flex items-center gap-1.5 text-xs text-muted">
        <input
          type="checkbox"
          checked={blockIps}
          onChange={(e) => setBlockIps(e.target.checked)}
        />
        Also block their recent IPs
      </label>
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={ban.isPending}
          onClick={() =>
            ban.mutate(
              { userId: user.id, reason: reason.trim(), blockIps },
              { onSuccess: () => setOpen(false) },
            )
          }
          className="rounded-lg bg-rose-500/15 px-2.5 py-1.5 text-xs font-semibold text-rose-500 transition-colors hover:bg-rose-500/25 disabled:opacity-50"
        >
          Confirm ban
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface"
        >
          Cancel
        </button>
      </div>
      {ban.isError && <p className="text-xs text-rose-500">{ban.error.message}</p>}
    </div>
  );
}

export function UsersSection({ me }: { me: AuthUser }) {
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  const users = useAdminUsers(q);
  const impersonate = useImpersonate();
  const setRole = useSetRole();
  const setPlan = useSetPlan();

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Users</h2>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search email or username…"
          className="w-full max-w-xs rounded-xl border border-line bg-surface px-4 py-2 text-sm shadow-sm outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs tracking-wide text-muted uppercase">
              <th className="px-4 py-3 font-semibold">User</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Plan</th>
              <th className="px-4 py-3 font-semibold">Joined</th>
              <th className="px-4 py-3 font-semibold">Sessions</th>
              <th className="px-4 py-3 font-semibold">Last seen</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.data?.users.map((u) => (
              <tr key={u.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  <p className="font-semibold">{u.username}</p>
                  <p className="text-xs text-muted">{u.email}</p>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge user={u} />
                  {u.status !== 'banned' && u.role === 'user' && u.trialEndsAt && (
                    <p className="mt-1 text-xs whitespace-nowrap text-muted">
                      trial ends {new Date(u.trialEndsAt).toLocaleDateString()}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3">
                  {u.id === me.id ? (
                    <span className="font-medium">{u.role} (you)</span>
                  ) : (
                    <select
                      value={u.role}
                      onChange={(e) =>
                        setRole.mutate({ userId: u.id, role: e.target.value as UserRole })
                      }
                      className="rounded-lg border border-line bg-surface px-2 py-1 text-sm outline-none focus:border-accent"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={u.plan}
                    onChange={(e) =>
                      setPlan.mutate({ userId: u.id, plan: e.target.value as MembershipPlan })
                    }
                    className="rounded-lg border border-line bg-surface px-2 py-1 text-sm outline-none focus:border-accent"
                  >
                    {PLANS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-muted">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 tabular-nums">{u.activeSessions}</td>
                <td className="px-4 py-3 whitespace-nowrap text-muted">
                  {u.lastLogin ? new Date(u.lastLogin).toLocaleString() : '—'}
                  {u.lastIp && <p className="font-mono text-xs">{u.lastIp}</p>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-start gap-1.5">
                    {u.role !== 'admin' && u.status === 'active' && (
                      <button
                        type="button"
                        onClick={() => impersonate.mutate(u.id, { onSuccess: () => navigate('/') })}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-elev"
                        title={`View the app as ${u.username}`}
                      >
                        <VenetianMask size={14} aria-hidden />
                        Masquerade
                      </button>
                    )}
                    {u.role !== 'admin' && u.id !== me.id && <BanControl user={u} />}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.data?.users.length === 0 && (
          <p className="px-4 py-6 text-center text-muted">No users match.</p>
        )}
      </div>
      {(impersonate.isError || setRole.isError || setPlan.isError) && (
        <p className="text-sm text-rose-500">
          {impersonate.error?.message ?? setRole.error?.message ?? setPlan.error?.message}
        </p>
      )}
    </section>
  );
}
