import { z } from "zod";

export const createTransactionSchema = z
  .object({
    items: z
      .array(
        z.object({
          productId: z.string().uuid("Product ID tidak valid"),
          quantity: z.number().int().positive("Quantity harus lebih dari 0"),
        }),
      )
      .min(1, "Minimal 1 produk dalam transaksi"),
    memberId: z.string().uuid("Member ID tidak valid").optional(),
    guestName: z
      .string()
      .min(1, "Nama tidak boleh kosong")
      .max(255, "Nama maksimal 255 karakter")
      .optional(),
    orderChannel: z.enum(["offline", "online"], "Channel tidak valid").optional(),
  })
  .refine((data) => !(data.memberId && data.guestName), {
    message: "Pilih salah satu: member terdaftar atau nama manual, tidak keduanya",
    path: ["guestName"],
  });

export const updateTransactionStatusSchema = z
  .object({
    status: z.enum(["paid", "cancelled"], "Status tidak valid"),
    paymentMethod: z.enum(["cash", "transfer", "qris"]).optional(),
    amountReceived: z.number().positive("Uang diterima harus lebih dari 0").optional(),
    cancelReason: z
      .string()
      .min(1, "Alasan tidak boleh kosong")
      .max(500, "Alasan maksimal 500 karakter")
      .optional(),
  })
  .refine((data) => data.status !== "paid" || data.paymentMethod, {
    message: "paymentMethod wajib diisi kalau status paid",
    path: ["paymentMethod"],
  })
  .refine((data) => data.paymentMethod !== "cash" || data.amountReceived, {
    message: "amountReceived wajib diisi kalau bayar cash",
    path: ["amountReceived"],
  })
  .refine((data) => data.status !== "cancelled" || data.cancelReason, {
    message: "cancelReason wajib diisi kalau status cancelled",
    path: ["cancelReason"],
  });

export const transactionIdParamSchema = z.object({
  id: z.string().uuid("Transaction ID tidak valid"),
});

export const getTransactionsQuerySchema = z.object({
  status: z.enum(["pending", "paid", "cancelled"]).optional(),
  orderChannel: z.enum(["offline", "online"]).optional(),
  search: z.string().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

const tanggal = z.iso.date("Format tanggal harus YYYY-MM-DD");

export const exportTransactionsQuerySchema = z
  .object({
    from: tanggal.optional(),
    to: tanggal.optional(),
    status: z.enum(["pending", "paid", "cancelled"]).optional(),
    orderChannel: z.enum(["offline", "online"]).optional(),
    search: z.string().min(1).optional(),
    // CSV tidak punya sheet, jadi rincian produk jadi file terpisah
    jenis: z.enum(["transaksi", "item"]).default("transaksi"),
  })
  .refine((q) => !(q.from && q.to && q.from > q.to), {
    message: "Tanggal awal tidak boleh setelah tanggal akhir",
    path: ["from"],
  });

const fromNotAfterTo = [
  (q) => !(q.from && q.to && q.from > q.to),
  { message: "Tanggal awal tidak boleh setelah tanggal akhir", path: ["from"] },
];

export const summaryQuerySchema = z
  .object({ from: tanggal.optional(), to: tanggal.optional() })
  .refine(...fromNotAfterTo);

// deret harian dipakai sparkline — dibatasi supaya generate_series tidak kebablasan
export const dailyQuerySchema = z
  .object({ from: tanggal, to: tanggal })
  .refine(...fromNotAfterTo)
  .refine((q) => (Date.parse(q.to) - Date.parse(q.from)) / 86_400_000 <= 366, {
    message: "Rentang maksimal 1 tahun",
    path: ["to"],
  });
