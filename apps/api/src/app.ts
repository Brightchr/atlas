import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { healthRoutes } from './routes/health';

/** App is split from the server entry (index.ts) so route handlers can be
 * tested without binding a port. */
export const app = new Hono();

app.use('*', logger());
app.use('*', cors());

app.route('/health', healthRoutes);

// Future route groups (sync, auth, provided plans/workouts) mount here:
// app.route('/v1/sync', syncRoutes);
// app.route('/v1/plans', planRoutes);

app.notFound((c) => c.json({ error: 'Not found' }, 404));
