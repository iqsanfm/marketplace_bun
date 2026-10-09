import { z } from "zod";
import { error } from "./response.js";

const TYPE_ID = {
  number: "angka",
  int: "bilangan bulat",
  string: "teks",
  boolean: "true/false",
  array: "daftar",
  object: "objek",
  date: "tanggal",
};

// Hanya field yang diisi pengguna lewat form. Query param teknis (page, limit,
// sort, dst.) sengaja tidak, yang lihat itu developer frontend.
const LABEL = {
  product_name: "Nama produk",
  price: "Harga jual",
  costPrice: "Harga modal",
  stock: "Stok",
  stockAfter: "Stok hasil hitungan",
  sku: "SKU",
  category: "Kategori",
  description: "Deskripsi",
  name: "Nama",
  email: "Email",
  phone: "Nomor HP",
  address: "Alamat",
  age: "Umur",
  password: "Password",
  currentPassword: "Password lama",
  newPassword: "Password baru",
  quantity: "Jumlah",
  guestName: "Nama pembeli",
  paymentMethod: "Metode pembayaran",
  reason: "Alasan",
  cancelReason: "Alasan pembatalan",
};

// Pesan default Zod (Inggris & teknis) diganti ke bahasa Indonesia. Pesan custom
// yang ditulis di schema (mis. "ID tidak valid") tetap menang atas ini.
z.config({
  customError: (issue) => {
    // items.0.quantity -> label "Jumlah" (diambil dari key terakhir)
    const key = issue.path?.findLast((p) => typeof p === "string");
    const field = LABEL[key] || issue.path?.join(".") || "Input";
    const unit = issue.origin === "string" ? " karakter" : "";
    switch (issue.code) {
      case "invalid_type":
        return issue.input === undefined
          ? `${field} wajib diisi`
          : `${field} harus berupa ${TYPE_ID[issue.expected] ?? issue.expected}`;
      case "invalid_value":
        return `${field} harus salah satu dari: ${issue.values.join(", ")}`;
      case "too_big":
        return `${field} maksimal ${issue.maximum}${unit}`;
      case "too_small":
        return `${field} minimal ${issue.minimum}${unit}`;
      case "invalid_format":
        return `Format ${field} tidak valid`;
      case "unrecognized_keys":
        return `Field tidak dikenal: ${issue.keys.join(", ")}`;
      default:
        return `${field} tidak valid`;
    }
  },
});

export const handleValidation = (result, c) => {
  if (!result.success) {
    return error(c, result.error.issues[0].message);
  }
};
