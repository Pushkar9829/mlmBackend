import { ApiError } from "../../utils/api-error.js";
import { auditService } from "../audit/audit.service.js";
import { compensationRepo } from "../compensation/compensation.repo.js";
import { notify } from "../control/notification.service.js";
import { partnerRepo } from "../partners/partner.repo.js";
import { Dispute, Payout } from "./wallet.model.js";

async function reserved(userId) {
  const rows = await Payout.find({ user: userId, status: { $in: ["requested", "approved", "paid"] } });
  return rows.reduce((sum, row) => sum + row.amount, 0);
}

function presentPayout(row) {
  return {
    id: String(row._id),
    userId: String(row.user?._id || row.user),
    userName: row.user?.name || "",
    amount: row.amount,
    status: row.status,
    reason: row.reason,
    createdAt: row.createdAt,
  };
}

export const walletService = {
  async summary(actor, userId) {
    const target = actor.role === "partner" ? actor.id : (userId || actor.id);
    const payable = await compensationRepo.payableTotal(target);
    const used = await reserved(target);
    const payouts = await Payout.find(actor.role === "partner" ? { user: actor.id } : {}).populate("user", "name email").sort({ createdAt: -1 }).limit(50);
    const disputes = await Dispute.find(actor.role === "partner" ? { user: actor.id } : {}).sort({ createdAt: -1 }).limit(50);
    return {
      payable,
      reserved: used,
      available: Math.round((payable - used) * 100) / 100,
      payouts: payouts.map(presentPayout),
      disputes: disputes.map((row) => ({
        id: String(row._id),
        userId: String(row.user),
        ledgerLineId: String(row.ledgerLine),
        reason: row.reason,
        status: row.status,
        resolution: row.resolution,
      })),
    };
  },

  async requestPayout(actor, amount) {
    const partner = await partnerRepo.findByUser(actor.id);
    if (!partner?.bankVerified) throw new ApiError(400, "Bank details must be verified before a payout.");
    const plan = await compensationRepo.activePlan();
    const minimum = plan?.payoutMinimum || 500;
    if (amount < minimum) throw new ApiError(400, `The minimum payout is ${minimum}.`);
    const view = await this.summary(actor);
    if (amount > view.available) throw new ApiError(400, "That amount is above the available balance.");
    const payout = await Payout.create({ user: actor.id, amount, status: "requested" });
    await auditService.record({
      actor: actor.id,
      actorEmail: actor.email,
      action: "payout.requested",
      entity: "payout",
      entityId: String(payout._id),
      after: { amount },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    return presentPayout(payout);
  },

  async reviewPayout(actor, id, { status, reason }) {
    const payout = await Payout.findById(id);
    if (!payout) throw new ApiError(404, "Payout not found.");
    const before = payout.status;
    payout.status = status;
    payout.reason = reason || "";
    await payout.save();
    await auditService.record({
      actor: actor.id,
      actorEmail: actor.email,
      action: "payout.reviewed",
      entity: "payout",
      entityId: String(payout._id),
      before: { status: before },
      after: { status },
      reason: reason || "",
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    await notify(payout.user, "Payout updated", `Your payout is now ${status}.`);
    return presentPayout(payout);
  },

  async openDispute(actor, { ledgerLineId, reason }) {
    const line = await compensationRepo.findLine(ledgerLineId);
    if (!line) throw new ApiError(404, "Commission line not found.");
    if (actor.role === "partner" && String(line.user) !== String(actor.id)) {
      throw new ApiError(403, "You can dispute only your own commission.");
    }
    const dispute = await Dispute.create({ user: line.user, ledgerLine: line._id, reason, status: "open" });
    return { id: String(dispute._id), status: dispute.status };
  },

  async reviewDispute(actor, id, { status, resolution }) {
    const dispute = await Dispute.findById(id);
    if (!dispute) throw new ApiError(404, "Dispute not found.");
    dispute.status = status;
    dispute.resolution = resolution || "";
    await dispute.save();
    if (status === "approved") {
      const line = await compensationRepo.findLine(dispute.ledgerLine);
      if (line) {
        await compensationRepo.addLedger({
          user: line.user,
          period: line.period,
          order: line.order,
          type: "dispute_adjustment",
          sourceUser: line.sourceUser,
          planVersion: line.planVersion,
          commissionBase: line.commissionBase,
          baseAmount: line.baseAmount,
          rate: line.rate,
          gross: 0,
          adjustment: -line.net,
          withholding: 0,
          net: -line.net,
          status: "payable",
          reversalOf: line._id,
          note: resolution || "Dispute adjustment",
        });
      }
    }
    await auditService.record({
      actor: actor.id,
      actorEmail: actor.email,
      action: "dispute.reviewed",
      entity: "dispute",
      entityId: String(dispute._id),
      after: { status },
      reason: resolution || "",
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    return { id: String(dispute._id), status };
  },

  async updatePayout(actor, id, fields) {
    const row = await Payout.findByIdAndUpdate(id, fields, { new: true });
    if (!row) throw new ApiError(404, "Payout not found.");
    await auditService.record({ actor: actor.id, actorEmail: actor.email, action: "payout.updated", entity: "payout", entityId: String(id), after: fields, ip: actor.ip, userAgent: actor.userAgent });
    return { id: String(row._id) };
  },
  async removePayout(actor, id) {
    const row = await Payout.findByIdAndDelete(id);
    if (!row) throw new ApiError(404, "Payout not found.");
    await auditService.record({ actor: actor.id, actorEmail: actor.email, action: "payout.deleted", entity: "payout", entityId: String(id), before: { amount: row.amount, status: row.status }, ip: actor.ip, userAgent: actor.userAgent });
  },
  async updateDispute(actor, id, fields) {
    const row = await Dispute.findByIdAndUpdate(id, fields, { new: true });
    if (!row) throw new ApiError(404, "Dispute not found.");
    await auditService.record({ actor: actor.id, actorEmail: actor.email, action: "dispute.updated", entity: "dispute", entityId: String(id), after: fields, ip: actor.ip, userAgent: actor.userAgent });
    return { id: String(row._id) };
  },
  async removeDispute(actor, id) {
    const row = await Dispute.findByIdAndDelete(id);
    if (!row) throw new ApiError(404, "Dispute not found.");
    await auditService.record({ actor: actor.id, actorEmail: actor.email, action: "dispute.deleted", entity: "dispute", entityId: String(id), ip: actor.ip, userAgent: actor.userAgent });
  },
};
