import { query } from '../db/pool';

/** Append-only audit trail for sensitive actions. Never deleted by app code. */
export async function logAudit(
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  detail: Record<string, unknown> = {},
): Promise<void> {
  await query(
    'INSERT INTO audit_log (actor_id, action, target_type, target_id, detail) VALUES ($1, $2, $3, $4, $5)',
    [actorId, action, targetType, targetId, JSON.stringify(detail)],
  );
}
