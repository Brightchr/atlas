import { createHash, randomBytes } from 'node:crypto';
import type { AuthUser } from '@arcadia/shared';
import { query } from '../db/pool';

const SESSION_DAYS = 30;

export interface SessionInfo {
  user: AuthUser;
  /** Set when an admin is masquerading as this user — never invisible. */
  impersonatorId: string | null;
}

/** The raw token goes to the client once; only its SHA-256 lands in the DB.
 * (Unlike passwords, session tokens are high-entropy random values, so a fast
 * hash is appropriate — there is nothing to brute-force.) */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(
  userId: string,
  impersonatorId?: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await query(
    'INSERT INTO sessions (user_id, token_hash, expires_at, impersonator_user_id) VALUES ($1, $2, $3, $4)',
    [userId, hashToken(token), expiresAt, impersonatorId ?? null],
  );
  return { token, expiresAt };
}

export async function getSessionForToken(token: string): Promise<SessionInfo | null> {
  const rows = await query<{
    id: string;
    email: string;
    username: string;
    role: AuthUser['role'];
    plan: AuthUser['plan'];
    created_at: string;
    impersonator_user_id: string | null;
  }>(
    `SELECT u.id, u.email, u.username, u.role, u.created_at, s.impersonator_user_id,
            CASE WHEN u.plan = 'pro' AND u.plan_expires_at IS NOT NULL AND u.plan_expires_at < now()
                 THEN 'free' ELSE u.plan END AS plan
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashToken(token)],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    user: {
      id: row.id,
      email: row.email,
      username: row.username,
      role: row.role,
      plan: row.plan,
      createdAt: row.created_at,
    },
    impersonatorId: row.impersonator_user_id,
  };
}

export async function deleteSession(token: string): Promise<void> {
  await query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
}

/** Housekeeping — expired rows are already unusable; this just keeps the table tidy. */
export async function deleteExpiredSessions(): Promise<void> {
  await query('DELETE FROM sessions WHERE expires_at <= now()');
}
