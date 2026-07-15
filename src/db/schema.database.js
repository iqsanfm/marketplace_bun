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

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const transactionStatusEnum = pgEnum("transaction_status", [
  "pending",
  "paid",
  "cancelled",
]);

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
  price: numeric().notNull(),
  stock: integer().notNull(),
  sku: varchar({ length: 100 }),
  description: text(),
  category: varchar({ length: 100 }),
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
  status: transactionStatusEnum().notNull().default("pending"),
  totalAmount: numeric().notNull(),
  createdAt: timestamp().notNull().defaultNow(),
});
