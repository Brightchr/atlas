/** Central place for reading environment configuration.
 * Railway injects PORT automatically; DATABASE_URL arrives when a Postgres
 * plugin is attached to the service. */
export const env = {
  port: Number(process.env.PORT ?? 3000),
  /** Set by Railway Postgres later — unused until sync features land. */
  databaseUrl: process.env.DATABASE_URL ?? null,
  nodeEnv: process.env.NODE_ENV ?? 'development',
} as const;
