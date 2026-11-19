import { Link } from 'react-router';
import {
  ChevronRight,
  CreditCard,
  LogOut,
  Settings,
  ShieldCheck,
  UserRound,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { Button, Card, PageHeader } from '@/components/ui';
import { useCurrentUser, useLogout } from '@/features/auth/api';
import { useIncomingRequestCount } from '@/features/social/components/FriendsCard';

function Row({
  to,
  Icon,
  label,
  hint,
  badge = 0,
}: {
  to: string;
  Icon: LucideIcon;
  label: string;
  hint: string;
  /** A count to flag on the row (waiting friend requests). */
  badge?: number;
}) {
  return (
    <Link
      to={to}
      className="flex min-h-16 items-center gap-3 px-4 transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-elev"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
        <Icon size={19} strokeWidth={1.8} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{label}</span>
        <span className="block truncate text-sm text-muted">{hint}</span>
      </span>
      {badge > 0 && (
        <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-bold text-accent-ink">
          {badge}
        </span>
      )}
      <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
    </Link>
  );
}

/** The You tab: the account in one place. On phones this replaces the
 * avatar menu that used to hide Profile and Settings in the top bar. */
export function YouPage() {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const requests = useIncomingRequestCount();

  const membership =
    user?.role !== 'user'
      ? null
      : user.membership === 'pro'
        ? 'Pro member'
        : user.membership === 'trial'
          ? 'Free trial'
          : 'Membership expired';

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-6">
      <PageHeader title="You" />

      {/* Wide screens: who you are on the left, where you can go on the right. */}
      <div className="grid items-start gap-5 lg:grid-cols-3">
        <div className="min-w-0 space-y-3">
          <Card className="flex items-center gap-4 p-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-accent to-accent-2 text-xl font-bold text-accent-ink uppercase">
              {user?.username.charAt(0) ?? '?'}
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold">{user?.username ?? 'Guest'}</p>
              <p className="truncate text-sm text-muted">{user?.email ?? 'Not signed in'}</p>
              {membership && (
                <p className="mt-0.5 text-sm font-semibold text-accent">{membership}</p>
              )}
            </div>
          </Card>
          <Button variant="secondary" size="lg" block onClick={() => logout.mutate()}>
            <LogOut size={18} aria-hidden />
            Sign out
          </Button>
        </div>

        <div className="min-w-0 space-y-5 lg:col-span-2">
          <Card className="divide-y divide-line">
            <Row
              to="/profile"
              Icon={UserRound}
              label="Profile"
              hint="Name, avatar, training profile"
            />
            <Row
              to="/friends"
              Icon={UsersRound}
              label="Friends"
              hint="Friends, groups and shared workouts"
              badge={requests}
            />
            <Row
              to="/settings"
              Icon={Settings}
              label="Settings"
              hint="Units, theme, sync and billing"
            />
            {user?.role === 'user' && user.membership !== 'pro' && (
              <Row to="/upgrade" Icon={CreditCard} label="Membership" hint="Plans and billing" />
            )}
            {user?.role === 'admin' && (
              <Row
                to="/admin"
                Icon={ShieldCheck}
                label="Admin"
                hint="Users, promotions and moderation"
              />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
