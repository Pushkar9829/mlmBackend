import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    phone: { type: String, default: "" },
    addressLine: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    pincode: { type: String, default: "" },
    linkPartner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    linkFirstUsedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const Customer = mongoose.model("Customer", customerSchema);
