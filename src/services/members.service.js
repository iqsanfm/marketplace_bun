import { eq, and, gte, lte, ilike, sql, count, or } from "drizzle-orm";
import { db } from "../db/database.connection";
import { membersTable } from "../db/schema.database";
import { parseDbError } from "../utils/db-error";
import { NotFoundError } from "../utils/errors";

export const registerMember = async (data) => {
  try {
    const member = await db.insert(membersTable).values(data).returning({
      id: membersTable.id,
      name: membersTable.name,
      phone: membersTable.phone,
      email: membersTable.email,
      address: membersTable.address,
      createdAt: membersTable.createdAt,
    });
    return member;
  } catch (err) {
    throw parseDbError(err);
  }
};

export const getAllMembers = async ({ page, limit, search }) => {
  try {
    const offset = (page - 1) * limit;
    const conditions = [];

    if (search)
      conditions.push(
        or(
          ilike(membersTable.name, `%${search}%`),
          ilike(membersTable.email, `%${search}%`),
          ilike(membersTable.phone, `%${search}%`),
          ilike(membersTable.address, `%${search}%`),
        ),
      );

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    let dataQuery = db
      .select({
        id: membersTable.id,
        name: membersTable.name,
        phone: membersTable.phone,
        email: membersTable.email,
        address: membersTable.address,
        createdAt: membersTable.createdAt,
      })
      .from(membersTable);

    let countQuery = db
      .select({ count: sql`count(*)::int` })
      .from(membersTable);

    if (whereClause) {
      dataQuery = dataQuery.where(whereClause);
      countQuery = countQuery.where(whereClause);
    }

    const [members, countResult] = await Promise.all([
      dataQuery.limit(limit).offset(offset),
      countQuery,
    ]);

    const total = countResult[0].count;
    return {
      members,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (err) {
    throw parseDbError(err);
  }
};

export const getMemberById = async (id) => {
  try {
    const member = await db
      .select({
        id: membersTable.id,
        name: membersTable.name,
        phone: membersTable.phone,
        email: membersTable.email,
        address: membersTable.address,
        createdAt: membersTable.createdAt,
      })
      .from(membersTable)
      .where(eq(membersTable.id, id));

    if (member.length === 0) throw new NotFoundError("Member tidak ditemukan");
    return member;
  } catch (err) {
    throw parseDbError(err);
  }
};

export const editMemberById = async (id, data) => {
  try {
    const member = await db
      .update(membersTable)
      .set(data)
      .where(eq(membersTable.id, id))
      .returning({
        name: membersTable.name,
        phone: membersTable.phone,
        email: membersTable.email,
        address: membersTable.address,
        createdAt: membersTable.createdAt,
      });
    if (member.length === 0) throw new NotFoundError("Member tidak ditemukan");
    return member;
  } catch (err) {
    throw parseDbError(err);
  }
};

export const deleteMemberById = async (id) => {
  try {
    const member = await db
      .delete(membersTable)
      .where(eq(membersTable.id, id))
      .returning();
    if (membersTable.length === 0)
      throw new NotFoundError("Member tidak ditemukan");
    return member;
  } catch (err) {
    throw parseDbError(err);
  }
};
