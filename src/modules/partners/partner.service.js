import { ApiError } from "../../utils/api-error.js";
import { auditService } from "../audit/audit.service.js";
import { Order } from "../orders/order.model.js";
import { User } from "../users/user.model.js";
import { kycRepo } from "../kyc/kyc.repo.js";
import { agreementRepo, partnerRepo } from "./partner.repo.js";
import { Partner } from "./partner.model.js";

const KINDS = ["identity", "address", "bank", "tax"];

function maskAccount(value) {
  if (!value) return "";
  const last = value.slice(-4);
  return `${"•".repeat(Math.max(value.length - 4, 0))}${last}`;
}

export function presentPartner(row, { revealBank = false } = {}) {
  return {
    id: String(row._id),
    userId: String(row.user?._id || row.user),
    name: row.user?.name || "",
    email: row.user?.email || "",
    accountStatus: row.user?.status || "",
    phone: row.phone,
    addressLine: row.addressLine,
    city: row.city,
    state: row.state,
    pincode: row.pincode,
    sponsor: row.sponsor ? { id: String(row.sponsor._id || row.sponsor), name: row.sponsor.name || "", email: row.sponsor.email || "" } : null,
    sponsorLocked: row.sponsorLocked,
    applicationStatus: row.applicationStatus,
    bankAccountName: row.bankAccountName,
    bankAccountNumber: revealBank ? row.bankAccountNumber : maskAccount(row.bankAccountNumber),
    bankIfsc: row.bankIfsc,
    bankVerified: row.bankVerified,
    taxId: row.taxId,
    nomineeName: row.nomineeName,
    nomineeRelation: row.nomineeRelation,
    agreementVersion: row.agreementVersion,
    agreementAcceptedAt: row.agreementAcceptedAt,
    placementParent: row.placementParent ? { id: String(row.placementParent._id || row.placementParent), name: row.placementParent.name || "" } : null,
    placementSide: row.placementSide,
    placementLocked: row.placementLocked,
    carryLeft: row.carryLeft,
    carryRight: row.carryRight,
    currentRank: row.currentRank,
  };
}

async function ensureDocs(userId) {
  for (const kind of KINDS) {
    const existing = await kycRepo.findByUserAndKind(userId, kind);
    if (!existing) {
      await kycRepo.create({ user: userId, kind, status: "not_started" });
    }
  }
}

