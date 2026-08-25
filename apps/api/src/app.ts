import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { env } from './lib/env';
import { ipBlockMiddleware } from './lib/ip-block';
import { sessionMiddleware, type AppEnv } from './middleware/auth';
import { adminRoutes } from './routes/admin';
import { authRoutes } from './routes/auth';
import { billingRoutes } from './routes/billing';
import { foodRoutes } from './routes/food';
import { healthRoutes } from './routes/health';
import { notificationRoutes } from './routes/notifications';
import { planRoutes } from './routes/plans';
import { profileRoutes } from './routes/profile';
import { reportRoutes } from './routes/reports';
import { socialRoutes } from './routes/social';
import { syncRoutes } from './routes/sync';

/** App is split from the server entry (index.ts) so route handlers can be
 * tested without binding a port. */
export const app = new Hono<AppEnv>();

app.use('*', logger());
app.use('*', secureHeaders());
// Credentials (cookies) require an explicit origin allowlist — never '*'.
app.use(
  '*',
  cors({
    origin: (origin) => (env.corsOrigins.includes(origin) ? origin : null),
    credentials: true,
  }),
);
// Blocked IPs are turned away before any session or body work. Scoped to /v1
// so uptime monitoring on /health keeps working from anywhere.
app.use('/v1/*', ipBlockMiddleware);
app.use('*', sessionMiddleware);

// Body caps BEFORE any route reads a body: route-level size checks run after
// the whole body is already in memory, so without these a single huge POST is
// a memory-exhaustion vector. Sync gets headroom for offline catch-up bursts
// (400 changes × 16 KB payload cap); plans carry a ≤200 KB payload; everything
// else is small JSON.
const KB = 1024;
const syncLimit = bodyLimit({ maxSize: 8 * 1024 * KB });
const planLimit = bodyLimit({ maxSize: 300 * KB });
const defaultLimit = bodyLimit({ maxSize: 64 * KB });
app.use('/v1/*', (c, next) => {
  const path = c.req.path;
  if (path.startsWith('/v1/sync')) return syncLimit(c, next);
  if (path.startsWith('/v1/plans')) return planLimit(c, next);
  return defaultLimit(c, next);
});

app.route('/health', healthRoutes);
app.route('/v1/auth', authRoutes);
app.route('/v1/food', foodRoutes);
app.route('/v1/notifications', notificationRoutes);
app.route('/v1/plans', planRoutes);
app.route('/v1/sync', syncRoutes);
app.route('/v1/profiles', profileRoutes);
app.route('/v1/admin', adminRoutes);
app.route('/v1/billing', billingRoutes);
app.route('/v1/reports', reportRoutes);
// The social group's requireAuth is scoped to its own prefixes (friends,
// groups, stats), so mount order is a style choice here, not load-bearing.
app.route('/v1', socialRoutes);

// Future route groups (community workouts, votes, comments, moderation) mount here.

app.notFound((c) => c.json({ error: 'Not found' }, 404));
// Uniform JSON errors (the client parses {error}); details go to the log,
// never the response. Framework HTTPExceptions (bodyLimit's 413, etc.) keep
// their intended status instead of being flattened to 500.
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message || 'Request rejected' }, err.status);
  }
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal error' }, 500);
});
