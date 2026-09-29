import { ApiError } from "../../utils/api-error.js";
import { AuditLog } from "./audit.model.js";
import { auditRepo } from "./audit.repo.js";

export const auditService = {
  async record(entry) {
    return auditRepo.create({
      actor: entry.actor || null,
      actorEmail: (entry.actorEmail || "").toLowerCase(),
      action: entry.action,
      entity: entry.entity || "",
      entityId: entry.entityId || "",
      before: entry.before ?? null,
      after: entry.after ?? null,
      reason: entry.reason || "",
      ip: entry.ip || "",
      userAgent: entry.userAgent || "",
      at: new Date(),
    });
  },

  async list({ action, actorEmail, from, to, page, limit }) {
    const safeLimit = Math.min(Math.max(limit || 20, 1), 100);
    const safePage = Math.max(page || 1, 1);
    const skip = (safePage - 1) * safeLimit;
    const [rows, total] = await auditRepo.search({
      action: action || "",
      actorEmail: actorEmail || "",
      from: startOfDay(from),
      to: endOfDay(to),
      skip,
      limit: safeLimit,
    });
    return {
      data: rows.map(presentAudit),
      page: safePage,
      limit: safeLimit,
      total,
    };
  },

  async update(actor, id, { reason }) {
    if (actor.role !== "admin") throw new ApiError(403, "Only an administrator can edit the audit log.");
    const row = await AuditLog.findByIdAndUpdate(id, { reason }, { new: true });
    if (!row) throw new ApiError(404, "Audit line not found.");
    return { id: String(row._id) };
  },

  async remove(actor, id) {
    if (actor.role !== "admin") throw new ApiError(403, "Only an administrator can delete an audit line.");
    const row = await AuditLog.findByIdAndDelete(id);
    if (!row) throw new ApiError(404, "Audit line not found.");
    return { id: String(id) };
  },
};

function startOfDay(value) {
  if (!value) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function endOfDay(value) {
  if (!value) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T23:59:59.999`) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function presentAudit(row) {
  return {
    id: String(row._id),
    actorId: row.actor ? String(row.actor) : null,
    actorEmail: row.actorEmail,
    action: row.action,
    entity: row.entity,
    entityId: row.entityId,
    before: row.before,
    after: row.after,
    reason: row.reason,
    ip: row.ip,
    userAgent: row.userAgent,
    at: row.at,
  };
}
