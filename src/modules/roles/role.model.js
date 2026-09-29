import mongoose from "mongoose";

const roleSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    permissions: { type: [String], default: [] },
    modules: { type: [String], default: [] },
  },
  { timestamps: true },
);

export const Role = mongoose.model("Role", roleSchema);
