import { requestMeta } from "./request-meta.js";

export function actorFrom(req) {
  return {
    id: req.user._id,
    email: req.user.email,
    role: req.user.role?.code || "",
    permissions: req.user.role?.permissions || [],
    ...requestMeta(req),
  };
}

export function hasPermission(actor, code) {
  return actor.permissions?.includes(code);
}
