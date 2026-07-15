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
  deleteTransactionById,
} from "../controllers/transaction.controllers.js";

const transactionRoute = new Hono();

transactionRoute.get(
  "/",
  zValidator("query", getTransactionsQuerySchema, handleValidation),
  getAllTransactions,
);

transactionRoute.delete("/:id", deleteTransactionById);

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
