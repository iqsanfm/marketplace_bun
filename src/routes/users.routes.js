import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  createUserSchema,
  userIdParamSchema,
  loginUserSchema,
  editUserByIdSchema,
  editUserRoleSchema,
  getUserQuerySchema,
  changePasswordSchema,
} from "../validators/user.validator.js";

import {
  updateMyProfile,
  updateUserRole,
  listUsers,
  handleLogin,
  handleRegister,
  userById,
  handlePasswordChange,
  myProfile,
} from "../controllers/user.controllers";

import { handleValidation } from "../utils/handle-validation.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const userRoute = new Hono();

userRoute.post(
  "/register",
  zValidator("json", createUserSchema, handleValidation),
  handleRegister,
);

userRoute.post(
  "/login",
  zValidator("json", loginUserSchema, handleValidation),
  handleLogin,
);

userRoute.use("*", authMiddleware);

userRoute.get(
  "/",
  zValidator("query", getUserQuerySchema, handleValidation),
  listUsers,
);

userRoute.get("/me", myProfile);

userRoute.patch(
  "/me/password",
  zValidator("json", changePasswordSchema, handleValidation),
  handlePasswordChange,
);

userRoute.patch(
  "/:id/role",
  zValidator("param", userIdParamSchema, handleValidation),
  zValidator("json", editUserRoleSchema, handleValidation),
  updateUserRole,
);

userRoute.patch(
  "/me",
  zValidator("json", editUserByIdSchema, handleValidation),
  updateMyProfile,
);

userRoute.get(
  "/:id",
  zValidator("param", userIdParamSchema, handleValidation),
  userById,
);

export default userRoute;
