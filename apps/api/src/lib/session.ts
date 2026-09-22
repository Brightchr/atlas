import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull, lte, ne } from 'drizzle-orm';
import { effectivePlan, resolveMembership, type AuthUser } from '@arcadia/shared';
import { db } from '../db/db';
import { sessions, users } from '../db/schema';

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
  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
    impersonatorUserId: impersonatorId ?? null,
    ip: ip ?? null,
  });
  return { token, expiresAt };
}

export async function getSessionForToken(token: string): Promise<SessionInfo | null> {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      role: users.role,
      plan: users.plan,
      planExpiresAt: users.planExpiresAt,
      trialEndsAt: users.trialEndsAt,
      comped: users.comped,
      emailVerified: users.emailVerified,
      passwordHash: users.passwordHash,
      createdAt: users.createdAt,
      impersonatorUserId: sessions.impersonatorUserId,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, hashToken(token)),
        gt(sessions.expiresAt, new Date()),
        // A ban takes effect on the very next request, on every device.
        eq(users.status, 'active'),
        // Soft-deleted accounts have no valid sessions; signing in again
        // (which restores the account) is the only way back.
        isNull(users.deletedAt),
      ),
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
      plan: effectivePlan(row.plan, row.planExpiresAt),
      trialEndsAt: row.trialEndsAt?.toISOString() ?? null,
      membership: resolveMembership(row.plan, row.planExpiresAt, row.trialEndsAt, row.comped),
      emailVerified: row.emailVerified,
      hasPassword: row.passwordHash !== null,
      createdAt: row.createdAt.toISOString(),
    },
    impersonatorId: row.impersonatorUserId,
  };
}

export async function deleteSession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

/** Revokes every session for a user EXCEPT the one making the request —
 * standard hygiene after a password change: stolen sessions die, the person
 * changing the password stays signed in. */
export async function deleteOtherSessions(userId: string, currentToken: string): Promise<void> {
  await db
    .delete(sessions)
    .where(and(eq(sessions.userId, userId), ne(sessions.tokenHash, hashToken(currentToken))));
}

/** Revokes EVERY session for a user — for password reset, where the person
 * proving email ownership may not be the person holding a stolen session. */
export async function deleteAllSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/** Housekeeping — expired rows are already unusable; this just keeps the table tidy. */
export async function deleteExpiredSessions(): Promise<void> {
  await db.delete(sessions).where(lte(sessions.expiresAt, new Date()));
}
