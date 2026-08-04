import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  createTransactionSchema,
  transactionIdParamSchema,
  updateTransactionStatusSchema,
  updateFulfillmentStatusSchema,
  getTransactionsQuerySchema,
} from "../validators/transaction.validator.js";
import { handleValidation } from "../utils/handle-validation.js";
import { authMiddleware, requireRole } from "../middlewares/auth.middleware.js";
import {
  handleCreateTransaction,
  changeTransactionStatus,
  changeFulfillmentStatus,
  listTransactions,
  transactionsSummary,
  transactionById,
  transactionInvoice,
} from "../controllers/transaction.controllers.js";

const transactionRoute = new Hono();

transactionRoute.use("*", authMiddleware);

// gudang tidak punya akses transaksi sama sekali. packaging cuma boleh lihat antrian
// kemasannya (order online yang sudah paid) + ubah status pengemasan — penyaringannya
// ada di controller/service karena bergantung isi barisnya, bukan cuma role.
const penjualan = requireRole("admin", "kasir", "admin_online");
const pengemasan = requireRole("admin", "packaging");
const keduanya = requireRole("admin", "kasir", "admin_online", "packaging");

transactionRoute.get("/summary", penjualan, transactionsSummary);

transactionRoute.get(
  "/",
  keduanya,
  zValidator("query", getTransactionsQuerySchema, handleValidation),
  listTransactions,
);

transactionRoute.get(
  "/:id",
  keduanya,
  zValidator("param", transactionIdParamSchema, handleValidation),
  transactionById,
);

transactionRoute.get(
  "/:id/invoice",
  penjualan,
  zValidator("param", transactionIdParamSchema, handleValidation),
  transactionInvoice,
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

transactionRoute.patch(
  "/:id/fulfillment",
  pengemasan,
  zValidator("param", transactionIdParamSchema, handleValidation),
  zValidator("json", updateFulfillmentStatusSchema, handleValidation),
  changeFulfillmentStatus,
);

export default transactionRoute;
