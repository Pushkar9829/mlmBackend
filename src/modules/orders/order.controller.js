import { z } from "zod";
import { actorFrom } from "../../utils/actor.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { validate } from "../../utils/validate.js";
import { orderService } from "./order.service.js";

const createSchema = z.object({
  params: z.object({}).optional(),
  query: z.object({}).optional(),
  body: z.object({
    productId: z.string().min(1),
    qty: z.number().int().min(1).max(20),
    partnerEmail: z.string().email().optional().or(z.literal("")),
  }),
});

const statusSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  query: z.object({}).optional(),
  body: z.object({
    status: z.enum(["paid", "packed", "shipped", "delivered", "return_requested", "returned", "refunded", "cancelled"]),
  }),
});

export const listOrders = asyncHandler(async (req, res) => {
  res.json({ data: await orderService.list(actorFrom(req)) });
});

export const createOrder = [
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const body = { ...req.valid.body };
    if (!body.partnerEmail) delete body.partnerEmail;
    const data = await orderService.create(actorFrom(req), body);
    res.status(201).json({ data });
  }),
];

export const updateOrderStatus = [
  validate(statusSchema),
  asyncHandler(async (req, res) => {
    const data = await orderService.changeStatus(actorFrom(req), req.valid.params.id, req.valid.body.status);
    res.json({ data });
  }),
];

export const removeOrder = asyncHandler(async (req, res) => {
  await orderService.remove(actorFrom(req), req.params.id);
  res.json({ data: { id: req.params.id } });
});
