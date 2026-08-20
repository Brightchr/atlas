import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { env } from './lib/env';
import { sessionMiddleware, type AppEnv } from './middleware/auth';
import { adminRoutes } from './routes/admin';
import { authRoutes } from './routes/auth';
import { foodRoutes } from './routes/food';
import { healthRoutes } from './routes/health';
import { notificationRoutes } from './routes/notifications';
import { planRoutes } from './routes/plans';
import { profileRoutes } from './routes/profile';
import { syncRoutes } from './routes/sync';

/** App is split from the server entry (index.ts) so route handlers can be
 * tested without binding a port. */
export const app = new Hono<AppEnv>();

app.use('*', logger());
// Credentials (cookies) require an explicit origin allowlist — never '*'.
app.use(
  '*',
  cors({
    origin: (origin) => (env.corsOrigins.includes(origin) ? origin : null),
    credentials: true,
  }),
);
app.use('*', sessionMiddleware);

app.route('/health', healthRoutes);
app.route('/v1/auth', authRoutes);
app.route('/v1/food', foodRoutes);
app.route('/v1/notifications', notificationRoutes);
app.route('/v1/plans', planRoutes);
app.route('/v1/sync', syncRoutes);
app.route('/v1/profiles', profileRoutes);
app.route('/v1/admin', adminRoutes);

// Future route groups (community workouts, votes, comments, moderation) mount here.

app.notFound((c) => c.json({ error: 'Not found' }, 404));
