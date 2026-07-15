# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- Install deps: `bun install`
- Run dev server (hot reload): `bun run dev` — serves on `http://localhost:$PORT` (see `.env`)
- Start local Postgres: `docker-compose up -d` (postgres:16-alpine, db `my_app`, exposed on 5432)
- Push schema directly to DB (no migration file): `bun run db:push`
- Generate a migration from schema changes: `bun run db:generate`
- Apply pending migrations: `bun run db:migrate`
- Open Drizzle Studio (DB GUI): `bun run db:studio`

There is no test suite, lint, or typecheck configured in this repo currently.

## Architecture

Bun + Hono HTTP API backed by Postgres via Drizzle ORM. Layering flows one direction:

```
routes -> (zValidator middleware) -> controllers -> services -> db
```

- **`src/index.js`** — app entry point. Creates the Hono app, calls `checkConnection()` against Postgres before accepting traffic, and mounts resource routers (e.g. `app.route("/users", userRoute)`).
- **`src/routes/`** — defines endpoints per resource and wires `@hono/zod-validator` (`zValidator`) using schemas from `src/validators/`. Validation failures are routed through `handleValidation`.
- **`src/controllers/`** — thin request/response glue. Reads `c.req`, calls the matching service function, and wraps the result with `success`/`error` from `src/utils/response.js`. Every controller method wraps its service call in try/catch and returns `error(c, err.message)` on failure — errors thrown from services must have a useful `.message`.
- **`src/services/`** — the only layer that talks to the DB (via `db` from `src/db/database.connection.js` and Drizzle query builder). Wraps DB calls in try/catch and rethrows via `parseDbError` (`src/utils/db-error.js`), which maps Postgres error codes (`23505` unique violation, `23503` FK violation, `23502` not-null violation) to human-readable `Error`s.
- **`src/db/schema.database.js`** — Drizzle table definitions (source of truth for DB schema, used both at runtime and by `drizzle-kit` for migrations).
- **`src/db/database.connection.js`** — creates the single shared `db` (drizzle/node-postgres) instance from `DATABASE_URL`, plus `checkConnection()`.
- **`drizzle/`** — generated SQL migrations from `drizzle-kit generate`, keyed off `drizzle.config.js` (schema path `src/db/schema.database.js`, dialect `postgresql`).

### Conventions to follow when adding a new resource

1. Add/extend a table in `src/db/schema.database.js`, then run `db:generate` (+ `db:migrate`, or `db:push` for quick local iteration).
2. Add a Zod schema in `src/validators/<resource>.validator.js`.
3. Add DB-touching functions in `src/services/<resource>.service.js`, each wrapping errors with `parseDbError`.
4. Add controller functions in `src/controllers/<resource>.controllers.js` that call the service and respond via `success`/`error`.
5. Add a router in `src/routes/<resource>.routes.js` wiring `zValidator("json", schema, handleValidation)` for validated routes, and mount it in `src/index.js` via `app.route(...)`.

Responses are always JSON in the shape `{ success: true, data }` or `{ success: false, error }` (see `src/utils/response.js`) — keep new endpoints consistent with this envelope.

Env vars (`PORT`, `DATABASE_URL`) are read via `Bun.env` directly in the files that need them (not a central config module).
