import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { listKyc, removeKyc, reviewKyc, submitKyc, updateKyc } from "./kyc.controller.js";

export const kycRouter = Router();

kycRouter.get("/", authenticate, authorize("kyc.read"), listKyc);
kycRouter.put("/me/:kind", authenticate, authorize("kyc.submit"), submitKyc);
kycRouter.patch("/:id/review", authenticate, authorize("kyc.review"), reviewKyc);
kycRouter.put("/:id", authenticate, authorize("kyc.review"), updateKyc);
kycRouter.delete("/:id", authenticate, authorize("kyc.review"), removeKyc);
