import { and, eq, gte, ilike, inArray, or, sql } from "drizzle-orm";

import { db } from "../db/database.connection";

import {
  transactionsTable,
  transactionItemsTable,
  productTable,
  paymentMethodEnum,
  membersTable,
} from "../db/schema.database";
import { parseDbError } from "../utils/db-error";
import { AppError, NotFoundError } from "../utils/errors";

// kasir pegang transaksi offline, admin_online pegang order online, admin bebas.
// Dipakai di semua titik yang menyentuh satu transaksi (buat, bayar/batal, invoice) —
// role saja tidak cukup, yang menentukan channel barisnya.
const CHANNEL_BY_ROLE = { kasir: "offline", admin_online: "online" };

export const channelForRole = (role) => CHANNEL_BY_ROLE[role];

export const assertChannelAllowed = (role, orderChannel) => {
  const allowed = CHANNEL_BY_ROLE[role];
  if (allowed && orderChannel !== allowed)
    throw new AppError(
      `Role ${role} cuma boleh menangani transaksi ${allowed}`,
      403,
    );
};

export const createTransaction = async (
  userId,
  items,
  memberId,
  guestName,
  orderChannel,
) => {
  try {
    const productIds = items.map((item) => item.productId);
    const products = await db
      .select()
      .from(productTable)
      .where(inArray(productTable.id, productIds));

    let totalAmount = 0;
    const itemsWithPrice = items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product)
        throw new NotFoundError(`Produk ${item.productId} tidak ditemukan`);

      totalAmount += product.price * item.quantity;
      return { ...item, priceAtPurchase: product.price };
    });

    const transaction = await db.transaction(async (tx) => {
      for (const item of itemsWithPrice) {
        const [updated] = await tx
          .update(productTable)
          .set({ stock: sql`${productTable.stock} - ${item.quantity}` })
          .where(
            and(
              eq(productTable.id, item.productId),
              gte(productTable.stock, item.quantity),
            ),
          )
          .returning();
        if (!updated) {
          const product = products.find((p) => p.id === item.productId);
          throw new AppError(`Stock ${product.product_name} tidak cukup`, 400);
        }
      }

      const [newTransaction] = await tx
        .insert(transactionsTable)
        .values({ userId, totalAmount, memberId, guestName, orderChannel })
        .returning();

      let finalTransaction = newTransaction;
      if (!memberId && !guestName) {
        [finalTransaction] = await tx
          .update(transactionsTable)
          .set({ guestName: `Guest-${newTransaction.id.slice(0, 8)}` })
          .where(eq(transactionsTable.id, newTransaction.id))
          .returning();
      }

      await tx.insert(transactionItemsTable).values(
        itemsWithPrice.map((item) => ({
          transactionId: newTransaction.id,
          productId: item.productId,
          quantity: item.quantity,
          priceAtPurchase: item.priceAtPurchase,
        })),
      );
      return finalTransaction;
    });
    return transaction;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw parseDbError(err);
  }
};

