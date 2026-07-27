import { query } from '../db/pool';

/** Creates an in-app notification. Email delivery is intentionally not wired
 * yet — it needs a sending provider (Resend/Postmark/SES) and a verified
 * domain; when that lands, this is the single place to fan out to email. */
export async function createNotification(
  userId: string,
  type: string,
  title: string,
  body = '',
): Promise<void> {
  await query('INSERT INTO notifications (user_id, type, title, body) VALUES ($1, $2, $3, $4)', [
    userId,
    type,
    title,
    body,
  ]);
}
