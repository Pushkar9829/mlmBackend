import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { createUser, listUsers, removeUser, updateUser, updateUserRole, updateUserStatus } from "./user.controller.js";

export const userRouter = Router();

userRouter.get("/", authenticate, authorize("users.read"), listUsers);
userRouter.post("/", authenticate, authorize("users.create"), createUser);
userRouter.patch("/:id/status", authenticate, authorize("users.suspend"), updateUserStatus);
userRouter.patch("/:id/role", authenticate, authorize("users.update"), updateUserRole);
userRouter.patch("/:id", authenticate, authorize("users.update"), updateUser);
userRouter.delete("/:id", authenticate, authorize("users.update"), removeUser);
