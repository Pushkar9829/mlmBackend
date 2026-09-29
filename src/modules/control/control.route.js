import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize, authorizeAny } from "../../middleware/authorize.js";
import {
  createCampaign,
  createGrievance,
  listCampaigns,
  listFraud,
  listGrievances,
  listNotifications,
  readNotification,
  removeCampaign,
  removeGrievance,
  removeNotification,
  report,
  reviewFraud,
  reviewGrievance,
  updateCampaign,
  updateFraud,
  removeFraud,
  updateNotification,
} from "./control.controller.js";

export const notificationRouter = Router();
notificationRouter.get("/", authenticate, authorize("notifications.read"), listNotifications);
notificationRouter.post("/:id/read", authenticate, authorize("notifications.read"), readNotification);
notificationRouter.put("/:id", authenticate, authorize("notifications.read"), updateNotification);
notificationRouter.delete("/:id", authenticate, authorize("notifications.read"), removeNotification);

export const campaignRouter = Router();
campaignRouter.get("/", authenticate, authorize("campaigns.manage"), listCampaigns);
campaignRouter.post("/", authenticate, authorize("campaigns.manage"), createCampaign);
campaignRouter.patch("/:id", authenticate, authorize("campaigns.manage"), updateCampaign);
campaignRouter.delete("/:id", authenticate, authorize("campaigns.manage"), removeCampaign);

export const fraudRouter = Router();
fraudRouter.get("/", authenticate, authorize("fraud.read"), listFraud);
fraudRouter.patch("/:id", authenticate, authorize("fraud.review"), reviewFraud);
fraudRouter.put("/:id", authenticate, authorize("fraud.review"), updateFraud);
fraudRouter.delete("/:id", authenticate, authorize("fraud.review"), removeFraud);

export const grievanceRouter = Router();
grievanceRouter.get("/", authenticate, authorizeAny(["grievances.create", "grievances.review"]), listGrievances);
grievanceRouter.post("/", authenticate, authorize("grievances.create"), createGrievance);
grievanceRouter.patch("/:id", authenticate, authorize("grievances.review"), reviewGrievance);
grievanceRouter.delete("/:id", authenticate, authorizeAny(["grievances.create", "grievances.review"]), removeGrievance);

export const reportRouter = Router();
reportRouter.get("/summary", authenticate, authorize("reports.read"), report);
