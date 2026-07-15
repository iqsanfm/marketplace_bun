import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  createUserSchema,
  userIdParamSchema,
  loginUserSchema,
  editUserByIdSchema,
  editUserRoleSchema,
  getUserQuerySchema,
} from "../validators/user.validator.js";

import {
  editUserById,
  editUserRole,
  listUsers,
  loginUser,
  registerUser,
  userById,
} from "../controllers/user.controllers";

import { handleValidation } from "../utils/handle-validation.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const userRoute = new Hono();

userRoute.post(
  "/register",
  zValidator("json", createUserSchema, handleValidation),
  registerUser,
);

userRoute.post(
  "/login",
  zValidator("json", loginUserSchema, handleValidation),
  loginUser,
);

userRoute.use("*", authMiddleware);

userRoute.get(
  "/",
  zValidator("query", getUserQuerySchema, handleValidation),
  listUsers,
);

userRoute.patch(
  "/:id",
  zValidator("param", userIdParamSchema, handleValidation),
  zValidator("json", editUserRoleSchema, handleValidation),
  editUserRole,
);

userRoute.patch(
  "/:id",
  zValidator("param", userIdParamSchema, handleValidation),
  zValidator("json", editUserByIdSchema, handleValidation),
  editUserById,
);

userRoute.get(
  "/:id",
  zValidator("param", userIdParamSchema, handleValidation),
  userById,
);

export default userRoute;
