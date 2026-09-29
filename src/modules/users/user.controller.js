import { z } from "zod";
import { asyncHandler } from "../../utils/async-handler.js";
import { validate } from "../../utils/validate.js";
import { requestMeta } from "../../utils/request-meta.js";
import { userService } from "./user.service.js";

const createSchema = z.object({
  params: z.object({}).optional(),
  query: z.object({}).optional(),
  body: z.object({
    name: z.string().trim().min(2).max(80),
    email: z.string().email(),
    password: z.string().min(8).max(80),
    roleCode: z.string().min(1),
  }),
});

const statusSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  query: z.object({}).optional(),
  body: z.object({
    status: z.enum(["active", "suspended", "terminated"]),
    reason: z.string().trim().min(3).max(300),
  }),
});

const roleSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  query: z.object({}).optional(),
  body: z.object({
    roleCode: z.string().min(1),
    reason: z.string().trim().min(3).max(300),
  }),
});

function actor(req) {
  return { id: req.user._id, email: req.user.email, ...requestMeta(req) };
}

export const listUsers = asyncHandler(async (req, res) => {
  const data = await userService.list();
  res.json({ data });
});

export const createUser = [
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const data = await userService.create(req.valid.body, actor(req));
    res.status(201).json({ data });
  }),
];

export const updateUserStatus = [
  validate(statusSchema),
  asyncHandler(async (req, res) => {
    const data = await userService.changeStatus(req.valid.params.id, req.valid.body, actor(req));
    res.json({ data });
  }),
];

const profileSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  query: z.object({}).optional(),
  body: z.object({
    name: z.string().trim().min(2).max(80),
    email: z.string().email(),
    password: z.string().max(80).optional().or(z.literal("")),
  }),
});

export const updateUser = [
  validate(profileSchema),
  asyncHandler(async (req, res) => {
    const data = await userService.update(req.valid.params.id, req.valid.body, actor(req));
    res.json({ data });
  }),
];

export const removeUser = asyncHandler(async (req, res) => {
  await userService.remove(req.params.id, actor(req));
  res.json({ data: { id: req.params.id } });
});

export const updateUserRole = [
  validate(roleSchema),
  asyncHandler(async (req, res) => {
    const data = await userService.assignRole(req.valid.params.id, req.valid.body, actor(req));
    res.json({ data });
  }),
];