export const getAllTransactions = async ({
  status,
  orderChannel,
  fulfillmentStatus,
  search,
  page,
  limit,
}) => {
  try {
    const offset = (page - 1) * limit;
    const conditions = [];
    if (status) conditions.push(eq(transactionsTable.status, status));
    if (orderChannel)
      conditions.push(eq(transactionsTable.orderChannel, orderChannel));
    if (fulfillmentStatus)
      conditions.push(
        eq(transactionsTable.fulfillmentStatus, fulfillmentStatus),
      );
    if (search) {
      conditions.push(
        or(
          ilike(transactionsTable.guestName, `%${search}%`),
          ilike(membersTable.name, `%${search}%`),
        ),
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;

    let dataQuery = db
      .select({
        id: transactionsTable.id,
        userId: transactionsTable.userId,
        status: transactionsTable.status,
        orderChannel: transactionsTable.orderChannel,
        fulfillmentStatus: transactionsTable.fulfillmentStatus,
        totalAmount: transactionsTable.totalAmount,
        paymentMethod: transactionsTable.paymentMethod,
        createdAt: transactionsTable.createdAt,
        buyerName: sql`coalesce(${membersTable.name}, ${transactionsTable.guestName})`,
      })
      .from(transactionsTable)
      .leftJoin(membersTable, eq(transactionsTable.memberId, membersTable.id));
    let countQuery = db
      .select({ count: sql`count(*)::int` })
      .from(transactionsTable)
      .leftJoin(membersTable, eq(transactionsTable.memberId, membersTable.id));

    if (where) {
      dataQuery = dataQuery.where(where);
      countQuery = countQuery.where(where);
    }

    const [items, [{ count: total }]] = await Promise.all([
      dataQuery.limit(limit).offset(offset),
      countQuery,
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (err) {
    throw parseDbError(err);
  }
};

export const getTransactionById = async (id, user) => {
  try {
    const [transaction] = await db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, id));

    if (!transaction) throw new NotFoundError("Transaksi tidak ditemukan");
    // packaging cuma boleh buka order yang jadi tanggung jawabnya
    if (
      user.role === "packaging" &&
      (transaction.orderChannel !== "online" || transaction.status !== "paid")
    ) {
      throw new AppError("Kamu tidak punya akses ke transaksi ini", 403);
    }
    assertChannelAllowed(user.role, transaction.orderChannel);
    const items = await db
      .select({
        id: transactionItemsTable.id,
        productId: transactionItemsTable.productId,
        productName: productTable.product_name,
        quantity: transactionItemsTable.quantity,
        priceAtPurchase: transactionItemsTable.priceAtPurchase,
      })
      .from(transactionItemsTable)
      .innerJoin(
        productTable,
        eq(transactionItemsTable.productId, productTable.id),
      )
      .where(eq(transactionItemsTable.transactionId, id));

    return { ...transaction, items };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw parseDbError(err);
  }
};

export const updateTransactionStatus = async (
  id,
  user,
  { status, paymentMethod, cancelReason },
) => {
  try {
    const transaction = await db.transaction(async (tx) => {
      // FOR UPDATE: tanpa ini, 2 request cancel yang datang barengan sama-sama
      // melihat status "pending", sama-sama lolos guard, dan stoknya balik 2x.
      const [current] = await tx
        .select()
        .from(transactionsTable)
        .where(eq(transactionsTable.id, id))
        .for("update");
      if (!current) throw new NotFoundError("Transaksi tidak ditemukan");
      assertChannelAllowed(user.role, current.orderChannel);

      // pending -> paid/cancelled bebas. paid -> cancelled boleh (barang bisa batal
      // setelah dibayar), tapi admin only karena uangnya harus dibalikin ke pembeli.
      if (
        current.status === "cancelled" ||
        (current.status === "paid" && status === "paid")
      ) {
        throw new AppError(
          `Transaksi sudah berstatus "${current.status}", tidak bisa diubah lagi`,
          400,
        );
      }
      if (current.status === "paid" && user.role !== "admin") {
        throw new AppError(
          "Hanya admin yang boleh membatalkan transaksi yang sudah dibayar",
          403,
        );
      }
      // Barang sudah fisik keluar bareng driver. Kalau dicancel di sini, stok sistem
      // nambah padahal raknya tidak — jadi retur harus lewat barang balik dulu.
      if (status === "cancelled" && current.fulfillmentStatus === "diambil") {
        throw new AppError(
          "Barang sudah dibawa driver, tidak bisa dibatalkan. Kalau barangnya benar-benar kembali, admin catat lewat penyesuaian stok setelah barangnya dicek",
          400,
        );
      }

      const updateData = { status };
      if (status === "paid") {
        updateData.paymentMethod = paymentMethod;
        updateData.paidAt = new Date();
        updateData.paidBy = user.id;
        // order online masuk antrian packaging begitu dibayar; offline selesai di tempat
        if (current.orderChannel === "online") {
          updateData.fulfillmentStatus = "belum_dikemas";
        }
      }
      if (status === "cancelled") {
        updateData.cancelReason = cancelReason;
        updateData.cancelledBy = user.id;
        // keluar dari antrian packaging; jejak "pernah dikemas" tetap ada di packedAt/packedBy
        updateData.fulfillmentStatus = null;
      }
      const [updated] = await tx
        .update(transactionsTable)
        .set(updateData)
        .where(eq(transactionsTable.id, id))
        .returning();

      if (status === "cancelled") {
        const items = await tx
          .select()
          .from(transactionItemsTable)
          .where(eq(transactionItemsTable.transactionId, id));

        // balikin stok lewat SQL, bukan baca-lalu-tulis: kalau ada penjualan lain
        // yang memotong stok di sela baca dan tulis, angkanya ketimpa dan stok hilang.
        for (const item of items) {
          await tx
            .update(productTable)
            .set({ stock: sql`${productTable.stock} + ${item.quantity}` })
            .where(eq(productTable.id, item.productId));
        }
      }
      return updated;
    });

    return transaction;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw parseDbError(err);
  }
};

// Alur pengemasan cuma maju, satu langkah per kali. "dikemas" = selesai dikemas &
// siap diambil driver, "diambil" = final.
const FULFILLMENT_FLOW = { belum_dikemas: "dikemas", dikemas: "diambil" };

export const updateFulfillmentStatus = async (id, user, fulfillmentStatus) => {
  try {
    const transaction = await db.transaction(async (tx) => {
      // FOR UPDATE: 2 orang packaging yang klik barengan sama-sama lihat
      // "belum_dikemas" dan dua-duanya dijawab sukses — packedBy-nya salah orang.
      const [current] = await tx
        .select()
        .from(transactionsTable)
        .where(eq(transactionsTable.id, id))
        .for("update");
      if (!current) throw new NotFoundError("Transaksi tidak ditemukan");

      if (current.orderChannel !== "online" || current.status !== "paid") {
        throw new AppError(
          "Cuma order online yang sudah dibayar yang perlu dikemas",
          400,
        );
      }
      if (FULFILLMENT_FLOW[current.fulfillmentStatus] !== fulfillmentStatus) {
        throw new AppError(
          `Status pengemasan tidak bisa langsung dari "${current.fulfillmentStatus}" ke "${fulfillmentStatus}"`,
          400,
        );
      }

      const updateData = { fulfillmentStatus };
      if (fulfillmentStatus === "dikemas") {
        updateData.packedBy = user.id;
        updateData.packedAt = new Date();
      } else {
        updateData.handedOverBy = user.id;
        updateData.handedOverAt = new Date();
      }

      const [updated] = await tx
        .update(transactionsTable)
        .set(updateData)
        .where(eq(transactionsTable.id, id))
        .returning();
      return updated;
    });

    return transaction;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw parseDbError(err);
  }
};

export const getInvoiceById = async (id, user) => {
  try {
    const [transaction] = await db
      .select({
        id: transactionsTable.id,
        createdAt: transactionsTable.createdAt,
        status: transactionsTable.status,
        orderChannel: transactionsTable.orderChannel,
        paymentMethod: transactionsTable.paymentMethod,
        paidAt: transactionsTable.paidAt,
        totalAmount: transactionsTable.totalAmount,
        guestName: transactionsTable.guestName,
        buyerName: membersTable.name,
        buyerPhone: membersTable.phone,
        buyerEmail: membersTable.email,
      })
      .from(transactionsTable)
      .leftJoin(membersTable, eq(transactionsTable.memberId, membersTable.id))
      .where(eq(transactionsTable.id, id));

    if (!transaction) throw new NotFoundError("Transaksi tidak ditemukan");
    assertChannelAllowed(user.role, transaction.orderChannel);

    const items = await db
      .select({
        productName: productTable.product_name,
        quantity: transactionItemsTable.quantity,
        priceAtPurchase: transactionItemsTable.priceAtPurchase,
      })
      .from(transactionItemsTable)
      .innerJoin(
        productTable,
        eq(transactionItemsTable.productId, productTable.id),
      )
      .where(eq(transactionItemsTable.transactionId, id));

    const isPaid = transaction.status === "paid";
    // transaksi batal bukan "belum dibayar" — uangnya bisa saja sudah sempat masuk
    const statusLabel =
      transaction.status === "cancelled"
        ? "Batal"
        : isPaid
          ? "Lunas"
          : "Belum Dibayar";
    // orderChannel cuma dipakai buat cek akses di atas, tidak ikut dicetak
    const { guestName, buyerName, buyerPhone, buyerEmail, orderChannel, ...rest } =
      transaction;

    return {
      ...rest,
      isPaid,
      statusLabel,
      paymentMethod: isPaid ? transaction.paymentMethod : null,
      paidAt: isPaid ? transaction.paidAt : null,
      buyer: buyerName
        ? { name: buyerName, phone: buyerPhone, email: buyerEmail }
        : guestName
          ? { name: guestName, phone: null, email: null }
          : null,
      items: items.map((item) => ({
        ...item,
        subtotal: item.priceAtPurchase * item.quantity,
      })),
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw parseDbError(err);
  }
};

export const getTransactionsSummary = async () => {
  try {
    const summary = await db
      .select({
        status: transactionsTable.status,
        orderChannel: transactionsTable.orderChannel,
        count: sql`count(*)::int`,
        total: sql`coalesce(sum(${transactionsTable.totalAmount}), 0)`,
      })
      .from(transactionsTable)
      .groupBy(transactionsTable.status, transactionsTable.orderChannel);
    return summary;
  } catch (err) {
    throw parseDbError(err);
  }
};
