import {
  createTransaction,
  updateTransactionStatus,
  getAllTransactions,
  getTransactionsSummary,
  getTransactionById,
} from "../services/transaction.service";
import { success, error } from "../utils/response";

export const handleCreateTransaction = async (c) => {
  try {
    const loggedInUser = c.get("user");
    const { items } = c.req.valid("json");
    const transaction = await createTransaction(loggedInUser.id, items);
    return success(c, transaction, 201);
  } catch (err) {
    return error(c, err.message, err.status ?? 400);
  }
};

export const changeTransactionStatus = async (c) => {
  try {
    const loggedInUser = c.get("user");
    const { id } = c.req.valid("param");
    const { status, paymentMethod } = c.req.valid("json");
    if (status === "cancelled" && loggedInUser.role !== "admin") {
      return error(c, "Hanya admin yang boleh membatalkan transaksi", 403);
    }
    const transaction = await updateTransactionStatus(
      id,
      status,
      paymentMethod,
    );
    return success(c, transaction);
  } catch (err) {
    return error(c, err.message, err.status ?? 400);
  }
};

export const listTransactions = async (c) => {
  try {
    const query = c.req.valid("query");
    const transaction = await getAllTransactions(query);
    return success(c, transaction);
  } catch (err) {
    return error(c, err.message);
  }
};

export const transactionsSummary = async (c) => {
  try {
    const summary = await getTransactionsSummary();
    return success(c, summary);
  } catch (err) {
    return error(c, err.message, err.status ?? 400);
  }
};

export const transactionById = async (c) => {
  try {
    const id = c.req.param("id");
    const transaction = await getTransactionById(id);
    return success(c, transaction);
  } catch (err) {
    return error(c, err.message, err.status ?? 400);
  }
};
