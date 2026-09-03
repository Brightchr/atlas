import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  ANNUAL_PRICE_USD,
  MONTHLY_PRICE_USD,
  effectivePlan,
  resolveMembership,
  type BillingStatus,
} from '@arcadia/shared';
import { pool, query } from '../db/pool';
import { logAudit } from '../lib/audit';
import { env } from '../lib/env';
import { rateLimit } from '../lib/rate-limit';
import { stripe, stripeConfigured } from '../lib/stripe';
import { requireAuth, type AppEnv } from '../middleware/auth';

/** Billing must stay reachable for EXPIRED members — it is the way back in.
 * Only requireAuth here, never requireActiveMember. */
export const billingRoutes = new Hono<AppEnv>();

billingRoutes.use('*', requireAuth);

billingRoutes.get('/', async (c) => {
  const user = c.get('user')!;
  const [row] = await query<{
    plan: 'free' | 'pro';
    plan_expires_at: string | null;
    trial_ends_at: string | null;
    comped: boolean;
    stripe_subscription_id: string | null;
  }>(
    `SELECT plan, plan_expires_at, trial_ends_at, comped, stripe_subscription_id
       FROM users WHERE id = $1`,
    [user.id],
  );
  if (!row) return c.json({ error: 'User not found' }, 404);

  const redemptions = await query<{
    code: string;
    discount_percent: number;
    grant_days: number | null;
    created_at: string;
  }>(
    `SELECT p.code, p.discount_percent, p.grant_days, r.created_at
       FROM promo_redemptions r JOIN promotions p ON p.id = r.promotion_id
      WHERE r.user_id = $1
      ORDER BY r.created_at DESC`,
    [user.id],
  );

  const status: BillingStatus = {
    plan: effectivePlan(row.plan, row.plan_expires_at),
    planExpiresAt: row.plan_expires_at,
    trialEndsAt: row.trial_ends_at,
    membership: resolveMembership(row.plan, row.plan_expires_at, row.trial_ends_at, row.comped),
    comped: row.comped,
    hasSubscription: row.stripe_subscription_id !== null,
    priceUsd: MONTHLY_PRICE_USD,
    annualPriceUsd: ANNUAL_PRICE_USD,
    redemptions: redemptions.map((r) => ({
      code: r.code,
      discountPercent: r.discount_percent,
      grantDays: r.grant_days,
      redeemedAt: r.created_at,
    })),
  };
  return c.json(status);
});

/** Active promotions for the dashboard banner — every signed-in user sees
 * these, so only the marketing-safe fields leave the server. */
billingRoutes.get('/promotions', async (c) => {
  const rows = await query<{
    code: string;
    description: string;
    discount_percent: number;
    grant_days: number | null;
    ends_at: string | null;
  }>(
    `SELECT code, description, discount_percent, grant_days, ends_at
       FROM promotions
      WHERE active AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now())
      ORDER BY created_at DESC
      LIMIT 3`,
  );
  return c.json({
    promotions: rows.map((p) => ({
      code: p.code,
      description: p.description,
      discountPercent: p.discount_percent,
      grantDays: p.grant_days,
      endsAt: p.ends_at,
    })),
  });
});

const redeemSchema = z.object({ code: z.string().min(3).max(30) });

/** Redeem a promo code. Tight rate limit: codes are guessable strings, and
 * this endpoint must not be usable to enumerate them. */
billingRoutes.post(
  '/redeem',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10, by: 'user' }),
  zValidator('json', redeemSchema),
  async (c) => {
    const user = c.get('user')!;
    const code = c.req.valid('json').code.trim().toUpperCase();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // FOR UPDATE serializes concurrent redemptions of the same code so a
      // max_redemptions cap cannot be overshot by racing requests.
      const promoRes = await client.query<{
        id: string;
        discount_percent: number;
        grant_days: number | null;
        max_redemptions: number | null;
        active: boolean;
        starts_at: string;
        ends_at: string | null;
      }>(
        `SELECT id, discount_percent, grant_days, max_redemptions, active, starts_at, ends_at
           FROM promotions WHERE code = $1 FOR UPDATE`,
        [code],
      );
      const promo = promoRes.rows[0];
      const now = new Date();
      const usable =
        promo &&
        promo.active &&
        new Date(promo.starts_at) <= now &&
        (promo.ends_at === null || new Date(promo.ends_at) > now);
      if (!usable) {
        await client.query('ROLLBACK');
        // One message for unknown, inactive and out-of-window codes — the
        // response must not confirm which codes exist.
        return c.json({ error: 'Invalid or expired code' }, 400);
      }

      if (promo.max_redemptions !== null) {
        const countRes = await client.query<{ n: number }>(
          'SELECT count(*)::int AS n FROM promo_redemptions WHERE promotion_id = $1',
          [promo.id],
        );
        if ((countRes.rows[0]?.n ?? 0) >= promo.max_redemptions) {
          await client.query('ROLLBACK');
          return c.json({ error: 'This code has been fully redeemed' }, 409);
        }
      }

      const inserted = await client.query(
        `INSERT INTO promo_redemptions (promotion_id, user_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id`,
        [promo.id, user.id],
      );
      if (inserted.rows.length === 0) {
        await client.query('ROLLBACK');
        return c.json({ error: 'You have already redeemed this code' }, 409);
      }

      if (promo.grant_days !== null) {
        // Grant codes extend pro from now or from the current expiry,
        // whichever is later. An indefinite pro plan (NULL expiry) is never
        // shortened by attaching an expiry to it.
        await client.query(
          `UPDATE users
              SET plan = 'pro',
                  plan_expires_at = GREATEST(coalesce(plan_expires_at, now()), now())
                                    + make_interval(days => $2)
            WHERE id = $1 AND NOT (plan = 'pro' AND plan_expires_at IS NULL)`,
          [user.id, promo.grant_days],
        );
      }

      await client.query('COMMIT');
      await logAudit(user.id, 'redeem_promo', 'promotion', promo.id, {
        code,
        grantDays: promo.grant_days,
        discountPercent: promo.discount_percent,
      });
      return c.json({
        ok: true,
        granted: promo.grant_days !== null,
        grantDays: promo.grant_days,
        discountPercent: promo.discount_percent,
      });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  },
);

