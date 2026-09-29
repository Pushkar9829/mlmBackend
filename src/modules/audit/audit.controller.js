import { z } from "zod";
import { actorFrom } from "../../utils/actor.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { validate } from "../../utils/validate.js";
import { auditService } from "./audit.service.js";

const listQuery = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    action: z.string().optional(),
    actorEmail: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    page: z.coerce.number().optional(),
    limit: z.coerce.number().optional(),
  }),
});

export const listAudit = [
  validate(listQuery),
  asyncHandler(async (req, res) => {
    const result = await auditService.list(req.valid.query);
    res.json(result);
  }),
];

export const updateAudit = [
  validate(z.object({
    params: z.object({ id: z.string().min(1) }),
    query: z.object({}).optional(),
    body: z.object({ reason: z.string().max(300).optional().default("") }),
  })),
  asyncHandler(async (req, res) => {
    res.json({ data: await auditService.update(actorFrom(req), req.valid.params.id, req.valid.body) });
  }),
];

export const removeAudit = asyncHandler(async (req, res) => {
  res.json({ data: await auditService.remove(actorFrom(req), req.params.id) });
});
