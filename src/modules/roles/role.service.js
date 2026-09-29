import { ApiError } from "../../utils/api-error.js";
import { auditService } from "../audit/audit.service.js";
import { moduleRepo } from "../modules/module.repo.js";
import { permissionRepo, roleRepo } from "./role.repo.js";

const PROTECTED_ADMIN_PERMISSIONS = ["users.read", "roles.read", "roles.update"];

export const roleService = {
  async list() {
    const roles = await roleRepo.list();
    return roles.map(presentRole);
  },

  async updateAccess(code, { permissions, modules, reason }, actor) {
    const role = await roleRepo.findByCode(code);
    if (!role) throw new ApiError(404, "Role not found.");

    const knownPermissions = new Set(await permissionRepo.codes());
    const knownModules = new Set(await moduleRepo.codes());
    const unknownPermission = permissions.find((item) => !knownPermissions.has(item));
    const unknownModule = modules.find((item) => !knownModules.has(item));
    if (unknownPermission) throw new ApiError(400, `Unknown permission ${unknownPermission}.`);
    if (unknownModule) throw new ApiError(400, `Unknown module ${unknownModule}.`);

    if (code === "admin") {
      const missing = PROTECTED_ADMIN_PERMISSIONS.filter((item) => !permissions.includes(item));
      if (missing.length) {
        throw new ApiError(400, "The admin role must keep user and role management.");
      }
    }

    const before = {
      permissions: [...role.permissions],
      modules: [...role.modules],
    };
    const updated = await roleRepo.updateByCode(code, { permissions, modules });
    await auditService.record({
      actor: actor.id,
      actorEmail: actor.email,
      action: "role.access_changed",
      entity: "role",
      entityId: String(role._id),
      before,
      after: { permissions, modules },
      reason: reason || "",
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    return presentRole(updated);
  },
};

export function presentRole(role) {
  return {
    id: String(role._id),
    code: role.code,
    name: role.name,
    description: role.description,
    permissions: role.permissions,
    modules: role.modules,
  };
}
