import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../db/database.connection";
import { productTable, transactionsTable } from "../db/schema.database";
import {
  makeMember,
  makeProduct,
  makeUser,
  resetDb,
  setupTestDb,
} from "../test/integration-db.js";
import {
  channelForRole,
  createTransaction,
  getDailySales,
  getInvoiceById,
  getQrisForTransaction,
  getTransactionById,
  getTransactionsForExport,
  getTransactionsSummary,
  updateTransactionStatus,
} from "./transaction.service.js";

// QRIS statis contoh dari src/utils/qris.test.js (merchant fiktif)
const QRIS_STATIC =
  "00020101021126630016ID.CO.CONTOH.WWW0119936000000000000000102090000000010303UMI51440014ID.CO.QRIS.WWW0215ID10000000000010303UMI5204541153033605802ID5916Toko Contoh Jaya6007JAKARTA610510110630403D6";

let admin, kasir, online, kopi, teh;
const stockOf = async (id) =>
  (await db.select().from(productTable).where(eq(productTable.id, id)))[0].stock;
const buy = (user, items, channel = channelForRole(user.role) ?? "offline", memberId, guestName) =>
  createTransaction(user.id, items, memberId, guestName, channel);

beforeAll(setupTestDb);
beforeEach(async () => {
  await resetDb();
  admin = await makeUser("admin");
  kasir = await makeUser("kasir");
  online = await makeUser("admin_online");
  kopi = await makeProduct({ product_name: "Kopi", price: "15000", stock: 10, sku: "KOPI" });
  teh = await makeProduct({ product_name: "Teh", price: "8000", stock: 5, sku: "TEH" });
});

describe("createTransaction", () => {
  test("total dihitung dari harga DB dan stok terpotong", async () => {
    const trx = await buy(kasir, [
      { productId: kopi.id, quantity: 2 },
      { productId: teh.id, quantity: 3 },
    ]);
    expect(Number(trx.totalAmount)).toBe(2 * 15000 + 3 * 8000);
    expect(trx.status).toBe("pending");
    expect(trx.orderChannel).toBe("offline");
    expect(trx.guestName).toBe(`Guest-${trx.id.slice(0, 8)}`);
    expect(await stockOf(kopi.id)).toBe(8);
    expect(await stockOf(teh.id)).toBe(2);
  });

  test("stok tidak cukup: ditolak dan tidak ada stok yang terpotong", async () => {
    const err = await buy(kasir, [
      { productId: kopi.id, quantity: 1 },
      { productId: teh.id, quantity: 6 },
    ]).catch((e) => e);
    expect(err.status).toBe(400);
    expect(err.message).toBe("Stock Teh tidak cukup");
    expect(await stockOf(kopi.id)).toBe(10);
    expect(await db.select().from(transactionsTable)).toHaveLength(0);
  });

  test("produk tidak ada: 404", async () => {
    const err = await buy(kasir, [
      { productId: "3f2b8c1e-4a5d-4e6f-8a9b-0c1d2e3f4a5b", quantity: 1 },
    ]).catch((e) => e);
    expect(err.status).toBe(404);
  });

  test("channel ikut role: kasir offline, admin_online online", async () => {
    expect((await buy(kasir, [{ productId: kopi.id, quantity: 1 }])).orderChannel).toBe("offline");
    expect((await buy(online, [{ productId: kopi.id, quantity: 1 }])).orderChannel).toBe("online");
  });

  test("member & nama tamu tersimpan apa adanya", async () => {
    const member = await makeMember();
    const withMember = await buy(kasir, [{ productId: kopi.id, quantity: 1 }], "offline", member.id);
    expect(withMember.memberId).toBe(member.id);
    expect(withMember.guestName).toBeNull();
    const guest = await buy(kasir, [{ productId: kopi.id, quantity: 1 }], "offline", undefined, "Budi");
    expect(guest.guestName).toBe("Budi");
  });
});

