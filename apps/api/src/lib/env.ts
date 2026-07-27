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
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:8080')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
} as const;
