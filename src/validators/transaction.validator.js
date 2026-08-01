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
  })
  .refine((data) => !(data.memberId && data.guestName), {
    message: "Pilih salah satu: member terdaftar atau nama manual, tidak keduanya",
    path: ["guestName"],
  });

export const updateTransactionStatusSchema = z
  .object({
    status: z.enum(["paid", "cancelled"], "Status tidak valid"),
    paymentMethod: z.enum(["cash", "transfer"]).optional(),
  })
  .refine((data) => data.status !== "paid" || data.paymentMethod, {
    message: "paymentMethod wajib diisi kalau status paid",
    path: ["paymentMethod"],
  });

export const transactionIdParamSchema = z.object({
  id: z.string().uuid("Transaction ID tidak valid"),
});

export const getTransactionsQuerySchema = z.object({
  status: z.enum(["pending", "paid", "cancelled"]).optional(),
  search: z.string().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});
