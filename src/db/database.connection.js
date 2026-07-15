import { drizzle } from "drizzle-orm/node-postgres";
const DATABASE_URL = Bun.env.DATABASE_URL;

export const db = drizzle(DATABASE_URL);
export const checkConnection = async () => {
  try {
    await db.execute("select 1");
    console.log("DB connected!");
  } catch (err) {
    throw new Error("Database tidak terhubung");
  }
};
