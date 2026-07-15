import { error } from "./response.js";

export const handleValidation = (result, c) => {
  if (!result.success) {
    return error(c, result.error.issues[0].message);
  }
};
