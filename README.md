# Atlas by Arcadia

**Live at [atlas-fitness.org](https://atlas-fitness.org)** · fitness, food, and community in
one local-first app.

Atlas is a subscription fitness platform ($10/month or $72/year after a 7-day trial): log
workouts (planned or on the spot), track calories against a weekly meal plan, and share
workouts, recipes, plans, and progress with friends. Everything personal lives in SQLite **on the device** and syncs through the
API — the server orders changes but never mines your data.

**Proprietary — all rights reserved.** This code is not licensed for use, copying, or
distribution.

## What's in the product

**Workout** — start an empty workout and add exercises as you go, or start a saved routine
(its exercises are copied into the session, so adding or dropping one on the day never edits
the routine; on finish you can save the session as a new routine or update the one it came
from). Weekly plans (curated catalog + community-shared) decide "today's workout". Sessions
can be renamed, discarded, edited after the fact and backdated ("Log past workout").

**History** — every finished workout, newest first, with duration, sets, volume and the
exercises done; open one to repeat it, edit it, delete it or share it. Progress charts
(weekly volume, muscle balance, top lifts, weight trend) and goals live under You.

**Eat** — calorie diary with per-meal targets, food search backed by four sources merged
in priority order (our curated food DB → FatSecret Premier → USDA → Open Food Facts), with
search-as-you-type autocomplete and camera barcode scanning. Recipes are first-class:
build them from ingredients, publish them to the community browser, rate others', and drop
any recipe (yours or saved) straight into the weekly meal plan — which in turn drives
one-tap diary logging and shopping-list generation.

**Community** — friends and groups with opt-in stat sharing, presence, public profiles
with reputation, a friends activity feed of shared workouts, shared plan/recipe browsing with
reviews, and abuse reporting on all of it.

**Dashboard** — the pinned top card is the workout: resume the one in progress, start
today's planned one, start an empty one, or log a past one. Below it the cards are
user-arrangeable (drag or use move controls; layout persists per device): weekly pulse,
progress charts, goals, today's meals. A live admin promotion shows as a dismissible strip.

**Navigation** — five tabs on every screen size (bottom bar on phones, sidebar on desktop):
Home · Workout · History · Eat · You. The Workout tab is one hub (quick start, routines,
plan, exercises, recent) with drill-downs; Eat and You keep segmented sub-tabs (You holds
Progress, Goals and Friends).

**Monetization** — 7-day trial on signup, then $10/month or $72/year through Stripe
Checkout (prices live in `packages/shared/src/membership.ts` and must match the Stripe
price objects). Promo codes (percent discounts and instant free-time grants, with
redemption caps), admin-comped accounts that bypass the subscription entirely, and a
paywall that keeps billing/settings reachable for expired accounts. Without the Stripe env
vars the app shows its "payments coming soon" state.

**Administration** (`/admin`) — user directory with roles (user/moderator/admin), plan and
exempt controls, masquerade, bans with optional IP blocking (blocklist enforced before
auth), the moderation queue for user reports, promo management, curated-food imports (paste
a JSON array generated from any restaurant's nutrition guide), and a full audit log of
every sensitive action.

## Stack

| Layer       | Tech                                                                                                                 |
| ----------- | -------------------------------------------------------------------------------------------------------------------- |
| Web         | React 19 · Vite · Tailwind 4 · TanStack Query · react-router · Capacitor (Android)                                   |
| Device data | SQLite (sql.js in browser, native on Android), synced via a per-user replica log                                     |
| API         | Hono on Node · Postgres (raw SQL, append-only migrations run at boot)                                                |
| Auth        | Argon2id passwords + Google sign-in (OAuth code flow) · hashed session tokens · httpOnly cookies / Bearer for native |
| Food data   | Curated DB (ours) · FatSecret Platform Premier · USDA FDC · Open Food Facts                                          |
| Hosting     | Railway (atlas-web nginx + atlas-api + Postgres), auto-deploys from `main`; DNS on Cloudflare                        |

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
  A new synced table needs its own table group there (the older groups are baked into
  earlier migrations) plus an entry in the API's `ALLOWED_ENTITIES` in `routes/sync.ts`.
- New accounts see the intro wizard once (skippable); completion/skip is stored in the synced
  `settings` table under `onboarding`, next to `training_profile`.
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

| Account | Email             | Password  | Notes                                                                                        |
| ------- | ----------------- | --------- | -------------------------------------------------------------------------------------------- |
| Demo    | demo@arcadia.dev  | demo1234  | `npm run seed:demo -w @arcadia/api` fills its sync log with workouts, meals, a shopping list |
| Admin   | admin@arcadia.dev | admin1234 | Full `/admin` dashboard                                                                      |

Admin masquerade sessions are always marked in the database, surfaced in the UI banner, and
recorded in the audit log — impersonation is never invisible.

### Curated community plans

`apps/api/scripts/plans/*.json` are weekly plan templates written with exercise names from the
vendored dataset. `npm run publish:plans -w @arcadia/api` publishes them as public community
plans owned by `admin` (override with `PLAN_OWNER`), updating in place on re-runs; point
`DATABASE_URL` at the target database. The two "365-Day Run Readiness" files split a year-long
program into its two weekly shapes, with the block-by-block progression in the description.

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
