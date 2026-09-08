import { expect, test } from "bun:test";
import { parseCsv, toCsv } from "./csv.js";

test("parseCsv: kutip, koma & newline di dalam sel, sel kosong", () => {
  const csv =
    'product_name,price,sku\r\n' +
    '"Kopi Susu, Gula Aren",15000,SKU-1\r\n' +
    '"Teh ""Spesial""",8000,\r\n' +
    '"Baris\nDua",1000,SKU-3\r\n';
  expect(parseCsv(csv)).toEqual([
    { product_name: "Kopi Susu, Gula Aren", price: "15000", sku: "SKU-1" },
    { product_name: 'Teh "Spesial"', price: "8000", sku: undefined },
    { product_name: "Baris\nDua", price: "1000", sku: "SKU-3" },
  ]);
});

test("parseCsv: file kosong / cuma header", () => {
  expect(parseCsv("")).toEqual([]);
  expect(parseCsv("product_name,price\n")).toEqual([]);
});

test("toCsv -> parseCsv bolak-balik utuh", () => {
  const header = ["product_name", "price", "sku"];
  const rows = [
    { product_name: "Kopi Susu, Gula Aren", price: "15000", sku: "SKU-1" },
    { product_name: 'Teh "Spesial"', price: "8000", sku: undefined },
  ];
  expect(parseCsv(toCsv(header, rows))).toEqual(rows);
});
