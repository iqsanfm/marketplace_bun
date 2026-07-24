import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

import {
  createNewProductSchema,
  productIdSchema,
  editProductByIdSchema,
  deleteProductByIdSchema,
  getProductsQuerySchema,
} from "../validators/product.validator";

import { handleValidation } from "../utils/handle-validation.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import {
  createProduct,
  updateProduct,
  listProducts,
  productById,
  removeProduct,
  listLowStockProducts,
} from "../controllers/product.controllers.js";

const productRoute = new Hono();

productRoute.use("*", authMiddleware);

productRoute.post(
  "/",
  zValidator("json", createNewProductSchema, handleValidation),
  createProduct,
);

productRoute.get("/low-stock", listLowStockProducts);

productRoute.get(
  "/",
  zValidator("query", getProductsQuerySchema, handleValidation),
  listProducts,
);

productRoute.get(
  "/:id",
  zValidator("param", productIdSchema, handleValidation),
  productById,
);

productRoute.delete(
  "/:id",
  zValidator("param", deleteProductByIdSchema, handleValidation),
  removeProduct,
);

productRoute.patch(
  "/:id",
  zValidator("param", productIdSchema, handleValidation),
  zValidator("json", editProductByIdSchema, handleValidation),
  updateProduct,
);

export default productRoute;
