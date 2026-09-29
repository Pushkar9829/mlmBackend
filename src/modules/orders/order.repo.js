import { Order } from "./order.model.js";

export const orderRepo = {
  create(data) {
    return Order.create(data);
  },
  findById(id) {
    return Order.findById(id).populate("buyer", "name email").populate("attributedPartner", "name email");
  },
  list() {
    return Order.find().populate("buyer", "name email").populate("attributedPartner", "name email").sort({ createdAt: -1 });
  },
  listForUser(userId) {
    return Order.find({ $or: [{ buyer: userId }, { attributedPartner: userId }] })
      .populate("buyer", "name email")
      .populate("attributedPartner", "name email")
      .sort({ createdAt: -1 });
  },
  countRefunded(userId) {
    return Order.countDocuments({ buyer: userId, status: "refunded" });
  },
  remove(id) {
    return Order.findByIdAndDelete(id);
  },
};

export function presentOrder(row) {
  return {
    id: String(row._id),
    number: row.number,
    buyer: row.buyer ? { id: String(row.buyer._id), name: row.buyer.name, email: row.buyer.email } : null,
    attributedPartner: row.attributedPartner ? { id: String(row.attributedPartner._id), name: row.attributedPartner.name, email: row.attributedPartner.email } : null,
    productName: row.productName,
    sku: row.sku,
    qty: row.qty,
    price: row.price,
    pv: row.pv,
    bv: row.bv,
    total: row.total,
    status: row.status,
    volumePosted: row.volumePosted,
    returnOpen: row.status === "delivered" && (!row.deliveredAt || Date.now() <= new Date(row.deliveredAt).getTime() + 30 * 24 * 60 * 60 * 1000),
    createdAt: row.createdAt,
  };
}
