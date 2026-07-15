import { eq, inArray } from "drizzle-orm";
import { db } from "../db/database.connection";

import {
  transactionsTable,
  transactionItemsTable,
  productTable,
} from "../db/schema.database";
import { parseDbError } from "../utils/db-error";
import { AppError, NotFoundError } from "../utils/errors";

export const createTransaction = async (userId, items) => {
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
      if (product.stock < item.quantity) {
        throw new AppError(`Stock ${product.product_name} tidak cukup`, 400);
      }

      totalAmount += product.price * item.quantity;
      return { ...item, priceAtPurchase: product.price };
    });

    const transaction = await db.transaction(async (tx) => {
      const [newTransaction] = await tx
        .insert(transactionsTable)
        .values({ userId, totalAmount })
        .returning();
      await tx.insert(transactionItemsTable).values(
        itemsWithPrice.map((item) => ({
          transactionId: newTransaction.id,
          productId: item.productId,
          quantity: item.quantity,
          priceAtPurchase: item.priceAtPurchase,
        })),
      );
      for (const item of itemsWithPrice) {
        const product = products.find((p) => p.id === item.productId);
        await tx
          .update(productTable)
          .set({ stock: product.stock - item.quantity })
          .where(eq(productTable.id, item.productId));
      }
      return newTransaction;
    });
    return transaction;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw parseDbError(err);
  }
};

export const getAllTransactions = async ({ status, page, limit }) => {
  try {
    const offset = (page - 1) * limit;

    let query = db
      .select({
        id: transactionsTable.id,
        userId: transactionsTable.userId,
        status: transactionsTable.status,
        totalAmount: transactionsTable.totalAmount,
        createdAt: transactionsTable.createdAt,
      })
      .from(transactionsTable);

    if (status) query = query.where(eq(transactionsTable.status, status));

    const transaction = await query.limit(limit).offset(offset);

    return transaction;
  } catch (err) {
    throw parseDbError(err);
  }
};

export const updateTransactionStatus = async (id, status) => {
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
      const [updated] = await tx
        .update(transactionsTable)
        .set({ status })
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

export const deleteTransactionById = async (id) => {
  try {
    const transaction = await db
      .delete(transactionsTable)
      .where(eq(transactionsTable.id, id))
      .returning();
    if (transaction.length === 0)
      throw new NotFoundError("Transaksi tidak ditemukan");
    return transaction;
  } catch (err) {
    throw parseDbError(err);
  }
};
