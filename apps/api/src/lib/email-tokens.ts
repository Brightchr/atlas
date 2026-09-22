import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull, lte, sql } from 'drizzle-orm';
import { db } from '../db/db';
import { emailTokens } from '../db/schema';

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
  await db
    .delete(emailTokens)
    .where(and(eq(emailTokens.userId, userId), eq(emailTokens.purpose, purpose)));
  await db.insert(emailTokens).values({
    userId,
    purpose,
    tokenHash: hashToken(token),
    expiresAt: sql`now() + make_interval(mins => ${ttlMinutes})`,
  });
  return token;
}

/** Atomically burns the token: the UPDATE both validates and marks it used in
 * one statement, so two racing requests can never both succeed. Returns the
 * owning user id, or null for unknown/expired/already-used tokens. */
export async function consumeEmailToken(
  token: string,
  purpose: EmailTokenPurpose,
): Promise<string | null> {
  const rows = await db
    .update(emailTokens)
    .set({ usedAt: sql`now()` })
    .where(
      and(
        eq(emailTokens.tokenHash, hashToken(token)),
        eq(emailTokens.purpose, purpose),
        isNull(emailTokens.usedAt),
        gt(emailTokens.expiresAt, new Date()),
      ),
    )
    .returning({ userId: emailTokens.userId });
  return rows[0]?.userId ?? null;
}

/** Housekeeping for the daily maintenance sweep. */
export async function deleteExpiredEmailTokens(): Promise<void> {
  await db.delete(emailTokens).where(lte(emailTokens.expiresAt, new Date()));
}
