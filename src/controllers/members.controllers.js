import { success, error } from "../utils/response";
import {
  registerMember,
  getAllMembers,
  getMemberById,
  editMemberById,
  deleteMemberById,
} from "../services/members.service";

export const handleRegisterMember = async (c) => {
  try {
    const body = c.req.valid("json");
    const member = await registerMember(body);
    return success(c, member, 201);
  } catch (err) {
    return error(c, err.message);
  }
};

export const listMembers = async (c) => {
  try {
    const query = c.req.valid("query");
    const members = await getAllMembers(query);
    return success(c, members);
  } catch (err) {
    return error(c, err.message);
  }
};

export const memberById = async (c) => {
  try {
    const id = c.req.param("id");
    const member = await getMemberById(id);
    return success(c, member);
  } catch (err) {
    return error(c, err.message, err.status ?? 400);
  }
};

export const updateMember = async (c) => {
  try {
    const id = c.req.param("id");
    const body = c.req.valid("json");
    const member = await editMemberById(id, body);
    return success(c, member);
  } catch (err) {
    return error(c, err.message, err.status ?? 400);
  }
};

export const removeMember = async (c) => {
  try {
    const id = c.req.param("id");
    const member = await deleteMemberById(id);
    return success(c, member);
  } catch (err) {
    return error(c, err.message, err.status ?? 400);
  }
};
