import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { getWallet, openDispute, removeDispute, removePayout, requestPayout, reviewDispute, reviewPayout, updateDispute, updatePayout } from "./wallet.controller.js";

export const walletRouter = Router();

walletRouter.get("/", authenticate, authorize("wallet.read"), getWallet);
walletRouter.post("/payouts", authenticate, authorize("payouts.request"), requestPayout);
walletRouter.patch("/payouts/:id", authenticate, authorize("payouts.approve"), reviewPayout);
walletRouter.put("/payouts/:id", authenticate, authorize("payouts.approve"), updatePayout);
walletRouter.delete("/payouts/:id", authenticate, authorize("payouts.approve"), removePayout);
walletRouter.post("/disputes", authenticate, authorize("disputes.create"), openDispute);
walletRouter.patch("/disputes/:id", authenticate, authorize("disputes.review"), reviewDispute);
walletRouter.put("/disputes/:id", authenticate, authorize("disputes.review"), updateDispute);
walletRouter.delete("/disputes/:id", authenticate, authorize("disputes.review"), removeDispute);
