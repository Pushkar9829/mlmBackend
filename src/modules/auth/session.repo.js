import { Session } from "./session.model.js";

export const sessionRepo = {
  create(data) {
    return Session.create(data);
  },
  findValidByHash(hash) {
    return Session.findOne({
      refreshTokenHash: hash,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    });
  },
  revokeById(id) {
    return Session.findByIdAndUpdate(id, { revokedAt: new Date() });
  },
  revokeAllForUser(userId) {
    return Session.updateMany(
      { user: userId, revokedAt: null },
      { revokedAt: new Date() },
    );
  },
};
