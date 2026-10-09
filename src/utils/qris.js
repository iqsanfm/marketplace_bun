// QRIS = format EMVCo TLV: tiap field = id (2 digit) + panjang (2 digit) + isi.
// QRIS statis dari bank dijadikan "dinamis" dengan menyisipkan nominal (tag 54).
// Ini cuma mengisi nominal otomatis — tidak ada notifikasi bayar, pelunasan tetap
// dicek manual di aplikasi merchant.
import { AppError } from "./errors";

const parseTlv = (qris) => {
  const fields = [];
  for (let i = 0; i < qris.length; ) {
    const id = qris.slice(i, i + 2);
    const len = Number(qris.slice(i + 2, i + 4));
    if (!/^\d{2}$/.test(id) || !Number.isInteger(len) || i + 4 + len > qris.length)
      throw new AppError("Format QRIS tidak valid", 500);
    fields.push([id, qris.slice(i + 4, i + 4 + len)]);
    i += 4 + len;
  }
  return fields;
};

// CRC-16/CCITT-FALSE, dihitung atas seluruh isi termasuk "6304"
export const crc16 = (text) => {
  let crc = 0xffff;
  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++)
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
};

const tlv = (id, value) => id + String(value.length).padStart(2, "0") + value;

export const toDynamicQris = (staticQris, amount) => {
  const qris = staticQris.trim();
  // salah salin (kepotong, spasi nama toko hilang, dst.) ketahuan di sini, bukan
  // pas pembeli scan dan aplikasinya menolak
  if (crc16(qris.slice(0, -4)) !== qris.slice(-4))
    throw new AppError("QRIS_STATIC rusak atau salah salin (CRC tidak cocok)", 500);

  const fields = parseTlv(qris)
    // 54 nominal lama, 55-57 tip (bisa bikin pembeli ubah nominal), 63 CRC dihitung ulang
    .filter(([id]) => !["54", "55", "56", "57", "63"].includes(id))
    .map(([id, value]) => (id === "01" ? [id, "12"] : [id, value]));
  fields.push(["54", String(Number(amount))]);
  fields.sort(([a], [b]) => a.localeCompare(b));

  const body = fields.map(([id, value]) => tlv(id, value)).join("") + "6304";
  return body + crc16(body);
};
