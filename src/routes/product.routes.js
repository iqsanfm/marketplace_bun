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
  addNewProduct,
  editProductById,
  getAllProducts,
  getProductById,
  deleteProductById,
  getLowStockProducts,
} from "../controllers/product.controllers.js";

const productRoute = new Hono();

productRoute.post(
  "/",
  zValidator("json", createNewProductSchema, handleValidation),
  addNewProduct,
);
productRoute.use("/low-stock", getLowStockProducts);

productRoute.use("*", authMiddleware);

productRoute.get(
  "/",
  zValidator("query", getProductsQuerySchema, handleValidation),
  getAllProducts,
);

productRoute.get(
  "/:id",
  zValidator("param", productIdSchema, handleValidation),
  getProductById,
);

productRoute.delete(
  "/:id",
  zValidator("param", deleteProductByIdSchema, handleValidation),
  deleteProductById,
);

productRoute.patch(
  "/:id",
  zValidator("param", productIdSchema, handleValidation),
  zValidator("json", editProductByIdSchema, handleValidation),
  editProductById,
);

export default productRoute;
