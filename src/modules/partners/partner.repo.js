import { Agreement, Partner } from "./partner.model.js";

const userFields = "name email status";

export const partnerRepo = {
  findByUser(userId) {
    return Partner.findOne({ user: userId }).populate("user", userFields).populate("sponsor", userFields).populate("placementParent", userFields);
  },
  list() {
    return Partner.find().populate("user", userFields).populate("sponsor", userFields).populate("placementParent", userFields).sort({ createdAt: 1 });
  },
  create(data) {
    return Partner.create(data);
  },
  save(doc) {
    return doc.save();
  },
  childrenBySponsor(userId) {
    return Partner.find({ sponsor: userId }).populate("user", userFields);
  },
  childrenByPlacement(userId) {
    return Partner.find({ placementParent: userId }).populate("user", userFields);
  },
  sideTaken(parentUserId, side) {
    return Partner.findOne({ placementParent: parentUserId, placementSide: side });
  },
};

export const agreementRepo = {
  active() {
    return Agreement.findOne({ active: true }).sort({ createdAt: -1 });
  },
  upsert(version, data) {
    return Agreement.findOneAndUpdate({ version }, data, { upsert: true, new: true });
  },
};
