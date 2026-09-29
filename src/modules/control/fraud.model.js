import mongoose from "mongoose";

const fraudSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    pattern: { type: String, required: true },
    status: { type: String, enum: ["open", "cleared", "confirmed"], default: "open" },
    note: { type: String, default: "" },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
  },
  { timestamps: true },
);

export const FraudCase = mongoose.model("FraudCase", fraudSchema);
