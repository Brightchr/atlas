# Atlas by Arcadia

**Live at [atlas-fitness.org](https://atlas-fitness.org)** · fitness, food, and community in
one local-first app.

Atlas is a subscription fitness platform ($5/month after a 7-day trial): plan and log
workouts, track calories against a weekly meal plan, and share recipes, plans, and progress
with friends. Everything personal lives in SQLite **on the device** and syncs through the
API — the server orders changes but never mines your data.

**Proprietary — all rights reserved.** This code is not licensed for use, copying, or
distribution.

## What's in the product

**Train** — workout plans (curated catalog + community-shared), session logging, weekly
volume/muscle-balance/top-lift charts, goals with progress tracking, training profile that
tunes exercise suggestions.

**Eat** — calorie diary with per-meal targets, food search backed by four sources merged
in priority order (our curated food DB → FatSecret Premier → USDA → Open Food Facts), with
search-as-you-type autocomplete and camera barcode scanning. Recipes are first-class:
build them from ingredients, publish them to the community browser, rate others', and drop
any recipe (yours or saved) straight into the weekly meal plan — which in turn drives
one-tap diary logging and shopping-list generation.

**Community** — friends and groups with opt-in stat sharing, presence, public profiles
with reputation, shared plan/recipe browsing with reviews, and abuse reporting on all of it.

**Dashboard** — the home screen is user-arrangeable (drag cards or use move controls;
layout persists per device), with progress charts, goals, and today-at-a-glance. The hero
slot is reserved for promotions we post.

**Monetization** — 7-day trial on signup, then $5/month. Promo codes (percent discounts
and instant free-time grants, with redemption caps), admin-comped accounts that bypass the
subscription entirely, and a paywall that keeps billing/settings reachable for expired
accounts. Checkout is a placeholder until Stripe is wired.

**Administration** (`/admin`) — user directory with roles (user/moderator/admin), plan and
exempt controls, masquerade, bans with optional IP blocking (blocklist enforced before
auth), the moderation queue for user reports, promo management, curated-food imports (paste
a JSON array generated from any restaurant's nutrition guide), and a full audit log of
every sensitive action.

## Stack

| Layer | Tech |
|---|---|
| Web | React 19 · Vite · Tailwind 4 · TanStack Query · react-router · Capacitor (Android) |
| Device data | SQLite (sql.js in browser, native on Android), synced via a per-user replica log |
| API | Hono on Node · Postgres (raw SQL, append-only migrations run at boot) |
| Auth | Argon2id passwords + Google sign-in (OAuth code flow) · hashed session tokens · httpOnly cookies / Bearer for native |
| Food data | Curated DB (ours) · FatSecret Platform Premier · USDA FDC · Open Food Facts |
| Hosting | Railway (atlas-web nginx + atlas-api + Postgres), auto-deploys from `main`; DNS on Cloudflare |

## Structure

```
apps/
  web/        React + Vite + Capacitor app (the product)
    src/
      app/        Router, providers, layout shell
      features/   One folder per feature: training, nutrition, social, billing, admin, …
      lib/        Cross-feature infrastructure: exercise catalog, SQLite layer, sync engine
  api/        Hono API: auth, billing, sync, food search, social, admin, moderation
packages/
  shared/     Domain types + membership resolution shared by web and api
```

Conventions:

- Features never import from each other's internals — shared code lives in `lib/` or `@arcadia/shared`.
- External DTOs (exercise DB, food APIs) are mapped to domain types at the boundary.
- Device SQLite schema: `apps/web/src/lib/db/schema.ts` (append a new `toVersion`, never edit one).
- Postgres schema: `apps/api/src/db/migrations.ts` (append-only, applied transactionally at boot).
- Membership (`pro` / `trial` / `expired`) is derived in exactly one place:
  `packages/shared/src/membership.ts`. API gates use `requireActiveMember`; the web paywall
  reads the same resolution off the session.

## Development

```bash
npm install
docker compose up -d db   # dev Postgres on localhost:55432 (arcadia/arcadia)
npm run dev               # web app on http://localhost:5174
npm run dev:api           # API on http://localhost:3000 (runs migrations on boot)
npm run typecheck         # all workspaces
npm test -w @arcadia/api  # integration tests (needs the dev Postgres running)
```

The dev servers honor `PORT`, and the web dev server honors `API_PROXY_TARGET`, so two
checkouts (e.g. git worktrees) can run side by side.

### API environment

See `apps/api/.env.example` for the full list: `DATABASE_URL`, `CORS_ORIGINS`,
`PUBLIC_URL` (OAuth redirects derive from it), `ADMIN_PASSWORD` / `DEMO_PASSWORD` (seeded
accounts — production only creates them when set), `FATSECRET_CLIENT_ID/SECRET` (food
search), `FDC_API_KEY` (USDA), `GOOGLE_CLIENT_ID/SECRET` (Google sign-in), and
`TRUST_CF_PROXY` (set to 1 only when Cloudflare fronts the origin, so rate limits and IP
bans see real client addresses).

## Seeded accounts (dev)

| Account | Email | Password | Notes |
|---|---|---|---|
| Demo | demo@arcadia.dev | demo1234 | Signing in seeds the device DB with workouts, meals, shopping list |
| Admin | admin@arcadia.dev | admin1234 | Full `/admin` dashboard |

Admin masquerade sessions are always marked in the database, surfaced in the UI banner, and
recorded in the audit log — impersonation is never invisible.

## Security posture

- Argon2id password hashing; Google-only accounts store no password at all.
- Sessions are 256-bit random tokens, stored only as SHA-256 hashes, revocable server-side;
  bans invalidate every session on the next request.
- Generic auth errors and timing-equalized login (no account enumeration), rate limits on
  auth/search/redeem endpoints, strict CORS allowlist, body-size caps before parsing,
  IP blocklist enforced ahead of authentication.
- Append-only audit log of all admin actions.

## Android (Capacitor)

```bash
cd apps/web && npx cap add android   # one-time, requires Android Studio
npm run cap:android                  # build, sync, open Android Studio
```

## Deployment

Pushing to `main` on GitHub deploys automatically: the Railway project builds `atlas-api`
and `atlas-web` from their Dockerfiles (healthcheck on `/health`), and the API applies any
new migrations at boot. DNS for atlas-fitness.org is delegated to Cloudflare; the domain is
registered through Railway.

## Data attribution

- Exercise data and images: [Free Exercise DB](https://github.com/yuhonas/free-exercise-db)
  (public domain), vendored at `apps/web/src/lib/exercise-db/exercises.json`, images served
  from the pinned dataset commit via jsDelivr. To update, re-download `dist/exercises.json`
  and bump `DATA_COMMIT` in `apps/web/src/lib/exercise-db/client.ts` together.
- Food search: [FatSecret Platform](https://platform.fatsecret.com),
  [USDA FoodData Central](https://fdc.nal.usda.gov), and
  [Open Food Facts](https://world.openfoodfacts.org) (ODbL — attribution shown in-app).
