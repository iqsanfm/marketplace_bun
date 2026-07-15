import { success, error } from "../utils/response";
import {
  addNewProduct as addNewProductService,
  getAllProducts as getAllProductsService,
  getProductById as getProductByIdService,
  editProductById as editProductByIdService,
  deleteProductById as deleteProductByIdService,
  getLowStockProducts as getLowStockProductsService,
} from "../services/product.service";

export const addNewProduct = async (c) => {
  try {
    const body = c.req.valid("json");
    const product = await addNewProductService(body);
    return success(c, product);
  } catch (err) {
    return error(c, err.message);
  }
};

export const getLowStockProducts = async (c) => {
  try {
    const product = await getLowStockProductsService();
    return success(c, product);
  } catch (err) {
    return error(c, err.message);
  }
};

export const getAllProducts = async (c) => {
  try {
    const query = c.req.valid("query");
    const product = await getAllProductsService(query);
    return success(c, product);
  } catch (err) {
    return error(c, err.message);
  }
};

export const getProductById = async (c) => {
  try {
    const id = c.req.param("id");
    const product = await getProductByIdService(id);
    return success(c, product);
  } catch (err) {
    return error(c, err.message, err.status ?? 400);
  }
};

export const deleteProductById = async (c) => {
  try {
    const id = c.req.param("id");
    const product = await deleteProductByIdService(id);
    return success(c, product);
  } catch (err) {
    return error(c, err.message, err.status ?? 400);
  }
};

export const editProductById = async (c) => {
  try {
    const loggedInUser = c.get("user");
    const id = c.req.param("id");

    if (loggedInUser.role !== "admin") {
      return error(c, "Tidak boleh melakukan edit selain Admin", 403);
    }

    const body = c.req.valid("json");
    const product = await editProductByIdService(id, body);
    return success(c, product);
  } catch (err) {
    return error(c, err.message, err.status ?? 400);
  }
};
