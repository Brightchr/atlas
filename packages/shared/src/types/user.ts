export type UserRole = 'user' | 'moderator' | 'admin';

/** Public shape of an authenticated user — never includes password hash or email
 * of other users. This is the ONLY user shape the API ever returns. */
export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  createdAt: string;
}
