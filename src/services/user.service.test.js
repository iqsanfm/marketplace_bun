import { beforeAll, beforeEach, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../db/database.connection";
import { sessionsTable, usersTable } from "../db/schema.database";
import { resetDb, setupTestDb } from "../test/integration-db.js";
import {
  changePassword,
  editUserById,
  editUserRole,
  getAllUsers,
  getUserById,
  loginUser,
  logoutUser,
  registerUser,
} from "./user.service.js";

const data = { name: "Sari", email: "sari@test.local", password: "rahasia123", phone: "0811" };
const sessionsOf = (userId) =>
  db.select().from(sessionsTable).where(eq(sessionsTable.userId, userId));

beforeAll(setupTestDb);
beforeEach(resetDb);

test("register: password di-hash dan tidak ikut di response", async () => {
  const [user] = await registerUser(data);
  expect(user).not.toHaveProperty("password");
  expect(user).toMatchObject({ name: "Sari", email: "sari@test.local", role: "user" });

  const [row] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
  expect(row.password).not.toBe(data.password);
  expect(row.password.startsWith("$argon2id$")).toBe(true);
  expect(await Bun.password.verify(data.password, row.password)).toBe(true);
});

test("register: email dobel ditolak", async () => {
  await registerUser(data);
  const err = await registerUser({ ...data, name: "Lain" }).catch((e) => e);
  expect(err.message).toBe("Data sudah ada (duplikat)");
});

test("login: buat session, password salah & email tidak ada pesannya sama", async () => {
  const [user] = await registerUser(data);
  const session = await loginUser({ email: data.email, password: data.password });
  expect(session).not.toHaveProperty("password");
  expect(session).toMatchObject({ id: user.id, role: "user" });
  expect(await sessionsOf(user.id)).toEqual([expect.objectContaining({ token: session.token })]);

  const wrongPass = await loginUser({ email: data.email, password: "salah" }).catch((e) => e);
  const noUser = await loginUser({ email: "x@test.local", password: "salah" }).catch((e) => e);
  expect(wrongPass.message).toBe("Email atau Password salah");
  expect(noUser.message).toBe(wrongPass.message);
});

test("logout: session yang dipakai terhapus, session lain tetap", async () => {
  const [user] = await registerUser(data);
  const a = await loginUser(data);
  const b = await loginUser(data);
  await logoutUser(a.token);
  expect((await sessionsOf(user.id)).map((s) => s.token)).toEqual([b.token]);
});

test("changePassword: password lama dicek, semua session dihapus", async () => {
  const [user] = await registerUser(data);
  await loginUser(data);

  const wrong = await changePassword(user.id, "salah", "baru12345").catch((e) => e);
  expect(wrong.status).toBe(401);
  expect(await sessionsOf(user.id)).toHaveLength(1);

  await changePassword(user.id, data.password, "baru12345");
  expect(await sessionsOf(user.id)).toHaveLength(0);
  expect((await loginUser({ email: data.email, password: "baru12345" })).token).toBeString();
  expect((await loginUser(data).catch((e) => e)).message).toBe("Email atau Password salah");
});

test("getUserById & getAllUsers tidak mengembalikan password", async () => {
  const [user] = await registerUser(data);
  await registerUser({ ...data, email: "budi@test.local", name: "Budi" });

  expect(await getUserById(user.id)).not.toHaveProperty("password");
  const list = await getAllUsers({ page: 1, limit: 10, search: "budi" });
  expect(list.total).toBe(1);
  expect(list.users[0]).not.toHaveProperty("password");
  expect((await getUserById("3f2b8c1e-4a5d-4e6f-8a9b-0c1d2e3f4a5b").catch((e) => e)).status).toBe(404);
});

test("editUserRole & editUserById: ubah data, user tidak ada 404", async () => {
  const [user] = await registerUser(data);
  expect((await editUserRole(user.id, { role: "kasir" }))[0].role).toBe("kasir");
  expect((await editUserById(user.id, { address: "Jl. Melati" }))[0].address).toBe("Jl. Melati");

  const missing = "3f2b8c1e-4a5d-4e6f-8a9b-0c1d2e3f4a5b";
  expect((await editUserRole(missing, { role: "kasir" }).catch((e) => e)).status).toBe(404);
  expect((await editUserById(missing, { name: "X" }).catch((e) => e)).status).toBe(404);
});
