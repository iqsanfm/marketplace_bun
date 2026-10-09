import { success, error } from "../utils/response";
import { parseCsv, toCsv } from "../utils/csv.js";
import { importProductRowSchema } from "../validators/product.validator.js";
import {
  addNewProduct,
  findExistingSkus,
  upsertProducts,
  getAllProducts,
  getProductById,
  editProductById,
  deleteProductById,
  getLowStockProducts,
  getBestSellerProducts,
  adjustProductStock,
  getStockAdjustments,
  findSkusUsedAsBarcode,
  getProductByCode,
  addProductBarcode,
  removeProductBarcode,
} from "../services/product.service";

export const createProduct = async (c) => {
  try {
    const body = c.req.valid("json");
    const product = await addNewProduct(body);
    return success(c, product, 201);
  } catch (err) {
    return error(c, err.message);
  }
};

const MAX_IMPORT_ROWS = 1000;
const MAX_IMPORT_BYTES = 2 * 1024 * 1024; // ~jauh di atas 1000 baris produk

// Header diambil dari schema, bukan ditulis ulang — kalau nanti ada kolom baru
// di importProductRowSchema, template ikut berubah sendiri.
export const importTemplateCsv = (c) => {
  const header = Object.keys(importProductRowSchema.shape);
  const contoh = [
    {
      product_name: "Kopi Susu, Gula Aren",
      costPrice: 8000,
      price: 15000,
      stock: 20,
      sku: "KOPI-01",
      category: "minuman",
    },
    {
      product_name: "Roti Tawar",
      costPrice: 4000,
      price: 12000,
      stock: 5,
      sku: "ROTI-01",
      category: "makanan",
    },
  ];
  // BOM: tanpa ini Excel di Windows salah baca huruf beraksen.
  return c.body("﻿" + toCsv(header, contoh), 200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": 'attachment; filename="template-import-produk.csv"',
  });
};

export const importProductsCsv = async (c) => {
  try {
    // Ditolak sebelum parseBody: begitu body di-parse, seluruh file sudah
    // terlanjur masuk memori.
    const declaredSize = Number(c.req.header("content-length"));
    if (declaredSize > MAX_IMPORT_BYTES)
      return error(c, "File maksimal 2 MB", 413);

    const file = (await c.req.parseBody()).file;
    if (typeof file === "string" || !file)
      return error(c, "File CSV belum diunggah (field: file)");
    if (file.size > MAX_IMPORT_BYTES) return error(c, "File maksimal 2 MB", 413);
    // Ekstensi, bukan MIME: browser & OS kirim tipe yang beda-beda buat CSV
    // (text/csv, application/vnd.ms-excel, kadang kosong).
    if (!/.csv$/i.test(file.name ?? ""))
      return error(c, "File harus berekstensi .csv");

    // Dry-run: divalidasi & dihitung, tapi tidak ada yang ditulis ke DB.
    const dryRun = ["true", "1"].includes(c.req.query("dryRun"));

    const rows = parseCsv(await file.text());
    if (rows.length === 0) return error(c, "File CSV kosong");
    if (rows.length > MAX_IMPORT_ROWS)
      return error(c, `Maksimal ${MAX_IMPORT_ROWS} baris per impor`);

    // Semua baris divalidasi dulu; satu error = tidak ada yang masuk, biar
    // operator tidak perlu menebak sebagian mana yang sudah kesimpan.
    const valid = [];
    const errors = [];
    rows.forEach((row, i) => {
      const parsed = importProductRowSchema.safeParse(row);
      if (parsed.success) valid.push(parsed.data);
      // +2: baris 1 header, index mulai 0
      else
        errors.push({
          line: i + 2,
          message: parsed.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("; "),
        });
    });
    // SKU kembar di dalam file yang sama bakal bentrok sendiri saat insert,
    // lebih enak ketahuan di sini daripada jadi error unique violation.
    const seen = new Map();
    valid.forEach((row, i) => {
      if (!row.sku) return;
      if (seen.has(row.sku))
        errors.push({
          line: i + 2,
          message: `SKU "${row.sku}" dobel dengan baris ${seen.get(row.sku)}`,
        });
      else seen.set(row.sku, i + 2);
    });

    // SKU yang sudah jadi barcode tambahan produk lain: kalau masuk, satu scan
    // nunjuk dua produk
    const usedAsBarcode = await findSkusUsedAsBarcode([...seen.keys()]);
    for (const [sku, line] of seen)
      if (usedAsBarcode.has(sku))
        errors.push({
          line,
          message: `SKU "${sku}" sudah terdaftar sebagai barcode tambahan produk lain`,
        });

    if (errors.length > 0)
      return c.json({ success: false, error: "CSV tidak valid", errors }, 400);

    const existing = await findExistingSkus([...seen.keys()]);
    if (dryRun) {
      const preview = valid.map((row, i) => ({
        line: i + 2,
        sku: row.sku ?? null,
        product_name: row.product_name,
        action: row.sku && existing.has(row.sku) ? "update" : "insert",
      }));
      return success(c, {
        dryRun: true,
        willInsert: preview.filter((r) => r.action === "insert").length,
        willUpdate: preview.filter((r) => r.action === "update").length,
        rows: preview,
      });
    }

    const result = await upsertProducts(valid);
    return success(c, result, 201);
  } catch (err) {
    return error(c, err.message);
  }
};

