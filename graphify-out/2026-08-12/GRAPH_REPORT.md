# Graph Report - my-app  (2026-08-12)

## Corpus Check
- 66 files · ~32,344 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 231 nodes · 529 edges · 13 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.75)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `19094a5a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

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
- Role & Pembagian Kerja
- smoke-roles.sh
- Update API: Role, Packaging, Stock Opname — untuk Tim FE

## God Nodes (most connected - your core abstractions)
1. `error()` - 39 edges
2. `parseDbError()` - 34 edges
3. `success()` - 34 edges
4. `Role & Pembagian Kerja` - 9 edges
5. `Update API: Role, Packaging, Stock Opname — untuk Tim FE` - 8 edges
6. `db` - 7 edges
7. `scripts` - 6 edges
8. `handleCreateTransaction()` - 6 edges
9. `authMiddleware()` - 6 edges
10. `requireRole()` - 6 edges

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

## Communities (13 total, 0 thin omitted)

### Community 0 - "Database Schema & Services"
Cohesion: 0.15
Nodes (17): db, fulfillmentStatusEnum, membersTable, orderChannelEnum, paymentMethodEnum, productTable, sessionsTable, stockAdjustmentsTable (+9 more)

### Community 1 - "Routing & App Wiring"
Cohesion: 0.16
Nodes (29): createProduct(), createStockAdjustment(), listBestSellerProducts(), listLowStockProducts(), listProducts(), listStockAdjustments(), productById(), removeProduct() (+21 more)

### Community 2 - "Controllers Layer"
Cohesion: 0.29
Nodes (7): c2(), hdr(), mkprod(), note(), ok(), req(), simulate.sh script

### Community 3 - "User Service & Errors"
Cohesion: 0.14
Nodes (23): changeFulfillmentStatus(), changeTransactionStatus(), handleCreateTransaction(), listTransactions(), transactionById(), transactionInvoice(), transactionsSummary(), keduanya (+15 more)

### Community 4 - "Docs & Auth Design"
Cohesion: 0.16
Nodes (15): Project Commands (bun/drizzle-kit workflow), parseDbError (Postgres error code mapping), JSON Response Envelope ({success, data} / {success, error}), Postgres db service (postgres:16-alpine), AppError (base error with .status), NotFoundError (AppError shortcut, 404), Controller status propagation (err.status ?? 400), Error-handling YAGNI deferrals (ConflictError 409, UUID param validation) (+7 more)

### Community 5 - "Runtime Dependencies"
Cohesion: 0.07
Nodes (27): dotenv, drizzle-kit, drizzle-orm, drizzle-zod, hono, @hono/zod-validator, dependencies, dotenv (+19 more)

### Community 6 - "Build Scripts & Tooling"
Cohesion: 0.13
Nodes (22): handleRegisterMember(), listMembers(), memberById(), removeMember(), updateMember(), checkConnection(), app, authMiddleware() (+14 more)

### Community 7 - "User Validators"
Cohesion: 0.16
Nodes (24): handleLogin(), handlePasswordChange(), handleRegister(), listUsers(), myProfile(), updateMyProfile(), updateUserRole(), userById() (+16 more)

### Community 8 - "Architecture Conventions"
Cohesion: 0.67
Nodes (3): Layered Architecture (routes -> controllers -> services -> db), New Resource Convention (schema -> validator -> service -> controller -> route), getAllTransactions (status filtering + pagination)

### Community 10 - "Role & Pembagian Kerja"
Cohesion: 0.15
Nodes (12): A. Role & permission — ✅ SELESAI, Aturan transisi status (sudah di kode), B. Alur pengemasan (packaging) — ✅ SELESAI, C. Stock Opname (gudang) — ✅ SELESAI, Keputusan yang sudah disepakati, Konteks, Permission matrix (rancangan), Role & Pembagian Kerja (+4 more)

### Community 11 - "smoke-roles.sh"
Cohesion: 0.47
Nodes (3): chk(), code(), smoke-roles.sh script

### Community 12 - "Update API: Role, Packaging, Stock Opname — untuk Tim FE"
Cohesion: 0.17
Nodes (11): 1. Role & akses, 2. Transaksi: field baru & aturan cancel, 3. BARU: alur pengemasan (layar untuk role packaging), 4. BARU: penyesuaian stok (layar untuk role gudang), 5. Perubahan kecil tapi kelihatan di UI, Bikin transaksi, Cancel, Checklist implementasi FE (+3 more)

## Knowledge Gaps
- **50 isolated node(s):** `name`, `dev`, `db:push`, `db:generate`, `db:migrate` (+45 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `error()` connect `Routing & App Wiring` to `Database Schema & Services`, `User Service & Errors`, `Build Scripts & Tooling`, `User Validators`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Why does `parseDbError()` connect `Routing & App Wiring` to `Database Schema & Services`, `User Service & Errors`, `Build Scripts & Tooling`, `User Validators`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `success()` connect `User Validators` to `Routing & App Wiring`, `User Service & Errors`, `Build Scripts & Tooling`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **What connects `name`, `dev`, `db:push` to the rest of the system?**
  _50 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Database Schema & Services` be split into smaller, more focused modules?**
  _Cohesion score 0.14814814814814814 - nodes in this community are weakly interconnected._
- **Should `User Service & Errors` be split into smaller, more focused modules?**
  _Cohesion score 0.14461538461538462 - nodes in this community are weakly interconnected._
- **Should `Runtime Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._