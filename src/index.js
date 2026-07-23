import { Hono } from "hono";
import { cors } from "hono/cors";

import { checkConnection } from "./db/database.connection";

import userRoute from "./routes/users.routes.js";
import productRoute from "./routes/product.routes.js";
import transactionRoute from "./routes/transaction.routes.js";

const app = new Hono();
const PORT = Bun.env.PORT;

await checkConnection();

app.use("*", cors());

app.route("/users", userRoute);

app.route("/product", productRoute);

app.route("/transactions", transactionRoute);

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

export default {
  port: PORT,
  fetch: app.fetch,
};
