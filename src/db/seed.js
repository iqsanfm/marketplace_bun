import { db } from "./database.connection";
import { productTable, usersTable } from "./schema.database";

// Password sama buat semua akun seed: "password123"
const password = await Bun.password.hash("password123", {
  algorithm: "argon2id",
});

const users = [
  { name: "Admin", email: "admin@example.com", role: "admin" },
  { name: "Kasir", email: "kasir@example.com", role: "kasir" },
  { name: "Admin Online", email: "online@example.com", role: "admin_online" },
  { name: "Gudang", email: "gudang@example.com", role: "gudang" },
  { name: "User Biasa", email: "user@example.com", role: "user" },
].map((u) => ({ ...u, password, phone: "08123456789" }));

const products = [
  { product_name: "Beras Premium 5kg", price: "75000", stock: 50, sku: "BRS-5", category: "sembako" },
  { product_name: "Minyak Goreng 2L", price: "38000", stock: 40, sku: "MYK-2", category: "sembako" },
  { product_name: "Gula Pasir 1kg", price: "16000", stock: 60, sku: "GLA-1", category: "sembako" },
  { product_name: "Kopi Bubuk 200g", price: "22000", stock: 30, sku: "KPI-200", category: "minuman" },
  { product_name: "Teh Celup 25s", price: "12000", stock: 35, sku: "TEH-25", category: "minuman" },
  { product_name: "Sabun Mandi 250ml", price: "19000", stock: 25, sku: "SBN-250", category: "kebersihan" },
];

const inserted = await db
  .insert(usersTable)
  .values(users)
  .onConflictDoNothing()
  .returning({ email: usersTable.email });
const insertedProducts = await db
  .insert(productTable)
  .values(products)
  .onConflictDoNothing()
  .returning({ sku: productTable.sku });

console.log(`seed: ${inserted.length} user, ${insertedProducts.length} produk (sisanya sudah ada)`);
console.log("login: <role>@example.com / password123");
process.exit(0);
