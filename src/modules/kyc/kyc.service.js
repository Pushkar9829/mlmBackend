import { ApiError } from "../../utils/api-error.js";
import { auditService } from "../audit/audit.service.js";
import { refreshPartnerProgress } from "../partners/partner.service.js";
import { notify } from "../control/notification.service.js";
import { kycRepo } from "./kyc.repo.js";

function present(row) {
  return {
    id: String(row._id),
    userId: String(row.user?._id || row.user),
    name: row.user?.name || "",
    email: row.user?.email || "",
    kind: row.kind,
    status: row.status,
    referenceNumber: row.referenceNumber,
    reviewNote: row.reviewNote,
    expiresAt: row.expiresAt,
  };
}

export const kycService = {
  async list(actor) {
    if (actor.role === "partner") {
      const rows = await kycRepo.listByUser(actor.id);
      return rows.map(present);
    }
    const rows = await kycRepo.listAll();
    return rows.map(present);
  },

  async submit(actor, kind, referenceNumber) {
    let doc = await kycRepo.findByUserAndKind(actor.id, kind);
    if (!doc) doc = await kycRepo.create({ user: actor.id, kind, status: "not_started" });
    doc.referenceNumber = referenceNumber;
    doc.status = "submitted";
    doc.reviewNote = "";
    await doc.save();
    await refreshPartnerProgress(actor.id);
    await auditService.record({
      actor: actor.id,
      actorEmail: actor.email,
      action: "kyc.submitted",
      entity: "kyc",
      entityId: String(doc._id),
      after: { kind, status: "submitted" },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    return present(doc);
  },

  async review(actor, id, { status, reviewNote }) {
    const doc = await kycRepo.findById(id);
    if (!doc) throw new ApiError(404, "KYC document not found.");
    const before = doc.status;
    doc.status = status;
    doc.reviewNote = reviewNote || "";
    await doc.save();
    await refreshPartnerProgress(doc.user._id || doc.user);
    await auditService.record({
      actor: actor.id,
      actorEmail: actor.email,
      action: "kyc.reviewed",
      entity: "kyc",
      entityId: String(doc._id),
      before: { status: before },
      after: { status },
      reason: reviewNote || "",
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    await notify(doc.user._id || doc.user, "KYC updated", `Your ${doc.kind} document is now ${status}.`);
    return present(await kycRepo.findById(id));
  },

  async update(actor, id, fields) {
    const doc = await kycRepo.findById(id);
    if (!doc) throw new ApiError(404, "KYC document not found.");
    doc.status = fields.status;
    doc.referenceNumber = fields.referenceNumber || "";
    doc.reviewNote = fields.reviewNote || "";
    await doc.save();
    await auditService.record({
      actor: actor.id, actorEmail: actor.email, action: "kyc.updated", entity: "kyc", entityId: String(id),
      after: { status: doc.status, kind: doc.kind }, ip: actor.ip, userAgent: actor.userAgent,
    });
    return present(doc);
  },

  async remove(actor, id) {
    const doc = await kycRepo.findById(id);
    if (!doc) throw new ApiError(404, "KYC document not found.");
    await doc.deleteOne();
    await auditService.record({
      actor: actor.id, actorEmail: actor.email, action: "kyc.deleted", entity: "kyc", entityId: String(id),
      before: { kind: doc.kind, status: doc.status }, ip: actor.ip, userAgent: actor.userAgent,
    });
  },
};
