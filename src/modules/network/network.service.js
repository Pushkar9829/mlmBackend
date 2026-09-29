import mongoose from "mongoose";
import { ApiError } from "../../utils/api-error.js";
import { auditService } from "../audit/audit.service.js";
import { VolumeEntry } from "../compensation/compensation.model.js";
import { partnerRepo } from "../partners/partner.repo.js";
import { Partner } from "../partners/partner.model.js";

function brief(partner) {
  return {
    userId: String(partner.user?._id || partner.user),
    name: partner.user?.name || "",
    email: partner.user?.email || "",
    applicationStatus: partner.applicationStatus,
    rank: partner.currentRank,
    side: partner.placementSide,
    placementLocked: partner.placementLocked,
  };
}

function buildTree(rows, mode) {
  const byId = new Map(rows.map((row) => [String(row.user?._id || row.user), row]));
  const childKey = mode === "sponsor" ? "sponsor" : "placementParent";
  function childrenOf(userId) {
    return rows.filter((row) => String(row[childKey]?._id || row[childKey] || "") === String(userId));
  }
  function walk(row) {
    const userId = String(row.user?._id || row.user);
    const kids = childrenOf(userId).map(walk);
    const base = brief(row);
    if (mode === "placement") {
      return {
        ...base,
        left: kids.find((item) => item.side === "left") || null,
        right: kids.find((item) => item.side === "right") || null,
      };
    }
    return { ...base, children: kids };
  }
  const roots = rows.filter((row) => !row[childKey]);
  return roots.map(walk);
}

async function rowsFor(actor) {
  if (actor.role !== "partner") return partnerRepo.list();
  const all = await partnerRepo.list();
  const keep = new Set([String(actor.id)]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of all) {
      const id = String(row.user?._id || row.user);
      const sponsorId = String(row.sponsor?._id || row.sponsor || "");
      const parentId = String(row.placementParent?._id || row.placementParent || "");
      if (!keep.has(id) && (keep.has(sponsorId) || keep.has(parentId))) {
        keep.add(id);
        changed = true;
      }
    }
  }
  return all.filter((row) => keep.has(String(row.user?._id || row.user)));
}

async function membersOnSide(userId, side) {
  const all = await Partner.find().populate("user", "name email status");
  const result = [];
  const queue = all.filter((row) => String(row.placementParent?._id || row.placementParent || "") === String(userId) && row.placementSide === side);
  while (queue.length) {
    const current = queue.shift();
    result.push(brief(current));
    const id = String(current.user?._id || current.user);
    queue.push(...all.filter((row) => String(row.placementParent?._id || row.placementParent || "") === id));
  }
  return result;
}

