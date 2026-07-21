import { eq, and, ilike, sql, or } from "drizzle-orm";

import { db } from "../db/database.connection";
import { sessionsTable, usersTable } from "../db/schema.database";
import { parseDbError } from "../utils/db-error";
import { AppError, NotFoundError } from "../utils/errors";
import { findUserByEmail } from "../utils/helper.login";

export const registerUser = async (data) => {
  try {
    const hashedPassword = await Bun.password.hash(data.password, {
      algorithm: "argon2id",
    });

    const user = await db
      .insert(usersTable)
      .values({ ...data, password: hashedPassword })
      .returning({
        id: usersTable.id,
        name: usersTable.name,
        age: usersTable.age,
        email: usersTable.email,
        address: usersTable.address,
        phone: usersTable.phone,
        role: usersTable.role,
      });
    return user;
  } catch (err) {
    throw parseDbError(err);
  }
};

export const loginUser = async ({ email, password }) => {
  const user = await findUserByEmail(email);
  if (!user) throw new AppError("Email atau Password salah");

  const userValid = await Bun.password.verify(password, user.password);
  if (!userValid) throw new AppError("Email atau Password salah");

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.insert(sessionsTable).values({ userId: user.id, token, expiresAt });

  return { email: user.email, name: user.name, token, expiresAt };
};

export const getAllUsers = async ({ role, page, limit, search }) => {
  try {
    const offset = (page - 1) * limit;
    const conditions = [];

    if (role) conditions.push(eq(usersTable.role, role));
    if (search)
      conditions.push(
        or(
          ilike(usersTable.name, `%${search}%`),
          ilike(usersTable.email, `%${search}%`),
          ilike(usersTable.phone, `%${search}%`),
        ),
      );

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    let dataQuery = db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        age: usersTable.age,
        email: usersTable.email,
        address: usersTable.address,
        phone: usersTable.phone,
        role: usersTable.role,
      })
      .from(usersTable);

    let countQuery = db.select({ count: sql`count(*)::int` }).from(usersTable);
    if (whereClause) {
      dataQuery = dataQuery.where(whereClause);
      countQuery = countQuery.where(whereClause);
    }
    const [users, countResult] = await Promise.all([
      dataQuery.limit(limit).offset(offset),
      countQuery,
    ]);

    const total = countResult[0].count;
    return {
      users,
      total,
      page,
      limit,
      totaPages: Math.ceil(total / limit),
    };
  } catch (err) {
    throw parseDbError(err);
  }
};

export const getUserById = async (id) => {
  try {
    const [user] = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        age: usersTable.age,
        email: usersTable.email,
        address: usersTable.address,
        phone: usersTable.phone,
        role: usersTable.role,
      })
      .from(usersTable)
      .where(eq(usersTable.id, id));
    if (!user) throw new NotFoundError("User tidak ditemukan");
    return user;
  } catch (err) {
    throw parseDbError(err);
  }
};

export const editUserRole = async (id, data) => {
  try {
    const user = await db
      .update(usersTable)
      .set(data)
      .where(eq(usersTable.id, id))
      .returning({
        name: usersTable.name,
        email: usersTable.email,
        role: usersTable.role,
      });
    if (!user) throw new NotFoundError("User tidak ditemukan");
    return user;
  } catch (err) {
    throw parseDbError(err);
  }
};

export const editUserById = async (id, data) => {
  try {
    const user = await db
      .update(usersTable)
      .set(data)
      .where(eq(usersTable.id, id))
      .returning({
        name: usersTable.name,
        age: usersTable.age,
        email: usersTable.email,
        address: usersTable.address,
        phone: usersTable.phone,
        role: usersTable.role,
      });
    if (!user) throw new NotFoundError("User tidak ditemukan");
    return user;
  } catch (err) {
    throw parseDbError(err);
  }
};
