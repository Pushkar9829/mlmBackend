import mongoose from "mongoose";
import { LedgerLine, Period, Plan, RankResult, VolumeEntry } from "./compensation.model.js";

function asId(value) {
  if (!value) return value;
  const raw = value._id || value;
  if (raw instanceof mongoose.Types.ObjectId) return raw;
  return new mongoose.Types.ObjectId(String(raw));
}

export const compensationRepo = {
  activePlan() {
    return Plan.findOne({ status: "active" }).sort({ version: -1 });
  },
  latestPlan() {
    return Plan.findOne().sort({ version: -1 });
  },
  createPlan(data) {
    return Plan.create(data);
  },
  supersedeActive() {
    return Plan.updateMany({ status: "active" }, { status: "superseded" });
  },
  openPeriod() {
    return Period.findOne({ status: "open" }).sort({ startsOn: 1 });
  },
  periods() {
    return Period.find().sort({ startsOn: -1 });
  },
  createPeriod(data) {
    return Period.create(data);
  },
  addVolume(data) {
    return VolumeEntry.create(data);
  },
  volumesForUser(userId) {
    return VolumeEntry.find({ user: userId }).sort({ createdAt: -1 }).limit(100);
  },
  sumVolume({ userId, periodId, kind, side, status = "posted" }) {
    return VolumeEntry.aggregate([
      { $match: { user: asId(userId), period: asId(periodId), kind, side, status } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]).then((rows) => rows[0]?.total || 0);
  },
  reverseOrderVolume(orderId) {
    return VolumeEntry.updateMany({ order: orderId, status: "posted" }, { status: "reversed" });
  },
  addLedger(data) {
    return LedgerLine.create(data);
  },
  linesForOrder(orderId) {
    return LedgerLine.find({ order: orderId, reversalOf: null });
  },
  linesForUser(userId) {
    return LedgerLine.find({ user: userId }).sort({ createdAt: -1 }).limit(100).populate("user", "name email");
  },
  allLines(limit = 100) {
    return LedgerLine.find().sort({ createdAt: -1 }).limit(limit).populate("user", "name email");
  },
  findLine(id) {
    return LedgerLine.findById(id);
  },
  payableTotal(userId) {
    return LedgerLine.aggregate([
      { $match: { user: asId(userId), status: "payable" } },
      { $group: { _id: null, total: { $sum: "$net" } } },
    ]).then((rows) => rows[0]?.total || 0);
  },
  markPayable(periodId) {
    return LedgerLine.updateMany({ period: periodId, status: "calculated" }, { status: "payable" });
  },
  saveRank(data) {
    return RankResult.findOneAndUpdate({ user: data.user, period: data.period }, data, { upsert: true, new: true });
  },
  ranksForPeriod(periodId) {
    return RankResult.find({ period: periodId }).populate("user", "name email");
  },
  latestRank(userId) {
    return RankResult.findOne({ user: userId }).sort({ createdAt: -1 });
  },
};
