import {
  eq,
  and,
  gte,
  lte,
  ilike,
  sql,
  count,
  or,
  desc,
  inArray,
} from "drizzle-orm";
import { db } from "../db/database.connection";
import {
  productTable,
  transactionItemsTable,
  transactionsTable,
  stockAdjustmentsTable,
  usersTable,
} from "../db/schema.database";
import { parseDbError } from "../utils/db-error";
import { NotFoundError } from "../utils/errors";
import { error } from "../utils/response";

export const addNewProduct = async (data) => {
  try {
    const product = await db.insert(productTable).values(data).returning({
      id: productTable.id,
      product_name: productTable.product_name,
      costPrice: productTable.costPrice,
      price: productTable.price,
      stock: productTable.stock,
      sku: productTable.sku,
      description: productTable.description,
      category: productTable.category,
    });
    return product;
  } catch (err) {
    throw parseDbError(err);
  }
};

export const findExistingSkus = async (skus) => {
  try {
    if (skus.length === 0) return new Set();
    const rows = await db
      .select({ sku: productTable.sku })
      .from(productTable)
      .where(inArray(productTable.sku, skus));
    return new Set(rows.map((r) => r.sku));
  } catch (err) {
    throw parseDbError(err);
  }
};

// Baris dengan SKU yang sudah ada = update, sisanya insert. Satu transaksi,
// jadi kalau ada yang gagal tidak ada yang setengah masuk.
export const upsertProducts = async (rows) => {
  try {
    return await db.transaction(async (tx) => {
      const skus = rows.map((r) => r.sku).filter(Boolean);
      const existing =
        skus.length > 0
          ? await tx
              .select({ sku: productTable.sku })
              .from(productTable)
              .where(inArray(productTable.sku, skus))
              .for("update")
          : [];
      const existingSkus = new Set(existing.map((r) => r.sku));

      const toInsert = rows.filter((r) => !r.sku || !existingSkus.has(r.sku));
      const toUpdate = rows.filter((r) => r.sku && existingSkus.has(r.sku));

      if (toInsert.length > 0)
        await tx.insert(productTable).values(toInsert);

      // `stock` sengaja dibuang: perubahan stok wajib lewat stock-adjustments
      // biar ada jejaknya. Kolom stok di CSV cuma berlaku buat produk baru.
      // ponytail: update satu per satu, cukup buat <=1000 baris; kalau kelamaan
      // ganti jadi satu INSERT ... ON CONFLICT DO UPDATE.
      for (const { sku, stock, ...fields } of toUpdate)
        await tx
          .update(productTable)
          .set(fields)
          .where(eq(productTable.sku, sku));

      return { inserted: toInsert.length, updated: toUpdate.length };
    });
  } catch (err) {
    throw parseDbError(err);
  }
};

