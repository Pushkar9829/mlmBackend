import { User } from "./user.model.js";

const publicSelect = "-passwordHash";

export const userRepo = {
  findByEmail(email) {
    return User.findOne({ email: email.toLowerCase() }).populate("role");
  },
  findById(id) {
    return User.findById(id).populate("role").select(publicSelect);
  },
  findAuthById(id) {
    return User.findById(id).populate("role");
  },
  list() {
    return User.find().populate("role").select(publicSelect).sort({ createdAt: -1 });
  },
  create(data) {
    return User.create(data);
  },
  updateById(id, changes) {
    return User.findByIdAndUpdate(id, changes, { new: true }).populate("role").select(publicSelect);
  },
  touchLogin(id) {
    return User.findByIdAndUpdate(id, { lastLoginAt: new Date() });
  },
  setPassword(id, passwordHash) {
    return User.findByIdAndUpdate(id, { passwordHash });
  },
};
