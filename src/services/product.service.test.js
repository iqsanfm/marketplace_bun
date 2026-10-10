import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/database.connection";
import { productTable } from "../db/schema.database";
import { importProductsCsv } from "../controllers/product.controllers.js";
import {
  makeProduct,
  makeUser,
  resetDb,
  setupTestDb,
} from "../test/integration-db.js";
import { createTransaction, updateTransactionStatus } from "./transaction.service.js";
import {
  addNewProduct,
  addProductBarcode,
  adjustProductStock,
  editProductById,
  getAllProducts,
  getBestSellerProducts,
  getLowStockProducts,
  getProductByCode,
  getProductById,
  getStockAdjustments,
  removeProductBarcode,
  upsertProducts,
} from "./product.service.js";

const MISSING_ID = "3f2b8c1e-4a5d-4e6f-8a9b-0c1d2e3f4a5b";
const productBySku = async (sku) =>
  (await db.select().from(productTable).where(eq(productTable.sku, sku)))[0];

beforeAll(setupTestDb);
beforeEach(resetDb);

describe("SKU vs barcode tambahan", () => {
  test("addNewProduct/editProductById menolak SKU yang sudah jadi barcode produk lain", async () => {
    const susu = await makeProduct({ product_name: "Susu", sku: "SUSU" });
    await addProductBarcode(susu.id, "899001");

    const err = await addNewProduct({ product_name: "Lain", price: 1000, stock: 1, sku: "899001" }).catch((e) => e);
    expect(err.status).toBe(400);
    expect(err.message).toBe('Kode "899001" sudah terdaftar sebagai barcode produk "Susu"');

    const other = await makeProduct({ sku: "OTHER" });
    const editErr = await editProductById(other.id, { sku: "899001" }).catch((e) => e);
    expect(editErr.message).toContain("Susu");
    expect((await productBySku("OTHER")).id).toBe(other.id);
  });

  test("addNewProduct: SKU dobel dengan SKU lain jadi error duplikat", async () => {
    await makeProduct({ sku: "DUP" });
    const err = await addNewProduct({ product_name: "X", price: 1000, stock: 1, sku: "DUP" }).catch((e) => e);
    expect(err.message).toBe("Data sudah ada (duplikat)");
  });

  test("editProductById: produk tidak ada 404", async () => {
    const err = await editProductById(MISSING_ID, { product_name: "X" }).catch((e) => e);
    expect(err.status).toBe(404);
  });

  test("addProductBarcode menolak barcode yang sudah jadi SKU atau barcode lain", async () => {
    const a = await makeProduct({ product_name: "A", sku: "A-1" });
    const b = await makeProduct({ product_name: "B", sku: "B-1" });
    await addProductBarcode(a.id, "BC-A");

    expect((await addProductBarcode(b.id, "A-1").catch((e) => e)).message).toBe(
      'Barcode "A-1" sudah jadi SKU produk "A"',
    );
    expect((await addProductBarcode(b.id, "BC-A").catch((e) => e)).message).toBe(
      'Barcode "BC-A" sudah terdaftar di produk "A"',
    );
    expect((await addProductBarcode(MISSING_ID, "BARU").catch((e) => e)).status).toBe(404);
  });

  test("getProductByCode cocok ke SKU atau barcode tambahan; removeProductBarcode", async () => {
    const p = await makeProduct({ product_name: "Roti", sku: "ROTI" });
    await addProductBarcode(p.id, "BC-1");
    await addProductBarcode(p.id, "BC-2");

    expect((await getProductByCode("ROTI")).id).toBe(p.id);
    expect((await getProductByCode("BC-2")).id).toBe(p.id);
    expect((await getProductById(p.id))[0].barcodes).toEqual(["BC-1", "BC-2"]);

    await removeProductBarcode(p.id, "BC-1");
    expect((await getProductByCode("BC-1").catch((e) => e)).status).toBe(404);
    expect((await removeProductBarcode(p.id, "BC-1").catch((e) => e)).status).toBe(404);
  });
});

