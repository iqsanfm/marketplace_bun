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
    paymentMethod: z.enum(["cash", "transfer"]).optional(),
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
  .refine((data) => data.status !== "cancelled" || data.cancelReason, {
    message: "cancelReason wajib diisi kalau status cancelled",
    path: ["cancelReason"],
  });

// belum_dikemas bukan target transisi — itu status awal waktu order dibayar
export const updateFulfillmentStatusSchema = z.object({
  fulfillmentStatus: z.enum(
    ["dikemas", "diambil"],
    "Status pengemasan tidak valid",
  ),
});

export const transactionIdParamSchema = z.object({
  id: z.string().uuid("Transaction ID tidak valid"),
});

export const getTransactionsQuerySchema = z.object({
  status: z.enum(["pending", "paid", "cancelled"]).optional(),
  orderChannel: z.enum(["offline", "online"]).optional(),
  fulfillmentStatus: z
    .enum(["belum_dikemas", "dikemas", "diambil"])
    .optional(),
  search: z.string().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});
