import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { Activity, Bell, UserPlus, Users, VenetianMask } from 'lucide-react';
import type { UserRole } from '@arcadia/shared';
import { StatTile } from '@/components/StatTile';
import { useCurrentUser } from '@/features/auth/api';
import { useAdminStats, useAdminUsers, useImpersonate, useSetRole } from '../api';

const ROLES: UserRole[] = ['user', 'moderator', 'admin'];

export function AdminPage() {
  const { data: me, isLoading } = useCurrentUser();
  const [q, setQ] = useState('');
  const navigate = useNavigate();

  const stats = useAdminStats();
  const users = useAdminUsers(q);
  const impersonate = useImpersonate();
  const setRole = useSetRole();

  if (isLoading) return <p className="p-6 text-muted">Loading…</p>;
  if (!me || me.role !== 'admin') return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-bold">Administration</h1>
        <p className="text-sm text-muted">Users, roles and troubleshooting.</p>
      </header>

      <section aria-label="Site stats" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Users" value={`${stats.data?.users ?? '—'}`} Icon={Users} tint="accent" />
        <StatTile
          label="Active sessions"
          value={`${stats.data?.activeSessions ?? '—'}`}
          Icon={Activity}
          tint="emerald"
        />
        <StatTile
          label="Signups (7 days)"
          value={`${stats.data?.signups7d ?? '—'}`}
          Icon={UserPlus}
          tint="sky"
        />
        <StatTile
          label="Notifications sent"
          value={`${stats.data?.notifications ?? '—'}`}
          Icon={Bell}
          tint="orange"
        />
      </section>

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
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs tracking-wide text-muted uppercase">
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Joined</th>
                <th className="px-4 py-3 font-semibold">Sessions</th>
                <th className="px-4 py-3 font-semibold">Last login</th>
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
                  <td className="px-4 py-3 whitespace-nowrap text-muted">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{u.activeSessions}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted">
                    {u.lastLogin ? new Date(u.lastLogin).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {u.role !== 'admin' && (
                      <button
                        type="button"
                        onClick={() =>
                          impersonate.mutate(u.id, { onSuccess: () => navigate('/') })
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-elev"
                        title={`View the app as ${u.username}`}
                      >
                        <VenetianMask size={14} aria-hidden />
                        Masquerade
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.data?.users.length === 0 && (
            <p className="px-4 py-6 text-center text-muted">No users match.</p>
          )}
        </div>
        {(impersonate.isError || setRole.isError) && (
          <p className="text-sm text-rose-500">
            {impersonate.error?.message ?? setRole.error?.message}
          </p>
        )}
      </section>
    </div>
  );
}
