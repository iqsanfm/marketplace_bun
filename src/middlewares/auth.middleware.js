import { eq } from "drizzle-orm";
import { db } from "../db/database.connection";
import { sessionsTable, usersTable } from "../db/schema.database";
import { error } from "../utils/response";

export const authMiddleware = async (c, next) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return error(c, "Token tidak ada", 401);
  }

  const token = header.slice(7);

  const [row] = await db
    .select()
    .from(sessionsTable)
    .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
    .where(eq(sessionsTable.token, token));

  if (!row) return error(c, "Token tidak valid", 401);
  if (row.sessions.expiresAt < new Date()) {
    return error(c, "Sesi sudah berakhir", 401);
  }

  c.set("user", row.users);
  await next();
};

export const requireRole =
  (...roles) =>
  async (c, next) => {
    const user = c.get("user");
    if (!roles.includes(user.role)) {
      return error(c, "Kamu tidak punya akses ke aksi ini", 403);
    }
    await next();
  };
