import {
  registerUser,
  loginUser,
  logoutUser,
  getAllUsers,
  getUserById,
  editUserRole,
  editUserById,
  changePassword,
} from "../services/user.service";
import { success, error } from "../utils/response";

export const handleRegister = async (c) => {
  try {
    const body = c.req.valid("json");
    const user = await registerUser(body);
    return success(c, user, 201);
  } catch (err) {
    return error(c, err.message);
  }
};

export const handleLogin = async (c) => {
  try {
    const body = c.req.valid("json");
    const user = await loginUser(body);
    return success(c, user, 201);
  } catch (err) {
    return error(c, err.message);
  }
};

export const handleLogout = async (c) => {
  try {
    const result = await logoutUser(c.get("token"));
    return success(c, result);
  } catch (err) {
    return error(c, err.message, err.status ?? 400);
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

export const myProfile = async (c) => {
  const { password, ...user } = c.get("user");
  return success(c, user);
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

export const updateUserRole = async (c) => {
  try {
    const id = c.req.param("id");
    // Kalau admin terakhir menurunkan role dirinya sendiri, tidak ada lagi yang bisa
    // mengembalikan lewat API — harus lewat SQL. Jadi urusan role sendiri ditutup.
    if (id === c.get("user").id) {
      return error(c, "Role sendiri tidak bisa diubah, minta admin lain", 400);
    }
    const body = c.req.valid("json");
    const user = await editUserRole(id, body);
    return success(c, user);
  } catch (err) {
    return error(c, err.message, err.status ?? 400);
  }
};

export const updateMyProfile = async (c) => {
  try {
    const loggedInUser = c.get("user");
    const body = c.req.valid("json");
    const user = await editUserById(loggedInUser.id, body);
    return success(c, user);
  } catch (err) {
    return error(c, err.message, err.status ?? 400);
  }
};

export const handlePasswordChange = async (c) => {
  try {
    const loggedInUser = c.get("user");
    const { currentPassword, newPassword } = c.req.valid("json");
    const result = await changePassword(
      loggedInUser.id,
      currentPassword,
      newPassword,
    );
    return success(c, result);
  } catch (err) {
    return error(c, err.message, err.status ?? 400);
  }
};
