import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { query } from '../db/pool';
import { rateLimit } from '../lib/rate-limit';
import { requireAuth, type AppEnv } from '../middleware/auth';

export const reportRoutes = new Hono<AppEnv>();

reportRoutes.use('*', requireAuth);

const reportSchema = z.object({
  targetType: z.enum(['user', 'plan', 'review', 'other']),
  /** For 'user' this is a username (resolved to an id here); for the rest an
   * entity id or free text. */
  targetId: z.string().trim().min(1).max(200),
  reason: z.enum(['spam', 'harassment', 'inappropriate', 'cheating', 'other']),
  detail: z.string().trim().max(1000).default(''),
});

/** File a report. Deliberately quiet on duplicates: re-reporting an already
 * open target reads as success, so the queue can't be spammed and the
 * reporter isn't told whether others reported first. */
reportRoutes.post(
  '/',
  rateLimit({ windowMs: 60 * 60 * 1000, max: 10, by: 'user' }),
  zValidator('json', reportSchema),
  async (c) => {
    const user = c.get('user')!;
    const body = c.req.valid('json');

    let targetId = body.targetId;
    let targetOk = true;
    if (body.targetType === 'user') {
      const [target] = await query<{ id: string }>(
        'SELECT id FROM users WHERE lower(username) = lower($1)',
        [body.targetId],
      );
      if (!target) targetOk = false;
      else if (target.id === user.id) {
        return c.json({ error: 'You cannot report yourself' }, 400);
      } else targetId = target.id;
    }
    if (!targetOk) return c.json({ error: 'Target not found' }, 404);

    await query(
      `INSERT INTO reports (reporter_user_id, target_type, target_id, reason, detail)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (reporter_user_id, target_type, target_id) WHERE status = 'open'
       DO NOTHING`,
      [user.id, body.targetType, targetId, body.reason, body.detail],
    );
    return c.json({ ok: true }, 201);
  },
);
