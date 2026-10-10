import { expect, spyOn, test } from "bun:test";
import { parseDbError } from "./db-error.js";
import { AppError, NotFoundError } from "./errors.js";

test("AppError dari service diteruskan apa adanya", () => {
  const err = new NotFoundError("Produk tidak ditemukan");
  expect(parseDbError(err)).toBe(err);
});

test("kode Postgres dipetakan ke pesan ramah (code di err.cause dari Drizzle)", () => {
  const pg = (code, detail) => ({ cause: { code, detail } });
  expect(parseDbError(pg("23505")).message).toBe("Data sudah ada (duplikat)");
  expect(parseDbError(pg("23503", "Key (id)=(1) is not present")).message).toBe(
    "Data terkait tidak ditemukan",
  );
  expect(parseDbError(pg("23503", 'Key is still referenced from table "x"')).message).toBe(
    "Data ini masih dipakai data lain, tidak bisa dihapus",
  );
  expect(parseDbError({ code: "23502" }).message).toBe("Ada data wajib yang belum diisi");
  expect(parseDbError(pg("23505")).status).toBe(400);
});

test("error lain jadi 500 generik, query SQL tidak bocor ke client", () => {
  const log = spyOn(console, "error").mockImplementation(() => {});
  const err = parseDbError(new Error('Failed query: select * from "users" where id = $1'));
  expect(err).toBeInstanceOf(AppError);
  expect(err.status).toBe(500);
  expect(err.message).not.toContain("select");
  log.mockRestore();
});
