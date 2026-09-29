import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { listAudit, removeAudit, updateAudit } from "./audit.controller.js";

export const auditRouter = Router();

auditRouter.get("/", authenticate, authorize("audit.read"), listAudit);
auditRouter.put("/:id", authenticate, authorize("audit.read"), updateAudit);
auditRouter.delete("/:id", authenticate, authorize("audit.read"), removeAudit);
