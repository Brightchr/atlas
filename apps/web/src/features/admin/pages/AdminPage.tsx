import { useState } from 'react';
import { Navigate } from 'react-router';
import {
  Activity,
  Ban,
  Flag,
  Globe,
  ScrollText,
  Sparkles,
  TicketPercent,
  UserPlus,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { StatTile } from '@/components/StatTile';
import { useCurrentUser } from '@/features/auth/api';
import { useAdminStats } from '../api';
import { AuditSection } from '../components/AuditSection';
import { ModerationSection } from '../components/ModerationSection';
import { PromotionsSection } from '../components/PromotionsSection';
import { UsersSection } from '../components/UsersSection';

type AdminTab = 'users' | 'promotions' | 'moderation' | 'audit';

const TABS: { id: AdminTab; label: string; Icon: LucideIcon }[] = [
  { id: 'users', label: 'Users', Icon: Users },
  { id: 'promotions', label: 'Promotions', Icon: TicketPercent },
  { id: 'moderation', label: 'Moderation', Icon: Flag },
  { id: 'audit', label: 'Audit', Icon: ScrollText },
];

export function AdminPage() {
  const { data: me, isLoading } = useCurrentUser();
  const stats = useAdminStats();
  const [tab, setTab] = useState<AdminTab>('users');

  if (isLoading) return <p className="p-6 text-muted">Loading…</p>;
  if (!me || me.role !== 'admin') return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-bold">Administration</h1>
        <p className="text-sm text-muted">Users, membership, promotions and moderation.</p>
      </header>

      <section aria-label="Site stats" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Users" value={`${stats.data?.users ?? '—'}`} Icon={Users} tint="accent" />
        <StatTile
          label="Signups (7 days)"
          value={`${stats.data?.signups7d ?? '—'}`}
          Icon={UserPlus}
          tint="sky"
        />
        <StatTile
          label="Active sessions"
          value={`${stats.data?.activeSessions ?? '—'}`}
          Icon={Activity}
          tint="emerald"
        />
        <StatTile
          label="Paying members"
          value={`${stats.data?.proUsers ?? '—'}`}
          Icon={Zap}
          tint="orange"
        />
        <StatTile
          label="On trial"
          value={`${stats.data?.trialUsers ?? '—'}`}
          Icon={Sparkles}
          tint="sky"
        />
        <StatTile
          label="Open reports"
          value={`${stats.data?.openReports ?? '—'}`}
          Icon={Flag}
          tint="rose"
        />
        <StatTile
          label="Banned"
          value={`${stats.data?.bannedUsers ?? '—'}`}
          Icon={Ban}
          tint="rose"
        />
        <StatTile
          label="Blocked IPs"
          value={`${stats.data?.ipBlocks ?? '—'}`}
          Icon={Globe}
          tint="orange"
        />
      </section>

      <nav
        aria-label="Admin sections"
        className="grid gap-1 rounded-2xl border border-line bg-surface p-1 shadow-sm"
        style={{ gridTemplateColumns: `repeat(${TABS.length}, minmax(0, 1fr))` }}
      >
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`springy inline-flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold sm:text-sm ${
              tab === id
                ? 'bg-linear-to-r from-accent to-accent-2 text-accent-ink shadow-sm'
                : 'text-muted hover:bg-elev hover:text-ink'
            }`}
          >
            <Icon size={14} strokeWidth={1.9} aria-hidden />
            {label}
          </button>
        ))}
      </nav>

      {tab === 'users' && <UsersSection me={me} />}
      {tab === 'promotions' && <PromotionsSection />}
      {tab === 'moderation' && <ModerationSection />}
      {tab === 'audit' && <AuditSection />}
    </div>
  );
}
