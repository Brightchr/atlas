import { pool } from './pool';

/** Ordered, append-only migrations (same rule as the app's SQLite schema:
 * never edit an applied migration — add a new one). Applied inside a
 * transaction and recorded in schema_migrations. */
const migrations: { id: string; sql: string }[] = [
  {
    id: '001_auth',
    sql: `
      CREATE TABLE users (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email         text NOT NULL UNIQUE,
        username      text NOT NULL UNIQUE,
        password_hash text NOT NULL,
        role          text NOT NULL DEFAULT 'user'
                      CHECK (role IN ('user', 'moderator', 'admin')),
        created_at    timestamptz NOT NULL DEFAULT now()
      );

      -- Sessions store only a SHA-256 hash of the token: a database leak
      -- must never yield usable session credentials.
      CREATE TABLE sessions (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash text NOT NULL UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL
      );
      CREATE INDEX sessions_user_id_idx ON sessions(user_id);
    `,
  },
];

export async function runMigrations(): Promise<void> {
  await pool.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
  );
  const applied = new Set(
    (await pool.query<{ id: string }>('SELECT id FROM schema_migrations')).rows.map((r) => r.id),
  );

  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(migration.sql);
      await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [migration.id]);
      await client.query('COMMIT');
      console.log(`migration applied: ${migration.id}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
