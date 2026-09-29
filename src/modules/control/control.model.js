import mongoose from "mongoose";

const campaignSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
    startsOn: { type: Date, required: true },
    endsOn: { type: Date, required: true },
    budget: { type: Number, required: true },
    awardAmount: { type: Number, required: true },
    spent: { type: Number, default: 0 },
    status: { type: String, enum: ["draft", "live", "closed"], default: "draft" },
  },
  { timestamps: true },
);

const grievanceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    subject: { type: String, required: true },
    message: { type: String, required: true },
    status: { type: String, enum: ["open", "under_review", "closed"], default: "open" },
    response: { type: String, default: "" },
  },
  { timestamps: true },
);

export const Campaign = mongoose.model("Campaign", campaignSchema);
export const Grievance = mongoose.model("Grievance", grievanceSchema);
void mongoose;
