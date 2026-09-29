import mongoose from "mongoose";

const partnerSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    phone: { type: String, default: "" },
    addressLine: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    pincode: { type: String, default: "" },
    sponsor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    sponsorLocked: { type: Boolean, default: false },
    applicationStatus: {
      type: String,
      enum: ["applied", "kyc_pending", "kyc_rejected", "agreement_pending", "pending_first_order", "active"],
      default: "applied",
    },
    bankAccountName: { type: String, default: "" },
    bankAccountNumber: { type: String, default: "" },
    bankIfsc: { type: String, default: "" },
    bankVerified: { type: Boolean, default: false },
    taxId: { type: String, default: "" },
    nomineeName: { type: String, default: "" },
    nomineeRelation: { type: String, default: "" },
    agreementVersion: { type: String, default: "" },
    agreementAcceptedAt: { type: Date, default: null },
    placementParent: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    placementSide: { type: String, enum: ["left", "right"] },
    placementLocked: { type: Boolean, default: false },
    carryLeft: { type: Number, default: 0 },
    carryRight: { type: Number, default: 0 },
    carryWeeks: { type: Number, default: 0 },
    currentRank: { type: String, default: "starter" },
    graceRank: { type: String, default: "" },
    activityStatus: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true },
);

export const Partner = mongoose.model("Partner", partnerSchema);

const agreementSchema = new mongoose.Schema(
  {
    version: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Agreement = mongoose.model("Agreement", agreementSchema);
