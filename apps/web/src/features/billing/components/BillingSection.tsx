import { Link } from 'react-router';
import { BadgeCheck, CreditCard } from 'lucide-react';
import { useCurrentUser } from '@/features/auth/api';
import { useBillingStatus } from '../api';
import { formatDate } from '@/lib/dates';

function membershipLine(status: {
  membership: string;
  planExpiresAt: string | null;
  trialEndsAt: string | null;
  comped: boolean;
}): string {
  if (status.comped) {
    return 'Complimentary access — no subscription needed.';
  }
  if (status.membership === 'pro') {
    return status.planExpiresAt
      ? `Full access until ${formatDate(status.planExpiresAt)}.`
      : 'Full access — active subscription.';
  }
  if (status.membership === 'trial') {
    return `Free trial — ends ${
      status.trialEndsAt ? formatDate(status.trialEndsAt) : 'soon'
    }.`;
  }
  return 'Trial ended — subscribe to keep using the app.';
}

/** Membership summary for the settings page: current status, price, redeemed
 * codes, and the door to the upgrade page. Staff see a simple note instead. */
export function BillingSection() {
  const { data: user } = useCurrentUser();
  const billing = useBillingStatus();
  const status = billing.data;

  return (
    <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
          <CreditCard size={17} strokeWidth={1.8} aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold">Membership</p>
          <p className="text-xs text-muted">
            {user && user.role !== 'user'
              ? `Staff account (${user.role}) — full access, no subscription needed.`
              : status
                ? `${membershipLine(status)} $${status.priceUsd}/month after the trial.`
                : 'Loading…'}
          </p>
        </div>
      </div>

      {status && status.redemptions.length > 0 && (
        <ul className="mb-3 space-y-1">
          {status.redemptions.map((r) => (
            <li key={r.code + r.redeemedAt} className="flex items-center gap-2 text-xs text-muted">
              <BadgeCheck size={14} className="text-emerald-500" aria-hidden />
              <span className="font-mono font-semibold text-ink">{r.code}</span>
              {r.grantDays
                ? `— ${r.grantDays} days of access applied`
                : `— ${r.discountPercent}% off at checkout`}
            </li>
          ))}
        </ul>
      )}

      {user?.role === 'user' && status?.membership !== 'pro' && (
        <Link
          to="/upgrade"
          className="inline-flex items-center gap-1.5 rounded-xl bg-linear-to-r from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90"
        >
          Subscribe or redeem a code
        </Link>
      )}
    </section>
  );
}
