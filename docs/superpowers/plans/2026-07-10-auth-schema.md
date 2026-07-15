# Auth Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Note for this project:** the user is implementing this plan by hand, not
> via an agentic worker — see `docs/superpowers/specs/2026-07-10-auth-schema-design.md`
> for the approved design this plan implements.

**Goal:** Add password + role to `usersTable` and a new `sessionsTable`, so the DB
can support password login with DB-backed session tokens.

**Architecture:** Pure schema change in `src/db/schema.database.js`, applied via
`drizzle-kit generate` + `drizzle-kit migrate`. No new endpoints, services, or
dependencies — see design doc for what's explicitly out of scope.

**Tech Stack:** Drizzle ORM (`pgTable`, `pgEnum`), Postgres, `drizzle-kit`
(already installed). No new packages.

## Global Constraints

- No test suite, lint, or typecheck configured in this repo (per `CLAUDE.md`) —
  verification steps below use `drizzle-kit` output and direct DB inspection
  instead of a test runner.
- No new dependencies: password hashing uses `Bun.password` (native), session
  tokens use `crypto.randomUUID()` (native) — neither is wired up in this plan
  (out of scope), but the schema must not assume any hashing/token library.
- Follow the existing column style in `schema.database.js`: no explicit column
  name string passed to column builders (e.g. `uuid()` not `uuid("id")`) —
  Drizzle infers the snake_case DB column name from the JS key.
- Local Postgres must be running (`docker-compose up -d`) before generating/
  applying migrations.

---

### Task 1: Add `password`/`role` to `usersTable` and create `sessionsTable`

**Files:**
- Modify: `src/db/schema.database.js`

**Interfaces:**
- Produces: `usersTable.password` (varchar), `usersTable.role` (enum
  `userRoleEnum`, values `"user" | "admin"`, default `"user"`),
  `sessionsTable` (`id`, `userId` FK → `usersTable.id` cascade delete,
  `token`, `expiresAt`).

- [ ] **Step 1: Replace the contents of `src/db/schema.database.js`**

```js
import {
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);

export const usersTable = pgTable("users", {
  id: uuid().primaryKey().defaultRandom(),
  name: varchar({ length: 255 }).notNull(),
  age: integer().notNull(),
  email: varchar({ length: 255 }).notNull().unique(),
  address: varchar({ length: 255 }),
  phone: varchar({ length: 20 }),
  password: varchar({ length: 255 }).notNull(),
  role: userRoleEnum().notNull().default("user"),
});

export const sessionsTable = pgTable("sessions", {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid()
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  token: varchar({ length: 255 }).notNull().unique(),
  expiresAt: timestamp().notNull(),
});
```

- [ ] **Step 2: Sanity-check the file loads**

Run: `bun -e "import('./src/db/schema.database.js').then(m => console.log(Object.keys(m)))"`
Expected: `[ 'userRoleEnum', 'usersTable', 'sessionsTable' ]` printed, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/db/schema.database.js
git commit -m "feat: add password/role to users, add sessions table"
```

(Skip if this repo isn't using git yet — `git init` first if you want history.)

---

### Task 2: Generate the migration

**Files:**
- Create: `drizzle/<timestamp>_<generated_name>.sql` (name is chosen by
  `drizzle-kit`, not hand-written)

**Interfaces:**
- Consumes: `usersTable`, `sessionsTable`, `userRoleEnum` from Task 1.

- [ ] **Step 1: Generate the migration**

Run: `bun run db:generate`
Expected: CLI reports a new migration file created under `drizzle/`, containing
roughly:
- `CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');`
- `ALTER TABLE "users" ADD COLUMN "password" varchar(255) NOT NULL;`
- `ALTER TABLE "users" ADD COLUMN "role" "user_role" DEFAULT 'user' NOT NULL;`
- `CREATE TABLE "sessions" (...)` with the FK to `users.id` and `ON DELETE cascade`.

- [ ] **Step 2: Read the generated SQL file**

Open the new file under `drizzle/` and confirm it matches Task 1's schema
(enum name `user_role`, `sessions` FK has `ON DELETE cascade`, `token` has a
unique constraint). If Drizzle asks an interactive question (e.g. because
`users` already has rows and `password` is `NOT NULL` with no default), stop
here — that's a real decision (need a default/backfill value or a nullable
column temporarily), not something to script around silently.

- [ ] **Step 3: Commit**

```bash
git add drizzle/
git commit -m "chore: generate migration for auth schema"
```

---

### Task 3: Apply the migration and verify

**Files:** none (DB state only)

**Interfaces:**
- Consumes: migration file from Task 2.

- [ ] **Step 1: Start local Postgres if not already running**

Run: `docker-compose up -d`
Expected: `postgres` container reported as running (or already up).

- [ ] **Step 2: Apply the migration**

Run: `bun run db:migrate`
Expected: CLI reports the migration applied with no errors.

- [ ] **Step 3: Verify the new columns/table exist**

Run: `bun run db:studio` and open the `users` and `sessions` tables in the
browser UI, **or** via `psql`:

```bash
docker exec -it $(docker compose ps -q postgres) psql -U postgres -d my_app -c "\d users" -c "\d sessions"
```

Expected: `users` shows `password` (varchar) and `role` (`user_role`, default
`'user'`) columns; `sessions` shows `id`, `user_id`, `token`, `expires_at`,
with `user_id` as a foreign key to `users(id)`.

- [ ] **Step 4: Commit (if anything changed, e.g. lockfiles)**

Usually nothing to commit here — this task only changes DB state, not files.
