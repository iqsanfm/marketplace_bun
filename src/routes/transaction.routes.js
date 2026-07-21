import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  createTransactionSchema,
  transactionIdParamSchema,
  updateTransactionStatusSchema,
  getTransactionsQuerySchema,
} from "../validators/transaction.validator.js";
import { handleValidation } from "../utils/handle-validation.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import {
  createTransaction,
  updateTransactionStatus,
  getAllTransactions,
  getTransactionsSummary,
  getTransactionById,
} from "../controllers/transaction.controllers.js";

const transactionRoute = new Hono();

transactionRoute.get(
  "/:id",
  zValidator("param", transactionIdParamSchema, handleValidation),
  getTransactionById,
);

transactionRoute.get("/summary", getTransactionsSummary);

transactionRoute.get(
  "/",
  zValidator("query", getTransactionsQuerySchema, handleValidation),
  getAllTransactions,
);

transactionRoute.use("*", authMiddleware);

transactionRoute.post(
  "/",
  zValidator("json", createTransactionSchema, handleValidation),
  createTransaction,
);

transactionRoute.patch(
  "/:id/status",
  zValidator("param", transactionIdParamSchema, handleValidation),
  zValidator("json", updateTransactionStatusSchema, handleValidation),
  updateTransactionStatus,
);

export default transactionRoute;
