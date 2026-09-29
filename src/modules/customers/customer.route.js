import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { listCustomers, myLink, removeCustomer, saveCustomer, saveMyCustomer, saveMyLink } from "./customer.controller.js";

export const customerRouter = Router();

customerRouter.get("/", authenticate, authorize("customers.read"), listCustomers);
customerRouter.get("/link", authenticate, authorize("customers.read"), myLink);
customerRouter.put("/link", authenticate, authorize("customers.update"), saveMyLink);
customerRouter.put("/me", authenticate, authorize("customers.update"), saveMyCustomer);
customerRouter.put("/:userId", authenticate, authorize("customers.update"), saveCustomer);
customerRouter.delete("/:userId", authenticate, authorize("customers.update"), removeCustomer);
