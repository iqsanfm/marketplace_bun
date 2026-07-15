import {
  createTransaction as createTransactionService,
  updateTransactionStatus as updateTransactionStatusService,
  getAllTransactions as getAllTransactionsService,
  deleteTransactionById as deleteTransactionByIdService,
} from "../services/transaction.service";
import { success, error } from "../utils/response";

export const createTransaction = async (c) => {
  try {
    const loggedInUser = c.get("user");
    const { items } = c.req.valid("json");
    const transaction = await createTransactionService(loggedInUser.id, items);
    return success(c, transaction, 201);
  } catch (err) {
    return error(c, err.message, err.status ?? 400);
  }
};

export const updateTransactionStatus = async (c) => {
  try {
    const loggedInUser = c.get("user");
    if (loggedInUser.role !== "admin") {
      return error(c, "Hanya admin yang boleh mengubah status transaksi", 403);
    }
    const { id } = c.req.valid("param");
    const { status } = c.req.valid("json");
    const transaction = await updateTransactionStatusService(id, status);
    return success(c, transaction);
  } catch (err) {
    return error(c, err.message, err.status ?? 400);
  }
};

export const getAllTransactions = async (c) => {
  try {
    const query = c.req.valid("query");
    const transaction = await getAllTransactionsService(query);
    return success(c, transaction);
  } catch (err) {
    return error(c, err.message);
  }
};

export const deleteTransactionById = async (c) => {
  try {
    const id = c.req.param("id");
    const transaction = await deleteTransactionByIdService(id);
    return success(c, transaction);
  } catch (err) {
    return error(c, err.message, err.status ?? 400);
  }
};
