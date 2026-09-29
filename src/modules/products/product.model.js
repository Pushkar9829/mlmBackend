import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, unique: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    pv: { type: Number, required: true, min: 0 },
    bv: { type: Number, required: true, min: 0 },
    commissionEligible: { type: Boolean, default: true },
    rankEligible: { type: Boolean, default: true },
    bonusEligible: { type: Boolean, default: true },
    retailEligible: { type: Boolean, default: true },
    networkEligible: { type: Boolean, default: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Product = mongoose.model("Product", productSchema);
