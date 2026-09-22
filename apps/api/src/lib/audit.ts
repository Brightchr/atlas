import { db } from '../db/db';
import { auditLog } from '../db/schema';

/** Append-only audit trail for sensitive actions. Never deleted by app code. */
export async function logAudit(
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  detail: Record<string, unknown> = {},
): Promise<void> {
  await db.insert(auditLog).values({ actorId, action, targetType, targetId, detail });
}
