export const parseDbError = (err) => {
  const code = err.cause?.code ?? err.code;
  if (code === "23505") return new Error("Data already exists (duplicate)");
  if (code === "23503") {
    // 23503 dipakai Postgres untuk 2 situasi yang berlawanan: nunjuk data yang tidak
    // ada (saat insert), dan menghapus data yang masih dipakai (saat delete).
    const detail = err.cause?.detail ?? err.detail ?? "";
    return new Error(
      detail.includes("still referenced")
        ? "Data ini masih dipakai data lain, tidak bisa dihapus"
        : "Data terkait tidak ditemukan",
    );
  }
  if (code === "23502") return new Error("Required field is missing");
  return err;
};
