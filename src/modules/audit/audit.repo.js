import { AuditLog } from "./audit.model.js";

export const auditRepo = {
  create(entry) {
    return AuditLog.create(entry);
  },
  search({ action, actorEmail, from, to, skip, limit }) {
    const query = {};
    if (action) query.action = action;
    if (actorEmail) query.actorEmail = actorEmail.toLowerCase();
    if (from || to) {
      query.at = {};
      if (from) query.at.$gte = from;
      if (to) query.at.$lte = to;
    }
    return Promise.all([
      AuditLog.find(query).sort({ at: -1 }).skip(skip).limit(limit),
      AuditLog.countDocuments(query),
    ]);
  },
};
