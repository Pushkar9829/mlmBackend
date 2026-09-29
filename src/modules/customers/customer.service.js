import { ApiError } from "../../utils/api-error.js";
import { auditService } from "../audit/audit.service.js";
import { compensationRepo } from "../compensation/compensation.repo.js";
import { partnerRepo } from "../partners/partner.repo.js";
import { User } from "../users/user.model.js";
import { Customer } from "./customer.model.js";
import { customerRepo } from "./customer.repo.js";

const DAY = 24 * 60 * 60 * 1000;

function present(row) {
  return {
    id: String(row._id),
    userId: String(row.user?._id || row.user),
    name: row.user?.name || "",
    email: row.user?.email || "",
    status: row.user?.status || "",
    phone: row.phone,
    addressLine: row.addressLine,
    city: row.city,
    state: row.state,
    pincode: row.pincode,
  };
}

export const customerService = {
  async list(actor) {
    if (actor.role === "customer") {
      const own = await customerRepo.findByUser(actor.id);
      return own ? [present(own)] : [];
    }
    const rows = await customerRepo.list();
    return rows.map(present);
  },

  async saveMine(actor, fields) {
    if (actor.role !== "customer" && !actor.permissions.includes("customers.update")) {
      throw new ApiError(403, "You cannot edit this customer profile.");
    }
    const targetId = actor.role === "customer" ? actor.id : actor.id;
    const user = await User.findById(targetId);
    if (!user) throw new ApiError(404, "Account not found.");
    const before = await customerRepo.findByUser(targetId);
    const saved = await customerRepo.upsert(targetId, fields);
    await auditService.record({
      actor: actor.id,
      actorEmail: actor.email,
      action: "customer.profile_saved",
      entity: "customer",
      entityId: String(saved._id),
      before: before ? { phone: before.phone, city: before.city } : null,
      after: { phone: saved.phone, city: saved.city },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    return present(saved);
  },

  async saveFor(actor, userId, fields) {
    if (!actor.permissions.includes("customers.update")) throw new ApiError(403, "You cannot edit this customer profile.");
    const user = await User.findById(userId);
    if (!user) throw new ApiError(404, "Account not found.");
    const before = await customerRepo.findByUser(userId);
    const saved = await customerRepo.upsert(userId, fields);
    await auditService.record({
      actor: actor.id,
      actorEmail: actor.email,
      action: "customer.profile_saved",
      entity: "customer",
      entityId: String(saved._id),
      before: before ? { phone: before.phone, city: before.city } : null,
      after: { phone: saved.phone, city: saved.city },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    return present(await customerRepo.findByUser(userId));
  },

  async remove(actor, userId) {
    if (!actor.permissions.includes("customers.update")) throw new ApiError(403, "You cannot delete this customer profile.");
    const row = await customerRepo.findByUser(userId);
    if (!row) throw new ApiError(404, "Customer profile not found.");
    await Customer.deleteOne({ _id: row._id });
    await auditService.record({
      actor: actor.id,
      actorEmail: actor.email,
      action: "customer.deleted",
      entity: "customer",
      entityId: String(row._id),
      before: { email: row.user?.email || "", city: row.city },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
  },

  async link(actor) {
    const row = await customerRepo.findByUser(actor.id);
    return presentLink(row, await attributionDays());
  },

  async saveLink(actor, partnerEmail) {
    if (actor.role !== "customer") throw new ApiError(403, "Only a customer stores a partner link.");
    const partnerUser = await User.findOne({ email: String(partnerEmail || "").toLowerCase() });
    const profile = partnerUser ? await partnerRepo.findByUser(partnerUser._id) : null;
    if (!profile || profile.applicationStatus !== "active") {
      throw new ApiError(400, "That partner link is not valid.");
    }
    if (String(partnerUser._id) === String(actor.id)) {
      throw new ApiError(400, "You cannot attribute a purchase to yourself.");
    }
    let row = await customerRepo.findByUser(actor.id);
    if (!row) row = await customerRepo.upsert(actor.id, {});
    const same = row.linkPartner && String(row.linkPartner._id || row.linkPartner) === String(partnerUser._id);
    row.linkPartner = partnerUser._id;
    if (!same || !row.linkFirstUsedAt) row.linkFirstUsedAt = new Date();
    await row.save();
    const saved = await customerRepo.findByUser(actor.id);
    return presentLink(saved, await attributionDays());
  },

  async partnerForCheckout(actor, partnerEmail) {
    if (partnerEmail) await this.saveLink(actor, partnerEmail);
    const row = await customerRepo.findByUser(actor.id);
    const days = await attributionDays();
    const view = presentLink(row, days);
    if (!view.active) return null;
    return row.linkPartner?._id || row.linkPartner;
  },
};

async function attributionDays() {
  const plan = await compensationRepo.activePlan();
  return plan?.attributionDays || 30;
}

function presentLink(row, days) {
  if (!row?.linkPartner || !row.linkFirstUsedAt) {
    return { partnerEmail: "", firstUsedAt: null, expiresOn: null, active: false };
  }
  const first = new Date(row.linkFirstUsedAt);
  const expiresOn = new Date(first.getTime() + days * DAY);
  const partner = row.linkPartner;
  return {
    partnerEmail: partner.email || "",
    firstUsedAt: first,
    expiresOn,
    active: Date.now() <= expiresOn.getTime(),
  };
}
