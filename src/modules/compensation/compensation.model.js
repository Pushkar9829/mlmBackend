import mongoose from "mongoose";

const planSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    version: { type: Number, required: true },
    status: { type: String, enum: ["draft", "active", "superseded"], default: "draft" },
    commissionBase: { type: String, enum: ["bv", "price"], default: "bv" },
    directPercent: { type: Number, default: 0 },
    levelPercents: { type: [Number], default: [] },
    binaryMatchPercent: { type: Number, default: 0 },
    binaryCap: { type: Number, default: 0 },
    minPv: { type: Number, default: 0 },
    withholdingPercent: { type: Number, default: 0 },
    attributionDays: { type: Number, default: 30 },
    returnDays: { type: Number, default: 30 },
    rankRules: {
      type: [{ code: String, minPv: Number, minEachLeg: Number }],
      default: [],
    },
  },
  { timestamps: true },
);

const periodSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    startsOn: { type: Date, required: true },
    endsOn: { type: Date, required: true },
    status: { type: String, enum: ["open", "locked"], default: "open" },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

const volumeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    period: { type: mongoose.Schema.Types.ObjectId, ref: "Period", required: true },
    kind: { type: String, enum: ["pv", "leg"], required: true },
    side: { type: String, enum: ["personal", "left", "right"], required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ["posted", "reversed"], default: "posted" },
  },
  { timestamps: true },
);

const ledgerSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    period: { type: mongoose.Schema.Types.ObjectId, ref: "Period", default: null },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
    type: { type: String, required: true },
    sourceUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    planVersion: { type: Number, default: null },
    commissionBase: { type: String, default: "" },
    baseAmount: { type: Number, default: 0 },
    rate: { type: Number, default: 0 },
    gross: { type: Number, required: true },
    adjustment: { type: Number, default: 0 },
    withholding: { type: Number, default: 0 },
    net: { type: Number, required: true },
    status: { type: String, enum: ["calculated", "payable", "paid"], default: "calculated" },
    reversalOf: { type: mongoose.Schema.Types.ObjectId, ref: "LedgerLine", default: null },
    note: { type: String, default: "" },
  },
  { timestamps: true },
);

const rankSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    period: { type: mongoose.Schema.Types.ObjectId, ref: "Period", required: true },
    rank: { type: String, required: true },
    status: { type: String, enum: ["qualified", "achieved", "grace", "downgraded"], default: "qualified" },
    personalVolume: { type: Number, default: 0 },
    leftVolume: { type: Number, default: 0 },
    rightVolume: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const Plan = mongoose.model("Plan", planSchema);
export const Period = mongoose.model("Period", periodSchema);
export const VolumeEntry = mongoose.model("VolumeEntry", volumeSchema);
export const LedgerLine = mongoose.model("LedgerLine", ledgerSchema);
export const RankResult = mongoose.model("RankResult", rankSchema);

void mongoose;
