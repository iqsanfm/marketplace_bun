# Auth Schema Design

## Tujuan

Nambahin kolom/tabel yang dibutuhin buat login berbasis password + session token,
tanpa nambah dependency auth (bcrypt/JWT lib dll) — semua pakai fitur native
Bun/Postgres/JS yang udah tersedia.

Scope: **cuma perubahan schema**. Endpoint register/login/logout (service,
controller, route) ada di luar scope ini — langkah lanjutan terpisah.

## Perubahan `usersTable` (`src/db/schema.database.js`)

Tambah 2 kolom ke tabel `users` yang udah ada:

| Kolom      | Tipe                              | Constraint                          |
|------------|------------------------------------|--------------------------------------|
| `password` | `varchar(255)`                     | `.notNull()`                         |
| `role`     | pg enum `user_role` (`user`,`admin`) | `.notNull().default('user')`        |

- `password` nyimpen hash, bukan plaintext. Hashing pakai `Bun.password.hash()` /
  `Bun.password.verify()` (bcrypt bawaan Bun runtime) — native, gak perlu
  dependency baru.
- `role` pakai Postgres enum (`pgEnum` dari drizzle-orm/pg-core) supaya nilai
  dibatasi di level DB, bukan cuma di Zod.

## Tabel baru `sessionsTable`

| Kolom       | Tipe        | Constraint                                         |
|-------------|-------------|------------------------------------------------------|
| `id`        | `uuid`      | primary key, `.defaultRandom()`                     |
| `userId`    | `uuid`      | FK → `usersTable.id`, `onDelete: 'cascade'`, notNull |
| `token`     | `varchar(255)` | unique, notNull                                  |
| `expiresAt` | `timestamp` | notNull                                             |

- `token` di-generate pakai `crypto.randomUUID()` (native Web Crypto API) —
  gak perlu lib JWT/session.
- `onDelete: 'cascade'` supaya session otomatis kehapus kalau user-nya dihapus
  (gak perlu cleanup manual di service layer).

## Yang sengaja belum dibikin (YAGNI)

Konsisten sama pola di `docs/error-handling.md` — ini ditulis eksplisit biar
gak diam-diam "keinget lupa", nambahnya nanti kalau kebutuhannya nyata:

- `createdAt`, `userAgent`, `ipAddress` di `sessionsTable` — tambah kalau nanti
  butuh fitur "kelola perangkat login" / audit trail.
- `emailVerified` di `usersTable` — tambah kalau nanti ada alur verifikasi email.
- Endpoint register/login/logout — di luar scope perubahan schema ini.

## Migration

Setelah schema diubah, jalanin `bun run db:generate` buat generate migration
file, terus `bun run db:migrate` (atau `bun run db:push` buat iterasi lokal
cepat) — sesuai convention yang udah ada di `CLAUDE.md`.
