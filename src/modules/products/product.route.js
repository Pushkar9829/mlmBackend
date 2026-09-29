import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { createProduct, listProducts, removeProduct, updateProduct } from "./product.controller.js";

export const productRouter = Router();

productRouter.get("/", authenticate, authorize("products.read"), listProducts);
productRouter.post("/", authenticate, authorize("products.manage"), createProduct);
productRouter.patch("/:id", authenticate, authorize("products.manage"), updateProduct);
productRouter.delete("/:id", authenticate, authorize("products.manage"), removeProduct);
