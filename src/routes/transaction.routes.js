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
  handleCreateTransaction,
  changeTransactionStatus,
  listTransactions,
  transactionsSummary,
  transactionById,
} from "../controllers/transaction.controllers.js";

const transactionRoute = new Hono();

transactionRoute.use("*", authMiddleware);

transactionRoute.get("/summary", transactionsSummary);

transactionRoute.get(
  "/",
  zValidator("query", getTransactionsQuerySchema, handleValidation),
  listTransactions,
);

transactionRoute.get(
  "/:id",
  zValidator("param", transactionIdParamSchema, handleValidation),
  transactionById,
);

transactionRoute.post(
  "/",
  zValidator("json", createTransactionSchema, handleValidation),
  handleCreateTransaction,
);

transactionRoute.patch(
  "/:id/status",
  zValidator("param", transactionIdParamSchema, handleValidation),
  zValidator("json", updateTransactionStatusSchema, handleValidation),
  changeTransactionStatus,
);

export default transactionRoute;
