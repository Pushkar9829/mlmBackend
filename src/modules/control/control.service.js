import { ApiError } from "../../utils/api-error.js";
import { auditService } from "../audit/audit.service.js";
import { Order } from "../orders/order.model.js";
import { LedgerLine } from "../compensation/compensation.model.js";
import { KycDocument } from "../kyc/kyc.model.js";
import { notify } from "./notification.service.js";
import { FraudCase } from "./fraud.model.js";
import { Campaign, Grievance } from "./control.model.js";

export const controlService = {
  async campaigns() {
    const rows = await Campaign.find().populate("product", "name sku").sort({ startsOn: -1 });
    return rows.map(presentCampaign);
  },
  async saveCampaign(actor, fields, id) {
    const row = id ? await Campaign.findByIdAndUpdate(id, fields, { new: true }) : await Campaign.create(fields);
    if (!row) throw new ApiError(404, "Campaign not found.");
    await auditService.record({
      actor: actor.id,
      actorEmail: actor.email,
      action: id ? "campaign.updated" : "campaign.created",
      entity: "campaign",
      entityId: String(row._id),
      after: { name: row.name, status: row.status },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    return presentCampaign(row);
  },
  async removeCampaign(actor, id) {
    const row = await Campaign.findByIdAndDelete(id);
    if (!row) throw new ApiError(404, "Campaign not found.");
    await auditService.record({
      actor: actor.id,
      actorEmail: actor.email,
      action: "campaign.deleted",
      entity: "campaign",
      entityId: String(id),
      before: { name: row.name },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
  },
  async fraudList() {
    const rows = await FraudCase.find().populate("user", "name email").sort({ createdAt: -1 });
    return rows.map((row) => ({
      id: String(row._id),
      userId: String(row.user?._id || row.user),
      userName: row.user?.name || "",
      userEmail: row.user?.email || "",
      pattern: row.pattern,
      status: row.status,
      note: row.note,
      createdAt: row.createdAt,
    }));
  },
  async reviewFraud(actor, id, { status, note }) {
    const row = await FraudCase.findById(id);
    if (!row) throw new ApiError(404, "Fraud review not found.");
    const before = row.status;
    row.status = status;
    if (note) row.note = note;
    await row.save();
    await auditService.record({
      actor: actor.id,
      actorEmail: actor.email,
      action: "fraud.reviewed",
      entity: "fraud",
      entityId: String(row._id),
      before: { status: before },
      after: { status },
      reason: note || "",
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    return { id: String(row._id), status };
  },
  async updateFraud(actor, id, fields) {
    const row = await FraudCase.findByIdAndUpdate(id, fields, { new: true });
    if (!row) throw new ApiError(404, "Fraud review not found.");
    await auditService.record({ actor: actor.id, actorEmail: actor.email, action: "fraud.updated", entity: "fraud", entityId: String(id), after: fields, ip: actor.ip, userAgent: actor.userAgent });
    return { id: String(row._id) };
  },
  async removeFraud(actor, id) {
    const row = await FraudCase.findByIdAndDelete(id);
    if (!row) throw new ApiError(404, "Fraud review not found.");
    await auditService.record({ actor: actor.id, actorEmail: actor.email, action: "fraud.deleted", entity: "fraud", entityId: String(id), before: { pattern: row.pattern }, ip: actor.ip, userAgent: actor.userAgent });
  },
  async grievances(actor) {
    const query = actor.permissions.includes("grievances.review") && actor.role !== "customer" && actor.role !== "partner"
      ? {}
      : { user: actor.id };
    const rows = await Grievance.find(query).populate("user", "name email").sort({ createdAt: -1 });
    return rows.map(presentGrievance);
  },
  async openGrievance(actor, fields) {
    const row = await Grievance.create({ ...fields, user: actor.id, status: "open" });
    return presentGrievance(row);
  },
  async reviewGrievance(actor, id, { status, response }) {
    const row = await Grievance.findById(id).populate("user", "name email");
    if (!row) throw new ApiError(404, "Grievance not found.");
    row.status = status;
    row.response = response || row.response;
    await row.save();
    await notify(row.user._id, "Grievance updated", row.response || `Status is now ${status}.`);
    return presentGrievance(row);
  },
  async removeGrievance(actor, id) {
    const row = await Grievance.findById(id);
    if (!row) throw new ApiError(404, "Grievance not found.");
    const reviewer = actor.permissions.includes("grievances.review") && !["customer", "partner"].includes(actor.role);
    const owner = String(row.user) === String(actor.id);
    if (!reviewer && !(owner && row.status === "open")) throw new ApiError(403, "You cannot delete this grievance.");
    await row.deleteOne();
    await auditService.record({
      actor: actor.id,
      actorEmail: actor.email,
      action: "grievance.deleted",
      entity: "grievance",
      entityId: String(id),
      before: { subject: row.subject, status: row.status },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
  },
  async report() {
    const [orders, paid, refunded, ledger, openKyc, openGrievances] = await Promise.all([
      Order.countDocuments(),
      Order.aggregate([{ $match: { status: { $in: ["paid", "packed", "shipped", "delivered"] } } }, { $group: { _id: null, total: { $sum: "$total" } } }]),
      Order.countDocuments({ status: "refunded" }),
      LedgerLine.aggregate([{ $group: { _id: "$type", net: { $sum: "$net" }, count: { $sum: 1 } } }]),
      KycDocument.countDocuments({ status: { $in: ["submitted", "in_review"] } }),
      Grievance.countDocuments({ status: { $ne: "closed" } }),
    ]);
    return {
      orders,
      salesTotal: paid[0]?.total || 0,
      refunded,
      commissionByType: ledger.map((row) => ({ type: row._id, net: row.net, count: row.count })),
      kycWaiting: openKyc,
      openGrievances,
    };
  },
};

function presentCampaign(row) {
  return {
    id: String(row._id),
    name: row.name,
    productId: row.product?._id ? String(row.product._id) : (row.product ? String(row.product) : null),
    productName: row.product?.name || "",
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    budget: row.budget,
    awardAmount: row.awardAmount,
    spent: row.spent,
    status: row.status,
  };
}

function presentGrievance(row) {
  return {
    id: String(row._id),
    userId: String(row.user?._id || row.user),
    userName: row.user?.name || "",
    subject: row.subject,
    message: row.message,
    status: row.status,
    response: row.response,
    createdAt: row.createdAt,
  };
}
