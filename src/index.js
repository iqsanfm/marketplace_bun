import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";

import { checkConnection } from "./db/database.connection";
import { error } from "./utils/response.js";

import userRoute from "./routes/users.routes.js";
import productRoute from "./routes/product.routes.js";
import transactionRoute from "./routes/transaction.routes.js";
import memberRoute from "./routes/members.routes.js";

const app = new Hono();
const PORT = Bun.env.PORT;

await checkConnection();

app.use("*", cors());

app.route("/users", userRoute);

app.route("/member", memberRoute);

app.route("/product", productRoute);

app.route("/transactions", transactionRoute);

// Default Hono balas teks polos ("404 Not Found", "Malformed JSON ...");
// disamakan ke envelope JSON + bahasa Indonesia.
app.notFound((c) => error(c, "Endpoint tidak ditemukan", 404));
app.onError((err, c) => {
  if (err instanceof HTTPException && err.status < 500)
    return error(c, "Format data yang dikirim tidak valid", err.status);
  console.error(err);
  return error(c, "Terjadi kesalahan pada server, coba lagi nanti", 500);
});

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

export default {
  port: PORT,
  // Satu-satunya endpoint yang terima upload cuma import CSV (dibatasi 2 MB di
  // controller). Sisanya JSON kecil, jadi 5 MB kelewat longgar pun aman.
  maxRequestBodySize: 5 * 1024 * 1024,
  fetch: app.fetch,
};
