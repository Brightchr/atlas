import { serve } from '@hono/node-server';
import { app } from './app';
import { runMigrations } from './db/migrations';
import { seedAccounts } from './db/seed';
import { env } from './lib/env';
import { deleteExpiredSessions } from './lib/session';

async function main() {
  await runMigrations();
  await seedAccounts();
  await deleteExpiredSessions();

  serve({ fetch: app.fetch, port: env.port, hostname: '0.0.0.0' }, (info) => {
    console.log(`Arcadia API listening on http://localhost:${info.port}`);
  });
}

main().catch((err) => {
  console.error('Failed to start API', err);
  process.exit(1);
});
