import { env } from '../lib/env';
import { hashPassword } from '../lib/password';
import { query } from './pool';

/** Idempotent startup seeding for the demo and admin accounts. In production
 * an account is only created when its password comes from env — never a
 * shipped default. Existing accounts are left untouched (no password resets). */
export async function seedAccounts(): Promise<void> {
  const accounts = [
    env.adminPassword
      ? { email: 'admin@arcadia.dev', username: 'admin', role: 'admin', password: env.adminPassword }
      : null,
    env.demoPassword
      ? { email: 'demo@arcadia.dev', username: 'demo', role: 'user', password: env.demoPassword }
      : null,
  ].filter((a): a is NonNullable<typeof a> => a !== null);

  for (const account of accounts) {
    const rows = await query<{ id: string }>(
      `INSERT INTO users (email, username, password_hash, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [account.email, account.username, await hashPassword(account.password), account.role],
    );
    if (rows.length > 0) {
      console.log(`seeded account: ${account.username} (${account.role})`);
    }
  }
}