describe("upsertProducts", () => {
  test("SKU yang sudah ada di-update (stok tidak berubah), sisanya di-insert", async () => {
    await makeProduct({ product_name: "Lama", price: "5000", stock: 7, sku: "S-1" });
    const result = await upsertProducts([
      { product_name: "Lama Baru", price: 6000, stock: 99, sku: "S-1" },
      { product_name: "Baru", price: 3000, stock: 4, sku: "S-2" },
      { product_name: "Tanpa SKU", price: 2000, stock: 1 },
    ]);
    expect(result).toEqual({ inserted: 2, updated: 1 });

    const updated = await productBySku("S-1");
    expect(updated.product_name).toBe("Lama Baru");
    expect(updated.price).toBe("6000");
    expect(updated.stock).toBe(7);
    expect((await productBySku("S-2")).stock).toBe(4);
  });

  test("satu baris gagal: tidak ada yang masuk", async () => {
    const err = await upsertProducts([
      { product_name: "OK", price: 1000, stock: 1, sku: "OK-1" },
      { product_name: null, price: 1000, stock: 1, sku: "BAD" },
    ]).catch((e) => e);
    expect(err.message).toBe("Ada data wajib yang belum diisi");
    expect(await productBySku("OK-1")).toBeUndefined();
  });
});

describe("penyesuaian stok", () => {
  test("adjustProductStock mengubah stok dan mencatat jejak", async () => {
    const gudang = await makeUser("gudang", { name: "Pak Gudang" });
    const p = await makeProduct({ stock: 10 });

    const adj = await adjustProductStock(p.id, gudang, { stockAfter: 7, reason: "rusak" });
    expect(adj).toMatchObject({ stockBefore: 10, stockAfter: 7, reason: "rusak", userId: gudang.id });
    await adjustProductStock(p.id, gudang, { stockAfter: 12, reason: "opname" });
    expect((await getProductById(p.id))[0].stock).toBe(12);

    const history = await getStockAdjustments(p.id, { page: 1, limit: 1 });
    expect(history.total).toBe(2);
    expect(history.totalPages).toBe(2);
    expect(history.items).toEqual([
      expect.objectContaining({ stockBefore: 7, stockAfter: 12, reason: "opname", adjustedBy: "Pak Gudang" }),
    ]);
  });

  test("produk tidak ada: 404", async () => {
    const gudang = await makeUser("gudang");
    const err = await adjustProductStock(MISSING_ID, gudang, { stockAfter: 1, reason: "x" }).catch((e) => e);
    expect(err.status).toBe(404);
  });
});

describe("daftar produk", () => {
  beforeEach(async () => {
    await makeProduct({ product_name: "Apel", price: "5000", stock: 3, category: "buah", sku: "APL" });
    await makeProduct({ product_name: "Beras", price: "70000", stock: 50, category: "sembako" });
    await makeProduct({ product_name: "Ceri", price: "20000", stock: 10, category: "buah" });
    await makeProduct({ product_name: "Duku", price: "15000", stock: 11, category: "buah" });
  });

  test("getAllProducts: filter kategori/harga, urutan, pagination", async () => {
    const page1 = await getAllProducts({ category: "buah", sort: "desc", page: 1, limit: 2 });
    expect(page1.items.map((p) => p.product_name)).toEqual(["Duku", "Ceri"]);
    expect(page1).toMatchObject({ total: 3, totalPages: 2 });
    const page2 = await getAllProducts({ category: "buah", sort: "desc", page: 2, limit: 2 });
    expect(page2.items.map((p) => p.product_name)).toEqual(["Apel"]);

    const priced = await getAllProducts({ minPrice: 10000, maxPrice: 20000, sort: "asc", page: 1, limit: 10 });
    expect(priced.items.map((p) => p.product_name)).toEqual(["Ceri", "Duku"]);
  });

  test("getAllProducts: search nama, SKU, dan barcode tambahan", async () => {
    const [dukuRow] = (await getAllProducts({ search: "duku", page: 1, limit: 10 })).items;
    await addProductBarcode(dukuRow.id, "8991234");

    const find = async (search) =>
      (await getAllProducts({ search, sort: "asc", page: 1, limit: 10 })).items.map((p) => p.product_name);
    expect(await find("ber")).toEqual(["Beras"]);
    expect(await find("apl")).toEqual(["Apel"]);
    expect(await find("91234")).toEqual(["Duku"]);
  });

  test("getLowStockProducts: stok <= 10", async () => {
    const low = await getLowStockProducts();
    expect(low.map((p) => p.product_name).sort()).toEqual(["Apel", "Ceri"]);
  });
});

