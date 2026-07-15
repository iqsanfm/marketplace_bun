import { eq, and, gte, lte, ilike } from "drizzle-orm";
import { db } from "../db/database.connection";
import { productTable } from "../db/schema.database";
import { parseDbError } from "../utils/db-error";
import { NotFoundError } from "../utils/errors";
import { error } from "../utils/response";

export const addNewProduct = async (data) => {
  try {
    const product = await db.insert(productTable).values(data).returning({
      id: productTable.id,
      product_name: productTable.product_name,
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
      conditions.push(ilike(productTable.product_name, `%${search}%`));
    if (minPrice !== undefined)
      conditions.push(gte(productTable.price, minPrice));
    if (maxPrice !== undefined)
      conditions.push(lte(productTable.price, maxPrice));

    let query = db
      .select({
        id: productTable.id,
        product_name: productTable.product_name,
        price: productTable.price,
        stock: productTable.stock,
        sku: productTable.sku,
        description: productTable.description,
        category: productTable.category,
      })
      .from(productTable);

    if (conditions.length > 0) query = query.where(and(...conditions));

    const product = await query.limit(limit).offset(offset);
    return product;
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
