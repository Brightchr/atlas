import Stripe from 'stripe';
import { query } from '../db/pool';
import { env } from './env';

/** Stripe wiring. Entitlement design: Stripe never gets its own membership
 * model — the webhook writes onto plan/plan_expires_at, the same columns
 * resolveMembership() already reads, so promo grants, comped accounts and the
 * paywall keep working unchanged. */

export function stripeConfigured(): boolean {
  return (
    env.stripeSecretKey.length > 0 &&
    env.stripeWebhookSecret.length > 0 &&
    env.stripePriceId.length > 0
  );
}

let client: Stripe | null = null;

/** Lazy singleton — constructing with an empty key throws, and the API must
 * boot fine with Stripe unconfigured (dev without keys, tests). */
export function stripe(): Stripe {
  if (!client) client = new Stripe(env.stripeSecretKey);
  return client;
}

/** Statuses that keep access on. past_due stays on while Stripe retries the
 * card — access still lapses at the paid-through date if retries keep failing,
 * so a dead card never means indefinite free access. */
const ENTITLING_STATUSES = new Set<Stripe.Subscription.Status>([
  'active',
  'trialing',
  'past_due',
]);

/** Re-derive membership from Stripe (the source of truth) instead of trusting
 * individual event payloads — event fields move between API versions, a fresh
 * subscriptions.list does not. Idempotent, so webhook retries and overlapping
 * events are harmless.
 *
 * GREATEST keeps the later entitlement: a user who redeemed promo days beyond
 * the paid period keeps them, and a renewal only ever extends. Lifetime
 * accounts (pro with NULL expiry) never get an expiry attached. */
export async function syncStripeMembership(customerId: string): Promise<void> {
  const subs = await stripe().subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 10,
  });
  const live = subs.data.find((s) => ENTITLING_STATUSES.has(s.status));

  if (!live) {
    // Canceled or gone: only detach the reference. plan_expires_at stays — the
    // user keeps what they paid for until the period they already covered ends.
    await query('UPDATE users SET stripe_subscription_id = NULL WHERE stripe_customer_id = $1', [
      customerId,
    ]);
    return;
  }

  // Since API version 2025-03-31 the billing period lives on subscription
  // items, not the subscription. One price = one item, but max() keeps this
  // correct if more prices ever share the subscription.
  const periodEnd = Math.max(...live.items.data.map((item) => item.current_period_end));

  await query(
    `UPDATE users
        SET stripe_subscription_id = $2,
            plan = 'pro',
            plan_expires_at = GREATEST(coalesce(plan_expires_at, 'epoch'::timestamptz),
                                       to_timestamp($3))
      WHERE stripe_customer_id = $1
        AND NOT (plan = 'pro' AND plan_expires_at IS NULL)`,
    [customerId, live.id, periodEnd],
  );
  // Lifetime accounts keep their NULL expiry but still record the subscription
  // id so the billing-portal button works for them too.
  await query(
    `UPDATE users SET stripe_subscription_id = $2
      WHERE stripe_customer_id = $1 AND plan = 'pro' AND plan_expires_at IS NULL`,
    [customerId, live.id],
  );
}
