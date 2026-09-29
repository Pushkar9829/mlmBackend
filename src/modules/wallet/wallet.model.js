import mongoose from "mongoose";

const payoutSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ["requested", "approved", "paid", "rejected", "failed"], default: "requested" },
    reason: { type: String, default: "" },
  },
  { timestamps: true },
);

const disputeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ledgerLine: { type: mongoose.Schema.Types.ObjectId, ref: "LedgerLine", required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: ["open", "approved", "rejected"], default: "open" },
    resolution: { type: String, default: "" },
  },
  { timestamps: true },
);

export const Payout = mongoose.model("Payout", payoutSchema);
export const Dispute = mongoose.model("Dispute", disputeSchema);
