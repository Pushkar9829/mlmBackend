import { z } from "zod";
import { actorFrom } from "../../utils/actor.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { validate } from "../../utils/validate.js";
import { kycService } from "./kyc.service.js";

const submitSchema = z.object({
  params: z.object({ kind: z.enum(["identity", "address", "bank", "tax"]) }),
  query: z.object({}).optional(),
  body: z.object({ referenceNumber: z.string().trim().min(3).max(40) }),
});

const reviewSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  query: z.object({}).optional(),
  body: z.object({
    status: z.enum(["in_review", "verified", "rejected", "expired"]),
    reviewNote: z.string().max(300).optional().default(""),
  }),
});

export const listKyc = asyncHandler(async (req, res) => {
  const data = await kycService.list(actorFrom(req));
  res.json({ data });
});

export const submitKyc = [
  validate(submitSchema),
  asyncHandler(async (req, res) => {
    const data = await kycService.submit(actorFrom(req), req.valid.params.kind, req.valid.body.referenceNumber);
    res.json({ data });
  }),
];

export const reviewKyc = [
  validate(reviewSchema),
  asyncHandler(async (req, res) => {
    const data = await kycService.review(actorFrom(req), req.valid.params.id, req.valid.body);
    res.json({ data });
  }),
];

const editSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  query: z.object({}).optional(),
  body: z.object({
    status: z.enum(["not_started", "submitted", "in_review", "verified", "rejected", "expired"]),
    referenceNumber: z.string().max(40).optional().default(""),
    reviewNote: z.string().max(300).optional().default(""),
  }),
});

export const updateKyc = [
  validate(editSchema),
  asyncHandler(async (req, res) => {
    res.json({ data: await kycService.update(actorFrom(req), req.valid.params.id, req.valid.body) });
  }),
];

export const removeKyc = asyncHandler(async (req, res) => {
  await kycService.remove(actorFrom(req), req.params.id);
  res.json({ data: { id: req.params.id } });
});
