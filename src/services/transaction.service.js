import { and, desc, eq, gte, ilike, inArray, or, sql } from "drizzle-orm";

import { db } from "../db/database.connection";

import {
  transactionsTable,
  transactionItemsTable,
  productTable,
  paymentMethodEnum,
  membersTable,
  usersTable,
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

// Nama pembeli boleh potongan di mana saja; ID cuma dicocokkan dari depan karena
// yang dipegang orang itu awalan di struk/chat, dan potongan tengah gampang nyasar.
// Butuh join ke membersTable di query pemanggilnya.
const searchCondition = (search) =>
  or(
    ilike(transactionsTable.guestName, `%${search}%`),
    ilike(membersTable.name, `%${search}%`),
    ilike(sql`${transactionsTable.id}::text`, `${search}%`),
  );

export const getAllTransactions = async ({
  status,
  orderChannel,
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
    if (search) conditions.push(searchCondition(search));
    const where = conditions.length ? and(...conditions) : undefined;

    let dataQuery = db
      .select({
        id: transactionsTable.id,
        userId: transactionsTable.userId,
        status: transactionsTable.status,
        orderChannel: transactionsTable.orderChannel,
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
      // terbaru dulu; id pemecah seri biar halaman tidak dobel/bolong kalau createdAt sama
      dataQuery
        .orderBy(desc(transactionsTable.createdAt), desc(transactionsTable.id))
        .limit(limit)
        .offset(offset),
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
  { status, paymentMethod, amountReceived, cancelReason },
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

      const updateData = { status };
      if (status === "paid") {
        if (paymentMethod === "cash") {
          if (amountReceived < Number(current.totalAmount)) {
            throw new AppError(
              `Uang diterima kurang dari total belanja (${current.totalAmount})`,
              400,
            );
          }
          updateData.amountReceived = String(amountReceived);
        }
        updateData.paymentMethod = paymentMethod;
        updateData.paidAt = new Date();
        updateData.paidBy = user.id;
      }
      if (status === "cancelled") {
        updateData.cancelReason = cancelReason;
        updateData.cancelledBy = user.id;
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

export const getInvoiceById = async (id, user) => {
  try {
    const [transaction] = await db
      .select({
        id: transactionsTable.id,
        createdAt: transactionsTable.createdAt,
        status: transactionsTable.status,
        orderChannel: transactionsTable.orderChannel,
        paymentMethod: transactionsTable.paymentMethod,
        amountReceived: transactionsTable.amountReceived,
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
      amountReceived: isPaid ? transaction.amountReceived : null,
      change:
        isPaid && transaction.amountReceived
          ? String(
              Number(transaction.amountReceived) -
                Number(transaction.totalAmount),
            )
          : null,
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

// createdAt disimpan UTC; rekap dibaca orang toko, jadi tanggal & filter pakai WIB.
// ponytail: zona waktu di-hardcode, jadikan config kalau ada cabang di luar WIB.
const createdAtWib = sql`(${transactionsTable.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')`;

export const getTransactionsForExport = async (
  { from, to, status, orderChannel, search },
  jenis,
) => {
  try {
    const conditions = [];
    if (status) conditions.push(eq(transactionsTable.status, status));
    if (orderChannel)
      conditions.push(eq(transactionsTable.orderChannel, orderChannel));
    if (from) conditions.push(sql`${createdAtWib}::date >= ${from}`);
    if (to) conditions.push(sql`${createdAtWib}::date <= ${to}`);
    if (search) conditions.push(searchCondition(search));
    const where = conditions.length ? and(...conditions) : undefined;
    const tanggal = sql`to_char(${createdAtWib}, 'YYYY-MM-DD HH24:MI')`;

    if (jenis === "item") {
      const columns = {
        tanggal,
        idTransaksi: transactionsTable.id,
        channel: transactionsTable.orderChannel,
        status: transactionsTable.status,
        produk: productTable.product_name,
        sku: productTable.sku,
        qty: transactionItemsTable.quantity,
        hargaSatuan: transactionItemsTable.priceAtPurchase,
        subtotal: sql`${transactionItemsTable.quantity} * ${transactionItemsTable.priceAtPurchase}`,
      };
      const rows = await db
        .select(columns)
        .from(transactionItemsTable)
        .innerJoin(
          transactionsTable,
          eq(transactionItemsTable.transactionId, transactionsTable.id),
        )
        .innerJoin(
          productTable,
          eq(transactionItemsTable.productId, productTable.id),
        )
        .leftJoin(
          membersTable,
          eq(transactionsTable.memberId, membersTable.id),
        )
        .where(where)
        .orderBy(transactionsTable.createdAt);
      return { header: Object.keys(columns), rows };
    }

    const columns = {
      tanggal,
      idTransaksi: transactionsTable.id,
      channel: transactionsTable.orderChannel,
      pembeli: sql`coalesce(${membersTable.name}, ${transactionsTable.guestName})`,
      status: transactionsTable.status,
      metodeBayar: transactionsTable.paymentMethod,
      total: transactionsTable.totalAmount,
      uangDiterima: transactionsTable.amountReceived,
      kembalian: sql`${transactionsTable.amountReceived} - ${transactionsTable.totalAmount}`,
      dibuatOleh: usersTable.name,
      alasanBatal: transactionsTable.cancelReason,
    };
    const rows = await db
      .select(columns)
      .from(transactionsTable)
      .leftJoin(membersTable, eq(transactionsTable.memberId, membersTable.id))
      .innerJoin(usersTable, eq(transactionsTable.userId, usersTable.id))
      .where(where)
      .orderBy(transactionsTable.createdAt);
    return { header: Object.keys(columns), rows };
  } catch (err) {
    throw parseDbError(err);
  }
};
