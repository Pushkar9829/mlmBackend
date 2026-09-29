import { Role } from "./role.model.js";
import { Permission } from "./permission.model.js";

export const roleRepo = {
  list() {
    return Role.find().sort({ name: 1 });
  },
  findByCode(code) {
    return Role.findOne({ code });
  },
  findById(id) {
    return Role.findById(id);
  },
  upsertByCode(code, data) {
    return Role.findOneAndUpdate({ code }, data, { upsert: true, new: true, setDefaultsOnInsert: true });
  },
  updateByCode(code, changes) {
    return Role.findOneAndUpdate({ code }, changes, { new: true });
  },
};

export const permissionRepo = {
  list() {
    return Permission.find().sort({ group: 1, code: 1 });
  },
  codes() {
    return Permission.find().distinct("code");
  },
  upsertMany(items) {
    return Promise.all(
      items.map((item) =>
        Permission.findOneAndUpdate({ code: item.code }, item, {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }),
      ),
    );
  },
};
