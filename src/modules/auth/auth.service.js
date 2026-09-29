import bcrypt from "bcryptjs";
import { config } from "../../config/index.js";
import { ApiError } from "../../utils/api-error.js";
import { auditService } from "../audit/audit.service.js";
import { sessionRepo } from "./session.repo.js";
import { userRepo } from "../users/user.repo.js";
import { assertPassword, presentAccount } from "../users/user.service.js";
import {
  createRefreshToken,
  hashToken,
  refreshExpiryDate,
  signAccessToken,
} from "../../utils/tokens.js";

export const authService = {
  async login({ email, password, ip, userAgent }) {
    const normalized = email.toLowerCase().trim();
    const user = await userRepo.findByEmail(normalized);
    if (!user) {
      await auditService.record({
        action: "auth.login_failed",
        actorEmail: normalized,
        entity: "user",
        reason: "unknown_email",
        ip,
        userAgent,
      });
      throw new ApiError(401, "Email or password is incorrect.");
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      await auditService.record({
        action: "auth.login_failed",
        actor: user._id,
        actorEmail: user.email,
        entity: "user",
        entityId: String(user._id),
        reason: "bad_password",
        ip,
        userAgent,
      });
      throw new ApiError(401, "Email or password is incorrect.");
    }

    if (user.status !== "active") {
      await auditService.record({
        action: "auth.login_blocked",
        actor: user._id,
        actorEmail: user.email,
        entity: "user",
        entityId: String(user._id),
        reason: user.status,
        ip,
        userAgent,
      });
      throw new ApiError(403, "This account cannot sign in.");
    }

    const issued = await issueSession(user._id, ip, userAgent);
    await userRepo.touchLogin(user._id);
    await auditService.record({
      action: "auth.login_success",
      actor: user._id,
      actorEmail: user.email,
      entity: "session",
      entityId: String(issued.sessionId),
      ip,
      userAgent,
    });
    const account = await presentAccount(await userRepo.findAuthById(user._id));
    return { accessToken: issued.accessToken, refreshToken: issued.refreshToken, user: account };
  },

  async refresh(refreshToken) {
    if (!refreshToken) throw new ApiError(401, "Sign in required.");
    const session = await sessionRepo.findValidByHash(hashToken(refreshToken));
    if (!session) throw new ApiError(401, "Sign in required.");
    const user = await userRepo.findAuthById(session.user);
    if (!user || user.status !== "active") {
      await sessionRepo.revokeById(session._id);
      throw new ApiError(401, "Sign in required.");
    }
    const account = await presentAccount(user);
    return {
      accessToken: signAccessToken(user._id),
      refreshToken,
      user: account,
    };
  },

  async logout(refreshToken, actor) {
    if (refreshToken) {
      const session = await sessionRepo.findValidByHash(hashToken(refreshToken));
      if (session) await sessionRepo.revokeById(session._id);
    }
    if (actor?.id) {
      await auditService.record({
        action: "auth.logout",
        actor: actor.id,
        actorEmail: actor.email,
        entity: "session",
        ip: actor.ip,
        userAgent: actor.userAgent,
      });
    }
  },

  async me(userId) {
    const user = await userRepo.findAuthById(userId);
    if (!user || user.status !== "active") throw new ApiError(401, "Sign in required.");
    return presentAccount(user);
  },

  async changePassword(userId, { currentPassword, newPassword }, meta) {
    assertPassword(newPassword);
    const user = await userRepo.findAuthById(userId);
    if (!user) throw new ApiError(401, "Sign in required.");
    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) throw new ApiError(400, "Current password is incorrect.");
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await userRepo.setPassword(userId, passwordHash);
    await sessionRepo.revokeAllForUser(userId);
    const issued = await issueSession(userId, meta.ip, meta.userAgent);
    await auditService.record({
      action: "auth.password_changed",
      actor: user._id,
      actorEmail: user.email,
      entity: "user",
      entityId: String(user._id),
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    const account = await presentAccount(await userRepo.findAuthById(userId));
    return { accessToken: issued.accessToken, refreshToken: issued.refreshToken, user: account };
  },
};

async function issueSession(userId, ip, userAgent) {
  const refreshToken = createRefreshToken();
  const session = await sessionRepo.create({
    user: userId,
    refreshTokenHash: hashToken(refreshToken),
    expiresAt: refreshExpiryDate(),
    ip,
    userAgent,
  });
  return {
    sessionId: session._id,
    refreshToken,
    accessToken: signAccessToken(userId),
  };
}

export function refreshCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/api/auth",
    maxAge: config.refreshTokenDays * 24 * 60 * 60 * 1000,
  };
}
