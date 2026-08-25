import { Hono } from 'hono';
import { query } from '../db/pool';
import { requireAuth, type AppEnv } from '../middleware/auth';

export const notificationRoutes = new Hono<AppEnv>();

notificationRoutes.use('*', requireAuth);

notificationRoutes.get('/', async (c) => {
  const user = c.get('user')!;
  const notifications = await query<{
    id: string;
    type: string;
    title: string;
    body: string;
    read: boolean;
    created_at: string;
  }>(
    `SELECT id, type, title, body, read, created_at
       FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 20`,
    [user.id],
  );
  // Counted in SQL — the visible page alone would undercount the badge.
  const unreadRows = await query<{ n: string }>(
    'SELECT count(*) FILTER (WHERE NOT read) AS n FROM notifications WHERE user_id = $1',
    [user.id],
  );
  return c.json({ notifications, unread: Number(unreadRows[0]?.n ?? 0) });
});

notificationRoutes.post('/read-all', async (c) => {
  const user = c.get('user')!;
  await query('UPDATE notifications SET read = true WHERE user_id = $1 AND read = false', [
    user.id,
  ]);
  return c.json({ ok: true });
});
