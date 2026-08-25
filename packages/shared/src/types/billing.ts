import type { MembershipPlan, MembershipStatus } from './user';

/** What /v1/billing returns — everything the paywall and the settings billing
 * section need in one round trip. */
export interface BillingStatus {
  plan: MembershipPlan;
  planExpiresAt: string | null;
  trialEndsAt: string | null;
  membership: MembershipStatus;
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
