import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    attributedPartner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true },
    sku: { type: String, required: true },
    qty: { type: Number, required: true },
    price: { type: Number, required: true },
    pv: { type: Number, required: true },
    bv: { type: Number, required: true },
    commissionEligible: { type: Boolean, default: false },
    rankEligible: { type: Boolean, default: false },
    bonusEligible: { type: Boolean, default: false },
    networkEligible: { type: Boolean, default: false },
    total: { type: Number, required: true },
    status: {
      type: String,
      enum: ["payment_pending", "paid", "packed", "shipped", "delivered", "return_requested", "returned", "refunded", "cancelled"],
      default: "payment_pending",
    },
    volumePosted: { type: Boolean, default: false },
    clawedBack: { type: Boolean, default: false },
    deliveredAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const Order = mongoose.model("Order", orderSchema);
