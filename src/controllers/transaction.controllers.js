import {
  createTransaction,
  updateTransactionStatus,
  updateFulfillmentStatus,
  getAllTransactions,
  getTransactionsSummary,
  getTransactionById,
  getInvoiceById,
  assertChannelAllowed,
  channelForRole,
} from "../services/transaction.service";
import { success, error } from "../utils/response";

export const handleCreateTransaction = async (c) => {
  try {
    const loggedInUser = c.get("user");
    const { items, memberId, guestName, orderChannel } = c.req.valid("json");
    const channel = orderChannel ?? "offline";
    assertChannelAllowed(loggedInUser.role, channel);
    const transaction = await createTransaction(
      loggedInUser.id,
      items,
      memberId,
      guestName,
      channel,
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
    // kasir/admin_online dikunci ke channel-nya — filter dari client diabaikan,
    // percuma menolak mereka mengubah order channel lain kalau daftarnya masih bocor
    const locked = channelForRole(loggedInUser.role);
    if (locked) query.orderChannel = locked;
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
    const { id } = c.req.valid("param");
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
    const invoice = await getInvoiceById(id, c.get("user"));
    return success(c, invoice);
  } catch (err) {
    return error(c, err.message, err.status ?? 400);
  }
};
