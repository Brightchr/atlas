import { createHash, randomBytes } from 'node:crypto';
import { query } from '../db/pool';

/** Single-use email link tokens (password reset, email verification). Same
 * storage rule as sessions: high-entropy random value to the user, SHA-256
 * in the database. */

export type EmailTokenPurpose = 'password_reset' | 'email_verify';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createEmailToken(
  userId: string,
  purpose: EmailTokenPurpose,
  ttlMinutes: number,
): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  // A new link supersedes older ones of the same purpose — only the freshest
  // email works, so a mistyped-then-retried request can't leave live spares.
  await query('DELETE FROM email_tokens WHERE user_id = $1 AND purpose = $2', [userId, purpose]);
  await query(
    `INSERT INTO email_tokens (user_id, purpose, token_hash, expires_at)
     VALUES ($1, $2, $3, now() + make_interval(mins => $4))`,
    [userId, purpose, hashToken(token), ttlMinutes],
  );
  return token;
}

/** Atomically burns the token: the UPDATE both validates and marks it used in
 * one statement, so two racing requests can never both succeed. Returns the
 * owning user id, or null for unknown/expired/already-used tokens. */
export async function consumeEmailToken(
  token: string,
  purpose: EmailTokenPurpose,
): Promise<string | null> {
  const rows = await query<{ user_id: string }>(
    `UPDATE email_tokens SET used_at = now()
      WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > now()
      RETURNING user_id`,
    [hashToken(token), purpose],
  );
  return rows[0]?.user_id ?? null;
}

/** Housekeeping for the daily maintenance sweep. */
export async function deleteExpiredEmailTokens(): Promise<void> {
  await query('DELETE FROM email_tokens WHERE expires_at <= now()');
}
