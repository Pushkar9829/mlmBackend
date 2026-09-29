import mongoose from "mongoose";

const appModuleSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    path: { type: String, required: true },
    phase: { type: Number, required: true },
    requiredPermission: { type: String, default: null },
    description: { type: String, default: "" },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: false },
);

export const AppModule = mongoose.model("AppModule", appModuleSchema);
