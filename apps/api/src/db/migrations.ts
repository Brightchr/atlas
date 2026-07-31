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
  {
    id: '002_notifications_admin',
    sql: `
      -- In-app notifications (email delivery can hook in later via a provider).
      CREATE TABLE notifications (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type       text NOT NULL,
        title      text NOT NULL,
        body       text NOT NULL DEFAULT '',
        read       boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX notifications_user_idx ON notifications(user_id, read);

      -- When an admin masquerades as a user, the session records who is really
      -- behind it — impersonation is never invisible.
      ALTER TABLE sessions
        ADD COLUMN impersonator_user_id uuid REFERENCES users(id) ON DELETE SET NULL;

      -- Append-only trail of sensitive actions (impersonation, role changes, …).
      CREATE TABLE audit_log (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_id    uuid REFERENCES users(id) ON DELETE SET NULL,
        action      text NOT NULL,
        target_type text NOT NULL,
        target_id   text NOT NULL,
        detail      jsonb NOT NULL DEFAULT '{}',
        created_at  timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX audit_log_actor_idx ON audit_log(actor_id, created_at);
    `,
  },
  {
    id: '003_membership',
    sql: `
      -- Monetization is a separate axis from moderation: role = permissions,
      -- plan = paid tier. plan_expires_at NULL means indefinite.
      ALTER TABLE users
        ADD COLUMN plan text NOT NULL DEFAULT 'free'
          CHECK (plan IN ('free', 'pro')),
        ADD COLUMN plan_expires_at timestamptz;

      -- Promotion codes for launches/discounts; redemption wiring comes with
      -- payments. Percent kept as integer (25 = 25% off).
      CREATE TABLE promotions (
        id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code             text NOT NULL UNIQUE,
        description      text NOT NULL DEFAULT '',
        discount_percent integer NOT NULL CHECK (discount_percent BETWEEN 1 AND 100),
        active           boolean NOT NULL DEFAULT true,
        starts_at        timestamptz NOT NULL DEFAULT now(),
        ends_at          timestamptz,
        created_at       timestamptz NOT NULL DEFAULT now()
      );
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
