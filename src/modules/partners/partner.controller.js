import { z } from "zod";
import { actorFrom } from "../../utils/actor.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { validate } from "../../utils/validate.js";
import { partnerService } from "./partner.service.js";

const saveSchema = z.object({
  params: z.object({}).optional(),
  query: z.object({}).optional(),
  body: z.object({
    phone: z.string().max(20).optional(),
    addressLine: z.string().max(160).optional(),
    city: z.string().max(80).optional(),
    state: z.string().max(80).optional(),
    pincode: z.string().max(12).optional(),
    sponsorEmail: z.string().email().optional().or(z.literal("")),
    bankAccountName: z.string().max(80).optional(),
    bankAccountNumber: z.string().max(30).optional(),
    bankIfsc: z.string().max(20).optional(),
    taxId: z.string().max(20).optional(),
    nomineeName: z.string().max(80).optional(),
    nomineeRelation: z.string().max(40).optional(),
  }),
});

const reviewSchema = z.object({
  params: z.object({ userId: z.string().min(1) }),
  query: z.object({}).optional(),
  body: z.object({
    applicationStatus: z.enum(["applied", "kyc_pending", "kyc_rejected", "agreement_pending", "pending_first_order", "active"]),
    reason: z.string().trim().min(3).max(300),
  }),
});

export const listPartners = asyncHandler(async (req, res) => {
  const data = await partnerService.list(actorFrom(req));
  res.json({ data });
});

export const saveMyPartner = [
  validate(saveSchema),
  asyncHandler(async (req, res) => {
    const body = { ...req.valid.body };
    if (!body.sponsorEmail) delete body.sponsorEmail;
    const data = await partnerService.saveMine(actorFrom(req), body);
    res.json({ data });
  }),
];

export const savePartner = [
  validate(z.object({
    params: z.object({ userId: z.string().min(1) }),
    query: z.object({}).optional(),
    body: saveSchema.shape.body,
  })),
  asyncHandler(async (req, res) => {
    const body = { ...req.valid.body };
    if (!body.sponsorEmail) delete body.sponsorEmail;
    res.json({ data: await partnerService.saveFor(actorFrom(req), req.valid.params.userId, body) });
  }),
];

export const removePartner = asyncHandler(async (req, res) => {
  await partnerService.remove(actorFrom(req), req.params.userId);
  res.json({ data: { id: req.params.userId } });
});

export const getAgreement = asyncHandler(async (req, res) => {
  const data = await partnerService.currentAgreement();
  res.json({ data });
});

export const acceptAgreement = asyncHandler(async (req, res) => {
  const data = await partnerService.acceptAgreement(actorFrom(req));
  res.json({ data });
});

export const reviewPartner = [
  validate(reviewSchema),
  asyncHandler(async (req, res) => {
    const data = await partnerService.review(actorFrom(req), req.valid.params.userId, req.valid.body);
    res.json({ data });
  }),
];
