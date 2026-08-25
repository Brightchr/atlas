import type { MembershipPlan, MembershipStatus } from './types/user';

/** Monthly subscription price in whole USD. Single source for API and UI copy;
 * the payment processor's product config must match when it lands. */
export const MONTHLY_PRICE_USD = 5;

/** Signup trial length. The database default mirrors this (migration 012). */
export const TRIAL_DAYS = 7;

/** A 'pro' plan counts only until its expiry; NULL expiry means indefinite
 * (admin-granted or lifetime). */
export function effectivePlan(
  plan: MembershipPlan,
  planExpiresAt: string | Date | null,
  now: Date = new Date(),
): MembershipPlan {
  if (plan !== 'pro') return plan;
  return planExpiresAt !== null && new Date(planExpiresAt) < now ? 'free' : 'pro';
}

/** The one place membership is decided — API gates and UI paywalls must never
 * re-derive this from raw fields. Roles are deliberately not consulted here:
 * admin/moderator bypass is an authorization concern, applied at the gates.
 * `comped` is the admin-granted exemption — full access, no subscription. */
export function resolveMembership(
  plan: MembershipPlan,
  planExpiresAt: string | Date | null,
  trialEndsAt: string | Date | null,
  comped = false,
  now: Date = new Date(),
): MembershipStatus {
  if (comped) return 'pro';
  if (effectivePlan(plan, planExpiresAt, now) === 'pro') return 'pro';
  if (trialEndsAt !== null && new Date(trialEndsAt) > now) return 'trial';
  return 'expired';
}
