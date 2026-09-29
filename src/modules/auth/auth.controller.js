import { z } from "zod";
import { asyncHandler } from "../../utils/async-handler.js";
import { validate } from "../../utils/validate.js";
import { requestMeta } from "../../utils/request-meta.js";
import { authService, refreshCookieOptions } from "./auth.service.js";

const loginSchema = z.object({
  params: z.object({}).optional(),
  query: z.object({}).optional(),
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
});

const passwordSchema = z.object({
  params: z.object({}).optional(),
  query: z.object({}).optional(),
  body: z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(80),
  }),
});

function sendSession(res, result) {
  res.cookie("refreshToken", result.refreshToken, refreshCookieOptions());
  res.json({ accessToken: result.accessToken, user: result.user });
}

export const login = [
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.login({ ...req.valid.body, ...requestMeta(req) });
    sendSession(res, result);
  }),
];

export const refresh = asyncHandler(async (req, res) => {
  const result = await authService.refresh(req.cookies?.refreshToken);
  sendSession(res, result);
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.cookies?.refreshToken, req.user
    ? { id: req.user._id, email: req.user.email, ...requestMeta(req) }
    : null);
  res.clearCookie("refreshToken", { path: "/api/auth" });
  res.json({ ok: true });
});

export const me = asyncHandler(async (req, res) => {
  const user = await authService.me(req.user._id);
  res.json({ user });
});

export const changePassword = [
  validate(passwordSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.changePassword(req.user._id, req.valid.body, requestMeta(req));
    sendSession(res, result);
  }),
];
