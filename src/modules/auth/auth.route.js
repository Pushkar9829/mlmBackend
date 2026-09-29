import { Router } from "express";
import { optionalAuthenticate, authenticate } from "../../middleware/authenticate.js";
import { changePassword, login, logout, me, refresh } from "./auth.controller.js";

export const authRouter = Router();

authRouter.post("/login", login);
authRouter.post("/refresh", refresh);
authRouter.post("/logout", optionalAuthenticate, logout);
authRouter.get("/me", authenticate, me);
authRouter.post("/change-password", authenticate, changePassword);
