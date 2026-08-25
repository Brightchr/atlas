import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  MONTHLY_PRICE_USD,
  effectivePlan,
  resolveMembership,
  type BillingStatus,
} from '@arcadia/shared';
import { pool, query } from '../db/pool';
import { logAudit } from '../lib/audit';
import { rateLimit } from '../lib/rate-limit';
import { requireAuth, type AppEnv } from '../middleware/auth';

/** Billing must stay reachable for EXPIRED members — it is the way back in.
 * Only requireAuth here, never requireActiveMember. */
export const billingRoutes = new Hono<AppEnv>();

billingRoutes.use('*', requireAuth);

billingRoutes.get('/', async (c) => {
  const user = c.get('user')!;
  const [row] = await query<{ plan: 'free' | 'pro'; plan_expires_at: string | null; trial_ends_at: string | null }>(
    'SELECT plan, plan_expires_at, trial_ends_at FROM users WHERE id = $1',
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
    membership: resolveMembership(row.plan, row.plan_expires_at, row.trial_ends_at),
    priceUsd: MONTHLY_PRICE_USD,
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

/** Placeholder until the payment processor (Stripe) is wired up: the client
 * shows the "coming soon" state off this 501. When payments land this becomes
 * "create checkout session, return its URL", and discount-only redemptions
 * get applied to the first invoice. */
billingRoutes.post('/checkout', async (c) => {
  return c.json({ error: 'Checkout is not open yet — payments are coming soon' }, 501);
});
