import { Hono } from 'hono';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/db';
import { notifications } from '../db/schema';
import { rateLimit } from '../lib/rate-limit';
import { requireAuth, type AppEnv } from '../middleware/auth';

export const notificationRoutes = new Hono<AppEnv>();

notificationRoutes.use('*', requireAuth);
// Polled by the top bar — generous, but a runaway client loop gets stopped.
notificationRoutes.use('*', rateLimit({ windowMs: 60 * 1000, max: 60, by: 'user' }));

notificationRoutes.get('/', async (c) => {
  const user = c.get('user')!;
  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      body: notifications.body,
      read: notifications.read,
      created_at: notifications.createdAt,
    })
    .from(notifications)
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(20);
  // Counted in SQL — the visible page alone would undercount the badge.
  const [unread] = await db
    .select({ n: sql<number>`count(*) FILTER (WHERE NOT ${notifications.read})::int` })
    .from(notifications)
    .where(eq(notifications.userId, user.id));
  return c.json({ notifications: rows, unread: unread?.n ?? 0 });
});

notificationRoutes.post('/read-all', async (c) => {
  const user = c.get('user')!;
  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.userId, user.id), eq(notifications.read, false)));
  return c.json({ ok: true });
});
