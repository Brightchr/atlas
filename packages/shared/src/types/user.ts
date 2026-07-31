/** Permissions axis — what a user may DO (moderation, administration). */
export type UserRole = 'user' | 'moderator' | 'admin';

/** Monetization axis — what a user has PAID for. Independent of role. */
export type MembershipPlan = 'free' | 'pro';

/** Public shape of an authenticated user — never includes password hash or email
 * of other users. This is the ONLY user shape the API ever returns. */
export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  plan: MembershipPlan;
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
}
