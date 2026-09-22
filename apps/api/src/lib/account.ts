import { and, eq, isNotNull, lt, sql } from 'drizzle-orm';
import { db } from '../db/db';
import { users } from '../db/schema';
import { stripe, stripeConfigured } from './stripe';

/** Account deletion lifecycle. Soft delete marks the row and kills access;
 * the row (and all cascading data) survives a grace window so signing back
 * in can restore it; the daily sweep hard-deletes what's past the window. */

export const DELETION_GRACE_DAYS = 14;

const pastGraceWindow = () =>
  and(
    isNotNull(users.deletedAt),
    lt(users.deletedAt, sql`now() - make_interval(days => ${DELETION_GRACE_DAYS})`),
  );

/** Ends billing immediately — nobody should be charged for a deleted
 * account. Best-effort: a Stripe hiccup must not block the deletion (the
 * purge retries customer cleanup later). */
export async function cancelStripeForUser(userId: string): Promise<void> {
  if (!stripeConfigured()) return;
  const [row] = await db
    .select({ stripeSubscriptionId: users.stripeSubscriptionId })
    .from(users)
    .where(eq(users.id, userId));
  if (!row?.stripeSubscriptionId) return;
  try {
    await stripe().subscriptions.cancel(row.stripeSubscriptionId);
  } catch (err) {
    console.warn('subscription cancel on account deletion failed:', err);
  }
}

/** Hard-deletes accounts whose grace window has passed. The users FK
 * cascades wipe sessions, sync data, social rows, tokens — everything owned.
 * Stripe customers are deleted too so no orphaned billing records remain. */
export async function purgeDeletedAccounts(): Promise<void> {
  const due = await db
    .select({ id: users.id, stripeCustomerId: users.stripeCustomerId })
    .from(users)
    .where(pastGraceWindow());
  if (due.length === 0) return;

  if (stripeConfigured()) {
    for (const row of due) {
      if (!row.stripeCustomerId) continue;
      try {
        await stripe().customers.del(row.stripeCustomerId);
      } catch (err) {
        console.warn('stripe customer cleanup failed (continuing purge):', err);
      }
    }
  }

  await db.delete(users).where(pastGraceWindow());
  console.log(`purged ${due.length} deleted account(s) past the grace window`);
}
