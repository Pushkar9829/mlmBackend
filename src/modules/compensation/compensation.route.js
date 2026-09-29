import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { closePeriod, getPlan, ledgerEdit, listLedger, listPeriods, listRanks, listVolume, periodEdit, rankEdit, savePlan, volumeEdit } from "./compensation.controller.js";

export const compensationRouter = Router();

compensationRouter.get("/plan", authenticate, authorize("compensation.read"), getPlan);
compensationRouter.put("/plan", authenticate, authorize("compensation.manage"), savePlan);
compensationRouter.get("/periods", authenticate, authorize("compensation.read"), listPeriods);
compensationRouter.patch("/periods/:id", authenticate, authorize("compensation.manage"), periodEdit.save);
compensationRouter.delete("/periods/:id", authenticate, authorize("compensation.manage"), periodEdit.drop);
compensationRouter.post("/periods/:id/close", authenticate, authorize("periods.manage"), closePeriod);
compensationRouter.get("/volume", authenticate, authorize("volume.read"), listVolume);
compensationRouter.patch("/volume/:id", authenticate, authorize("compensation.manage"), volumeEdit.save);
compensationRouter.delete("/volume/:id", authenticate, authorize("compensation.manage"), volumeEdit.drop);
compensationRouter.get("/ledger", authenticate, authorize("ledger.read"), listLedger);
compensationRouter.patch("/ledger/:id", authenticate, authorize("compensation.manage"), ledgerEdit.save);
compensationRouter.delete("/ledger/:id", authenticate, authorize("compensation.manage"), ledgerEdit.drop);
compensationRouter.get("/ranks", authenticate, authorize("ranks.read"), listRanks);
compensationRouter.patch("/ranks/:id", authenticate, authorize("compensation.manage"), rankEdit.save);
compensationRouter.delete("/ranks/:id", authenticate, authorize("compensation.manage"), rankEdit.drop);