export const listLowStockProducts = async (c) => {
  try {
    const product = await getLowStockProducts();
    return success(c, product);
  } catch (err) {
    return error(c, err.message);
  }
};

export const listBestSellerProducts = async (c) => {
  try {
    const { category, page, limit, from, to } = c.req.valid("query");
    const product = await getBestSellerProducts(category, page, limit, { from, to });
    return success(c, product);
  } catch (err) {
    return error(c, err.message);
  }
};

export const listProducts = async (c) => {
  try {
    const query = c.req.valid("query");
    const product = await getAllProducts(query);
    return success(c, product);
  } catch (err) {
    return error(c, err.message);
  }
};

export const productById = async (c) => {
  try {
    const id = c.req.param("id");
    const product = await getProductById(id);
    return success(c, product);
  } catch (err) {
    return error(c, err.message, err.status ?? 400);
  }
};

export const removeProduct = async (c) => {
  try {
    const id = c.req.param("id");
    const product = await deleteProductById(id);
    return success(c, product);
  } catch (err) {
    return error(c, err.message, err.status ?? 400);
  }
};

export const createStockAdjustment = async (c) => {
  try {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const adjustment = await adjustProductStock(id, c.get("user"), body);
    return success(c, adjustment, 201);
  } catch (err) {
    return error(c, err.message, err.status ?? 400);
  }
};

export const listStockAdjustments = async (c) => {
  try {
    const { id } = c.req.valid("param");
    const query = c.req.valid("query");
    const adjustments = await getStockAdjustments(id, query);
    return success(c, adjustments);
  } catch (err) {
    return error(c, err.message, err.status ?? 400);
  }
};

export const updateProduct = async (c) => {
  try {
    const id = c.req.param("id");
    const body = c.req.valid("json");
    const product = await editProductById(id, body);
    return success(c, product);
  } catch (err) {
    return error(c, err.message, err.status ?? 400);
  }
};

export const productByBarcode = async (c) => {
  try {
    const { code } = c.req.valid("param");
    const product = await getProductByCode(code);
    return success(c, product);
  } catch (err) {
    return error(c, err.message, err.status ?? 400);
  }
};

export const addBarcode = async (c) => {
  try {
    const { id } = c.req.valid("param");
    const { barcode } = c.req.valid("json");
    const created = await addProductBarcode(id, barcode);
    return success(c, created, 201);
  } catch (err) {
    return error(c, err.message, err.status ?? 400);
  }
};

export const removeBarcode = async (c) => {
  try {
    const { id, barcode } = c.req.valid("param");
    const deleted = await removeProductBarcode(id, barcode);
    return success(c, deleted);
  } catch (err) {
    return error(c, err.message, err.status ?? 400);
  }
};
