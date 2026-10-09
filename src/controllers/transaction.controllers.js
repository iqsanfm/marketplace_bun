import {
  createTransaction,
  updateTransactionStatus,
  getAllTransactions,
  getTransactionsSummary,
  getTransactionById,
  getInvoiceById,
  assertChannelAllowed,
  channelForRole,
  getTransactionsForExport,
  getQrisForTransaction,
} from "../services/transaction.service";
import { success, error } from "../utils/response";
import { toCsv } from "../utils/csv.js";

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

export const transactionInvoice = async (c) => {
  try {
    const { id } = c.req.valid("param");
    const invoice = await getInvoiceById(id, c.get("user"));
    return success(c, invoice);
  } catch (err) {
    return error(c, err.message, err.status ?? 400);
  }
};

export const exportTransactionsCsv = async (c) => {
  try {
    const { jenis, ...filter } = c.req.valid("query");
    // sama seperti daftar transaksi: kasir/admin_online cuma dapat channel-nya sendiri
    const locked = channelForRole(c.get("user").role);
    if (locked) filter.orderChannel = locked;
    const { header, rows } = await getTransactionsForExport(filter, jenis);
    const filename = `rekap-${jenis}_${filter.from ?? "awal"}_sd_${filter.to ?? "sekarang"}.csv`;
    // BOM: tanpa ini Excel di Windows salah baca huruf beraksen.
    return c.body("﻿" + toCsv(header, rows), 200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    });
  } catch (err) {
    return error(c, err.message, err.status ?? 400);
  }
};

export const transactionQris = async (c) => {
  try {
    const { id } = c.req.valid("param");
    const qris = await getQrisForTransaction(id, c.get("user"));
    return success(c, qris);
  } catch (err) {
    return error(c, err.message, err.status ?? 400);
  }
};
