import { z } from "zod";
import { asyncHandler } from "../../utils/async-handler.js";
import { validate } from "../../utils/validate.js";
import { requestMeta } from "../../utils/request-meta.js";
import { permissionRepo } from "./role.repo.js";
import { roleService } from "./role.service.js";

const updateSchema = z.object({
  params: z.object({ code: z.string().min(1) }),
  query: z.object({}).optional(),
  body: z.object({
    permissions: z.array(z.string()).default([]),
    modules: z.array(z.string()).default([]),
    reason: z.string().max(300).optional(),
  }),
});

export const listRoles = asyncHandler(async (req, res) => {
  const [roles, permissions] = await Promise.all([roleService.list(), permissionRepo.list()]);
  res.json({
    data: roles,
    permissions: permissions.map((item) => ({
      code: item.code,
      description: item.description,
      group: item.group,
    })),
  });
});

export const updateRole = [
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const meta = requestMeta(req);
    const data = await roleService.updateAccess(
      req.valid.params.code,
      req.valid.body,
      { id: req.user._id, email: req.user.email, ...meta },
    );
    res.json({ data });
  }),
];
