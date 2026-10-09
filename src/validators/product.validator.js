import { z } from "zod";

export const createNewProductSchema = z.object({
  product_name: z
    .string()
    .min(1, "Nama Produk belum di isi")
    .max(255, "Nama maksimal 255 karakter"),
  costPrice: z
    .number()
    .nonnegative("Harga modal tidak boleh negatif")
    .default(0),
  price: z.number().positive("Harga jual harus lebih dari 0"),
  stock: z.number().int().nonnegative("Stock tidak boleh negatif"),
  sku: z.string().max(100, "Maksimal 100 karakter").optional(),
  description: z.string().optional(),
  category: z.string().max(100, "Maksimal 100 karakter").optional(),
});

// Sel CSV selalu string, jadi angkanya di-coerce. Sisanya ikut schema create.
export const importProductRowSchema = createNewProductSchema.extend({
  // Optional, bukan default(0): sel kosong berarti "jangan diubah", bukan
  // "harga modalnya nol".
  costPrice: z.coerce
    .number()
    .nonnegative("Harga modal tidak boleh negatif")
    .optional(),
  price: z.coerce.number().positive("Harga jual harus lebih dari 0"),
  stock: z.coerce
    .number()
    .int()
    .nonnegative("Stock tidak boleh negatif")
    .default(0),
});

export const getProductsQuerySchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  // urut nama produk: asc = A-Z, desc = Z-A
  sort: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

export const getBestSellerQuerySchema = z.object({
  category: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

export const productIdSchema = z.object({
  id: z.string().uuid("ID tidak valid"),
});

export const editProductByIdSchema = z
  .object({
    product_name: z
      .string()
      .min(1, "Nama Produk belum di isi")
      .max(255, "Nama maksimal 255 karakter"),
    costPrice: z.number().nonnegative("Harga modal tidak boleh negatif"),
    price: z.number().positive("Harga jual harus lebih dari 0"),
    sku: z.string().max(100, "Maksimal 100 karakter").optional(),
    description: z.string().optional(),
    category: z.string().max(100, "Maksimal 100 karakter").optional(),
    // ditolak terang-terangan, bukan diam-diam dibuang — biar client tau stoknya
    // tidak jadi berubah
    stock: z.never({
      error:
        "Stok tidak bisa diubah lewat sini, pakai POST /product/:id/stock-adjustments",
    }),
  })
  .partial();

// Sengaja tanpa `stock`: perubahan stok wajib lewat POST /product/:id/stock-adjustments
// supaya selalu ada jejak siapa & kenapa.
export const createStockAdjustmentSchema = z.object({
  stockAfter: z
    .number()
    .int()
    .nonnegative("Stok hasil hitungan tidak boleh negatif"),
  reason: z
    .string()
    .min(1, "Alasan penyesuaian wajib diisi")
    .max(500, "Alasan maksimal 500 karakter"),
});

export const getStockAdjustmentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

export const deleteProductByIdSchema = z.object({
  id: z.string().uuid("ID tidak valid"),
});

const barcode = z
  .string()
  .trim()
  .min(1, "Barcode belum diisi")
  .max(100, "Maksimal 100 karakter");

export const addBarcodeSchema = z.object({ barcode });

export const productBarcodeParamSchema = z.object({
  id: z.string().uuid("ID tidak valid"),
  barcode,
});

export const barcodeLookupParamSchema = z.object({ code: barcode });
