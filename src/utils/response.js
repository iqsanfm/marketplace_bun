// utils/response.js
export const success = (c, data, status = 200) =>
  c.json({ success: true, data }, status);

export const error = (c, message, status = 400) =>
  c.json({ success: false, error: message }, status);
