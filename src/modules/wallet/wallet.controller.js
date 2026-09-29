import { z } from "zod";
import { actorFrom } from "../../utils/actor.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { validate } from "../../utils/validate.js";
import { walletService } from "./wallet.service.js";

const payoutSchema = z.object({
  params: z.object({}).optional(),
  query: z.object({}).optional(),
  body: z.object({ amount: z.number().positive() }),
});

const reviewPayoutSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  query: z.object({}).optional(),
  body: z.object({
    status: z.enum(["approved", "paid", "rejected", "failed"]),
    reason: z.string().max(300).optional().default(""),
  }),
});

const disputeSchema = z.object({
  params: z.object({}).optional(),
  query: z.object({}).optional(),
  body: z.object({
    ledgerLineId: z.string().min(1),
    reason: z.string().trim().min(3).max(300),
  }),
});

const reviewDisputeSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  query: z.object({}).optional(),
  body: z.object({
    status: z.enum(["approved", "rejected"]),
    resolution: z.string().max(300).optional().default(""),
  }),
});

export const getWallet = asyncHandler(async (req, res) => {
  res.json({ data: await walletService.summary(actorFrom(req)) });
});

export const requestPayout = [
  validate(payoutSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json({ data: await walletService.requestPayout(actorFrom(req), req.valid.body.amount) });
  }),
];

export const reviewPayout = [
  validate(reviewPayoutSchema),
  asyncHandler(async (req, res) => {
    res.json({ data: await walletService.reviewPayout(actorFrom(req), req.valid.params.id, req.valid.body) });
  }),
];

export const openDispute = [
  validate(disputeSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json({ data: await walletService.openDispute(actorFrom(req), req.valid.body) });
  }),
];

export const reviewDispute = [
  validate(reviewDisputeSchema),
  asyncHandler(async (req, res) => {
    res.json({ data: await walletService.reviewDispute(actorFrom(req), req.valid.params.id, req.valid.body) });
  }),
];

const payoutEditSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  query: z.object({}).optional(),
  body: z.object({
    amount: z.number().positive(),
    status: z.enum(["requested", "approved", "paid", "rejected", "failed"]),
    reason: z.string().max(300).optional().default(""),
  }),
});

const disputeEditSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  query: z.object({}).optional(),
  body: z.object({
    reason: z.string().min(3).max(300),
    status: z.enum(["open", "approved", "rejected"]),
    resolution: z.string().max(300).optional().default(""),
  }),
});

export const updatePayout = [
  validate(payoutEditSchema),
  asyncHandler(async (req, res) => {
    res.json({ data: await walletService.updatePayout(actorFrom(req), req.valid.params.id, req.valid.body) });
  }),
];

export const removePayout = asyncHandler(async (req, res) => {
  await walletService.removePayout(actorFrom(req), req.params.id);
  res.json({ data: { id: req.params.id } });
});

export const updateDispute = [
  validate(disputeEditSchema),
  asyncHandler(async (req, res) => {
    res.json({ data: await walletService.updateDispute(actorFrom(req), req.valid.params.id, req.valid.body) });
  }),
];

export const removeDispute = asyncHandler(async (req, res) => {
  await walletService.removeDispute(actorFrom(req), req.params.id);
  res.json({ data: { id: req.params.id } });
});
