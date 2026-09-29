import { AppModule } from "./module.model.js";

export const moduleRepo = {
  list() {
    return AppModule.find().sort({ sortOrder: 1, label: 1 });
  },
  findByCodes(codes) {
    return AppModule.find({ code: { $in: codes } }).sort({ sortOrder: 1, label: 1 });
  },
  codes() {
    return AppModule.find().distinct("code");
  },
  upsertMany(items) {
    return Promise.all(
      items.map((item) =>
        AppModule.findOneAndUpdate({ code: item.code }, item, {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }),
      ),
    );
  },
};
