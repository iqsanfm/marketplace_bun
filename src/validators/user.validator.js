import { z } from "zod";
import { userRoleEnum } from "../db/schema.database";

export const createUserSchema = z.object({
  name: z
    .string()
    .min(1, "Nama belum diisi")
    .max(255, "Nama maksimal 255 karakter"),
  age: z.number().int().positive("Umur harus lebih dari 0").optional(),
  email: z
    .string()
    .email("Format email tidak valid")
    .max(255, "Email maksimal 255 karakter"),
  address: z.string().max(255, "Alamat maksimal 255 karakter").optional(),
  phone: z.string().max(20, "Nomor telepon maksimal 20 karakter").optional(),
  password: z.string().min(1, "Password belum di isi").max(255, "").nonempty(),
});

export const userIdParamSchema = z.object({
  id: z.string().uuid("ID tidak valid"),
});

export const loginUserSchema = z.object({
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(1, "Password belum di isi"),
});

export const editUserByIdSchema = z
  .object({
    name: z.string().max(255, "Nama maksimal 255 karakter"),
    age: z.number().int().positive("Umur harus lebih dari 0"),
    email: z.string().email("Format email tidak valid"),
    address: z.string().max(255, "Alamat maksimal 255 karakter"),
    phone: z.string().max(20, "Nomor Telepon maksimal 20 karakter"),
  })
  .partial();

export const editUserRoleSchema = z.object({
  role: z.enum(userRoleEnum.enumValues, "Role tidak Valid"),
});

export const getUserQuerySchema = z.object({
  role: z.enum(userRoleEnum.enumValues).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Password lama belum diisi"),
  newPassword: z.string().min(8, "Password baru minimal 8 karakter"),
});
