import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { ApiError } from "../../utils/api-error.js";
import { auditService } from "../audit/audit.service.js";
import { Session } from "../auth/session.model.js";
import { LedgerLine } from "../compensation/compensation.model.js";
import { Grievance } from "../control/control.model.js";
import { FraudCase } from "../control/fraud.model.js";
import { Notification } from "../control/notification.model.js";
import { Customer } from "../customers/customer.model.js";
import { KycDocument } from "../kyc/kyc.model.js";
import { Order } from "../orders/order.model.js";
import { Partner } from "../partners/partner.model.js";
import { Dispute, Payout } from "../wallet/wallet.model.js";
import { moduleService } from "../modules/module.service.js";
import { roleRepo } from "../roles/role.repo.js";
import { userRepo } from "./user.repo.js";
import { User } from "./user.model.js";

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export function assertPassword(password) {
  if (!PASSWORD_RULE.test(password)) {
    throw new ApiError(400, "Password must be at least 8 characters and include a letter and a number.");
  }
}

export const userService = {
  async list() {
    const users = await userRepo.list();
    return users.map(presentUser);
  },

  async create({ name, email, password, roleCode }, actor) {
    assertPassword(password);
    const existing = await userRepo.findByEmail(email);
    if (existing) throw new ApiError(409, "An account with this email already exists.");
    const role = await roleRepo.findByCode(roleCode);
    if (!role) throw new ApiError(400, "Choose a valid role.");
    const passwordHash = await bcrypt.hash(password, 10);
    const created = await userRepo.create({
      name: name.trim(),
      email: email.toLowerCase(),
      passwordHash,
      role: role._id,
      status: "active",
    });
    const user = await userRepo.findById(created._id);
    await auditService.record({
      actor: actor.id,
      actorEmail: actor.email,
      action: "user.created",
      entity: "user",
      entityId: String(user._id),
      after: { email: user.email, name: user.name, role: role.code, status: "active" },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    return presentUser(user);
  },

  async changeStatus(id, { status, reason }, actor) {
    assertUserId(id);
    if (!reason || !reason.trim()) throw new ApiError(400, "A reason is required.");
    if (String(actor.id) === String(id)) {
      throw new ApiError(400, "You cannot change your own status.");
    }
    const current = await userRepo.findById(id);
    if (!current) throw new ApiError(404, "User not found.");
    const updated = await userRepo.updateById(id, { status });
    await auditService.record({
      actor: actor.id,
      actorEmail: actor.email,
      action: "user.status_changed",
      entity: "user",
      entityId: String(id),
      before: { status: current.status },
      after: { status },
      reason: reason.trim(),
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    return presentUser(updated);
  },

  async assignRole(id, { roleCode, reason }, actor) {
    assertUserId(id);
    if (!reason || !reason.trim()) throw new ApiError(400, "A reason is required.");
    if (String(actor.id) === String(id)) {
      throw new ApiError(400, "You cannot change your own role.");
    }
    const current = await userRepo.findById(id);
    if (!current) throw new ApiError(404, "User not found.");
    const role = await roleRepo.findByCode(roleCode);
    if (!role) throw new ApiError(400, "Choose a valid role.");
    const updated = await userRepo.updateById(id, { role: role._id });
    await auditService.record({
      actor: actor.id,
      actorEmail: actor.email,
      action: "user.role_changed",
      entity: "user",
      entityId: String(id),
      before: { role: current.role?.code || "" },
      after: { role: role.code },
      reason: reason.trim(),
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    return presentUser(updated);
  },

  async update(id, { name, email, password }, actor) {
    assertUserId(id);
    const current = await userRepo.findById(id);
    if (!current) throw new ApiError(404, "User not found.");
    const nextEmail = email.toLowerCase();
    const taken = await userRepo.findByEmail(nextEmail);
    if (taken && String(taken._id) !== String(id)) throw new ApiError(409, "An account with this email already exists.");
    await userRepo.updateById(id, { name: name.trim(), email: nextEmail });
    if (password) {
      assertPassword(password);
      await userRepo.setPassword(id, await bcrypt.hash(password, 10));
    }
    const updated = await userRepo.findById(id);
    await auditService.record({
      actor: actor.id,
      actorEmail: actor.email,
      action: "user.updated",
      entity: "user",
      entityId: String(id),
      before: { name: current.name, email: current.email },
      after: { name: updated.name, email: updated.email },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    return presentUser(updated);
  },

  async remove(id, actor) {
    assertUserId(id);
    if (String(actor.id) === String(id)) throw new ApiError(400, "You cannot delete your own account.");
    const current = await userRepo.findById(id);
    if (!current) throw new ApiError(404, "User not found.");
    const [orders, ledger] = await Promise.all([
      Order.exists({ $or: [{ buyer: id }, { attributedPartner: id }] }),
      LedgerLine.exists({ user: id }),
    ]);
    if (orders || ledger) throw new ApiError(409, "This account has orders or commission lines, so it cannot be deleted.");
    const placed = await Partner.exists({ $or: [{ sponsor: id }, { placementParent: id }] });
    if (placed) throw new ApiError(409, "This account still has people under it, so it cannot be deleted.");
    await Promise.all([
      Session.deleteMany({ user: id }),
      KycDocument.deleteMany({ user: id }),
      Partner.deleteMany({ user: id }),
      Customer.deleteMany({ user: id }),
      Notification.deleteMany({ user: id }),
      Grievance.deleteMany({ user: id }),
      FraudCase.deleteMany({ user: id }),
      Payout.deleteMany({ user: id }),
      Dispute.deleteMany({ user: id }),
    ]);
    await User.deleteOne({ _id: id });
    await auditService.record({
      actor: actor.id,
      actorEmail: actor.email,
      action: "user.deleted",
      entity: "user",
      entityId: String(id),
      before: { email: current.email, name: current.name, role: current.role?.code || "" },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
  },
};

export async function presentAccount(user) {
  const role = user.role;
  const modules = await moduleService.forCodes(role?.modules || []);
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    status: user.status,
    lastLoginAt: user.lastLoginAt || null,
    role: role
      ? { code: role.code, name: role.name }
      : null,
    permissions: role?.permissions || [],
    modules,
  };
}

function assertUserId(id) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "User not found.");
}

function presentUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    status: user.status,
    lastLoginAt: user.lastLoginAt || null,
    role: user.role ? { code: user.role.code, name: user.role.name } : null,
    createdAt: user.createdAt,
  };
}
