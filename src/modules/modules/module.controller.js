import { asyncHandler } from "../../utils/async-handler.js";
import { moduleService } from "./module.service.js";

export const listModules = asyncHandler(async (req, res) => {
  const data = await moduleService.listCatalog();
  res.json({ data });
});
