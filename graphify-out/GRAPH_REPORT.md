# Graph Report - marketplace_bun  (2026-10-09)

## Corpus Check
- 76 files · ~39,959 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: .graphify-bak 1, (none) 1, .lock 1)

## Summary
- 260 nodes · 659 edges · 13 communities
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 51 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `95b2a9c8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- parseDbError
- product.controllers.js
- Simulation Script
- transaction.routes.js
- Architecture & Auth Design
- package.json
- error
- Architecture Conventions
- Role & Pembagian Kerja
- Role Smoke Tests
- Frontend API Update Guide
- members.routes.js
- compilerOptions

## God Nodes (most connected - your core abstractions)
1. `error()` - 42 edges
2. `parseDbError()` - 38 edges
3. `success()` - 35 edges
4. `NotFoundError` - 22 edges
5. `AppError` - 12 edges
6. `drizzle-orm` - 9 edges
7. `simulate.sh script` - 9 edges
8. `updateTransactionStatus()` - 9 edges
9. `Role & Pembagian Kerja` - 9 edges
10. `db` - 8 edges

## Surprising Connections (you probably didn't know these)
- `Soal SO: per-produk atau sesi?` --references--> `editProductById()`  [INFERRED]
  docs/roles.md → src/services/product.service.js
- `A. Role & permission — ✅ SELESAI` --references--> `requireRole()`  [INFERRED]
  docs/roles.md → src/middlewares/auth.middleware.js
- `B. Alur pengemasan (packaging) — ✅ SELESAI` --references--> `requireRole()`  [INFERRED]
  docs/roles.md → src/middlewares/auth.middleware.js
- `Aturan transisi status (sudah di kode)` --references--> `updateTransactionStatus()`  [INFERRED]
  docs/roles.md → src/services/transaction.service.js
- `Keputusan yang sudah disepakati` --references--> `updateTransactionStatus()`  [INFERRED]
  docs/roles.md → src/services/transaction.service.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Auth Schema Change (design + plan + schema entities)** — docs_superpowers_plans_2026_07_10_auth_schema_plan, docs_superpowers_specs_2026_07_10_auth_schema_design_auth_schema_design, docs_superpowers_specs_2026_07_10_auth_schema_design_userstable_auth_columns, docs_superpowers_specs_2026_07_10_auth_schema_design_sessionstable, docs_superpowers_specs_2026_07_10_auth_schema_design_userroleenum [EXTRACTED 1.00]
- **Service-to-controller error handling flow** — docs_error_handling_apperror, docs_error_handling_notfounderror, docs_error_handling_status_propagation, claude_md_parsedberror [EXTRACTED 1.00]

## Communities (13 total, 0 thin omitted)

### Community 0 - "parseDbError"
Cohesion: 0.12
Nodes (32): drizzle-orm, db, membersTable, orderChannelEnum, paymentMethodEnum, productTable, sessionsTable, stockAdjustmentsTable (+24 more)

### Community 1 - "product.controllers.js"
Cohesion: 0.10
Nodes (35): RFC-4180, createProduct(), createStockAdjustment(), importProductsCsv(), importTemplateCsv(), listBestSellerProducts(), listLowStockProducts(), listProducts() (+27 more)

### Community 2 - "Simulation Script"
Cohesion: 0.36
Nodes (9): c2(), hdr(), mkprod(), note(), ok(), reg(), req(), simulate.sh script (+1 more)

### Community 3 - "transaction.routes.js"
Cohesion: 0.16
Nodes (20): exportTransactionsCsv(), handleCreateTransaction(), transactionById(), transactionInvoice(), transactionsSummary(), penjualan, assertChannelAllowed(), channelForRole() (+12 more)

### Community 4 - "Architecture & Auth Design"
Cohesion: 0.16
Nodes (13): Project Commands (bun/drizzle-kit workflow), parseDbError (Postgres error code mapping), JSON Response Envelope ({success, data} / {success, error}), Postgres db service (postgres:16-alpine), AppError (base error with .status), NotFoundError (AppError shortcut, 404), Controller status propagation (err.status ?? 400), Auth Schema Implementation Plan (+5 more)

### Community 5 - "package.json"
Cohesion: 0.07
Nodes (28): dependencies, dotenv, drizzle-orm, drizzle-zod, hono, @hono/zod-validator, pg, zod (+20 more)

### Community 6 - "error"
Cohesion: 0.14
Nodes (31): Permission matrix (rancangan), handleRegisterMember(), listMembers(), memberById(), removeMember(), updateMember(), updateProduct(), changeTransactionStatus() (+23 more)

### Community 8 - "Architecture Conventions"
Cohesion: 0.67
Nodes (3): Layered Architecture (routes -> controllers -> services -> db), New Resource Convention (schema -> validator -> service -> controller -> route), getAllTransactions (status filtering + pagination)

### Community 10 - "Role & Pembagian Kerja"
Cohesion: 0.16
Nodes (13): A. Role & permission — ✅ SELESAI, Aturan transisi status (sudah di kode), B. Alur pengemasan (packaging) — ✅ SELESAI, C. Stock Opname (gudang) — ✅ SELESAI, Keputusan yang sudah disepakati, Konteks, Role & Pembagian Kerja, Soal SO: per-produk atau sesi? (+5 more)

### Community 11 - "Role Smoke Tests"
Cohesion: 0.53
Nodes (4): body(), chk(), reg(), smoke-roles.sh script

### Community 12 - "Frontend API Update Guide"
Cohesion: 0.17
Nodes (11): 1. Role & akses, 2. Transaksi: field baru & aturan cancel, 3. BARU: alur pengemasan (layar untuk role packaging), 4. BARU: penyesuaian stok (layar untuk role gudang), 5. Perubahan kecil tapi kelihatan di UI, Bikin transaksi, Cancel, Checklist implementasi FE (+3 more)

### Community 13 - "members.routes.js"
Cohesion: 0.16
Nodes (14): zod, checkConnection(), app, memberRoute, productRoute, transactionRoute, userRoute, handleValidation() (+6 more)

### Community 14 - "compilerOptions"
Cohesion: 0.33
Nodes (5): compilerOptions, module, moduleResolution, target, include

## Knowledge Gaps
- **12 isolated node(s):** `drizzle-zod`, `pg`, `@types/bun`, `typescript`, `RFC-4180` (+7 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 64 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `error()` connect `error` to `parseDbError`, `product.controllers.js`, `transaction.routes.js`, `Role & Pembagian Kerja`, `members.routes.js`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **What connects `drizzle-zod`, `pg`, `@types/bun` to the rest of the system?**
  _12 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `parseDbError` be split into smaller, more focused modules?**
  _Cohesion score 0.12473572938689217 - nodes in this community are weakly interconnected._
- **Why does `drizzle-orm` connect `parseDbError` to `product.controllers.js`, `package.json`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **Should `product.controllers.js` be split into smaller, more focused modules?**
  _Cohesion score 0.10452961672473868 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._
- **Should `error` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._