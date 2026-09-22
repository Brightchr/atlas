import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { and, desc, eq, gt, gte, isNull, lte, not, or, sql } from 'drizzle-orm';
import {
  ANNUAL_PRICE_USD,
  MONTHLY_PRICE_USD,
  effectivePlan,
  resolveMembership,
  type BillingStatus,
} from '@arcadia/shared';
import { db } from '../db/db';
import { promoRedemptions, promotions, users } from '../db/schema';
import { logAudit } from '../lib/audit';
import { env } from '../lib/env';
import { rateLimit } from '../lib/rate-limit';
import { stripe, stripeConfigured } from '../lib/stripe';
import { requireAuth, type AppEnv } from '../middleware/auth';

/** Billing must stay reachable for EXPIRED members — it is the way back in.
 * Only requireAuth here, never requireActiveMember. */
export const billingRoutes = new Hono<AppEnv>();

billingRoutes.use('*', requireAuth);

/** An indefinite pro plan (admin-granted or lifetime) must never gain an
 * expiry or a charge — several handlers below guard on it. */
const lifetimePro = () => and(eq(users.plan, 'pro'), isNull(users.planExpiresAt))!;

billingRoutes.get('/', async (c) => {
  const user = c.get('user')!;
  const [row] = await db
    .select({
      plan: users.plan,
      planExpiresAt: users.planExpiresAt,
      trialEndsAt: users.trialEndsAt,
      comped: users.comped,
      stripeSubscriptionId: users.stripeSubscriptionId,
    })
    .from(users)
    .where(eq(users.id, user.id));
  if (!row) return c.json({ error: 'User not found' }, 404);

  const redemptions = await db
    .select({
      code: promotions.code,
      discountPercent: promotions.discountPercent,
      grantDays: promotions.grantDays,
      redeemedAt: promoRedemptions.createdAt,
    })
    .from(promoRedemptions)
    .innerJoin(promotions, eq(promotions.id, promoRedemptions.promotionId))
    .where(eq(promoRedemptions.userId, user.id))
    .orderBy(desc(promoRedemptions.createdAt));

  const status: BillingStatus = {
    plan: effectivePlan(row.plan, row.planExpiresAt),
    planExpiresAt: row.planExpiresAt?.toISOString() ?? null,
    trialEndsAt: row.trialEndsAt?.toISOString() ?? null,
    membership: resolveMembership(row.plan, row.planExpiresAt, row.trialEndsAt, row.comped),
    comped: row.comped,
    hasSubscription: row.stripeSubscriptionId !== null,
    priceUsd: MONTHLY_PRICE_USD,
    annualPriceUsd: ANNUAL_PRICE_USD,
    redemptions: redemptions.map((r) => ({
      code: r.code,
      discountPercent: r.discountPercent,
      grantDays: r.grantDays,
      redeemedAt: r.redeemedAt.toISOString(),
    })),
  };
  return c.json(status);
});

/** Active promotions for the dashboard banner — every signed-in user sees
 * these, so only the marketing-safe fields leave the server. */
billingRoutes.get('/promotions', async (c) => {
  const now = new Date();
  const rows = await db
    .select({
      code: promotions.code,
      description: promotions.description,
      discountPercent: promotions.discountPercent,
      grantDays: promotions.grantDays,
      endsAt: promotions.endsAt,
    })
    .from(promotions)
    .where(
      and(
        eq(promotions.active, true),
        lte(promotions.startsAt, now),
        or(isNull(promotions.endsAt), gt(promotions.endsAt, now)),
      ),
    )
    .orderBy(desc(promotions.createdAt))
    .limit(3);
  return c.json({
    promotions: rows.map((p) => ({ ...p, endsAt: p.endsAt?.toISOString() ?? null })),
  });
});

const redeemSchema = z.object({ code: z.string().min(3).max(30) });

type RedeemOutcome =
  | { kind: 'invalid' }
  | { kind: 'exhausted' }
  | { kind: 'already' }
  | { kind: 'ok'; promoId: string; grantDays: number | null; discountPercent: number };

/** Redeem a promo code. Tight rate limit: codes are guessable strings, and
 * this endpoint must not be usable to enumerate them. */
