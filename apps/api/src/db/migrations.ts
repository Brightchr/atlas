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
  {
    id: '004_shared_plans',
    sql: `
      -- Workout plans published from a device. The full plan (days + embedded
      -- workout definitions) travels as one JSON payload — the server never
      -- needs to understand workout internals, only visibility.
      -- 'friends' visibility is stored but resolves to owner-only until the
      -- friends system ships.
      CREATE TABLE shared_plans (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        local_plan_id text NOT NULL,
        name          text NOT NULL,
        description   text NOT NULL DEFAULT '',
        visibility    text NOT NULL DEFAULT 'private'
                      CHECK (visibility IN ('private', 'friends', 'public')),
        payload       jsonb NOT NULL,
        created_at    timestamptz NOT NULL DEFAULT now(),
        updated_at    timestamptz NOT NULL DEFAULT now(),
        UNIQUE (owner_user_id, local_plan_id)
      );
      CREATE INDEX shared_plans_visibility_idx ON shared_plans(visibility, updated_at);
    `,
  },
  {
    id: '005_sync',
    sql: `
      -- Device sync: a per-user replica log, one row per synced entity row.
      -- The server never parses payloads (same stance as shared_plans) — it
      -- only orders changes. seq is a global sequence; clients page through
      -- their own rows with WHERE user_id = ? AND seq > cursor, so per-user
      -- ordering is all that matters. Tombstones keep payload NULL.
      CREATE SEQUENCE sync_rows_seq;
      CREATE TABLE sync_rows (
        user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        entity     text NOT NULL,
        row_id     text NOT NULL,
        payload    jsonb,
        deleted    boolean NOT NULL DEFAULT false,
        -- Client clock at the moment of the change: the last-write-wins axis.
        changed_at timestamptz NOT NULL,
        device_id  text NOT NULL,
        seq        bigint NOT NULL DEFAULT nextval('sync_rows_seq'),
        PRIMARY KEY (user_id, entity, row_id)
      );
      CREATE INDEX sync_rows_user_seq_idx ON sync_rows(user_id, seq);
    `,
  },
  {
    id: '006_plan_social',
    sql: `
      -- Published plans grow discovery metadata: what the plan is for, how hard
      -- it is, and the eating style it pairs with. Existing shares default to
      -- the neutral middle.
      ALTER TABLE shared_plans
        ADD COLUMN difficulty text NOT NULL DEFAULT 'intermediate'
          CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
        ADD COLUMN goal text NOT NULL DEFAULT 'general'
          CHECK (goal IN ('build_muscle', 'lose_weight', 'get_stronger', 'general')),
        ADD COLUMN diet text
          CHECK (diet IN ('high_protein', 'calorie_deficit', 'balanced', 'performance'));

      -- One review per user per plan; re-reviewing updates in place.
      CREATE TABLE plan_reviews (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        plan_id    uuid NOT NULL REFERENCES shared_plans(id) ON DELETE CASCADE,
        user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rating     integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment    text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (plan_id, user_id)
      );
      CREATE INDEX plan_reviews_plan_idx ON plan_reviews(plan_id);

      -- Direct person-to-person shares: the recipient (and only the recipient)
      -- gains view/import access to a non-public plan. Requires sign-in by
      -- construction — rows reference user accounts.
      CREATE TABLE plan_shares (
        id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        plan_id      uuid NOT NULL REFERENCES shared_plans(id) ON DELETE CASCADE,
        from_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        to_user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at   timestamptz NOT NULL DEFAULT now(),
        UNIQUE (plan_id, to_user_id)
      );
      CREATE INDEX plan_shares_to_idx ON plan_shares(to_user_id);
    `,
  },
  {
    id: '007_profiles',
    sql: `
      -- Public-facing identity. display_name NULL means "show the username";
      -- bio is always a string so the UI never branches on null.
      ALTER TABLE users
        ADD COLUMN display_name text CHECK (char_length(display_name) <= 60),
        ADD COLUMN bio text NOT NULL DEFAULT '' CHECK (char_length(bio) <= 500);
    `,
  },
  {
    id: '008_profile_page',
    sql: `
      -- The customizable public profile: appearance (banner preset, avatar
      -- emoji), per-section privacy switches, and an opt-in snapshot of
      -- training goals. One validated JSON document so the page can grow
      -- without a migration per knob. Size-capped against abuse.
      ALTER TABLE users
        ADD COLUMN profile jsonb NOT NULL DEFAULT '{}'
          CHECK (pg_column_size(profile) <= 8192);
    `,
  },
  {
    id: '009_social',
    sql: `
      -- Discord-style friend graph: one row per request, accepted = friends.
      -- A request in each direction never coexists — sending a request while
      -- the reverse is pending auto-accepts it (route logic).
      CREATE TABLE friendships (
        id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        requester_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        addressee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status       text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'accepted')),
        created_at   timestamptz NOT NULL DEFAULT now(),
        responded_at timestamptz,
        UNIQUE (requester_id, addressee_id),
        CHECK (requester_id <> addressee_id)
      );
      CREATE INDEX friendships_addressee_idx ON friendships(addressee_id, status);
      CREATE INDEX friendships_requester_idx ON friendships(requester_id, status);

      -- Workout groups: a named crew that sees each other's shared stats.
      CREATE TABLE groups (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name          text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
        owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at    timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE group_members (
        group_id    uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status      text NOT NULL DEFAULT 'invited'
                    CHECK (status IN ('invited', 'member')),
        -- Joining a group means sharing stats to it by default (disclosed in
        -- the invite UI); members can switch it off per group.
        share_stats boolean NOT NULL DEFAULT true,
        invited_by  uuid REFERENCES users(id) ON DELETE SET NULL,
        created_at  timestamptz NOT NULL DEFAULT now(),
        joined_at   timestamptz,
        PRIMARY KEY (group_id, user_id)
      );
      CREATE INDEX group_members_user_idx ON group_members(user_id, status);

      -- Person-to-person stat sharing: owner grants grantee sight of their
      -- stats snapshot. OFF by default — a friendship alone reveals nothing.
      CREATE TABLE stat_grants (
        owner_user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        grantee_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at      timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (owner_user_id, grantee_user_id)
      );

      -- One compact stats snapshot per user, computed and published by the
      -- client (the server never derives stats from opaque sync payloads).
      -- Who may SEE it is decided at read time from grants + groups.
      CREATE TABLE user_stats (
        user_id    uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        payload    jsonb NOT NULL CHECK (pg_column_size(payload) <= 8192),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `,
  },
  {
    id: '010_hardening',
    sql: `
      -- Usernames are matched with lower() everywhere (friend requests, plan
      -- shares, profile pages) but were only unique case-SENSITIVELY: "Bob"
      -- could register next to "bob" and intercept things addressed to the
      -- other. The functional unique index closes the hole and makes the
      -- lower() lookups indexed. Emails are stored lowercased by the auth
      -- routes; the CHECK makes the database enforce it.
      CREATE UNIQUE INDEX users_username_lower_idx ON users (lower(username));
      UPDATE users SET email = lower(email);
      ALTER TABLE users ADD CONSTRAINT users_email_lowercase CHECK (email = lower(email));

      -- Indexes for hot read paths that only had their write-side constraints.
      CREATE INDEX stat_grants_grantee_idx ON stat_grants (grantee_user_id);
      CREATE INDEX plan_reviews_user_idx ON plan_reviews (user_id, updated_at DESC);
      CREATE INDEX notifications_user_created_idx ON notifications (user_id, created_at DESC);
      CREATE INDEX audit_log_created_idx ON audit_log (created_at DESC);
      CREATE INDEX sessions_expires_idx ON sessions (expires_at);
    `,
  },
  {
    id: '011_presence',
    sql: `
      -- Presence: touched (throttled) by the session middleware. "Online" is
      -- derived at read time (last_seen_at within a few minutes); visibility
      -- is the owner's choice via the profile document's show.online switch.
      ALTER TABLE users ADD COLUMN last_seen_at timestamptz;
    `,
  },
  {
    id: '012_trial',
    sql: `
      -- Every signup starts a 7-day trial (the default fires at INSERT time,
      -- so registration needs no extra step). Membership is derived at read
      -- time: paid plan > unexpired trial > expired. Existing accounts get a
      -- fresh 7 days from this deploy rather than a retroactive window that
      -- could lock them out the moment the paywall ships.
      ALTER TABLE users
        ADD COLUMN trial_ends_at timestamptz DEFAULT (now() + interval '7 days');
      UPDATE users SET trial_ends_at = now() + interval '7 days';
    `,
  },
  {
    id: '013_promo_redemptions',
    sql: `
      -- Redemption controls. max_redemptions NULL = unlimited. grant_days set
      -- means the code grants pro time immediately on redemption (comp/launch
      -- codes); NULL means it is a checkout discount, held until the payment
      -- processor lands and applied to the first invoice.
      ALTER TABLE promotions
        ADD COLUMN max_redemptions integer CHECK (max_redemptions > 0),
        ADD COLUMN grant_days integer CHECK (grant_days > 0);

      -- One redemption per user per code, enforced by the database — the
      -- application check alone would race under concurrent requests.
      CREATE TABLE promo_redemptions (
        id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
        user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at   timestamptz NOT NULL DEFAULT now(),
        UNIQUE (promotion_id, user_id)
      );
      CREATE INDEX promo_redemptions_user_idx ON promo_redemptions(user_id, created_at DESC);
    `,
  },
  {
    id: '014_moderation',
    sql: `
      -- Account standing — a third axis next to role (permissions) and plan
      -- (payment). Banned accounts keep their data but every session lookup
      -- excludes them, so access dies instantly across all devices.
      ALTER TABLE users
        ADD COLUMN status text NOT NULL DEFAULT 'active'
          CHECK (status IN ('active', 'banned')),
        ADD COLUMN banned_at timestamptz,
        ADD COLUMN ban_reason text CHECK (char_length(ban_reason) <= 300);

      -- Where each session was created from (register/login/impersonate).
      -- Feeds abuse tooling: the admin "ban + block IPs" action reads the
      -- target's recent session IPs.
      ALTER TABLE sessions ADD COLUMN ip text;
    `,
  },
];

/** A constant app-wide lock key — any number, stable forever. */
const MIGRATION_LOCK_KEY = 727_001;

export async function runMigrations(): Promise<void> {
  // Serialize across instances: overlapping deploys (or 2+ replicas booting)
  // racing CREATE TABLE would crash-loop. The advisory lock is held on a
  // dedicated connection for the whole run.
  const lockClient = await pool.connect();
  try {
    await lockClient.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
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
  } finally {
    await lockClient.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]).catch(() => {});
    lockClient.release();
  }
}
