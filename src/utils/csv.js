// Parser CSV RFC4180 seadanya: field berkutip boleh berisi koma & newline,
// `""` di dalam kutip jadi satu `"`. Cukup buat file dari Excel/Sheets.
const parseRows = (text) => {
  const rows = [[""]];
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const row = rows[rows.length - 1];
    if (quoted) {
      if (ch !== '"') row[row.length - 1] += ch;
      else if (text[i + 1] === '"') (row[row.length - 1] += '"'), i++;
      else quoted = false;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") row.push("");
    else if (ch === "\r") continue;
    else if (ch === "\n") rows.push([""]);
    else row[row.length - 1] += ch;
  }
  return rows;
};

// Baris pertama dianggap header. Sel kosong jadi undefined biar kolom opsional
// benar-benar kosong (bukan string ""), dan default zod bisa jalan.
export const parseCsv = (text) => {
  const rows = parseRows(text.replace(/^﻿/, "")).filter(
    (r) => r.some((cell) => cell.trim() !== ""),
  );
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((row) =>
    Object.fromEntries(
      header.map((key, i) => [key, (row[i] ?? "").trim() || undefined]),
    ),
  );
};

const quote = (value) => {
  let s = String(value ?? "");
  // Sel yang diawali = + - @ dijalankan Excel sebagai rumus (CSV injection);
  // nama tamu/produk itu ketikan bebas. Angka negatif dibiarkan.
  if (/^[=+\-@]/.test(s) && isNaN(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCsv = (header, rows) =>
  [header, ...rows.map((row) => header.map((key) => row[key]))]
    .map((cells) => cells.map(quote).join(","))
    .join("\r\n");
