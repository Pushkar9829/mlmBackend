import crypto from "crypto";
import jwt from "jsonwebtoken";
import { config } from "../config/index.js";

export function signAccessToken(userId) {
  return jwt.sign({ sub: String(userId) }, config.jwtAccessSecret, {
    expiresIn: `${config.accessTokenMinutes}m`,
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, config.jwtAccessSecret);
}

export function createRefreshToken() {
  return crypto.randomBytes(48).toString("base64url");
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function refreshExpiryDate() {
  const date = new Date();
  date.setDate(date.getDate() + config.refreshTokenDays);
  return date;
}