export const networkService = {
  async sponsorship(actor) {
    return buildTree(await rowsFor(actor), "sponsor");
  },
  async placement(actor) {
    return buildTree(await rowsFor(actor), "placement");
  },
  async legs(actor, userId) {
    const target = userId && actor.role !== "partner" ? userId : actor.id;
    const partner = await partnerRepo.findByUser(target);
    if (!partner && actor.role === "partner") throw new ApiError(404, "Partner profile not found.");
    const leftMembers = await membersOnSide(target, "left");
    const rightMembers = await membersOnSide(target, "right");
    const ownerId = partner?.user?._id || partner?.user || target;
    const leftVolume = await VolumeEntry.aggregate([
      { $match: { user: ownerId instanceof mongoose.Types.ObjectId ? ownerId : new mongoose.Types.ObjectId(String(ownerId)), kind: "leg", side: "left", status: "posted" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const rightVolume = await VolumeEntry.aggregate([
      { $match: { user: ownerId instanceof mongoose.Types.ObjectId ? ownerId : new mongoose.Types.ObjectId(String(ownerId)), kind: "leg", side: "right", status: "posted" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    return {
      left: { members: leftMembers, volume: leftVolume[0]?.total || 0, carry: partner?.carryLeft || 0 },
      right: { members: rightMembers, volume: rightVolume[0]?.total || 0, carry: partner?.carryRight || 0 },
      rank: partner?.currentRank || "starter",
    };
  },
  async place(actor, { userId, parentUserId, side, reason }) {
    const partner = await partnerRepo.findByUser(userId);
    if (!partner) throw new ApiError(404, "Partner not found.");
    if (partner.placementLocked && actor.role === "partner") {
      throw new ApiError(400, "Placement is already locked.");
    }
    if (actor.role === "partner") {
      const sponsorId = String(partner.sponsor?._id || partner.sponsor || "");
      if (sponsorId !== String(actor.id)) throw new ApiError(403, "You can place only people you sponsor.");
    }
    const parent = await partnerRepo.findByUser(parentUserId);
    if (!parent) throw new ApiError(400, "Placement parent is not a partner.");
    const taken = await partnerRepo.sideTaken(parentUserId, side);
    if (taken && String(taken.user) !== String(userId)) throw new ApiError(400, `The ${side} seat is already filled.`);
    const before = { parent: partner.placementParent ? String(partner.placementParent._id || partner.placementParent) : null, side: partner.placementSide };
    partner.placementParent = parentUserId;
    partner.placementSide = side;
    await partnerRepo.save(partner);
    await auditService.record({
      actor: actor.id,
      actorEmail: actor.email,
      action: "placement.changed",
      entity: "partner",
      entityId: String(partner._id),
      before,
      after: { parent: parentUserId, side },
      reason: reason || "",
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    return brief(await partnerRepo.findByUser(userId));
  },
  async clearPlacement(actor, userId) {
    const partner = await partnerRepo.findByUser(userId);
    if (!partner) throw new ApiError(404, "Partner not found.");
    if (partner.placementLocked && actor.role === "partner") throw new ApiError(400, "Placement is already locked.");
    const before = { parent: partner.placementParent ? String(partner.placementParent._id || partner.placementParent) : null, side: partner.placementSide };
    await Partner.updateOne({ _id: partner._id }, { $unset: { placementParent: 1, placementSide: 1 }, $set: { placementLocked: false } });
    await auditService.record({
      actor: actor.id,
      actorEmail: actor.email,
      action: "placement.cleared",
      entity: "partner",
      entityId: String(partner._id),
      before,
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
  },
};

async function legTotals(userId) {
  const partner = await partnerRepo.findByUser(userId);
  const owner = partner?.user?._id || userId;
  const id = owner instanceof mongoose.Types.ObjectId ? owner : new mongoose.Types.ObjectId(String(owner));
  async function posted(side) {
    const rows = await VolumeEntry.aggregate([
      { $match: { user: id, kind: "leg", side, status: "posted" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    return rows[0]?.total || 0;
  }
  return {
    left: (await posted("left")) + (partner?.carryLeft || 0),
    right: (await posted("right")) + (partner?.carryRight || 0),
  };
}

async function findOpenSeat(rootId) {
  const queue = [rootId];
  const seen = new Set();
  while (queue.length) {
    const id = queue.shift();
    const key = String(id?._id || id);
    if (seen.has(key)) continue;
    seen.add(key);
    const totals = await legTotals(id);
    const sides = totals.left <= totals.right ? ["left", "right"] : ["right", "left"];
    for (const side of sides) {
      const taken = await partnerRepo.sideTaken(id, side);
      if (!taken) return { parentId: id, side };
    }
    const left = await partnerRepo.sideTaken(id, "left");
    const right = await partnerRepo.sideTaken(id, "right");
    if (left?.user) queue.push(left.user);
    if (right?.user) queue.push(right.user);
  }
  return null;
}

export async function placeBySpillover(partner) {
  if (!partner || partner.placementParent || partner.placementLocked) return partner;
  const sponsorId = partner.sponsor?._id || partner.sponsor;
  if (!sponsorId) return partner;
  const seat = await findOpenSeat(sponsorId);
  if (!seat) return partner;
  partner.placementParent = seat.parentId;
  partner.placementSide = seat.side;
  await partnerRepo.save(partner);
  await auditService.record({
    actorEmail: "spillover",
    action: "placement.spillover",
    entity: "partner",
    entityId: String(partner._id),
    after: { parent: String(seat.parentId?._id || seat.parentId), side: seat.side },
    reason: "No seat was chosen. The open weaker-leg seat was used.",
  });
  return partnerRepo.findByUser(partner.user?._id || partner.user);
}
