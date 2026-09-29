import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { clearPlacement, legs, place, placement, sponsorship } from "./network.controller.js";

export const networkRouter = Router();

networkRouter.get("/sponsorship", authenticate, authorize("network.read"), sponsorship);
networkRouter.get("/placement", authenticate, authorize("network.read"), placement);
networkRouter.get("/legs", authenticate, authorize("network.read"), legs);
networkRouter.post("/placement", authenticate, authorize("network.place"), place);
networkRouter.delete("/placement/:userId", authenticate, authorize("network.place"), clearPlacement);
