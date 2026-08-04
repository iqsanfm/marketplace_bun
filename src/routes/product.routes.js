import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

import {
  createNewProductSchema,
  productIdSchema,
  editProductByIdSchema,
  deleteProductByIdSchema,
  getProductsQuerySchema,
  getBestSellerQuerySchema,
  createStockAdjustmentSchema,
  getStockAdjustmentsQuerySchema,
} from "../validators/product.validator";

import { handleValidation } from "../utils/handle-validation.js";
import { authMiddleware, requireRole } from "../middlewares/auth.middleware.js";
import {
  createProduct,
  updateProduct,
  listProducts,
  productById,
  removeProduct,
  listLowStockProducts,
  listBestSellerProducts,
  createStockAdjustment,
  listStockAdjustments,
} from "../controllers/product.controllers.js";

const productRoute = new Hono();

productRoute.use("*", authMiddleware);
// Semua peran kerja boleh lihat katalog. Role "user" (belum ditugaskan) tidak.
productRoute.use(
  "*",
  requireRole("admin", "kasir", "admin_online", "packaging", "gudang"),
);

productRoute.post(
  "/",
  requireRole("admin"),
  zValidator("json", createNewProductSchema, handleValidation),
  createProduct,
);

productRoute.get("/low-stock", listLowStockProducts);

productRoute.get(
  "/best-seller",
  zValidator("query", getBestSellerQuerySchema, handleValidation),
  listBestSellerProducts,
);

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

// Stok cuma boleh berubah lewat sini (atau lewat transaksi), bukan lewat PATCH /:id
productRoute.post(
  "/:id/stock-adjustments",
  requireRole("admin", "gudang"),
  zValidator("param", productIdSchema, handleValidation),
  zValidator("json", createStockAdjustmentSchema, handleValidation),
  createStockAdjustment,
);

productRoute.get(
  "/:id/stock-adjustments",
  requireRole("admin", "gudang"),
  zValidator("param", productIdSchema, handleValidation),
  zValidator("query", getStockAdjustmentsQuerySchema, handleValidation),
  listStockAdjustments,
);

productRoute.delete(
  "/:id",
  requireRole("admin"),
  zValidator("param", deleteProductByIdSchema, handleValidation),
  removeProduct,
);

productRoute.patch(
  "/:id",
  requireRole("admin"),
  zValidator("param", productIdSchema, handleValidation),
  zValidator("json", editProductByIdSchema, handleValidation),
  updateProduct,
);

export default productRoute;
