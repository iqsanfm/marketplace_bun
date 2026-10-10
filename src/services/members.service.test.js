import { beforeAll, beforeEach, expect, test } from "bun:test";
import { makeMember, resetDb, setupTestDb } from "../test/integration-db.js";
import {
  deleteMemberById,
  editMemberById,
  getAllMembers,
  getMemberById,
  registerMember,
} from "./members.service.js";

const MISSING_ID = "3f2b8c1e-4a5d-4e6f-8a9b-0c1d2e3f4a5b";

beforeAll(setupTestDb);
beforeEach(resetDb);

test("register, ambil, edit, hapus member", async () => {
  const [member] = await registerMember({ name: "Rina", phone: "0812", email: "rina@test.local" });
  expect(member).toMatchObject({ name: "Rina", phone: "0812" });

  expect((await getMemberById(member.id))[0].email).toBe("rina@test.local");
  const [edited] = await editMemberById(member.id, { address: "Jl. Mawar" });
  expect(edited.address).toBe("Jl. Mawar");

  await deleteMemberById(member.id);
  expect((await getMemberById(member.id).catch((e) => e)).status).toBe(404);
});

test("nomor HP dobel ditolak", async () => {
  await registerMember({ name: "A", phone: "0812" });
  const err = await registerMember({ name: "B", phone: "0812" }).catch((e) => e);
  expect(err.message).toBe("Data sudah ada (duplikat)");
});

test("member tidak ada: get, edit, hapus 404", async () => {
  expect((await getMemberById(MISSING_ID).catch((e) => e)).status).toBe(404);
  expect((await editMemberById(MISSING_ID, { name: "X" }).catch((e) => e)).status).toBe(404);
  expect((await deleteMemberById(MISSING_ID).catch((e) => e)).status).toBe(404);
});

test("getAllMembers: search, urutan, pagination", async () => {
  await makeMember({ name: "Andi", address: "Bandung" });
  await makeMember({ name: "Budi", email: "budi@test.local" });
  await makeMember({ name: "Cici", address: "Bandung" });

  const page1 = await getAllMembers({ page: 1, limit: 2, sort: "desc" });
  expect(page1.items.map((m) => m.name)).toEqual(["Cici", "Budi"]);
  expect(page1).toMatchObject({ total: 3, totalPages: 2 });
  expect((await getAllMembers({ page: 2, limit: 2, sort: "desc" })).items.map((m) => m.name)).toEqual(["Andi"]);

  const bandung = await getAllMembers({ page: 1, limit: 10, search: "bandung", sort: "asc" });
  expect(bandung.items.map((m) => m.name)).toEqual(["Andi", "Cici"]);
  expect((await getAllMembers({ page: 1, limit: 10, search: "budi@" })).total).toBe(1);
});
