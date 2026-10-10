import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Hono } from "hono";

// DB palsu: query session di authMiddleware mengembalikan `sessionRows`.
// Test di sini cuma lewat jalur yang berhenti sebelum service menyentuh DB.
let sessionRows = [];
const query = { from: () => query, innerJoin: () => query, where: async () => sessionRows };
mock.module("../db/database.connection", () => ({
  db: { select: () => query },
  checkConnection: async () => {},
}));

const { default: userRoute } = await import("../routes/users.routes.js");
const { default: productRoute } = await import("../routes/product.routes.js");
const { default: transactionRoute } = await import("../routes/transaction.routes.js");
const { default: memberRoute } = await import("../routes/members.routes.js");
const { assertChannelAllowed, channelForRole } = await import(
  "../services/transaction.service.js"
);

const app = new Hono()
  .route("/users", userRoute)
  .route("/product", productRoute)
  .route("/transactions", transactionRoute)
  .route("/member", memberRoute);

const UUID = "3f2b8c1e-4a5d-4e6f-8a9b-0c1d2e3f4a5b";
const loginAs = (role, expiresAt = new Date(Date.now() + 86_400_000)) => {
  sessionRows = [
    {
      sessions: { token: "tok", expiresAt },
      users: { id: UUID, name: "Tes", email: "tes@mail.com", role, password: "$argon2id$hash" },
    },
  ];
};

const call = async (method, path, body) => {
  const res = await app.request(path, {
    method,
    headers: { Authorization: "Bearer tok", "Content-Type": "application/json" },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};

beforeEach(() => {
  sessionRows = [];
});

describe("authMiddleware", () => {
  test("tanpa header Authorization -> 401", async () => {
    const res = await app.request("/product");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ success: false, error: "Token tidak ada" });
  });

  test("token tidak ada di DB -> 401", async () => {
    expect(await call("GET", "/product")).toEqual({
      status: 401,
      body: { success: false, error: "Token tidak valid" },
    });
  });

  test("sesi kadaluarsa -> 401", async () => {
    loginAs("admin", new Date(Date.now() - 1000));
    expect(await call("GET", "/users/me")).toEqual({
      status: 401,
      body: { success: false, error: "Sesi sudah berakhir" },
    });
  });

  test("sesi valid: /users/me tanpa password", async () => {
    loginAs("kasir");
    const { status, body } = await call("GET", "/users/me");
    expect(status).toBe(200);
    expect(body.data).toMatchObject({ id: UUID, role: "kasir" });
    expect(body.data.password).toBeUndefined();
  });
});

describe("requireRole (otorisasi)", () => {
  test.each([
    ["user", "GET", "/product"], // role belum ditugaskan
    ["kasir", "POST", "/product"], // cuma admin yang boleh buat produk
    ["kasir", "PATCH", `/product/${UUID}`],
    ["kasir", "POST", `/product/${UUID}/stock-adjustments`], // stok: admin & gudang
    ["gudang", "GET", "/transactions"], // gudang tidak boleh lihat transaksi
    ["gudang", "GET", "/member"],
    ["kasir", "GET", "/users"], // daftar user cuma admin
    ["admin_online", "PATCH", `/users/${UUID}/role`],
  ])("%s %s %s -> 403", async (role, method, path) => {
    loginAs(role);
    expect(await call(method, path, {})).toEqual({
      status: 403,
      body: { success: false, error: "Kamu tidak punya akses ke aksi ini" },
    });
  });
});

describe("validasi input lewat route -> 400", () => {
  test("buat produk dengan harga 0", async () => {
    loginAs("admin");
    expect(await call("POST", "/product", { product_name: "Kopi", price: 0, stock: 1 })).toEqual({
      status: 400,
      body: { success: false, error: "Harga jual harus lebih dari 0" },
    });
  });

  test("ubah stok lewat PATCH produk ditolak", async () => {
    loginAs("admin");
    const { status, body } = await call("PATCH", `/product/${UUID}`, { stock: 99 });
    expect(status).toBe(400);
    expect(body.error).toContain("stock-adjustments");
  });

  test("id bukan uuid", async () => {
    loginAs("admin");
    expect((await call("GET", "/product/abc")).body.error).toBe("ID tidak valid");
  });

  test("transaksi dengan member dan nama manual sekaligus", async () => {
    loginAs("kasir");
    const { status, body } = await call("POST", "/transactions", {
      items: [{ productId: UUID, quantity: 1 }],
      memberId: UUID,
      guestName: "Budi",
    });
    expect(status).toBe(400);
    expect(body.error).toContain("tidak keduanya");
  });

  test("login dengan email tidak valid (route publik)", async () => {
    const res = await app.request("/users/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "bukan-email", password: "x" }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Format email tidak valid");
  });
});

test("channel transaksi per role: kasir offline, admin_online online, admin bebas", () => {
  expect(channelForRole("kasir")).toBe("offline");
  expect(channelForRole("admin_online")).toBe("online");
  expect(() => assertChannelAllowed("kasir", "offline")).not.toThrow();
  expect(() => assertChannelAllowed("admin", "online")).not.toThrow();
  expect(() => assertChannelAllowed("kasir", "online")).toThrow(
    "Role kasir cuma boleh menangani transaksi offline",
  );
  expect(() => assertChannelAllowed("admin_online", "offline")).toThrow(
    expect.objectContaining({ status: 403 }),
  );
});
