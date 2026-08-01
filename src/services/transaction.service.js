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

export const createTransaction = async (userId, items, memberId, guestName) => {
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
        .values({ userId, totalAmount, memberId, guestName })
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

export const getAllTransactions = async ({ status, search, page, limit }) => {
  try {
    const offset = (page - 1) * limit;
    const conditions = [];
    if (status) conditions.push(eq(transactionsTable.status, status));
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

export const getTransactionById = async (id) => {
  try {
    const [transaction] = await db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, id));

    if (!transaction) throw new NotFoundError("Transaksi tidak ditemukan");
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
    if (err instanceof NotFoundError) throw err;
    throw parseDbError(err);
  }
};

export const updateTransactionStatus = async (id, status, paymentMethod) => {
  try {
    const transaction = await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(transactionsTable)
        .where(eq(transactionsTable.id, id));
      if (!current) throw new NotFoundError("Transaksi tidak ditemukan");
      if (current.status !== "pending") {
        throw new AppError(
          `Transaksi sudah berstatus "${current.status}", tidak bisa diubah lagi`,
          400,
        );
      }

      const updateData = { status };
      if (status === "paid") {
        updateData.paymentMethod = paymentMethod;
        updateData.paidAt = new Date();
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

        for (const item of items) {
          const [product] = await tx
            .select()
            .from(productTable)
            .where(eq(productTable.id, item.productId));
          await tx
            .update(productTable)
            .set({ stock: product.stock + item.quantity })
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

export const getInvoiceById = async (id) => {
  try {
    const [transaction] = await db
      .select({
        id: transactionsTable.id,
        createdAt: transactionsTable.createdAt,
        status: transactionsTable.status,
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
    const { guestName, buyerName, buyerPhone, buyerEmail, ...rest } =
      transaction;

    return {
      ...rest,
      isPaid,
      statusLabel: isPaid ? "Lunas" : "Belum Dibayar",
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
    if (err instanceof NotFoundError) throw err;
    throw parseDbError(err);
  }
};

export const getTransactionsSummary = async () => {
  try {
    const summary = await db
      .select({
        status: transactionsTable.status,
        count: sql`count(*)::int`,
        total: sql`coalesce(sum(${transactionsTable.totalAmount}), 0)`,
      })
      .from(transactionsTable)
      .groupBy(transactionsTable.status);
    return summary;
  } catch (err) {
    throw parseDbError(err);
  }
};