/** Open a Stripe Checkout session and hand its URL to the client. This
 * endpoint only STARTS the flow — the plan is granted by the webhook
 * (routes/stripe.ts) once payment actually lands, never here. */
billingRoutes.post(
  '/checkout',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10, by: 'user' }),
  zValidator('json', z.object({ interval: z.enum(['month', 'year']).default('month') })),
  async (c) => {
    if (!stripeConfigured()) {
      return c.json({ error: 'Checkout is not open yet — payments are coming soon' }, 501);
    }
    const { interval } = c.req.valid('json');
    const priceId = interval === 'year' ? env.stripePriceIdAnnual : env.stripePriceId;
    if (!priceId) {
      return c.json({ error: 'Annual billing isn’t available yet — choose monthly' }, 501);
    }
    const user = c.get('user')!;
    const [row] = await query<{
      email: string;
      plan: 'free' | 'pro';
      plan_expires_at: string | null;
      comped: boolean;
      stripe_customer_id: string | null;
      stripe_subscription_id: string | null;
    }>(
      `SELECT email, plan, plan_expires_at, comped, stripe_customer_id, stripe_subscription_id
         FROM users WHERE id = $1`,
      [user.id],
    );
    if (!row) return c.json({ error: 'User not found' }, 404);
    // Comped and lifetime accounts must never be charged; an existing
    // subscription is managed through the portal, not doubled up.
    if (row.comped || (row.plan === 'pro' && row.plan_expires_at === null)) {
      return c.json({ error: 'You already have full access — no subscription needed' }, 409);
    }
    if (row.stripe_subscription_id) {
      return c.json(
        { error: 'You already have a subscription — manage it from Settings → Membership' },
        409,
      );
    }

    // One Stripe customer per user, created on first checkout. The WHERE guard
    // keeps a concurrent double-click from attaching two customers.
    let customerId = row.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe().customers.create({
        email: row.email,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await query('UPDATE users SET stripe_customer_id = $2 WHERE id = $1 AND stripe_customer_id IS NULL', [
        user.id,
        customerId,
      ]);
    }

    // Discount-only promo codes apply to the first invoice (grant-day codes
    // were consumed at redemption). Best percentage wins if they stacked.
    const [discount] = await query<{ percent: number | null }>(
      `SELECT max(p.discount_percent)::int AS percent
         FROM promo_redemptions r JOIN promotions p ON p.id = r.promotion_id
        WHERE r.user_id = $1 AND p.discount_percent > 0`,
      [user.id],
    );
    let discounts: { coupon: string }[] | undefined;
    if (discount?.percent) {
      const coupon = await stripe().coupons.create({
        percent_off: discount.percent,
        duration: 'once',
      });
      discounts = [{ coupon: coupon.id }];
    }

    const session = await stripe().checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      discounts,
      // Stripe Tax computes the right tax from the billing address entered at
      // checkout; address 'auto' saves it onto the customer so renewals keep
      // taxing correctly. Requires Stripe Tax activated in the dashboard.
      automatic_tax: { enabled: true },
      customer_update: { address: 'auto' },
      success_url: `${env.publicUrl}/upgrade?checkout=success`,
      cancel_url: `${env.publicUrl}/upgrade?checkout=cancelled`,
      metadata: { userId: user.id },
    });
    if (!session.url) return c.json({ error: 'Could not start checkout — try again' }, 500);

    await logAudit(user.id, 'checkout_started', 'user', user.id, {
      customerId,
      interval,
      discountPercent: discount?.percent ?? null,
    });
    return c.json({ url: session.url });
  },
);

/** Stripe's hosted billing portal: change card, cancel, past invoices. Doing
 * dunning and cancellation UI in-app would be weeks of work Stripe already did. */
billingRoutes.post(
  '/portal',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10, by: 'user' }),
  async (c) => {
    if (!stripeConfigured()) {
      return c.json({ error: 'Billing management is not available yet' }, 501);
    }
    const user = c.get('user')!;
    const [row] = await query<{ stripe_customer_id: string | null }>(
      'SELECT stripe_customer_id FROM users WHERE id = $1',
      [user.id],
    );
    if (!row?.stripe_customer_id) {
      return c.json({ error: 'No billing account yet — subscribe first' }, 404);
    }
    const session = await stripe().billingPortal.sessions.create({
      customer: row.stripe_customer_id,
      return_url: `${env.publicUrl}/settings`,
    });
    return c.json({ url: session.url });
  },
);
