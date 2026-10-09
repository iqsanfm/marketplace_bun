import { expect, test } from "bun:test";
import { crc16, toDynamicQris } from "./qris.js";

// QRIS statis contoh, merchant fiktif — data toko asli cukup di .env (QRIS_STATIC)
const STATIC =
  "00020101021126630016ID.CO.CONTOH.WWW0119936000000000000000102090000000010303UMI51440014ID.CO.QRIS.WWW0215ID10000000000010303UMI5204541153033605802ID5916Toko Contoh Jaya6007JAKARTA610510110630403D6";

test("crc16 sesuai vektor baku CRC-16/CCITT-FALSE", () => {
  expect(crc16("123456789")).toBe("29B1");
});

test("statis jadi dinamis dengan nominal", () => {
  const dyn = toDynamicQris(STATIC, "75000");
  expect(dyn).toContain("010212"); // point of initiation: dinamis
  expect(dyn).not.toContain("010211");
  expect(dyn).toContain("5303360540575000" + "5802ID"); // nominal tepat sebelum kode negara
  expect(dyn).toContain("5916Toko Contoh Jaya"); // spasi nama merchant utuh
  expect(crc16(dyn.slice(0, -4))).toBe(dyn.slice(-4));
  // sisanya tidak berubah
  expect(dyn.replace("010212", "010211").replace("540575000", "").slice(0, -4)).toBe(
    STATIC.slice(0, -4),
  );
});

test("QRIS salah salin ditolak", () => {
  expect(() => toDynamicQris(STATIC.replace("Toko Contoh Jaya", "TokoContohJaya"), 1000)).toThrow(
    "CRC",
  );
});
