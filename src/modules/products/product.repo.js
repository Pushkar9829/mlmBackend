import { Product } from "./product.model.js";

export const productRepo = {
  list(activeOnly) {
    const query = activeOnly ? { active: true } : {};
    return Product.find(query).sort({ name: 1 });
  },
  findById(id) {
    return Product.findById(id);
  },
  findBySku(sku) {
    return Product.findOne({ sku });
  },
  create(data) {
    return Product.create(data);
  },
  update(id, data) {
    return Product.findByIdAndUpdate(id, data, { new: true });
  },
  remove(id) {
    return Product.findByIdAndDelete(id);
  },
};

export function presentProduct(row) {
  return {
    id: String(row._id),
    name: row.name,
    sku: row.sku,
    price: row.price,
    pv: row.pv,
    bv: row.bv,
    commissionEligible: row.commissionEligible,
    rankEligible: row.rankEligible,
    bonusEligible: row.bonusEligible,
    retailEligible: row.retailEligible,
    networkEligible: row.networkEligible,
    active: row.active,
  };
}