test("getBestSellerProducts: cuma transaksi paid, urut terlaris", async () => {
  const kasir = await makeUser("kasir");
  const a = await makeProduct({ product_name: "A", stock: 100, category: "x" });
  const b = await makeProduct({ product_name: "B", stock: 100, category: "x" });
  const c = await makeProduct({ product_name: "C", stock: 100, category: "y" });
  const sell = async (items, status) => {
    const trx = await createTransaction(kasir.id, items, undefined, undefined, "offline");
    if (status) await updateTransactionStatus(trx.id, kasir, { status, paymentMethod: "qris" });
  };
  await sell([{ productId: a.id, quantity: 2 }, { productId: b.id, quantity: 5 }], "paid");
  await sell([{ productId: a.id, quantity: 4 }], "paid");
  await sell([{ productId: c.id, quantity: 50 }]); // pending, tidak dihitung
  await sell([{ productId: c.id, quantity: 9 }], "cancelled");

  const all = await getBestSellerProducts(undefined, 1, 10);
  expect(all.items).toEqual([
    { productId: a.id, productName: "A", totalSold: 6 },
    { productId: b.id, productName: "B", totalSold: 5 },
  ]);
  expect(all.total).toBe(2);
  expect((await getBestSellerProducts("y", 1, 10)).items).toEqual([]);
  expect((await getBestSellerProducts(undefined, 1, 10, { from: "2000-01-01", to: "2000-01-02" })).total).toBe(0);
});

describe("import CSV: nomor baris di pesan error", () => {
  const app = new Hono().post("/import", importProductsCsv);
  const upload = async (csv, query = "") => {
    const form = new FormData();
    form.append("file", new File([csv], "produk.csv", { type: "text/csv" }));
    const res = await app.request(`/import${query}`, { method: "POST", body: form });
    return { status: res.status, body: await res.json() };
  };

  test("SKU dobel setelah baris tidak valid: nomor baris tetap sesuai file", async () => {
    const res = await upload("product_name,price,sku\nKopi,0,SKU-1\nTeh,8000,SKU-2\nSusu,9000,SKU-2\n");
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual([
      { line: 2, message: expect.stringContaining("price") },
      { line: 4, message: 'SKU "SKU-2" dobel dengan baris 3' },
    ]);
  });

  test("SKU yang sudah jadi barcode tambahan: nomor baris sesuai file", async () => {
    const p = await makeProduct({ sku: "ADA" });
    await addProductBarcode(p.id, "BC-X");
    const res = await upload("product_name,price,sku\nKopi,0,SKU-1\nTeh,8000,BC-X\n");
    expect(res.body.errors).toContainEqual({
      line: 3,
      message: 'SKU "BC-X" sudah terdaftar sebagai barcode tambahan produk lain',
    });
  });

  test("dry-run & import sukses", async () => {
    await makeProduct({ product_name: "Lama", sku: "SKU-1", stock: 3 });
    const csv = "product_name,price,sku\nKopi,9000,SKU-1\nTeh,8000,SKU-2\n";

    const dry = await upload(csv, "?dryRun=true");
    expect(dry.body.data).toMatchObject({ dryRun: true, willInsert: 1, willUpdate: 1 });
    expect(dry.body.data.rows.map((r) => [r.line, r.action])).toEqual([[2, "update"], [3, "insert"]]);
    expect(await productBySku("SKU-2")).toBeUndefined();

    const real = await upload(csv);
    expect(real.status).toBe(201);
    expect(real.body.data).toEqual({ inserted: 1, updated: 1 });
    expect((await productBySku("SKU-1")).product_name).toBe("Kopi");
  });
});
