import { z } from "zod";
import { actorFrom } from "../../utils/actor.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { validate } from "../../utils/validate.js";
import { customerService } from "./customer.service.js";

const saveSchema = z.object({
  params: z.object({}).optional(),
  query: z.object({}).optional(),
  body: z.object({
    phone: z.string().max(20).optional().default(""),
    addressLine: z.string().max(160).optional().default(""),
    city: z.string().max(80).optional().default(""),
    state: z.string().max(80).optional().default(""),
    pincode: z.string().max(12).optional().default(""),
  }),
});

export const listCustomers = asyncHandler(async (req, res) => {
  const data = await customerService.list(actorFrom(req));
  res.json({ data });
});

export const saveMyCustomer = [
  validate(saveSchema),
  asyncHandler(async (req, res) => {
    const data = await customerService.saveMine(actorFrom(req), req.valid.body);
    res.json({ data });
  }),
];

const linkSchema = z.object({
  params: z.object({}).optional(),
  query: z.object({}).optional(),
  body: z.object({ partnerEmail: z.string().email() }),
});

export const myLink = asyncHandler(async (req, res) => {
  res.json({ data: await customerService.link(actorFrom(req)) });
});

export const saveMyLink = [
  validate(linkSchema),
  asyncHandler(async (req, res) => {
    res.json({ data: await customerService.saveLink(actorFrom(req), req.valid.body.partnerEmail) });
  }),
];

const byUserSchema = z.object({
  params: z.object({ userId: z.string().min(1) }),
  query: z.object({}).optional(),
  body: saveSchema.shape.body,
});

export const saveCustomer = [
  validate(byUserSchema),
  asyncHandler(async (req, res) => {
    res.json({ data: await customerService.saveFor(actorFrom(req), req.valid.params.userId, req.valid.body) });
  }),
];

export const removeCustomer = asyncHandler(async (req, res) => {
  await customerService.remove(actorFrom(req), req.params.userId);
  res.json({ data: { id: req.params.userId } });
});
