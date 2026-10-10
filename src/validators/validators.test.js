import { describe, expect, test } from "bun:test";
// z.config (pesan Indonesia) dipasang saat modul ini di-import
import "../utils/handle-validation.js";
import {
  createNewProductSchema,
  editProductByIdSchema,
  importProductRowSchema,
  productIdSchema,
} from "./product.validator.js";
import {
  createTransactionSchema,
  dailyQuerySchema,
  exportTransactionsQuerySchema,
  updateTransactionStatusSchema,
} from "./transaction.validator.js";
import { changePasswordSchema, createUserSchema, editUserRoleSchema } from "./user.validator.js";
import { getMemberQuerySchema, registerMemberSchema } from "./member.validator.js";

const UUID = "3f2b8c1e-4a5d-4e6f-8a9b-0c1d2e3f4a5b";
const firstError = (schema, input) => schema.safeParse(input).error?.issues[0].message;

describe("product", () => {
  const valid = { product_name: "Kopi", price: 15000, stock: 10 };

  test("create: valid + default costPrice 0", () => {
    expect(createNewProductSchema.parse(valid).costPrice).toBe(0);
  });

  test("create: harga, stok & nama ditolak kalau salah", () => {
    expect(firstError(createNewProductSchema, { ...valid, price: 0 })).toBe(
      "Harga jual harus lebih dari 0",
    );
    expect(firstError(createNewProductSchema, { ...valid, stock: -1 })).toBe(
      "Stock tidak boleh negatif",
    );
    expect(firstError(createNewProductSchema, { ...valid, price: "15000" })).toBe(
      "Harga jual harus berupa angka",
    );
    expect(firstError(createNewProductSchema, { price: 1, stock: 1 })).toBe(
      "Nama produk wajib diisi",
    );
  });

  test("edit: stok tidak boleh diubah lewat PATCH", () => {
    expect(firstError(editProductByIdSchema, { stock: 5 })).toContain("stock-adjustments");
    expect(editProductByIdSchema.parse({ price: 2000 })).toEqual({ price: 2000 });
  });

  test("import CSV: sel string di-coerce, costPrice kosong tetap undefined", () => {
    const row = importProductRowSchema.parse({ product_name: "Teh", price: "8000" });
    expect(row).toMatchObject({ price: 8000, stock: 0 });
    expect(row.costPrice).toBeUndefined();
  });

  test("id harus uuid", () => {
    expect(firstError(productIdSchema, { id: "123" })).toBe("ID tidak valid");
  });
});

describe("transaction", () => {
  const item = { productId: UUID, quantity: 1 };

  test("create: minimal 1 item, quantity positif", () => {
    expect(createTransactionSchema.safeParse({ items: [item] }).success).toBe(true);
    expect(firstError(createTransactionSchema, { items: [] })).toBe(
      "Minimal 1 produk dalam transaksi",
    );
    expect(firstError(createTransactionSchema, { items: [{ ...item, quantity: 0 }] })).toBe(
      "Quantity harus lebih dari 0",
    );
  });

  test("create: member dan nama manual tidak boleh dua-duanya", () => {
    expect(
      firstError(createTransactionSchema, { items: [item], memberId: UUID, guestName: "Budi" }),
    ).toContain("tidak keduanya");
  });

  test("update status: aturan paid / cash / cancelled", () => {
    const ok = (input) => updateTransactionStatusSchema.safeParse(input).success;
    expect(ok({ status: "paid" })).toBe(false); // paymentMethod wajib
    expect(ok({ status: "paid", paymentMethod: "cash" })).toBe(false); // amountReceived wajib
    expect(ok({ status: "paid", paymentMethod: "cash", amountReceived: 50000 })).toBe(true);
    expect(ok({ status: "paid", paymentMethod: "qris" })).toBe(true);
    expect(ok({ status: "cancelled" })).toBe(false); // cancelReason wajib
    expect(ok({ status: "cancelled", cancelReason: "Batal" })).toBe(true);
    expect(ok({ status: "pending" })).toBe(false);
  });

  test("rentang tanggal: from <= to, daily maksimal 1 tahun", () => {
    expect(
      firstError(exportTransactionsQuerySchema, { from: "2026-02-01", to: "2026-01-01" }),
    ).toBe("Tanggal awal tidak boleh setelah tanggal akhir");
    expect(exportTransactionsQuerySchema.parse({}).jenis).toBe("transaksi");
    expect(dailyQuerySchema.safeParse({ from: "2026-01-01", to: "2026-12-31" }).success).toBe(
      true,
    );
    expect(firstError(dailyQuerySchema, { from: "2025-01-01", to: "2026-06-01" })).toBe(
      "Rentang maksimal 1 tahun",
    );
    expect(firstError(dailyQuerySchema, { from: "01-01-2026", to: "2026-01-02" })).toBe(
      "Format tanggal harus YYYY-MM-DD",
    );
  });
});

describe("user & member", () => {
  test("register user: email harus valid, password wajib", () => {
    const base = { name: "Ani", email: "ani@mail.com", password: "rahasia" };
    expect(createUserSchema.safeParse(base).success).toBe(true);
    expect(firstError(createUserSchema, { ...base, email: "ani" })).toBe(
      "Format email tidak valid",
    );
    expect(firstError(createUserSchema, { ...base, password: "" })).toBe(
      "Password belum di isi",
    );
  });

  test("role harus salah satu enum, password baru minimal 8", () => {
    expect(firstError(editUserRoleSchema, { role: "superadmin" })).toBe("Role tidak Valid");
    expect(
      firstError(changePasswordSchema, { currentPassword: "a", newPassword: "1234567" }),
    ).toBe("Password baru minimal 8 karakter");
  });

  test("member: email opsional, query pagination di-coerce & dibatasi", () => {
    expect(registerMemberSchema.safeParse({ name: "Budi", phone: "0812" }).success).toBe(true);
    expect(getMemberQuerySchema.parse({ page: "2" })).toEqual({ sort: "asc", page: 2, limit: 10 });
    expect(getMemberQuerySchema.safeParse({ limit: "101" }).success).toBe(false);
  });
});
