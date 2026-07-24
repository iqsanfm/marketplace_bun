import { success, error } from "../utils/response";
import {
  addNewProduct,
  getAllProducts,
  getProductById,
  editProductById,
  deleteProductById,
  getLowStockProducts,
} from "../services/product.service";

export const createProduct = async (c) => {
  try {
    const body = c.req.valid("json");
    const product = await addNewProduct(body);
    return success(c, product, 201);
  } catch (err) {
    return error(c, err.message);
  }
};

export const listLowStockProducts = async (c) => {
  try {
    const product = await getLowStockProducts();
    return success(c, product);
  } catch (err) {
    return error(c, err.message);
  }
};

export const listProducts = async (c) => {
  try {
    const query = c.req.valid("query");
    const product = await getAllProducts(query);
    return success(c, product);
  } catch (err) {
    return error(c, err.message);
  }
};

export const productById = async (c) => {
  try {
    const id = c.req.param("id");
    const product = await getProductById(id);
    return success(c, product);
  } catch (err) {
    return error(c, err.message, err.status ?? 400);
  }
};

export const removeProduct = async (c) => {
  try {
    const id = c.req.param("id");
    const product = await deleteProductById(id);
    return success(c, product);
  } catch (err) {
    return error(c, err.message, err.status ?? 400);
  }
};

export const updateProduct = async (c) => {
  try {
    const loggedInUser = c.get("user");
    const id = c.req.param("id");

    if (loggedInUser.role !== "admin") {
      return error(c, "Tidak boleh melakukan edit selain Admin", 403);
    }

    const body = c.req.valid("json");
    const product = await editProductById(id, body);
    return success(c, product);
  } catch (err) {
    return error(c, err.message, err.status ?? 400);
  }
};
