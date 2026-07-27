import { Hono } from 'hono';

export const healthRoutes = new Hono();

healthRoutes.get('/', (c) =>
  c.json({
    status: 'ok',
    service: 'arcadia-api',
    time: new Date().toISOString(),
  }),
);
