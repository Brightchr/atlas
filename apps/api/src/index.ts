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

  // '::' binds dual-stack (IPv6 + IPv4) — required for Railway's private
  // networking, which is IPv6-only; still works for local IPv4 clients.
  serve({ fetch: app.fetch, port: env.port, hostname: '::' }, (info) => {
    console.log(`Arcadia API listening on port ${info.port}`);
  });
}

main().catch((err) => {
  console.error('Failed to start API', err);
  process.exit(1);
});
