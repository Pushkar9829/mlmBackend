import { ApiError } from "../../utils/api-error.js";
import { auditService } from "../audit/audit.service.js";
import { notify } from "../control/notification.service.js";
import { placeBySpillover } from "../network/network.service.js";
import { partnerRepo } from "../partners/partner.repo.js";
import { Partner } from "../partners/partner.model.js";
import { LedgerLine, Period, RankResult, VolumeEntry } from "./compensation.model.js";
import { compensationRepo } from "./compensation.repo.js";

function presentPlan(plan) {
  if (!plan) return null;
  return {
    id: String(plan._id),
    name: plan.name,
    version: plan.version,
    status: plan.status,
    commissionBase: plan.commissionBase,
    directPercent: plan.directPercent,
    levelPercents: plan.levelPercents,
    binaryMatchPercent: plan.binaryMatchPercent,
    binaryCap: plan.binaryCap,
    minPv: plan.minPv,
    withholdingPercent: plan.withholdingPercent,
    payoutMinimum: plan.payoutMinimum,
    rankRules: plan.rankRules,
  };
}

async function patchRow(actor, Model, id, fields, action) {
  const row = await Model.findByIdAndUpdate(id, fields, { new: true });
  if (!row) throw new ApiError(404, "Record not found.");
  await auditService.record({
    actor: actor.id,
    actorEmail: actor.email,
    action,
    entity: action.split(".")[0],
    entityId: String(id),
    after: fields,
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  return { id: String(row._id) };
}

async function dropRow(actor, Model, id, action) {
  const row = await Model.findByIdAndDelete(id);
  if (!row) throw new ApiError(404, "Record not found.");
  await auditService.record({
    actor: actor.id,
    actorEmail: actor.email,
    action,
    entity: action.split(".")[0],
    entityId: String(id),
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  return { id: String(id) };
}

function moneyLine({ user, period, order, type, sourceUser, plan, baseAmount, rate, gross }) {
  const withholding = Math.round((gross * (plan?.withholdingPercent || 0)) ) / 100;
  const net = Math.round((gross - withholding) * 100) / 100;
  return {
    user,
    period: period?._id || period,
    order: order?._id || order || null,
    type,
    sourceUser: sourceUser || null,
    planVersion: plan?.version || null,
    commissionBase: plan?.commissionBase || "",
    baseAmount,
    rate,
    gross: Math.round(gross * 100) / 100,
    adjustment: 0,
    withholding,
    net,
    status: "calculated",
  };
}

async function ensurePeriod() {
  const open = await compensationRepo.openPeriod();
  if (open) return open;
  const start = new Date();
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  return compensationRepo.createPeriod({ name: `Week of ${start.toISOString().slice(0, 10)}`, startsOn: start, endsOn: end, status: "open" });
}

export const compensationService = {
  async plan() {
    return presentPlan(await compensationRepo.activePlan());
  },

  async savePlan(actor, fields) {
    const latest = await compensationRepo.latestPlan();
    const version = (latest?.version || 0) + 1;
    await compensationRepo.supersedeActive();
    const created = await compensationRepo.createPlan({ ...fields, version, status: "active" });
    await auditService.record({
      actor: actor.id,
      actorEmail: actor.email,
      action: "plan.version_activated",
      entity: "plan",
      entityId: String(created._id),
      after: { version, name: created.name },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    return presentPlan(created);
  },

  async periods() {
    const rows = await compensationRepo.periods();
    return rows.map((row) => ({
      id: String(row._id),
      name: row.name,
      startsOn: row.startsOn,
      endsOn: row.endsOn,
      status: row.status,
      closedAt: row.closedAt,
    }));
  },

  async volume(actor) {
    const query = actor.role === "partner" ? { user: actor.id } : {};
    const rows = await VolumeEntry.find(query).sort({ createdAt: -1 }).limit(100).populate("user", "name email");
    return rows.map(presentVolume);
  },

  async ledger(actor) {
    const rows = actor.role === "partner"
      ? await compensationRepo.linesForUser(actor.id)
      : await compensationRepo.allLines();
    return rows.map(presentLedger);
  },

  async ranks(actor) {
    const plan = await compensationRepo.activePlan();
    if (actor.role === "partner") {
      const row = await compensationRepo.latestRank(actor.id);
      const partner = await partnerRepo.findByUser(actor.id);
      const period = await compensationRepo.openPeriod();
      const personal = period ? await rankPersonal(actor.id, period._id) : 0;
      const leftNew = period ? await compensationRepo.sumVolume({ userId: actor.id, periodId: period._id, kind: "leg", side: "left" }) : 0;
      const rightNew = period ? await compensationRepo.sumVolume({ userId: actor.id, periodId: period._id, kind: "leg", side: "right" }) : 0;
      const left = leftNew + (partner?.carryLeft || 0);
      const right = rightNew + (partner?.carryRight || 0);
      const next = nextRankRule(plan, partner?.currentRank || "starter");
      return {
        currentRank: partner?.currentRank || "starter",
        inGrace: Boolean(partner?.graceRank),
        nextRank: next?.code || null,
        gap: next ? {
          pv: Math.max(0, next.minPv - personal),
          left: Math.max(0, next.minEachLeg - left),
          right: Math.max(0, next.minEachLeg - right),
        } : null,
        history: row ? [presentRank(row)] : [],
      };
    }
    const period = await compensationRepo.openPeriod();
    const history = period ? await compensationRepo.ranksForPeriod(period._id) : [];
    return { currentRank: null, inGrace: false, nextRank: null, gap: null, history: history.map(presentRank) };
  },

  async onDelivered(order) {
    if (order.volumePosted) return;
    const plan = await compensationRepo.activePlan();
    const period = await ensurePeriod();
      const partnerId = order.attributedPartner?._id || order.attributedPartner;
    if (plan && partnerId && order.networkEligible) {
      let partner = await partnerRepo.findByUser(partnerId);
      if (partner) {
        partner = await placeBySpillover(partner) || partner;
        const base = plan.commissionBase === "price" ? order.price * order.qty : order.bv * order.qty;
        await compensationRepo.addVolume({
          user: partnerId,
          order: order._id,
          period: period._id,
          kind: "pv",
          side: "personal",
          amount: order.pv * order.qty,
          status: "posted",
        });
        let current = partner;
        const guard = new Set();
        while (current?.placementParent && !guard.has(String(current.user?._id || current.user))) {
          guard.add(String(current.user?._id || current.user));
          const parentId = current.placementParent?._id || current.placementParent;
          const side = current.placementSide;
          if (parentId && (side === "left" || side === "right")) {
            await compensationRepo.addVolume({
              user: parentId,
              order: order._id,
              period: period._id,
              kind: "leg",
              side,
              amount: order.bv * order.qty,
              status: "posted",
            });
          }
          current = parentId ? await partnerRepo.findByUser(parentId) : null;
        }
        if (order.commissionEligible && order.bonusEligible) {
          let sponsor = await nextEarningSponsor(partner.sponsor?._id || partner.sponsor);
          if (sponsor && plan.directPercent) {
            await compensationRepo.addLedger(moneyLine({
              user: sponsor.user?._id || sponsor.user,
              period,
              order,
              type: "direct",
              sourceUser: partnerId,
              plan,
              baseAmount: base,
              rate: plan.directPercent,
              gross: (base * plan.directPercent) / 100,
            }));
            sponsor = await nextEarningSponsor(sponsor.sponsor?._id || sponsor.sponsor);
          }
          for (const rate of plan.levelPercents) {
            if (!sponsor) break;
            await compensationRepo.addLedger(moneyLine({
              user: sponsor.user?._id || sponsor.user,
              period,
              order,
              type: "level",
              sourceUser: partnerId,
              plan,
              baseAmount: base,
              rate,
              gross: (base * rate) / 100,
            }));
            sponsor = await nextEarningSponsor(sponsor.sponsor?._id || sponsor.sponsor);
          }
        }
        if (partner.applicationStatus === "pending_first_order") {
          partner.applicationStatus = "active";
          partner.sponsorLocked = true;
          partner.placementLocked = true;
          await partnerRepo.save(partner);
          await notify(partnerId, "Partner active", "Your first qualifying order was delivered. The account is now active.");
        }
      }
    }
    order.volumePosted = true;
    await order.save();
  },

  async onRefunded(order, periodHint) {
    if (order.clawedBack) return;
    const period = periodHint || await ensurePeriod();
    const plan = await compensationRepo.activePlan();
    await compensationRepo.reverseOrderVolume(order._id);
    const lines = await compensationRepo.linesForOrder(order._id);
    for (const line of lines) {
      await compensationRepo.addLedger({
        user: line.user,
        period: period._id,
        order: order._id,
        type: `${line.type}_clawback`,
        sourceUser: line.sourceUser,
        planVersion: line.planVersion,
        commissionBase: line.commissionBase,
        baseAmount: line.baseAmount,
        rate: line.rate,
        gross: -line.gross,
        adjustment: 0,
        withholding: -line.withholding,
        net: -line.net,
        status: "payable",
        reversalOf: line._id,
        note: "Refund reversal. The original line is kept.",
      });
    }
    await correctMatchedLegs(order, plan);
    order.clawedBack = true;
    await order.save();
    if (plan) {
      await notify(order.buyer?._id || order.buyer, "Order refunded", `${order.number} was refunded. Related commission was reversed.`);
    }
  },

  async closePeriod(actor, periodId) {
    const period = (await compensationRepo.periods()).find((row) => String(row._id) === String(periodId));
    if (!period || period.status !== "open") throw new ApiError(400, "That period is not open.");
    const plan = await compensationRepo.activePlan();
    if (!plan) throw new ApiError(400, "There is no active compensation plan.");
    const partners = await Partner.find();
    for (const partner of partners) {
      const userId = partner.user;
      const personal = await compensationRepo.sumVolume({ userId, periodId: period._id, kind: "pv", side: "personal" });
      const leftNew = await compensationRepo.sumVolume({ userId, periodId: period._id, kind: "leg", side: "left" });
      const rightNew = await compensationRepo.sumVolume({ userId, periodId: period._id, kind: "leg", side: "right" });
      const left = leftNew + (partner.carryLeft || 0);
      const right = rightNew + (partner.carryRight || 0);
      const qualified = personal >= plan.minPv;
      let carryLeft = 0;
      let carryRight = 0;
      if (qualified) {
        const matched = Math.min(left, right);
        let gross = (matched * plan.binaryMatchPercent) / 100;
        if (plan.binaryCap && gross > plan.binaryCap) gross = plan.binaryCap;
        if (gross > 0) {
          await compensationRepo.addLedger(moneyLine({
            user: userId,
            period,
            order: null,
            type: "binary",
            sourceUser: userId,
            plan,
            baseAmount: matched,
            rate: plan.binaryMatchPercent,
            gross,
          }));
        }
        if (left >= right) carryLeft = left - matched;
        else carryRight = right - matched;
        if (carryLeft > 0 || carryRight > 0) {
          const weeks = (partner.carryWeeks || 0) + 1;
          if (weeks > 4) {
            carryLeft = 0;
            carryRight = 0;
            partner.carryWeeks = 0;
          } else {
            partner.carryWeeks = weeks;
          }
        } else {
          partner.carryWeeks = 0;
        }
      } else {
        partner.carryWeeks = 0;
      }
      partner.carryLeft = carryLeft;
      partner.carryRight = carryRight;
      const personalForRank = await rankPersonal(userId, period._id);
      let calculated = "starter";
      for (const rule of plan.rankRules || []) {
        if (personalForRank >= rule.minPv && left >= rule.minEachLeg && right >= rule.minEachLeg) calculated = rule.code;
      }
      const rankStatus = applyGrace(partner, plan, calculated);
      if (partner.applicationStatus === "active") {
        partner.activityStatus = personal >= plan.minPv ? "active" : "inactive";
      }
      await partner.save();
      await compensationRepo.saveRank({
        user: userId,
        period: period._id,
        rank: partner.currentRank,
        status: rankStatus,
        personalVolume: personalForRank,
        leftVolume: left,
        rightVolume: right,
      });
    }
    await compensationRepo.markPayable(period._id);
    period.status = "locked";
    period.closedAt = new Date();
    await period.save();
    const nextStart = new Date(period.endsOn);
    const nextEnd = new Date(nextStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    await compensationRepo.createPeriod({
      name: `Week of ${nextStart.toISOString().slice(0, 10)}`,
      startsOn: nextStart,
      endsOn: nextEnd,
      status: "open",
    });
    await auditService.record({
      actor: actor.id,
      actorEmail: actor.email,
      action: "period.locked",
      entity: "period",
      entityId: String(period._id),
      after: { status: "locked" },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    return { id: String(period._id), status: "locked" };
  },

  async updateVolume(actor, id, fields) {
    return patchRow(actor, VolumeEntry, id, fields, "volume.updated");
  },
  async removeVolume(actor, id) {
    return dropRow(actor, VolumeEntry, id, "volume.deleted");
  },
  async updateLedger(actor, id, fields) {
    return patchRow(actor, LedgerLine, id, fields, "ledger.updated");
  },
  async removeLedger(actor, id) {
    return dropRow(actor, LedgerLine, id, "ledger.deleted");
  },
  async updateRank(actor, id, fields) {
    return patchRow(actor, RankResult, id, fields, "rank.updated");
  },
  async removeRank(actor, id) {
    return dropRow(actor, RankResult, id, "rank.deleted");
  },
  async updatePeriod(actor, id, fields) {
    return patchRow(actor, Period, id, fields, "period.updated");
  },
  async removePeriod(actor, id) {
    const open = await Period.countDocuments({ status: "open", _id: { $ne: id } });
    const row = await Period.findById(id);
    if (!row) throw new ApiError(404, "Record not found.");
    if (row.status === "open" && open === 0) throw new ApiError(409, "Keep at least one open period.");
    return dropRow(actor, Period, id, "period.deleted");
  },
};

async function nextEarningSponsor(startId) {
  let sponsorId = startId;
  const guard = new Set();
  while (sponsorId && !guard.has(String(sponsorId?._id || sponsorId))) {
    guard.add(String(sponsorId?._id || sponsorId));
    const sponsor = await partnerRepo.findByUser(sponsorId);
    if (!sponsor) return null;
    const account = sponsor.user?.status;
    const earning = sponsor.applicationStatus === "active"
      && sponsor.activityStatus !== "inactive"
      && account !== "suspended"
      && account !== "terminated";
    if (earning) return sponsor;
    sponsorId = sponsor.sponsor?._id || sponsor.sponsor || null;
  }
  return null;
}

async function rankPersonal(userId, periodId) {
  const rows = await VolumeEntry.find({
    user: userId,
    period: periodId,
    kind: "pv",
    side: "personal",
    status: "posted",
  }).populate("order", "rankEligible");
  return rows.reduce((sum, row) => sum + (row.order && row.order.rankEligible === false ? 0 : row.amount), 0);
}

function rankIndex(plan, code) {
  const codes = ["starter", ...(plan?.rankRules || []).map((rule) => rule.code)];
  const index = codes.indexOf(code || "starter");
  return index < 0 ? 0 : index;
}

function nextRankRule(plan, current) {
  return (plan?.rankRules || []).find((rule) => rankIndex(plan, rule.code) > rankIndex(plan, current)) || null;
}

function applyGrace(partner, plan, calculated) {
  const previous = partner.currentRank || "starter";
  if (rankIndex(plan, calculated) < rankIndex(plan, previous) && previous !== "starter") {
    if (partner.graceRank) {
      partner.currentRank = calculated;
      partner.graceRank = "";
      return "downgraded";
    }
    partner.graceRank = previous;
    partner.currentRank = previous;
    return "grace";
  }
  partner.graceRank = "";
  partner.currentRank = calculated;
  return rankIndex(plan, calculated) > rankIndex(plan, previous) ? "achieved" : "qualified";
}

async function correctMatchedLegs(order, plan) {
  const entries = await VolumeEntry.find({ order: order._id, kind: "leg" });
  for (const entry of entries) {
    const period = await Period.findById(entry.period);
    if (!period || period.status !== "locked") continue;
    const partner = await partnerRepo.findByUser(entry.user);
    if (!partner || (entry.side !== "left" && entry.side !== "right")) continue;
    const field = entry.side === "right" ? "carryRight" : "carryLeft";
    const current = partner[field] || 0;
    const fromCarry = Math.min(current, entry.amount);
    partner[field] = Math.round((current - fromCarry) * 100) / 100;
    await partner.save();
    const matched = entry.amount - fromCarry;
    if (matched <= 0 || !plan?.binaryMatchPercent) continue;
    const paid = await LedgerLine.find({ user: entry.user, period: entry.period, type: "binary" });
    const grossPaid = paid.reduce((sum, line) => sum + (line.gross > 0 ? line.gross : 0), 0);
    if (grossPaid <= 0) continue;
    let gross = (matched * plan.binaryMatchPercent) / 100;
    if (gross > grossPaid) gross = grossPaid;
    if (plan.binaryCap && gross > plan.binaryCap) gross = plan.binaryCap;
    gross = Math.round(gross * 100) / 100;
    if (gross <= 0) continue;
    await compensationRepo.addLedger({
      user: entry.user,
      period: period._id,
      order: order._id,
      type: "binary_clawback",
      sourceUser: entry.user,
      planVersion: plan.version,
      commissionBase: plan.commissionBase,
      baseAmount: matched,
      rate: plan.binaryMatchPercent,
      gross: -gross,
      adjustment: 0,
      withholding: 0,
      net: -gross,
      status: "payable",
      note: "Refund reduced matched leg volume. The original binary line is kept.",
    });
  }
}

function presentVolume(row) {
  return {
    id: String(row._id),
    userId: String(row.user?._id || row.user),
    userName: row.user?.name || "",
    kind: row.kind,
    side: row.side,
    amount: row.amount,
    status: row.status,
    createdAt: row.createdAt,
  };
}

function presentLedger(row) {
  return {
    id: String(row._id),
    userId: String(row.user?._id || row.user),
    userName: row.user?.name || "",
    userEmail: row.user?.email || "",
    type: row.type,
    planVersion: row.planVersion,
    commissionBase: row.commissionBase,
    baseAmount: row.baseAmount,
    rate: row.rate,
    gross: row.gross,
    adjustment: row.adjustment,
    withholding: row.withholding,
    net: row.net,
    status: row.status,
    note: row.note,
    reversalOf: row.reversalOf ? String(row.reversalOf) : null,
    createdAt: row.createdAt,
  };
}

function presentRank(row) {
  return {
    id: String(row._id),
    userId: String(row.user?._id || row.user),
    userName: row.user?.name || "",
    rank: row.rank,
    status: row.status || "qualified",
    personalVolume: row.personalVolume,
    leftVolume: row.leftVolume,
    rightVolume: row.rightVolume,
  };
}

export { presentLedger };
