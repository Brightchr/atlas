import { serve } from '@hono/node-server';
import { app } from './app';
import { query } from './db/pool';
import { runMigrations } from './db/migrations';
import { seedAccounts } from './db/seed';
import { env } from './lib/env';
import { deleteExpiredSessions } from './lib/session';

/** Daily housekeeping — idempotent deletes, safe with multiple instances.
 * Without it, sessions and notifications only shrink on redeploys (or
 * never): expired sessions used to be swept once at boot, notifications not
 * at all. */
async function runMaintenance(): Promise<void> {
  try {
    await deleteExpiredSessions();
    await query(`DELETE FROM notifications WHERE created_at < now() - interval '90 days'`);
  } catch (err) {
    console.warn('maintenance sweep failed (will retry next cycle):', err);
  }
}

async function main() {
  await runMigrations();
  await seedAccounts();
  await runMaintenance();
  setInterval(() => void runMaintenance(), 24 * 60 * 60 * 1000).unref();

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
