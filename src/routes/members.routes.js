import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

import {
  handleRegisterMember,
  listMembers,
  memberById,
  updateMember,
  removeMember,
} from "../controllers/members.controllers";

import {
  registerMemberSchema,
  getMemberByIdSchema,
  editMemberByIdSchema,
  getMemberQuerySchema,
} from "../validators/member.validator";
import { handleValidation } from "../utils/handle-validation";
import { authMiddleware, requireRole } from "../middlewares/auth.middleware";

const memberRoute = new Hono();

memberRoute.use("*", authMiddleware);
// Member urusan penjualan. Packaging & gudang tidak ada urusan dengan data pembeli.
memberRoute.use("*", requireRole("admin", "kasir", "admin_online"));

memberRoute.post(
  "/register",
  zValidator("json", registerMemberSchema, handleValidation),
  handleRegisterMember,
);

memberRoute.get(
  "/",
  zValidator("query", getMemberQuerySchema, handleValidation),
  listMembers,
);

memberRoute.get(
  "/:id",
  zValidator("param", getMemberByIdSchema, handleValidation),
  memberById,
);

memberRoute.patch(
  "/:id",
  zValidator("param", getMemberByIdSchema, handleValidation),
  zValidator("json", editMemberByIdSchema, handleValidation),
  updateMember,
);

memberRoute.delete(
  "/:id",
  zValidator("param", getMemberByIdSchema, handleValidation),
  removeMember,
);

export default memberRoute;
