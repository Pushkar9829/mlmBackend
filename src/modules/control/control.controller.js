import { z } from "zod";
import { actorFrom } from "../../utils/actor.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { validate } from "../../utils/validate.js";
import { notificationService } from "./notification.service.js";
import { controlService } from "./control.service.js";

const campaignBody = z.object({
  name: z.string().min(2).max(80),
  product: z.string().optional().nullable(),
  startsOn: z.string(),
  endsOn: z.string(),
  budget: z.number().nonnegative(),
  awardAmount: z.number().nonnegative(),
  status: z.enum(["draft", "live", "closed"]),
});

const grievanceBody = z.object({
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(3).max(1000),
});

export const listNotifications = asyncHandler(async (req, res) => {
  res.json({ data: await notificationService.list(actorFrom(req)) });
});

export const readNotification = asyncHandler(async (req, res) => {
  res.json({ data: await notificationService.markRead(actorFrom(req), req.params.id) });
});

export const updateNotification = [
  validate(z.object({
    params: z.object({ id: z.string().min(1) }),
    query: z.object({}).optional(),
    body: z.object({ title: z.string().min(2).max(120), body: z.string().min(2).max(500) }),
  })),
  asyncHandler(async (req, res) => {
    const data = await notificationService.update(actorFrom(req), req.valid.params.id, req.valid.body);
    if (!data) return res.status(404).json({ message: "Notice not found." });
    res.json({ data });
  }),
];

export const removeNotification = asyncHandler(async (req, res) => {
  const data = await notificationService.remove(actorFrom(req), req.params.id);
  if (!data) return res.status(404).json({ message: "Notice not found." });
  res.json({ data });
});

export const listCampaigns = asyncHandler(async (req, res) => {
  res.json({ data: await controlService.campaigns() });
});

export const createCampaign = [
  validate(z.object({ params: z.object({}).optional(), query: z.object({}).optional(), body: campaignBody })),
  asyncHandler(async (req, res) => {
    const body = { ...req.valid.body, startsOn: new Date(req.valid.body.startsOn), endsOn: new Date(req.valid.body.endsOn) };
    if (!body.product) body.product = null;
    res.status(201).json({ data: await controlService.saveCampaign(actorFrom(req), body) });
  }),
];

export const updateCampaign = [
  validate(z.object({ params: z.object({ id: z.string() }), query: z.object({}).optional(), body: campaignBody })),
  asyncHandler(async (req, res) => {
    const body = { ...req.valid.body, startsOn: new Date(req.valid.body.startsOn), endsOn: new Date(req.valid.body.endsOn) };
    if (!body.product) body.product = null;
    res.json({ data: await controlService.saveCampaign(actorFrom(req), body, req.valid.params.id) });
  }),
];

export const listFraud = asyncHandler(async (req, res) => {
  res.json({ data: await controlService.fraudList() });
});

export const reviewFraud = [
  validate(z.object({
    params: z.object({ id: z.string() }),
    query: z.object({}).optional(),
    body: z.object({ status: z.enum(["open", "cleared", "confirmed"]), note: z.string().max(300).optional().default("") }),
  })),
  asyncHandler(async (req, res) => {
    res.json({ data: await controlService.reviewFraud(actorFrom(req), req.valid.params.id, req.valid.body) });
  }),
];

export const updateFraud = [
  validate(z.object({
    params: z.object({ id: z.string() }),
    query: z.object({}).optional(),
    body: z.object({
      pattern: z.string().min(2).max(80),
      status: z.enum(["open", "cleared", "confirmed"]),
      note: z.string().max(300).optional().default(""),
    }),
  })),
  asyncHandler(async (req, res) => {
    res.json({ data: await controlService.updateFraud(actorFrom(req), req.valid.params.id, req.valid.body) });
  }),
];

export const removeFraud = asyncHandler(async (req, res) => {
  await controlService.removeFraud(actorFrom(req), req.params.id);
  res.json({ data: { id: req.params.id } });
});

export const listGrievances = asyncHandler(async (req, res) => {
  res.json({ data: await controlService.grievances(actorFrom(req)) });
});

export const createGrievance = [
  validate(z.object({ params: z.object({}).optional(), query: z.object({}).optional(), body: grievanceBody })),
  asyncHandler(async (req, res) => {
    res.status(201).json({ data: await controlService.openGrievance(actorFrom(req), req.valid.body) });
  }),
];

export const reviewGrievance = [
  validate(z.object({
    params: z.object({ id: z.string() }),
    query: z.object({}).optional(),
    body: z.object({
      status: z.enum(["under_review", "closed", "open"]),
      response: z.string().max(1000).optional().default(""),
    }),
  })),
  asyncHandler(async (req, res) => {
    res.json({ data: await controlService.reviewGrievance(actorFrom(req), req.valid.params.id, req.valid.body) });
  }),
];

export const removeCampaign = asyncHandler(async (req, res) => {
  await controlService.removeCampaign(actorFrom(req), req.params.id);
  res.json({ data: { id: req.params.id } });
});

export const removeGrievance = asyncHandler(async (req, res) => {
  await controlService.removeGrievance(actorFrom(req), req.params.id);
  res.json({ data: { id: req.params.id } });
});

export const report = asyncHandler(async (req, res) => {
  res.json({ data: await controlService.report() });
});
