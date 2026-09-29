import dotenv from "dotenv";

dotenv.config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT || 4000),
  mongodbUri: required("MONGODB_URI"),
  jwtAccessSecret: required("JWT_ACCESS_SECRET"),
  accessTokenMinutes: Number(process.env.ACCESS_TOKEN_MINUTES || 15),
  refreshTokenDays: Number(process.env.REFRESH_TOKEN_DAYS || 7),
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  seedAdminEmail: (process.env.SEED_ADMIN_EMAIL || "admin@mlm.local").toLowerCase(),
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD || "Admin@12345",
  seedDemoUsers: process.env.SEED_DEMO_USERS === "true",
};
