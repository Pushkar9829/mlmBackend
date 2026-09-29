import mongoose from "mongoose";

const kycSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    kind: { type: String, enum: ["identity", "address", "bank", "tax"], required: true },
    status: {
      type: String,
      enum: ["not_started", "submitted", "in_review", "verified", "rejected", "expired"],
      default: "not_started",
    },
    referenceNumber: { type: String, default: "" },
    reviewNote: { type: String, default: "" },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true },
);

kycSchema.index({ user: 1, kind: 1 }, { unique: true });

export const KycDocument = mongoose.model("KycDocument", kycSchema);
