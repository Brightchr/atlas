import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Minimal .env loader (no dotenv dependency): KEY=VALUE lines, # comments,
 * optional surrounding quotes. Real environment variables always win — on
 * Railway there is no .env file and this is a no-op; locally it makes
 * apps/api/.env actually take effect (it silently never did before). */
function loadDotEnv(): void {
  let raw: string;
  try {
    raw = readFileSync(resolve(process.cwd(), '.env'), 'utf8');
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || line.trimStart().startsWith('#')) continue;
    const key = m[1]!;
    if (process.env[key] !== undefined) continue;
    process.env[key] = m[2]!.replace(/^(['"])(.*)\1$/, '$2');
  }
}
loadDotEnv();

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
  /** USDA FoodData Central key (free at https://fdc.nal.usda.gov/api-key-signup).
   * DEMO_KEY works but is rate-limited to ~30 req/hour — fine for dev, set a
   * real key in production. */
  fdcApiKey: process.env.FDC_API_KEY ?? 'DEMO_KEY',
  /** The browser-facing origin (the web app). OAuth redirect URIs and
   * post-login redirects derive from it — set it in production. */
  publicUrl: (process.env.PUBLIC_URL ?? 'http://localhost:5174').replace(/\/+$/, ''),
  /** Google OAuth (console.cloud.google.com → Credentials → OAuth client).
   * Unset = the "Continue with Google" flow reports itself unavailable. */
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  /** Set TRUST_CF_PROXY=1 once traffic flows through Cloudflare: client IPs
   * then come from CF-Connecting-IP — the x-forwarded-for walk would stop at
   * a Cloudflare edge address (public) and rate-limit/ban the edge, not the
   * client. Leave unset when Cloudflare is not in front (the header would be
   * spoofable). */
  trustCfProxy: process.env.TRUST_CF_PROXY === '1',
  /** FatSecret Platform credentials (https://platform.fatsecret.com). When
   * set, FatSecret becomes the primary food-search source with USDA as
   * backup; when empty, search runs on USDA + Open Food Facts as before. */
  fatSecretClientId: process.env.FATSECRET_CLIENT_ID ?? '',
  fatSecretClientSecret: process.env.FATSECRET_CLIENT_SECRET ?? '',
} as const;
