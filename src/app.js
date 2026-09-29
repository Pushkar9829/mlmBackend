import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { config } from "./config/index.js";
import { authRouter } from "./modules/auth/auth.route.js";
import { userRouter } from "./modules/users/user.route.js";
import { roleRouter } from "./modules/roles/role.route.js";
import { moduleRouter } from "./modules/modules/module.route.js";
import { auditRouter } from "./modules/audit/audit.route.js";
import { customerRouter } from "./modules/customers/customer.route.js";
import { partnerRouter } from "./modules/partners/partner.route.js";
import { kycRouter } from "./modules/kyc/kyc.route.js";
import { productRouter } from "./modules/products/product.route.js";
import { orderRouter } from "./modules/orders/order.route.js";
import { networkRouter } from "./modules/network/network.route.js";
import { compensationRouter } from "./modules/compensation/compensation.route.js";
import { walletRouter } from "./modules/wallet/wallet.route.js";
import { campaignRouter, fraudRouter, grievanceRouter, notificationRouter, reportRouter } from "./modules/control/control.route.js";
import { errorHandler, notFound } from "./middleware/error-handler.js";

export function createApp() {
  const app = express();
  app.use(cors({
    origin(origin, callback) {
      const local = typeof origin === "string" && /^http:\/\/localhost:\d+$/.test(origin);
      if (!origin || origin === config.clientOrigin || local) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed"));
    },
    credentials: true,
  }));
  app.use(express.json());
  app.use(cookieParser());

  app.get("/api/health", (req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/users", userRouter);
  app.use("/api/roles", roleRouter);
  app.use("/api/modules", moduleRouter);
  app.use("/api/audit", auditRouter);
  app.use("/api/customers", customerRouter);
  app.use("/api/partners", partnerRouter);
  app.use("/api/kyc", kycRouter);
  app.use("/api/products", productRouter);
  app.use("/api/orders", orderRouter);
  app.use("/api/network", networkRouter);
  app.use("/api/compensation", compensationRouter);
  app.use("/api/wallet", walletRouter);
  app.use("/api/notifications", notificationRouter);
  app.use("/api/campaigns", campaignRouter);
  app.use("/api/fraud", fraudRouter);
  app.use("/api/grievances", grievanceRouter);
  app.use("/api/reports", reportRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
