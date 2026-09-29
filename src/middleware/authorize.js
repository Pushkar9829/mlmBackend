import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { requestMeta } from "../utils/request-meta.js";
import { auditService } from "../modules/audit/audit.service.js";

export function authorize(permission) {
  return authorizeAny([permission]);
}

export function authorizeAny(permissionList) {
  return asyncHandler(async (req, res, next) => {
    const permissions = req.user?.role?.permissions || [];
    if (!permissionList.some((permission) => permissions.includes(permission))) {
      const meta = requestMeta(req);
      await auditService.record({
        action: "access.denied",
        actor: req.user?._id,
        actorEmail: req.user?.email || "",
        entity: "permission",
        entityId: permissionList.join(","),
        after: { permission: permissionList.join(","), path: req.originalUrl, method: req.method },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      throw new ApiError(403, "You do not have access to this action.");
    }
    next();
  });
}
