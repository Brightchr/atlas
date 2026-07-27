# Arcadia Atlas

Workout platform: exercise lookup (powered by [wger](https://wger.de)), workout & diet plans,
calorie tracking, and shopping lists. Local-first — everything is stored in SQLite on the device.

**Proprietary — all rights reserved.** This code is not licensed for use, copying, or
distribution. Exercise data displayed in the app comes from [wger](https://wger.de) (CC-BY-SA).

## Structure

```
apps/
  web/        React + Vite + Capacitor app (the product)
    src/
      app/        Router, providers, layout shell
      features/   One folder per feature: exercises, workouts, nutrition, plans, shopping
      lib/        Cross-feature infrastructure: wger client, SQLite layer, env
  api/        Hono API for Railway (sync/auth later — health endpoint for now)
packages/
  shared/     Domain types shared by web and api
```

Conventions:

- Features never import from each other's internals — shared code lives in `lib/` or `@arcadia/shared`.
- External DTOs (wger) are mapped to domain types at the client boundary; features only see domain types.
- SQLite access goes through a `repository.ts` per feature; schema changes are versioned in
  `apps/web/src/lib/db/schema.ts` (append a new `toVersion`, never edit an existing one).

## Development

```bash
npm install
docker compose up -d db   # dev Postgres on localhost:55432 (arcadia/arcadia)
npm run dev               # web app on http://localhost:5173
npm run dev:api           # API on http://localhost:3000 (runs migrations on boot)
npm run build             # typecheck + build everything
```

## Auth & data protection

- Passwords hashed with argon2id (OWASP parameters) — never stored or logged in plaintext.
- Sessions are 256-bit random tokens; the database stores only their SHA-256 hash.
  Logout revokes server-side. Browser gets an httpOnly/SameSite=Lax cookie; the
  native app uses `Authorization: Bearer` with the token from the login response.
- Auth endpoints are rate-limited; login errors are generic (no account enumeration).
- CORS is a strict origin allowlist (CORS_ORIGINS) because credentials are allowed.
- Postgres migrations live in `apps/api/src/db/migrations.ts` — append-only, applied
  transactionally at startup. On Railway: attach a Postgres service and the injected
  DATABASE_URL is picked up automatically.

## Android (Capacitor)

One-time setup (requires Android Studio):

```bash
cd apps/web
npx cap add android
```

Then to run on a device/emulator:

```bash
npm run cap:android   # builds web assets, syncs, opens Android Studio
```

## Docker

```bash
docker compose up --build
# web: http://localhost:8080, api: http://localhost:3000
```

## Local wger (self-hosted exercise database)

The app reads exercise data from wger. To run your own instance instead of wger.de:

```bash
npm run wger:up      # clones the official stack into infra/wger on first run, then starts it
npm run wger:logs    # watch first-boot migrations + exercise sync (takes a few minutes)
npm run wger:down
```

- UI: http://localhost:8001 (default login `admin` / `adminadmin`)
- API: http://localhost:8001/api/v2/
- Upstream stack lives in `infra/wger` (gitignored, `git pull`-able); our customizations are
  layered via `infra/wger.override.yml` — never edit the upstream files.
- Point the app at it with `VITE_WGER_URL=http://localhost:8001` in `apps/web/.env`.

## Railway

`railway.json` points Railway at `apps/api/Dockerfile`, so deploying is: create a service from
this repo and it builds the API automatically (healthcheck on `/health`). Attach a Postgres
plugin later to get `DATABASE_URL` for sync features.