billingRoutes.post(
  '/redeem',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10, by: 'user' }),
  zValidator('json', redeemSchema),
  async (c) => {
    const user = c.get('user')!;
    const code = c.req.valid('json').code.trim().toUpperCase();

    const outcome = await db.transaction(async (tx): Promise<RedeemOutcome> => {
      // FOR UPDATE serializes concurrent redemptions of the same code so a
      // max_redemptions cap cannot be overshot by racing requests.
      const [promo] = await tx
        .select()
        .from(promotions)
        .where(eq(promotions.code, code))
        .for('update');
      const now = new Date();
      const usable =
        promo &&
        promo.active &&
        promo.startsAt <= now &&
        (promo.endsAt === null || promo.endsAt > now);
      if (!usable) return { kind: 'invalid' };

      if (promo.maxRedemptions !== null) {
        const [count] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(promoRedemptions)
          .where(eq(promoRedemptions.promotionId, promo.id));
        if ((count?.n ?? 0) >= promo.maxRedemptions) return { kind: 'exhausted' };
      }

      const inserted = await tx
        .insert(promoRedemptions)
        .values({ promotionId: promo.id, userId: user.id })
        .onConflictDoNothing()
        .returning({ id: promoRedemptions.id });
      if (inserted.length === 0) return { kind: 'already' };

      if (promo.grantDays !== null) {
        // Grant codes extend pro from now or from the current expiry,
        // whichever is later. An indefinite pro plan (NULL expiry) is never
        // shortened by attaching an expiry to it.
        await tx
          .update(users)
          .set({
            plan: 'pro',
            planExpiresAt: sql`GREATEST(coalesce(${users.planExpiresAt}, now()), now())
                               + make_interval(days => ${promo.grantDays})`,
          })
          .where(and(eq(users.id, user.id), not(lifetimePro())));
      }
      return {
        kind: 'ok',
        promoId: promo.id,
        grantDays: promo.grantDays,
        discountPercent: promo.discountPercent,
      };
    });

    // One message for unknown, inactive and out-of-window codes — the
    // response must not confirm which codes exist.
    if (outcome.kind === 'invalid') return c.json({ error: 'Invalid or expired code' }, 400);
    if (outcome.kind === 'exhausted') {
      return c.json({ error: 'This code has been fully redeemed' }, 409);
    }
    if (outcome.kind === 'already') {
      return c.json({ error: 'You have already redeemed this code' }, 409);
    }

    await logAudit(user.id, 'redeem_promo', 'promotion', outcome.promoId, {
      code,
      grantDays: outcome.grantDays,
      discountPercent: outcome.discountPercent,
    });
    return c.json({
      ok: true,
      granted: outcome.grantDays !== null,
      grantDays: outcome.grantDays,
      discountPercent: outcome.discountPercent,
    });
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
    const [row] = await db
      .select({
        email: users.email,
        plan: users.plan,
        planExpiresAt: users.planExpiresAt,
        comped: users.comped,
        stripeCustomerId: users.stripeCustomerId,
        stripeSubscriptionId: users.stripeSubscriptionId,
      })
      .from(users)
      .where(eq(users.id, user.id));
    if (!row) return c.json({ error: 'User not found' }, 404);
    // Comped and lifetime accounts must never be charged; an existing
    // subscription is managed through the portal, not doubled up.
    if (row.comped || (row.plan === 'pro' && row.planExpiresAt === null)) {
      return c.json({ error: 'You already have full access — no subscription needed' }, 409);
    }
    if (row.stripeSubscriptionId) {
      return c.json(
        { error: 'You already have a subscription — manage it from Settings → Membership' },
        409,
      );
    }

    // One Stripe customer per user, created on first checkout. The WHERE guard
    // keeps a concurrent double-click from attaching two customers.
    let customerId = row.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe().customers.create({
        email: row.email,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await db
        .update(users)
        .set({ stripeCustomerId: customerId })
        .where(and(eq(users.id, user.id), isNull(users.stripeCustomerId)));
    }

    // Discount-only promo codes apply to the first invoice (grant-day codes
    // were consumed at redemption). Best percentage wins if they stacked.
    const [discount] = await db
      .select({ percent: sql<number | null>`max(${promotions.discountPercent})::int` })
      .from(promoRedemptions)
      .innerJoin(promotions, eq(promotions.id, promoRedemptions.promotionId))
      .where(and(eq(promoRedemptions.userId, user.id), gte(promotions.discountPercent, 1)));
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
    const [row] = await db
      .select({ stripeCustomerId: users.stripeCustomerId })
      .from(users)
      .where(eq(users.id, user.id));
    if (!row?.stripeCustomerId) {
      return c.json({ error: 'No billing account yet — subscribe first' }, 404);
    }
    const session = await stripe().billingPortal.sessions.create({
      customer: row.stripeCustomerId,
      return_url: `${env.publicUrl}/settings`,
    });
    return c.json({ url: session.url });
  },
);
