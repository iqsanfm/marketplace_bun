import { eq } from "drizzle-orm";
import { db } from "../db/database.connection";
import { usersTable } from "../db/schema.database";
import { parseDbError } from "./db-error";

export const findUserByEmail = async (email) => {
  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email));
    return user;
  } catch (err) {
    throw parseDbError(err);
  }
};
