import { z } from "zod";
import { actorFrom } from "../../utils/actor.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { validate } from "../../utils/validate.js";
import { networkService } from "./network.service.js";

const placeSchema = z.object({
  params: z.object({}).optional(),
  query: z.object({}).optional(),
  body: z.object({
    userId: z.string().min(1),
    parentUserId: z.string().min(1),
    side: z.enum(["left", "right"]),
    reason: z.string().max(300).optional().default(""),
  }),
});

export const sponsorship = asyncHandler(async (req, res) => {
  res.json({ data: await networkService.sponsorship(actorFrom(req)) });
});

export const placement = asyncHandler(async (req, res) => {
  res.json({ data: await networkService.placement(actorFrom(req)) });
});

export const legs = asyncHandler(async (req, res) => {
  res.json({ data: await networkService.legs(actorFrom(req), req.query.userId) });
});

export const place = [
  validate(placeSchema),
  asyncHandler(async (req, res) => {
    const data = await networkService.place(actorFrom(req), req.valid.body);
    res.json({ data });
  }),
];

export const clearPlacement = asyncHandler(async (req, res) => {
  await networkService.clearPlacement(actorFrom(req), req.params.userId);
  res.json({ data: { id: req.params.userId } });
});
