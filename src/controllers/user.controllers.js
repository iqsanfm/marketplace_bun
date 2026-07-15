import {
  getAllUsers,
  registerUser as registerUserService,
  loginUser as loginUserService,
  editUserById as editUserByIdService,
  editUserRole as editUserRoleService,
  getUserById,
} from "../services/user.service";
import { success, error } from "../utils/response";

export const registerUser = async (c) => {
  try {
    const body = c.req.valid("json");
    const user = await registerUserService(body);
    return success(c, user, 201);
  } catch (err) {
    return error(c, err.message);
  }
};

export const loginUser = async (c) => {
  try {
    const body = c.req.valid("json");
    const user = await loginUserService(body);
    return success(c, user, 201);
  } catch (err) {
    return error(c, err.message);
  }
};

export const listUsers = async (c) => {
  try {
    const query = c.req.valid("query");
    const users = await getAllUsers(query);
    return success(c, users);
  } catch (err) {
    return error(c, err.message);
  }
};

export const userById = async (c) => {
  try {
    const id = c.req.param("id");
    const user = await getUserById(id);
    return success(c, user);
  } catch (err) {
    return error(c, err.message, err.status ?? 400);
  }
};

export const editUserRole = async (c) => {
  try {
    const loggedInUser = c.get("user");
    const id = c.req.param("id");

    if (loggedInUser.role !== "admin") {
      return error(c, "Tidak boleh mengedit selain Admin", 403);
    }

    const body = c.req.valid("json");
    const user = await editUserRoleService(id, body);
    return success(c, user);
  } catch (err) {
    return error(c, err.message, err.status ?? 400);
  }
};

export const editUserById = async (c) => {
  try {
    const loggedInUser = c.get("user");
    const id = c.req.param("id");

    if (loggedInUser.id !== id) {
      return error(c, "Tidak boleh mengedit user lain", 403);
    }
    const body = c.req.valid("json");
    const user = await editUserByIdService(id, body);
    return success(c, user);
  } catch (err) {
    return error(c, err.message, err.status ?? 400);
  }
};
