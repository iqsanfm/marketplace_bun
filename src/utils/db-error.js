import { AppError } from "./errors.js";

export const parseDbError = (err) => {
  // Error yang sengaja dilempar service (NotFoundError dsb.) sudah ramah user.
  if (err instanceof AppError) return err;
  const code = err.cause?.code ?? err.code;
  if (code === "23505") return new AppError("Data sudah ada (duplikat)");
  if (code === "23503") {
    // 23503 dipakai Postgres untuk 2 situasi yang berlawanan: nunjuk data yang tidak
    // ada (saat insert), dan menghapus data yang masih dipakai (saat delete).
    const detail = err.cause?.detail ?? err.detail ?? "";
    return new AppError(
      detail.includes("still referenced")
        ? "Data ini masih dipakai data lain, tidak bisa dihapus"
        : "Data terkait tidak ditemukan",
    );
  }
  if (code === "23502") return new AppError("Ada data wajib yang belum diisi");
  // Sisanya jangan diteruskan mentah: message Drizzle berisi query SQL + params.
  console.error(err);
  return new AppError("Terjadi kesalahan pada server, coba lagi nanti", 500);
};
