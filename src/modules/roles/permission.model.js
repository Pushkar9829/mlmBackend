import mongoose from "mongoose";

const permissionSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    group: { type: String, required: true },
  },
  { timestamps: false },
);

export const Permission = mongoose.model("Permission", permissionSchema);
