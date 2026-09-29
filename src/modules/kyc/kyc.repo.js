import { KycDocument } from "./kyc.model.js";

export const kycRepo = {
  findByUserAndKind(userId, kind) {
    return KycDocument.findOne({ user: userId, kind });
  },
  listByUser(userId) {
    return KycDocument.find({ user: userId }).sort({ kind: 1 });
  },
  listAll() {
    return KycDocument.find().populate("user", "name email").sort({ updatedAt: -1 });
  },
  create(data) {
    return KycDocument.create(data);
  },
  findById(id) {
    return KycDocument.findById(id).populate("user", "name email");
  },
};
