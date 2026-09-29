import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { listRoles, updateRole } from "./role.controller.js";

export const roleRouter = Router();

roleRouter.get("/", authenticate, authorize("roles.read"), listRoles);
roleRouter.put("/:code", authenticate, authorize("roles.update"), updateRole);
