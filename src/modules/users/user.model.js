import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: mongoose.Schema.Types.ObjectId, ref: "Role", required: true },
    status: {
      type: String,
      enum: ["active", "suspended", "terminated"],
      default: "active",
    },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

export const User = mongoose.model("User", userSchema);
