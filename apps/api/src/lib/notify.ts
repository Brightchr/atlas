import { db } from '../db/db';
import { notifications } from '../db/schema';

/** Creates an in-app notification. Fan-out to email (via lib/email.ts) can
 * hook in here later — this is the single place notifications are born. */
export async function createNotification(
  userId: string,
  type: string,
  title: string,
  body = '',
): Promise<void> {
  await db.insert(notifications).values({ userId, type, title, body });
}