export const getAllProducts = async ({
  category,
  search,
  minPrice,
  maxPrice,
  page,
  limit,
}) => {
  try {
    const offset = (page - 1) * limit;
    const conditions = [];

    if (category) conditions.push(eq(productTable.category, category));
    if (search)
      conditions.push(
        or(
          ilike(productTable.product_name, `%${search}%`),
          ilike(productTable.sku, `%${search}%`),
        ),
      );
    if (minPrice !== undefined)
      conditions.push(gte(productTable.price, minPrice));
    if (maxPrice !== undefined)
      conditions.push(lte(productTable.price, maxPrice));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    let dataQuery = db
      .select({
        id: productTable.id,
        product_name: productTable.product_name,
        costPrice: productTable.costPrice,
        price: productTable.price,
        stock: productTable.stock,
        sku: productTable.sku,
        description: productTable.description,
        category: productTable.category,
      })
      .from(productTable);

    let countQuery = db
      .select({ count: sql`count(*)::int` })
      .from(productTable);

    if (whereClause) {
      dataQuery = dataQuery.where(whereClause);
      countQuery = countQuery.where(whereClause);
    }

    const [items, countResult] = await Promise.all([
      dataQuery.limit(limit).offset(offset),
      countQuery,
    ]);

    const total = countResult[0].count;
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

export const getLowStockProducts = async (data) => {
  try {
    const product = await db
      .select({
        id: productTable.id,
        product_name: productTable.product_name,
        stock: productTable.stock,
      })
      .from(productTable)
      .where(lte(productTable.stock, 10));

    return product;
  } catch (err) {
    throw parseDbError(err);
  }
};

export const getProductById = async (id) => {
  try {
    const product = await db
      .select({
        id: productTable.id,
        product_name: productTable.product_name,
        costPrice: productTable.costPrice,
        price: productTable.price,
        stock: productTable.stock,
        sku: productTable.sku,
        description: productTable.description,
        category: productTable.category,
      })
      .from(productTable)
      .where(eq(productTable.id, id));
    if (product.length === 0) throw new NotFoundError("Produk tidak ditemukan");
    return product;
  } catch (err) {
    throw parseDbError(err);
  }
};

export const deleteProductById = async (id) => {
  try {
    const product = await db
      .delete(productTable)
      .where(eq(productTable.id, id))
      .returning();
    if (product.length === 0) throw new NotFoundError("Produk tidak ditemukan");
    return product;
  } catch (err) {
    throw parseDbError(err);
  }
};

export const editProductById = async (id, data) => {
  try {
    const product = await db
      .update(productTable)
      .set(data)
      .where(eq(productTable.id, id))
      .returning({
        id: productTable.id,
        product_name: productTable.product_name,
        costPrice: productTable.costPrice,
        price: productTable.price,
        stock: productTable.stock,
        sku: productTable.sku,
        description: productTable.description,
        category: productTable.category,
      });
    if (product.length === 0) throw new NotFoundError("Produk tidak ditemukan");
    return product;
  } catch (err) {
    throw parseDbError(err);
  }
};

export const adjustProductStock = async (productId, user, data) => {
  try {
    const adjustment = await db.transaction(async (tx) => {
      // FOR UPDATE: kalau ada transaksi masuk barengan, dia antri — kalau tidak,
      // stok hasil hitungan fisik bisa nimpa pengurangan dari penjualan barusan.
      const [product] = await tx
        .select()
        .from(productTable)
        .where(eq(productTable.id, productId))
        .for("update");
      if (!product) throw new NotFoundError("Produk tidak ditemukan");

      const [created] = await tx
        .insert(stockAdjustmentsTable)
        .values({
          productId,
          userId: user.id,
          stockBefore: product.stock,
          stockAfter: data.stockAfter,
          reason: data.reason,
        })
        .returning();

      await tx
        .update(productTable)
        .set({ stock: data.stockAfter })
        .where(eq(productTable.id, productId));

      return created;
    });

    return adjustment;
  } catch (err) {
    if (err instanceof NotFoundError) throw err;
    throw parseDbError(err);
  }
};

export const getStockAdjustments = async (productId, { page, limit }) => {
  try {
    const offset = (page - 1) * limit;
    const where = eq(stockAdjustmentsTable.productId, productId);

    const [items, [{ count: total }]] = await Promise.all([
      db
        .select({
          id: stockAdjustmentsTable.id,
          stockBefore: stockAdjustmentsTable.stockBefore,
          stockAfter: stockAdjustmentsTable.stockAfter,
          reason: stockAdjustmentsTable.reason,
          createdAt: stockAdjustmentsTable.createdAt,
          adjustedBy: usersTable.name,
        })
        .from(stockAdjustmentsTable)
        .innerJoin(usersTable, eq(stockAdjustmentsTable.userId, usersTable.id))
        .where(where)
        .orderBy(desc(stockAdjustmentsTable.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql`count(*)::int` })
        .from(stockAdjustmentsTable)
        .where(where),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  } catch (err) {
    throw parseDbError(err);
  }
};

export const getBestSellerProducts = async (category, page, limit) => {
  try {
    const offset = (page - 1) * limit;
    const conditions = [eq(transactionsTable.status, "paid")];

    if (category) conditions.push(eq(productTable.category, category));

    const whereClause = and(...conditions);

    const dataQuery = db
      .select({
        productId: productTable.id,
        productName: productTable.product_name,
        totalSold: sql`sum(${transactionItemsTable.quantity})`.mapWith(Number),
      })
      .from(transactionItemsTable)
      .innerJoin(
        productTable,
        eq(transactionItemsTable.productId, productTable.id),
      )
      .innerJoin(
        transactionsTable,
        eq(transactionItemsTable.transactionId, transactionsTable.id),
      )
      .where(whereClause)
      .groupBy(productTable.id, productTable.product_name)
      .orderBy(sql`sum(${transactionItemsTable.quantity}) desc`);

    const countQuery = db
      .select({ count: sql`count(distinct ${productTable.id})::int` })
      .from(transactionItemsTable)
      .innerJoin(
        productTable,
        eq(transactionItemsTable.productId, productTable.id),
      )
      .innerJoin(
        transactionsTable,
        eq(transactionItemsTable.transactionId, transactionsTable.id),
      )
      .where(whereClause);

    const [items, countResult] = await Promise.all([
      dataQuery.limit(limit).offset(offset),
      countQuery,
    ]);

    const total = countResult[0].count;

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