describe("updateTransactionStatus", () => {
  let trx;
  beforeEach(async () => {
    trx = await buy(kasir, [{ productId: kopi.id, quantity: 2 }]); // total 30000
  });

  test("bayar cash: tersimpan uang diterima, pembayar, dan waktu bayar", async () => {
    const paid = await updateTransactionStatus(trx.id, kasir, {
      status: "paid",
      paymentMethod: "cash",
      amountReceived: 50000,
    });
    expect(paid.status).toBe("paid");
    expect(paid.paymentMethod).toBe("cash");
    expect(Number(paid.amountReceived)).toBe(50000);
    expect(paid.paidBy).toBe(kasir.id);
    expect(paid.paidAt).toBeInstanceOf(Date);
  });

  test("bayar cash kurang dari total ditolak", async () => {
    const err = await updateTransactionStatus(trx.id, kasir, {
      status: "paid",
      paymentMethod: "cash",
      amountReceived: 20000,
    }).catch((e) => e);
    expect(err.status).toBe(400);
    const [row] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, trx.id));
    expect(row.status).toBe("pending");
  });

  test("bayar non-cash tidak menyimpan amountReceived", async () => {
    const paid = await updateTransactionStatus(trx.id, kasir, {
      status: "paid",
      paymentMethod: "qris",
      amountReceived: 99999,
    });
    expect(paid.amountReceived).toBeNull();
  });

  test("batal mengembalikan stok", async () => {
    expect(await stockOf(kopi.id)).toBe(8);
    const cancelled = await updateTransactionStatus(trx.id, kasir, {
      status: "cancelled",
      cancelReason: "salah input",
    });
    expect(cancelled.cancelledBy).toBe(kasir.id);
    expect(cancelled.cancelReason).toBe("salah input");
    expect(await stockOf(kopi.id)).toBe(10);
  });

  test("dua cancel bersamaan: stok cuma balik sekali", async () => {
    const results = await Promise.allSettled([
      updateTransactionStatus(trx.id, kasir, { status: "cancelled" }),
      updateTransactionStatus(trx.id, kasir, { status: "cancelled" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await stockOf(kopi.id)).toBe(10);
  });

  test("transaksi final tidak bisa diubah lagi", async () => {
    await updateTransactionStatus(trx.id, kasir, { status: "paid", paymentMethod: "qris" });
    const again = await updateTransactionStatus(trx.id, kasir, {
      status: "paid",
      paymentMethod: "qris",
    }).catch((e) => e);
    expect(again.status).toBe(400);

    await updateTransactionStatus(trx.id, admin, { status: "cancelled" });
    const afterCancel = await updateTransactionStatus(trx.id, admin, {
      status: "paid",
      paymentMethod: "cash",
      amountReceived: 30000,
    }).catch((e) => e);
    expect(afterCancel.status).toBe(400);
    expect(afterCancel.message).toContain("cancelled");
  });

  test("batal setelah lunas cuma boleh admin", async () => {
    await updateTransactionStatus(trx.id, kasir, { status: "paid", paymentMethod: "qris" });
    const err = await updateTransactionStatus(trx.id, kasir, { status: "cancelled" }).catch((e) => e);
    expect(err.status).toBe(403);
    expect(await stockOf(kopi.id)).toBe(8);

    await updateTransactionStatus(trx.id, admin, { status: "cancelled" });
    expect(await stockOf(kopi.id)).toBe(10);
  });

  test("role channel lain ditolak 403", async () => {
    const err = await updateTransactionStatus(trx.id, online, {
      status: "paid",
      paymentMethod: "qris",
    }).catch((e) => e);
    expect(err.status).toBe(403);
  });

  test("transaksi tidak ada: 404", async () => {
    const err = await updateTransactionStatus("3f2b8c1e-4a5d-4e6f-8a9b-0c1d2e3f4a5b", admin, {
      status: "cancelled",
    }).catch((e) => e);
    expect(err.status).toBe(404);
  });
});

describe("akses per channel: detail, invoice, QRIS", () => {
  let offlineTrx, onlineTrx;
  beforeEach(async () => {
    offlineTrx = await buy(kasir, [{ productId: kopi.id, quantity: 1 }]);
    onlineTrx = await buy(online, [{ productId: teh.id, quantity: 2 }]);
  });

  test("getTransactionById: item ikut, channel lain 403, admin bebas", async () => {
    const detail = await getTransactionById(offlineTrx.id, kasir);
    expect(detail.items).toEqual([
      expect.objectContaining({ productName: "Kopi", quantity: 1 }),
    ]);
    expect((await getTransactionById(onlineTrx.id, kasir).catch((e) => e)).status).toBe(403);
    expect((await getTransactionById(offlineTrx.id, online).catch((e) => e)).status).toBe(403);
    expect((await getTransactionById(onlineTrx.id, admin)).id).toBe(onlineTrx.id);
  });

  test("getInvoiceById: belum dibayar, lalu lunas dengan kembalian", async () => {
    const pending = await getInvoiceById(offlineTrx.id, kasir);
    expect(pending.statusLabel).toBe("Belum Dibayar");
    expect(pending.change).toBeNull();
    expect(pending).not.toHaveProperty("orderChannel");

    await updateTransactionStatus(offlineTrx.id, kasir, {
      status: "paid",
      paymentMethod: "cash",
      amountReceived: 20000,
    });
    const paid = await getInvoiceById(offlineTrx.id, kasir);
    expect(paid.statusLabel).toBe("Lunas");
    expect(paid.change).toBe("5000");
    expect(paid.buyer.name).toBe(offlineTrx.guestName);
    expect(paid.items).toEqual([
      { productName: "Kopi", quantity: 1, priceAtPurchase: "15000", subtotal: 15000 },
    ]);
    expect((await getInvoiceById(offlineTrx.id, online).catch((e) => e)).status).toBe(403);
  });

  test("getInvoiceById: transaksi batal berlabel Batal", async () => {
    await updateTransactionStatus(offlineTrx.id, kasir, { status: "cancelled" });
    expect((await getInvoiceById(offlineTrx.id, admin)).statusLabel).toBe("Batal");
  });

  test("getQrisForTransaction: nominal ikut total, channel & status dicek", async () => {
    const prev = Bun.env.QRIS_STATIC;
    Bun.env.QRIS_STATIC = QRIS_STATIC;
    try {
      const qris = await getQrisForTransaction(onlineTrx.id, online);
      expect(qris.amount).toBe("16000");
      expect(qris.qris).toContain("540516000");
      expect((await getQrisForTransaction(onlineTrx.id, kasir).catch((e) => e)).status).toBe(403);

      await updateTransactionStatus(onlineTrx.id, online, { status: "paid", paymentMethod: "qris" });
      expect((await getQrisForTransaction(onlineTrx.id, online).catch((e) => e)).status).toBe(400);
    } finally {
      Bun.env.QRIS_STATIC = prev;
    }
  });
});

describe("rekap", () => {
  // createdAt disimpan UTC; 2026-10-09 18:00 UTC = 2026-10-10 01:00 WIB
  const setCreatedAt = (id, iso) =>
    db.update(transactionsTable).set({ createdAt: new Date(iso) }).where(eq(transactionsTable.id, id));

  let paidOffline, pendingOnline, cancelled;
  beforeEach(async () => {
    paidOffline = await buy(kasir, [{ productId: kopi.id, quantity: 2 }]); // 30000
    await updateTransactionStatus(paidOffline.id, kasir, {
      status: "paid",
      paymentMethod: "cash",
      amountReceived: 50000,
    });
    await setCreatedAt(paidOffline.id, "2026-10-09T18:00:00Z");

    pendingOnline = await buy(online, [{ productId: teh.id, quantity: 1 }]); // 8000
    await setCreatedAt(pendingOnline.id, "2026-10-08T03:00:00Z");

    cancelled = await buy(kasir, [{ productId: teh.id, quantity: 1 }]);
    await updateTransactionStatus(cancelled.id, kasir, { status: "cancelled", cancelReason: "batal" });
    await setCreatedAt(cancelled.id, "2026-10-10T03:00:00Z");
  });

  test("getTransactionsSummary: dikelompokkan per status & channel, filter tanggal WIB", async () => {
    const all = await getTransactionsSummary();
    expect(all).toHaveLength(3);
    expect(all).toContainEqual({ status: "paid", orderChannel: "offline", count: 1, total: "30000" });

    // 10 Okt WIB: paidOffline (01:00 WIB) + cancelled; pendingOnline tanggal 8
    const tenth = await getTransactionsSummary({ from: "2026-10-10", to: "2026-10-10" });
    expect(tenth.map((r) => r.status).sort()).toEqual(["cancelled", "paid"]);
  });

  test("getDailySales: cuma paid, hari kosong tetap muncul 0", async () => {
    const rows = await getDailySales({ from: "2026-10-08", to: "2026-10-11" });
    expect(rows).toEqual([
      { date: "2026-10-08", count: 0, total: "0" },
      { date: "2026-10-09", count: 0, total: "0" },
      { date: "2026-10-10", count: 1, total: "30000" },
      { date: "2026-10-11", count: 0, total: "0" },
    ]);
  });

  test("getTransactionsForExport: per transaksi & per item, dengan filter", async () => {
    const perTrx = await getTransactionsForExport({}, "transaksi");
    expect(perTrx.header).toContain("kembalian");
    expect(perTrx.rows.map((r) => r.idTransaksi)).toEqual([
      pendingOnline.id,
      paidOffline.id,
      cancelled.id,
    ]);
    const paidRow = perTrx.rows[1];
    expect(paidRow.tanggal).toBe("2026-10-10 01:00");
    expect(paidRow.kembalian).toBe("20000");
    expect(paidRow.dibuatOleh).toBe(kasir.name);

    const offline = await getTransactionsForExport({ orderChannel: "offline" }, "transaksi");
    expect(offline.rows).toHaveLength(2);

    const byGuest = await getTransactionsForExport(
      { search: pendingOnline.guestName },
      "transaksi",
    );
    expect(byGuest.rows.map((r) => r.idTransaksi)).toEqual([pendingOnline.id]);

    const items = await getTransactionsForExport({ status: "paid" }, "item");
    expect(items.rows).toEqual([
      expect.objectContaining({ produk: "Kopi", sku: "KOPI", qty: 2, subtotal: "30000" }),
    ]);
  });
});
