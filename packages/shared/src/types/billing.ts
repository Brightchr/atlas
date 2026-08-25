import type { MembershipPlan, MembershipStatus } from './user';

/** What /v1/billing returns — everything the paywall and the settings billing
 * section need in one round trip. */
export interface BillingStatus {
  plan: MembershipPlan;
  planExpiresAt: string | null;
  trialEndsAt: string | null;
  membership: MembershipStatus;
  /** Admin-granted complimentary access — membership resolves to 'pro'. */
  comped: boolean;
  /** Monthly price in whole USD (display; the processor is authoritative). */
  priceUsd: number;
  redemptions: PromoRedemption[];
}

/** A promo code the user has redeemed. Codes with grantDays applied instantly;
 * discount-only codes wait for checkout. */
export interface PromoRedemption {
  code: string;
  discountPercent: number;
  grantDays: number | null;
  redeemedAt: string;
}

/** The marketing-safe slice of an active promotion, shown to every signed-in
 * user (dashboard banner). Never includes caps or redemption counts. */
export interface PublicPromotion {
  code: string;
  description: string;
  discountPercent: number;
  grantDays: number | null;
  endsAt: string | null;
}
