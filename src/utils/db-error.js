export const parseDbError = (err) => {
  const code = err.cause?.code ?? err.code;
  if (code === "23505") return new Error("Data already exists (duplicate)");
  if (code === "23503") return new Error("Related data not found");
  if (code === "23502") return new Error("Required field is missing");
  return err;
};
