import {
  createTransaction,
  updateTransactionStatus,
  updateFulfillmentStatus,
  getAllTransactions,
  getTransactionsSummary,
  getTransactionById,
  getInvoiceById,
} from "../services/transaction.service";
import { success, error } from "../utils/response";

export const handleCreateTransaction = async (c) => {
  try {
    const loggedInUser = c.get("user");
    const { items, memberId, guestName, orderChannel } = c.req.valid("json");
    const channel = orderChannel ?? "offline";
    if (loggedInUser.role === "kasir" && channel !== "offline") {
      return error(c, "Kasir hanya boleh membuat transaksi offline", 403);
    }
    if (loggedInUser.role === "admin_online" && channel !== "online") {
      return error(c, "Admin online hanya boleh membuat transaksi online", 403);
    }
    const transaction = await createTransaction(
      loggedInUser.id,
      items,
      memberId,
      guestName,
      orderChannel,
    );
    return success(c, transaction, 201);
  } catch (err) {
    return error(c, err.message, err.status ?? 400);
  }
};

export const changeTransactionStatus = async (c) => {
  try {
    const loggedInUser = c.get("user");
    const { id } = c.req.valid("param");
    const transaction = await updateTransactionStatus(
      id,
      loggedInUser,
      c.req.valid("json"),
    );
    return success(c, transaction);
  } catch (err) {
    return error(c, err.message, err.status ?? 400);
  }
};

export const listTransactions = async (c) => {
  try {
    const loggedInUser = c.get("user");
    const query = c.req.valid("query");
    // packaging cuma lihat antrian kerjanya sendiri, bukan semua transaksi
    if (loggedInUser.role === "packaging") {
      query.orderChannel = "online";
      query.status = "paid";
    }
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
    const transaction = await getTransactionById(id, c.get("user"));
    return success(c, transaction);
  } catch (err) {
    return error(c, err.message, err.status ?? 400);
  }
};

export const changeFulfillmentStatus = async (c) => {
  try {
    const { id } = c.req.valid("param");
    const { fulfillmentStatus } = c.req.valid("json");
    const transaction = await updateFulfillmentStatus(
      id,
      c.get("user"),
      fulfillmentStatus,
    );
    return success(c, transaction);
  } catch (err) {
    return error(c, err.message, err.status ?? 400);
  }
};

export const transactionInvoice = async (c) => {
  try {
    const { id } = c.req.valid("param");
    const invoice = await getInvoiceById(id);
    return success(c, invoice);
  } catch (err) {
    return error(c, err.message, err.status ?? 400);
  }
};
