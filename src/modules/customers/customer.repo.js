import { Customer } from "./customer.model.js";

export const customerRepo = {
  findByUser(userId) {
    return Customer.findOne({ user: userId }).populate("user", "name email status").populate("linkPartner", "name email");
  },
  list() {
    return Customer.find().populate("user", "name email status").sort({ updatedAt: -1 });
  },
  upsert(userId, fields) {
    return Customer.findOneAndUpdate({ user: userId }, { user: userId, ...fields }, { upsert: true, new: true }).populate("user", "name email status");
  },
};
