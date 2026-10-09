import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  createTransactionSchema,
  transactionIdParamSchema,
  updateTransactionStatusSchema,
  getTransactionsQuerySchema,
  exportTransactionsQuerySchema,
} from "../validators/transaction.validator.js";
import { handleValidation } from "../utils/handle-validation.js";
import { authMiddleware, requireRole } from "../middlewares/auth.middleware.js";
import {
  handleCreateTransaction,
  changeTransactionStatus,
  listTransactions,
  transactionsSummary,
  transactionById,
  transactionInvoice,
  exportTransactionsCsv,
  transactionQris,
} from "../controllers/transaction.controllers.js";

const transactionRoute = new Hono();

transactionRoute.use("*", authMiddleware);

// gudang tidak punya akses transaksi sama sekali.
const penjualan = requireRole("admin", "kasir", "admin_online");

transactionRoute.get("/summary", penjualan, transactionsSummary);

transactionRoute.get(
  "/",
  penjualan,
  zValidator("query", getTransactionsQuerySchema, handleValidation),
  listTransactions,
);

transactionRoute.get(
  "/export",
  penjualan,
  zValidator("query", exportTransactionsQuerySchema, handleValidation),
  exportTransactionsCsv,
);

transactionRoute.get(
  "/:id",
  penjualan,
  zValidator("param", transactionIdParamSchema, handleValidation),
  transactionById,
);

transactionRoute.get(
  "/:id/invoice",
  penjualan,
  zValidator("param", transactionIdParamSchema, handleValidation),
  transactionInvoice,
);

// teks QRIS dengan nominal terisi; FE yang merender jadi gambar QR
transactionRoute.get(
  "/:id/qris",
  penjualan,
  zValidator("param", transactionIdParamSchema, handleValidation),
  transactionQris,
);

transactionRoute.post(
  "/",
  penjualan,
  zValidator("json", createTransactionSchema, handleValidation),
  handleCreateTransaction,
);

transactionRoute.patch(
  "/:id/status",
  penjualan,
  zValidator("param", transactionIdParamSchema, handleValidation),
  zValidator("json", updateTransactionStatusSchema, handleValidation),
  changeTransactionStatus,
);

export default transactionRoute;