export const partnerService = {
  async list(actor) {
    if (actor.role === "partner") {
      const own = await partnerRepo.findByUser(actor.id);
      return own ? [presentPartner(own, { revealBank: true })] : [];
    }
    const rows = await partnerRepo.list();
    return rows.map((row) => presentPartner(row, { revealBank: false }));
  },

  async saveMine(actor, fields) {
    let partner = await partnerRepo.findByUser(actor.id);
    if (!partner) {
      partner = await partnerRepo.create({ user: actor.id, applicationStatus: "applied" });
      await ensureDocs(actor.id);
      partner = await partnerRepo.findByUser(actor.id);
    }
    if (partner.sponsorLocked) {
      delete fields.sponsorEmail;
    }
    if (fields.sponsorEmail) {
      const sponsorUser = await User.findOne({ email: fields.sponsorEmail.toLowerCase() });
      if (!sponsorUser) throw new ApiError(400, "Sponsor account was not found.");
      const sponsorPartner = await partnerRepo.findByUser(sponsorUser._id);
      if (!sponsorPartner || sponsorPartner.applicationStatus !== "active") {
        throw new ApiError(400, "The sponsor must be an active partner.");
      }
      partner.sponsor = sponsorUser._id;
    }
    for (const key of ["phone", "addressLine", "city", "state", "pincode", "bankAccountName", "bankAccountNumber", "bankIfsc", "taxId", "nomineeName", "nomineeRelation"]) {
      if (fields[key] === undefined) continue;
      if (key === "bankAccountNumber" && fields[key] === "" && partner.bankAccountNumber) continue;
      partner[key] = fields[key];
    }
    if (partner.applicationStatus === "applied") partner.applicationStatus = "kyc_pending";
    await partnerRepo.save(partner);
    await auditService.record({
      actor: actor.id,
      actorEmail: actor.email,
      action: "partner.application_saved",
      entity: "partner",
      entityId: String(partner._id),
      after: { applicationStatus: partner.applicationStatus },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    return presentPartner(await partnerRepo.findByUser(actor.id), { revealBank: true });
  },

  async saveFor(actor, userId, fields) {
    const partner = await partnerRepo.findByUser(userId);
    if (!partner) throw new ApiError(404, "Partner application not found.");
    if (!partner.sponsorLocked && fields.sponsorEmail) {
      const sponsorUser = await User.findOne({ email: fields.sponsorEmail.toLowerCase() });
      if (!sponsorUser) throw new ApiError(400, "Sponsor account was not found.");
      partner.sponsor = sponsorUser._id;
    }
    for (const key of ["phone", "addressLine", "city", "state", "pincode", "bankAccountName", "bankAccountNumber", "bankIfsc", "taxId", "nomineeName", "nomineeRelation"]) {
      if (fields[key] === undefined) continue;
      if (key === "bankAccountNumber" && !fields[key]) continue;
      partner[key] = fields[key];
    }
    await partnerRepo.save(partner);
    await auditService.record({
      actor: actor.id,
      actorEmail: actor.email,
      action: "partner.application_saved",
      entity: "partner",
      entityId: String(partner._id),
      after: { applicationStatus: partner.applicationStatus },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    return presentPartner(await partnerRepo.findByUser(userId), { revealBank: false });
  },

  async remove(actor, userId) {
    const partner = await partnerRepo.findByUser(userId);
    if (!partner) throw new ApiError(404, "Partner application not found.");
    const blocked = await Partner.exists({ $or: [{ sponsor: userId }, { placementParent: userId }] });
    if (blocked) throw new ApiError(409, "This partner still has people under them, so the profile cannot be deleted.");
    const orders = await Order.exists({ attributedPartner: userId });
    if (orders) throw new ApiError(409, "This partner is on an order, so the profile cannot be deleted.");
    await Partner.deleteOne({ _id: partner._id });
    await auditService.record({
      actor: actor.id,
      actorEmail: actor.email,
      action: "partner.deleted",
      entity: "partner",
      entityId: String(partner._id),
      before: { email: partner.user?.email || "" },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
  },

  async acceptAgreement(actor) {
    const partner = await partnerRepo.findByUser(actor.id);
    if (!partner) throw new ApiError(400, "Save the partner application first.");
    const agreement = await agreementRepo.active();
    if (!agreement) throw new ApiError(400, "No agreement is published.");
    partner.agreementVersion = agreement.version;
    partner.agreementAcceptedAt = new Date();
    await partnerRepo.save(partner);
    await refreshPartnerProgress(actor.id);
    await auditService.record({
      actor: actor.id,
      actorEmail: actor.email,
      action: "partner.agreement_accepted",
      entity: "partner",
      entityId: String(partner._id),
      after: { version: agreement.version },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    return {
      partner: presentPartner(await partnerRepo.findByUser(actor.id), { revealBank: true }),
      agreement: { version: agreement.version, title: agreement.title, body: agreement.body },
    };
  },

  async currentAgreement() {
    const agreement = await agreementRepo.active();
    if (!agreement) return null;
    return { version: agreement.version, title: agreement.title, body: agreement.body };
  },

  async review(actor, userId, { applicationStatus, reason }) {
    const partner = await partnerRepo.findByUser(userId);
    if (!partner) throw new ApiError(404, "Partner application not found.");
    if (applicationStatus === "active") {
      throw new ApiError(400, "A partner becomes active when the first qualifying order is delivered.");
    }
    const before = partner.applicationStatus;
    partner.applicationStatus = applicationStatus;
    if (applicationStatus === "active") {
      partner.sponsorLocked = true;
      partner.placementLocked = true;
    }
    await partnerRepo.save(partner);
    await auditService.record({
      actor: actor.id,
      actorEmail: actor.email,
      action: "partner.application_reviewed",
      entity: "partner",
      entityId: String(partner._id),
      before: { applicationStatus: before },
      after: { applicationStatus },
      reason,
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    return presentPartner(await partnerRepo.findByUser(userId));
  },
};

export async function refreshPartnerProgress(userId) {
  const partner = await partnerRepo.findByUser(userId);
  if (!partner || partner.applicationStatus === "active") return partner;
  const docs = await kycRepo.listByUser(userId);
  const rejected = docs.some((doc) => doc.status === "rejected");
  const verified = KINDS.every((kind) => docs.some((doc) => doc.kind === kind && doc.status === "verified"));
  if (rejected) partner.applicationStatus = "kyc_rejected";
  else if (!verified) partner.applicationStatus = "kyc_pending";
  else if (!partner.agreementAcceptedAt) partner.applicationStatus = "agreement_pending";
  else partner.applicationStatus = "pending_first_order";
  const bank = docs.find((doc) => doc.kind === "bank");
  partner.bankVerified = bank?.status === "verified";
  await partnerRepo.save(partner);
  return partner;
}
