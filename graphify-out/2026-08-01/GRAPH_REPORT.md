# Graph Report - .  (2026-07-22)

## Corpus Check
- Corpus is ~9,369 words - fits in a single context window. You may not need a graph.

## Summary
- 141 nodes · 315 edges · 10 communities
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.75)
- Token cost: 48,262 input · 0 output

## Community Hubs (Navigation)
- Database Schema & Services
- Routing & App Wiring
- Controllers Layer
- User Service & Errors
- Docs & Auth Design
- Runtime Dependencies
- Build Scripts & Tooling
- User Validators
- Architecture Conventions

## God Nodes (most connected - your core abstractions)
1. `error()` - 26 edges
2. `parseDbError()` - 22 edges
3. `success()` - 21 edges
4. `scripts` - 6 edges
5. `db` - 6 edges
6. `listUsers()` - 5 edges
7. `userById()` - 5 edges
8. `authMiddleware()` - 5 edges
9. `NotFoundError` - 5 edges
10. `handleValidation()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `README Quickstart (bun install / bun run dev)` --semantically_similar_to--> `Project Commands (bun/drizzle-kit workflow)`  [INFERRED] [semantically similar]
  README.md → CLAUDE.md
- `getAllTransactions (status filtering + pagination)` --conceptually_related_to--> `Layered Architecture (routes -> controllers -> services -> db)`  [INFERRED]
  docs/transactions.md → CLAUDE.md
- `Controller status propagation (err.status ?? 400)` --references--> `JSON Response Envelope ({success, data} / {success, error})`  [EXTRACTED]
  docs/error-handling.md → CLAUDE.md
- `Controller status propagation (err.status ?? 400)` --references--> `parseDbError (Postgres error code mapping)`  [EXTRACTED]
  docs/error-handling.md → CLAUDE.md
- `Project Commands (bun/drizzle-kit workflow)` --references--> `Postgres db service (postgres:16-alpine)`  [EXTRACTED]
  CLAUDE.md → docker-compose.yml

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Auth Schema Change (design + plan + schema entities)** — docs_superpowers_plans_2026_07_10_auth_schema_plan, docs_superpowers_specs_2026_07_10_auth_schema_design_auth_schema_design, docs_superpowers_specs_2026_07_10_auth_schema_design_userstable_auth_columns, docs_superpowers_specs_2026_07_10_auth_schema_design_sessionstable, docs_superpowers_specs_2026_07_10_auth_schema_design_userroleenum [EXTRACTED 1.00]
- **Service-to-controller error handling flow** — docs_error_handling_apperror, docs_error_handling_notfounderror, docs_error_handling_status_propagation, claude_md_parsedberror [EXTRACTED 1.00]

## Communities (10 total, 0 thin omitted)

### Community 0 - "Database Schema & Services"
Cohesion: 0.17
Nodes (20): db, paymentMethodEnum, productTable, sessionsTable, transactionItemsTable, transactionsTable, transactionStatusEnum, usersTable (+12 more)

### Community 1 - "Routing & App Wiring"
Cohesion: 0.16
Nodes (16): checkConnection(), app, authMiddleware(), productRoute, transactionRoute, userRoute, handleValidation(), createNewProductSchema (+8 more)

### Community 2 - "Controllers Layer"
Cohesion: 0.24
Nodes (17): addNewProduct(), deleteProductById(), editProductById(), getAllProducts(), getLowStockProducts(), getProductById(), createTransaction(), getAllTransactions() (+9 more)

### Community 3 - "User Service & Errors"
Cohesion: 0.22
Nodes (11): listUsers(), userById(), editUserById(), editUserRole(), getAllUsers(), getUserById(), loginUser(), registerUser() (+3 more)

### Community 4 - "Docs & Auth Design"
Cohesion: 0.16
Nodes (15): Project Commands (bun/drizzle-kit workflow), parseDbError (Postgres error code mapping), JSON Response Envelope ({success, data} / {success, error}), Postgres db service (postgres:16-alpine), AppError (base error with .status), NotFoundError (AppError shortcut, 404), Controller status propagation (err.status ?? 400), Error-handling YAGNI deferrals (ConflictError 409, UUID param validation) (+7 more)

### Community 5 - "Runtime Dependencies"
Cohesion: 0.13
Nodes (15): dotenv, drizzle-orm, drizzle-zod, hono, @hono/zod-validator, dependencies, dotenv, drizzle-orm (+7 more)

### Community 6 - "Build Scripts & Tooling"
Cohesion: 0.15
Nodes (12): drizzle-kit, devDependencies, drizzle-kit, @types/bun, name, scripts, db:generate, db:migrate (+4 more)

### Community 7 - "User Validators"
Cohesion: 0.39
Nodes (7): userRoleEnum, createUserSchema, editUserByIdSchema, editUserRoleSchema, getUserQuerySchema, loginUserSchema, userIdParamSchema

### Community 8 - "Architecture Conventions"
Cohesion: 0.67
Nodes (3): Layered Architecture (routes -> controllers -> services -> db), New Resource Convention (schema -> validator -> service -> controller -> route), getAllTransactions (status filtering + pagination)

## Knowledge Gaps
- **24 isolated node(s):** `name`, `dev`, `db:push`, `db:generate`, `db:migrate` (+19 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `error()` connect `Controllers Layer` to `Database Schema & Services`, `Routing & App Wiring`, `User Service & Errors`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Why does `success()` connect `Controllers Layer` to `Database Schema & Services`, `User Service & Errors`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `parseDbError()` connect `Database Schema & Services` to `User Service & Errors`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **What connects `name`, `dev`, `db:push` to the rest of the system?**
  _24 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Runtime Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._