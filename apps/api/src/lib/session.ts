import { createHash, randomBytes } from 'node:crypto';
import { effectivePlan, resolveMembership, type AuthUser } from '@arcadia/shared';
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
  /** Override for short-lived sessions (admin masquerade); default 30 days. */
  ttlMs?: number,
  /** Client IP at sign-in — recorded for the admin abuse tooling. */
  ip?: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + (ttlMs ?? SESSION_DAYS * 24 * 60 * 60 * 1000));
  await query(
    'INSERT INTO sessions (user_id, token_hash, expires_at, impersonator_user_id, ip) VALUES ($1, $2, $3, $4, $5)',
    [userId, hashToken(token), expiresAt, impersonatorId ?? null, ip ?? null],
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
    plan_expires_at: string | null;
    trial_ends_at: string | null;
    comped: boolean;
    created_at: string;
    impersonator_user_id: string | null;
  }>(
    `SELECT u.id, u.email, u.username, u.role, u.plan, u.plan_expires_at, u.trial_ends_at,
            u.comped, u.created_at, s.impersonator_user_id
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now()
        -- A ban takes effect on the very next request, on every device.
        AND u.status = 'active'`,
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
      // Plan expiry and trial windows are applied here, once — everything
      // downstream (requirePro, membership gates, the UI) sees resolved values.
      plan: effectivePlan(row.plan, row.plan_expires_at),
      trialEndsAt: row.trial_ends_at,
      membership: resolveMembership(row.plan, row.plan_expires_at, row.trial_ends_at, row.comped),
      createdAt: row.created_at,
    },
    impersonatorId: row.impersonator_user_id,
  };
}

export async function deleteSession(token: string): Promise<void> {
  await query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
}

/** Revokes every session for a user EXCEPT the one making the request —
 * standard hygiene after a password change: stolen sessions die, the person
 * changing the password stays signed in. */
export async function deleteOtherSessions(userId: string, currentToken: string): Promise<void> {
  await query('DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2', [
    userId,
    hashToken(currentToken),
  ]);
}

/** Housekeeping — expired rows are already unusable; this just keeps the table tidy. */
export async function deleteExpiredSessions(): Promise<void> {
  await query('DELETE FROM sessions WHERE expires_at <= now()');
}
