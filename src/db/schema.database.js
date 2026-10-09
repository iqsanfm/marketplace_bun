import {
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
  "user",
  "admin",
  "kasir",
  "admin_online",
  "gudang",
]);
export const transactionStatusEnum = pgEnum("transaction_status", [
  "pending",
  "paid",
  "cancelled",
]);

export const paymentMethodEnum = pgEnum("payment_method", ["cash", "transfer", "qris"]);

export const orderChannelEnum = pgEnum("order_channel", ["offline", "online"]);

export const usersTable = pgTable("users", {
  id: uuid().primaryKey().defaultRandom(),
  name: varchar({ length: 255 }).notNull(),
  age: integer(),
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

export const productTable = pgTable("product", {
  id: uuid().primaryKey().defaultRandom(),
  product_name: varchar({ length: 255 }).notNull(),
  costPrice: numeric().notNull().default("0"),
  price: numeric().notNull(),
  stock: integer().notNull(),
  sku: varchar({ length: 100 }).unique(),
  description: text(),
  category: varchar({ length: 100 }),
});

// Barcode tambahan per produk (kemasan baru, supplier lain) — barcode utama tetap di
// productTable.sku. Satu kode harus nunjuk satu produk: unique di sini cuma jaga
// antar-barcode, bentrok dengan sku produk lain dicek di product.service.
export const productBarcodesTable = pgTable("product_barcodes", {
  id: uuid().primaryKey().defaultRandom(),
  productId: uuid()
    .notNull()
    .references(() => productTable.id, { onDelete: "cascade" }),
  barcode: varchar({ length: 100 }).notNull().unique(),
  createdAt: timestamp().notNull().defaultNow(),
});

export const transactionItemsTable = pgTable("transaction_items", {
  id: uuid().primaryKey().defaultRandom(),
  transactionId: uuid()
    .notNull()
    .references(() => transactionsTable.id, { onDelete: "cascade" }),
  productId: uuid()
    .notNull()
    .references(() => productTable.id),
  quantity: integer().notNull(),
  priceAtPurchase: numeric().notNull(),
});

export const transactionsTable = pgTable("transactions", {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid()
    .notNull()
    .references(() => usersTable.id),
  memberId: uuid().references(() => membersTable.id),
  guestName: varchar({ length: 255 }),
  status: transactionStatusEnum().notNull().default("pending"),
  orderChannel: orderChannelEnum().notNull().default("offline"),
  totalAmount: numeric().notNull(),
  paymentMethod: paymentMethodEnum(),
  // uang yang diserahkan pembeli, cuma diisi kalau bayar cash; kembalian dihitung dari sini
  amountReceived: numeric(),
  paidAt: timestamp(),
  paidBy: uuid().references(() => usersTable.id),
  cancelReason: text(),
  cancelledBy: uuid().references(() => usersTable.id),
  createdAt: timestamp().notNull().defaultNow(),
});

// Riwayat penyesuaian stok (stock opname, barang rusak/expired, salah input).
// Satu baris per penyesuaian — stok produk cuma boleh berubah lewat sini atau lewat
// transaksi, tidak lewat edit produk biasa.
export const stockAdjustmentsTable = pgTable("stock_adjustments", {
  id: uuid().primaryKey().defaultRandom(),
  productId: uuid()
    .notNull()
    .references(() => productTable.id, { onDelete: "cascade" }),
  userId: uuid()
    .notNull()
    .references(() => usersTable.id),
  stockBefore: integer().notNull(),
  stockAfter: integer().notNull(),
  reason: text().notNull(),
  createdAt: timestamp().notNull().defaultNow(),
});

export const membersTable = pgTable("members", {
  id: uuid().primaryKey().defaultRandom(),
  name: varchar({ length: 255 }).notNull(),
  phone: varchar({ length: 20 }).notNull().unique(),
  email: varchar({ length: 255 }),
  address: varchar({ length: 255 }),
  createdAt: timestamp().notNull().defaultNow(),
});
