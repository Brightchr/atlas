/** Permissions axis — what a user may DO (moderation, administration). */
export type UserRole = 'user' | 'moderator' | 'admin';

/** Monetization axis — what a user has PAID for. Independent of role. */
export type MembershipPlan = 'free' | 'pro';

/** Effective access derived from plan + trial at read time: paying ('pro'),
 * inside the free trial window ('trial'), or out of both ('expired' — must
 * subscribe to keep using paid features). */
export type MembershipStatus = 'pro' | 'trial' | 'expired';

/** Public shape of an authenticated user — never includes password hash or email
 * of other users. This is the ONLY user shape the API ever returns. */
export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  plan: MembershipPlan;
  /** When the signup trial ends. Null only for accounts predating trials. */
  trialEndsAt: string | null;
  membership: MembershipStatus;
  createdAt: string;
}

export interface Promotion {
  id: string;
  code: string;
  description: string;
  discountPercent: number;
  active: boolean;
  startsAt: string;
  endsAt: string | null;
  /** Redemption cap across all users; null = unlimited. */
  maxRedemptions: number | null;
  /** Days of pro granted instantly on redemption; null = checkout discount. */
  grantDays: number | null;
  /** How many users have redeemed it (admin listing). */
  redemptions: number;
}
