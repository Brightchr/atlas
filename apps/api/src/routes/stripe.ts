import { Hono } from 'hono';
import type Stripe from 'stripe';
import { query } from '../db/pool';
import { env } from '../lib/env';
import { stripe, stripeConfigured, syncStripeMembership } from '../lib/stripe';

/** Stripe calls this server-to-server: no session, no cookies, no CORS
 * preflight. The signature check IS the authentication — never mount auth
 * middleware here, and never parse the body before verifying it. */
export const stripeRoutes = new Hono();

/** Every handled event resolves the same way — re-sync the customer from
 * Stripe — so new event types only need adding to this set. */
const HANDLED_EVENTS = new Set([
  'checkout.session.completed',
  'invoice.paid',
  'invoice.payment_failed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]);

stripeRoutes.post('/webhook', async (c) => {
  if (!stripeConfigured()) return c.json({ error: 'Stripe is not configured' }, 501);

  const signature = c.req.header('stripe-signature');
  if (!signature) return c.json({ error: 'Missing signature' }, 400);

  // Raw text, untouched: signature verification runs over the exact bytes
  // Stripe sent, so any prior JSON parse/re-serialize would break it.
  const body = await c.req.text();
  let event: Stripe.Event;
  try {
    event = await stripe().webhooks.constructEventAsync(body, signature, env.stripeWebhookSecret);
  } catch {
    return c.json({ error: 'Invalid signature' }, 400);
  }

  if (!HANDLED_EVENTS.has(event.type)) return c.json({ received: true });

  // Stripe retries deliveries until it sees a 2xx; the events table makes each
  // event apply exactly once even when a retry crosses a slow first attempt.
  const fresh = await query<{ id: string }>(
    'INSERT INTO stripe_events (id, type) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id',
    [event.id, event.type],
  );
  if (fresh.length === 0) return c.json({ received: true });

  const object = event.data.object as { customer?: string | { id: string } | null };
  const customerId = typeof object.customer === 'string' ? object.customer : object.customer?.id;

  try {
    if (customerId) await syncStripeMembership(customerId);
  } catch (err) {
    // Give the retry a clean slate: drop the idempotency marker so Stripe's
    // redelivery re-runs the sync instead of short-circuiting on it.
    await query('DELETE FROM stripe_events WHERE id = $1', [event.id]).catch(() => {});
    throw err;
  }
  return c.json({ received: true });
});
