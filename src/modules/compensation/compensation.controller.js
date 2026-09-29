import { z } from "zod";
import { actorFrom } from "../../utils/actor.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { validate } from "../../utils/validate.js";
import { compensationService } from "./compensation.service.js";

const planSchema = z.object({
  params: z.object({}).optional(),
  query: z.object({}).optional(),
  body: z.object({
    name: z.string().min(2).max(80),
    commissionBase: z.enum(["bv", "price"]),
    directPercent: z.number().nonnegative(),
    levelPercents: z.array(z.number().nonnegative()).max(10),
    binaryMatchPercent: z.number().nonnegative(),
    binaryCap: z.number().nonnegative(),
    minPv: z.number().nonnegative(),
    withholdingPercent: z.number().nonnegative(),
    payoutMinimum: z.number().nonnegative(),
    rankRules: z.array(z.object({
      code: z.string().min(2),
      minPv: z.number().nonnegative(),
      minEachLeg: z.number().nonnegative(),
    })).default([]),
  }),
});

export const getPlan = asyncHandler(async (req, res) => {
  res.json({ data: await compensationService.plan() });
});

export const savePlan = [
  validate(planSchema),
  asyncHandler(async (req, res) => {
    const data = await compensationService.savePlan(actorFrom(req), req.valid.body);
    res.json({ data });
  }),
];

export const listPeriods = asyncHandler(async (req, res) => {
  res.json({ data: await compensationService.periods() });
});

export const closePeriod = asyncHandler(async (req, res) => {
  const data = await compensationService.closePeriod(actorFrom(req), req.params.id);
  res.json({ data });
});

export const listVolume = asyncHandler(async (req, res) => {
  res.json({ data: await compensationService.volume(actorFrom(req)) });
});

export const listLedger = asyncHandler(async (req, res) => {
  res.json({ data: await compensationService.ledger(actorFrom(req)) });
});

export const listRanks = asyncHandler(async (req, res) => {
  res.json({ data: await compensationService.ranks(actorFrom(req)) });
});

function editable(update, remove) {
  const save = [
    validate(z.object({
      params: z.object({ id: z.string().min(1) }),
      query: z.object({}).optional(),
      body: z.record(z.any()),
    })),
    asyncHandler(async (req, res) => {
      res.json({ data: await update(actorFrom(req), req.valid.params.id, req.valid.body) });
    }),
  ];
  const drop = asyncHandler(async (req, res) => {
    res.json({ data: await remove(actorFrom(req), req.params.id) });
  });
  return { save, drop };
}

export const volumeEdit = editable(compensationService.updateVolume, compensationService.removeVolume);
export const ledgerEdit = editable(compensationService.updateLedger, compensationService.removeLedger);
export const rankEdit = editable(compensationService.updateRank, compensationService.removeRank);
export const periodEdit = editable(compensationService.updatePeriod, compensationService.removePeriod);
