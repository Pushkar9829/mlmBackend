import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { acceptAgreement, getAgreement, listPartners, removePartner, reviewPartner, saveMyPartner, savePartner } from "./partner.controller.js";

export const partnerRouter = Router();

partnerRouter.get("/", authenticate, authorize("partners.read"), listPartners);
partnerRouter.put("/me", authenticate, authorize("partners.apply"), saveMyPartner);
partnerRouter.put("/:userId", authenticate, authorize("partners.review"), savePartner);
partnerRouter.delete("/:userId", authenticate, authorize("partners.review"), removePartner);
partnerRouter.get("/agreement", authenticate, authorize("partners.read"), getAgreement);
partnerRouter.post("/me/agreement", authenticate, authorize("partners.apply"), acceptAgreement);
partnerRouter.patch("/:userId/review", authenticate, authorize("partners.review"), reviewPartner);
