// Helper integration test: DB Postgres khusus test (DATABASE_URL dari .env.test,
// yang otomatis dibaca `bun test`). DB dibuat kalau belum ada, lalu dimigrasi.
import { Client } from "pg";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "../db/database.connection";
import {
  membersTable,
  productTable,
  usersTable,
} from "../db/schema.database";

const url = new URL(Bun.env.DATABASE_URL);
const dbName = url.pathname.slice(1);
// Pengaman: resetDb() mengosongkan semua tabel, jangan sampai jalan di DB
// development/production gara-gara DATABASE_URL di shell menimpa .env.test.
if (!dbName.endsWith("_test"))
  throw new Error(
    `Integration test cuma boleh jalan di DB berakhiran _test, dapat "${dbName}"`,
  );

let ready;
export const setupTestDb = () =>
  (ready ??= (async () => {
    const adminUrl = new URL(url);
    adminUrl.pathname = "/postgres";
    const admin = new Client({ connectionString: adminUrl.toString() });
    await admin.connect();
    const { rowCount } = await admin.query(
      "select 1 from pg_database where datname = $1",
      [dbName],
    );
    if (!rowCount) await admin.query(`create database "${dbName}"`);
    await admin.end();
    await migrate(db, { migrationsFolder: "drizzle" });
  })());

// CASCADE ikut mengosongkan semua tabel yang punya FK ke tiga tabel ini.
// Sengaja async + await: query Drizzle cuma thenable, bukan Promise, jadi kalau
// dipakai langsung `beforeEach(resetDb)` query-nya tidak pernah dijalankan.
export const resetDb = async () => {
  await db.execute(sql`truncate ${usersTable}, ${productTable}, ${membersTable} cascade`);
};

let seq = 0;
export const makeUser = async (role = "admin", overrides = {}) => {
  const [user] = await db
    .insert(usersTable)
    .values({
      name: `User ${role}`,
      email: `${role}-${++seq}@test.local`,
      password: "bukan-hash",
      role,
      ...overrides,
    })
    .returning();
  return user;
};

export const makeProduct = async (overrides = {}) => {
  const [product] = await db
    .insert(productTable)
    .values({ product_name: `Produk ${++seq}`, price: "10000", stock: 10, ...overrides })
    .returning();
  return product;
};

export const makeMember = async (overrides = {}) => {
  const [member] = await db
    .insert(membersTable)
    .values({ name: `Member ${++seq}`, phone: `08${String(++seq).padStart(9, "0")}`, ...overrides })
    .returning();
  return member;
};
