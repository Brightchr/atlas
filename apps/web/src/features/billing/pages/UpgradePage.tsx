import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Check, CreditCard, Settings2, Sparkles, TicketPercent } from 'lucide-react';
import { useCurrentUser } from '@/features/auth/api';
import { useBillingPortal, useBillingStatus, useCheckout, useRedeemPromo } from '../api';

const PERKS = [
  'Workout plans, training log and progress charts',
  'Calorie tracking with food search',
  'Meal plans, recipes and shopping lists',
  'Sync across all your devices',
  'Friends, groups and shared stats',
];

function PromoRedeemer() {
  const redeem = useRedeemPromo();
  const [code, setCode] = useState('');

  return (
    <div className="space-y-2">
      <label
        htmlFor="promo-code"
        className="flex items-center gap-1.5 text-sm font-semibold"
      >
        <TicketPercent size={15} className="text-accent" aria-hidden />
        Have a promo code?
      </label>
      <div className="flex gap-2">
        <input
          id="promo-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="CODE"
          className="w-full rounded-xl border border-line bg-surface px-3 py-2 font-mono text-sm outline-none placeholder:text-muted/70 focus:border-accent"
        />
        <button
          type="button"
          disabled={code.trim().length < 3 || redeem.isPending}
          onClick={() => redeem.mutate(code.trim(), { onSuccess: () => setCode('') })}
          className="rounded-xl border border-line px-4 py-2 text-sm font-semibold transition-colors hover:bg-elev disabled:opacity-50"
        >
          Apply
        </button>
      </div>
      {redeem.isError && <p className="text-sm text-rose-500">{redeem.error.message}</p>}
      {redeem.isSuccess && (
        <p className="text-sm text-emerald-500">
          {redeem.data.granted
            ? `Code applied — ${redeem.data.grantDays} days of full access added.`
            : `Code saved — ${redeem.data.discountPercent}% off will apply at checkout.`}
        </p>
      )}
    </div>
  );
}

/** The paywall. Expired members land here (RequireMembership); trial members
 * can visit early via the banner. Stripe Checkout redirects back here with
 * ?checkout=success|cancelled. */
export function UpgradePage() {
  const { data: user } = useCurrentUser();
  const billing = useBillingStatus();
  const checkout = useCheckout();
  const portal = useBillingPortal();
  const [params] = useSearchParams();
  const queryClient = useQueryClient();

  const checkoutResult = params.get('checkout');

  // The webhook that grants the plan can land a beat after Stripe's redirect,
  // so refresh once immediately and once again shortly after.
  useEffect(() => {
    if (checkoutResult !== 'success') return;
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ['billing'] });
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    };
    refresh();
    const timer = setTimeout(refresh, 2500);
    return () => clearTimeout(timer);
  }, [checkoutResult, queryClient]);

  const membership = user?.membership;
  const price = billing.data?.priceUsd ?? 10;
  const annualPrice = billing.data?.annualPriceUsd ?? 72;
  const savings = Math.round((1 - annualPrice / (price * 12)) * 100);
  const [interval, setInterval] = useState<'month' | 'year'>('month');

  return (
    <div className="mx-auto max-w-lg space-y-5 p-4 md:p-6">
      <header className="text-center">
        <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-accent to-accent-2 text-accent-ink shadow-sm">
          <Sparkles size={22} aria-hidden />
        </span>
        <h1 className="text-2xl font-bold">
          {membership === 'expired' ? 'Your free trial has ended' : 'Keep the momentum going'}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {membership === 'expired'
            ? 'Subscribe to pick up right where you left off — everything you tracked is safe.'
            : 'Subscribe now and your access continues seamlessly when the trial ends.'}
        </p>
      </header>

      {checkoutResult === 'success' && (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center text-sm text-emerald-500">
          Payment received — thank you!{' '}
          {membership === 'pro'
            ? 'Your subscription is active.'
            : 'Your subscription is being activated…'}
        </p>
      )}
      {checkoutResult === 'cancelled' && (
        <p className="rounded-xl border border-line bg-surface p-3 text-center text-sm text-muted">
          Checkout cancelled — no charge was made.
        </p>
      )}

      <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <div
          role="radiogroup"
          aria-label="Billing period"
          className="mx-auto mb-4 flex w-fit rounded-xl border border-line bg-elev p-1"
        >
          {(
            [
              { value: 'month', label: 'Monthly' },
              { value: 'year', label: `Annual · save ${savings}%` },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={interval === option.value}
              onClick={() => setInterval(option.value)}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                interval === option.value
                  ? 'bg-surface text-ink shadow-sm'
                  : 'text-muted hover:text-ink'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-4xl font-bold">${interval === 'year' ? annualPrice : price}</span>
          <span className="text-sm text-muted">/ {interval === 'year' ? 'year' : 'month'}</span>
        </div>
        {interval === 'year' && (
          <p className="mt-1 text-center text-sm text-muted">
            ${Math.round((annualPrice / 12) * 100) / 100}/month, billed once a year
          </p>
        )}
        <ul className="mt-4 space-y-2">
          {PERKS.map((perk) => (
            <li key={perk} className="flex items-start gap-2 text-sm">
              <Check size={16} className="mt-0.5 shrink-0 text-emerald-500" aria-hidden />
              {perk}
            </li>
          ))}
        </ul>
        <button
          type="button"
          disabled={checkout.isPending || membership === 'pro'}
          onClick={() => checkout.mutate(interval)}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-accent to-accent-2 px-4 py-2.5 text-sm font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <CreditCard size={16} aria-hidden />
          {membership === 'pro' ? 'You have full access' : 'Subscribe'}
        </button>
        {checkout.isError && (
          <p className="mt-2 text-center text-sm text-muted">{checkout.error.message}</p>
        )}
        {billing.data?.hasSubscription && (
          <button
            type="button"
            disabled={portal.isPending}
            onClick={() => portal.mutate()}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-elev disabled:opacity-50"
          >
            <Settings2 size={16} aria-hidden />
            Manage billing
          </button>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <PromoRedeemer />
      </section>

      {membership !== 'expired' && (
        <p className="text-center text-sm">
          <Link to="/" className="font-medium text-accent hover:underline">
            Back to the app
          </Link>
        </p>
      )}
    </div>
  );
}
