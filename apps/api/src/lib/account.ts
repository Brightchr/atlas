import { query } from '../db/pool';
import { stripe, stripeConfigured } from './stripe';

/** Account deletion lifecycle. Soft delete marks the row and kills access;
 * the row (and all cascading data) survives a grace window so signing back
 * in can restore it; the daily sweep hard-deletes what's past the window. */

export const DELETION_GRACE_DAYS = 14;

/** Ends billing immediately — nobody should be charged for a deleted
 * account. Best-effort: a Stripe hiccup must not block the deletion (the
 * purge retries customer cleanup later). */
export async function cancelStripeForUser(userId: string): Promise<void> {
  if (!stripeConfigured()) return;
  const [row] = await query<{ stripe_subscription_id: string | null }>(
    'SELECT stripe_subscription_id FROM users WHERE id = $1',
    [userId],
  );
  if (!row?.stripe_subscription_id) return;
  try {
    await stripe().subscriptions.cancel(row.stripe_subscription_id);
  } catch (err) {
    console.warn('subscription cancel on account deletion failed:', err);
  }
}

/** Hard-deletes accounts whose grace window has passed. The users FK
 * cascades wipe sessions, sync data, social rows, tokens — everything owned.
 * Stripe customers are deleted too so no orphaned billing records remain. */
export async function purgeDeletedAccounts(): Promise<void> {
  const due = await query<{ id: string; stripe_customer_id: string | null }>(
    `SELECT id, stripe_customer_id FROM users
      WHERE deleted_at IS NOT NULL
        AND deleted_at < now() - make_interval(days => $1)`,
    [DELETION_GRACE_DAYS],
  );
  if (due.length === 0) return;

  if (stripeConfigured()) {
    for (const row of due) {
      if (!row.stripe_customer_id) continue;
      try {
        await stripe().customers.del(row.stripe_customer_id);
      } catch (err) {
        console.warn('stripe customer cleanup failed (continuing purge):', err);
      }
    }
  }

  await query(
    `DELETE FROM users
      WHERE deleted_at IS NOT NULL
        AND deleted_at < now() - make_interval(days => $1)`,
    [DELETION_GRACE_DAYS],
  );
  console.log(`purged ${due.length} deleted account(s) past the grace window`);
}
