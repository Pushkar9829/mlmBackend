import mongoose from "mongoose";
import { config } from "./index.js";

export async function connectDb() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(config.mongodbUri);
}
