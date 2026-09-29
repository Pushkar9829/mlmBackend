import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { listModules } from "./module.controller.js";

export const moduleRouter = Router();

moduleRouter.get("/", authenticate, authorize("modules.read"), listModules);
