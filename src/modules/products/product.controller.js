import { z } from "zod";
import { actorFrom } from "../../utils/actor.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { validate } from "../../utils/validate.js";
import { productService } from "./product.service.js";

const productBody = z.object({
  name: z.string().trim().min(2).max(80),
  sku: z.string().trim().min(2).max(40),
  price: z.number().nonnegative(),
  pv: z.number().nonnegative(),
  bv: z.number().nonnegative(),
  commissionEligible: z.boolean().optional().default(true),
  rankEligible: z.boolean().optional().default(true),
  bonusEligible: z.boolean().optional().default(true),
  retailEligible: z.boolean().optional().default(true),
  networkEligible: z.boolean().optional().default(true),
  active: z.boolean().optional().default(true),
});

const createSchema = z.object({
  params: z.object({}).optional(),
  query: z.object({}).optional(),
  body: productBody,
});

const updateSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  query: z.object({}).optional(),
  body: productBody,
});

export const listProducts = asyncHandler(async (req, res) => {
  const data = await productService.list(actorFrom(req));
  res.json({ data });
});

export const createProduct = [
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const data = await productService.save(actorFrom(req), req.valid.body);
    res.status(201).json({ data });
  }),
];

export const updateProduct = [
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const data = await productService.save(actorFrom(req), req.valid.body, req.valid.params.id);
    res.json({ data });
  }),
];

export const removeProduct = asyncHandler(async (req, res) => {
  await productService.remove(actorFrom(req), req.params.id);
  res.json({ data: { id: req.params.id } });
});
