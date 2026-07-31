/** Central place for reading environment configuration.
 * Railway injects PORT and DATABASE_URL automatically; the defaults below match
 * the local docker-compose Postgres so `npm run dev:api` works out of the box. */
export const env = {
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',
  databaseUrl:
    process.env.DATABASE_URL ?? 'postgresql://arcadia:arcadia@localhost:55432/arcadia',
  /** Browser origins allowed to call this API with credentials (cookies). */
  corsOrigins: (
    process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:5174,http://localhost:8080'
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  /** Seeded account passwords. Dev gets defaults; in production the accounts
   * are only created when a password is explicitly provided via env — a
   * known default admin password must never exist on a public deployment. */
  adminPassword:
    process.env.ADMIN_PASSWORD ??
    (process.env.NODE_ENV === 'production' ? null : 'admin1234'),
  demoPassword:
    process.env.DEMO_PASSWORD ?? (process.env.NODE_ENV === 'production' ? null : 'demo1234'),
} as const;
