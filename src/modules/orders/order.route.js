import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize, authorizeAny } from "../../middleware/authorize.js";
import { createOrder, listOrders, removeOrder, updateOrderStatus } from "./order.controller.js";

export const orderRouter = Router();

orderRouter.get("/", authenticate, authorizeAny(["products.read", "orders.update", "orders.create"]), listOrders);
orderRouter.post("/", authenticate, authorizeAny(["orders.create"]), createOrder);
orderRouter.patch("/:id/status", authenticate, authorizeAny(["orders.update", "orders.create"]), updateOrderStatus);
orderRouter.delete("/:id", authenticate, authorize("orders.update"), removeOrder);
