import { z } from "zod";

export const registerMemberSchema = z.object({
  name: z
    .string()
    .min(1, "Nama belum diisi")
    .max(255, "Nama maksimal 255 karakter"),
  phone: z
    .string()
    .min(1, "Nomor belum di isi")
    .max(20, "Nomor telepon maksimal 20 karakter"),
  // opsional: pembeli WA sering tidak punya/tidak mau kasih email, dan kolomnya
  // di DB memang nullable
  email: z
    .string()
    .email("Format email tidak valid")
    .max(255, "Email maksimal 255 karakter")
    .optional(),
  address: z.string().max(255, "Alamat maksimal 255 karakter").optional(),
});

export const getMemberByIdSchema = z.object({
  id: z.string().uuid("ID tidak valid"),
});

export const getMemberQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

// .partial() biar bisa ganti satu field saja, sejalan sama edit produk & edit user
export const editMemberByIdSchema = z
  .object({
    name: z
      .string()
      .min(1, "Nama belum diisi")
      .max(255, "Nama maksimal 255 karakter"),
    phone: z
      .string()
      .min(1, "Nomor belum di isi")
      .max(20, "Nomor telepon maksimal 20 karakter"),
    email: z
      .string()
      .email("Format email tidak valid")
      .max(255, "Email maksimal 255 karakter"),
    address: z.string().max(255, "Alamat maksimal 255 karakter"),
  })
  .partial();
