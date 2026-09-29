import { moduleRepo } from "./module.repo.js";

export const moduleService = {
  async listCatalog() {
    const rows = await moduleRepo.list();
    return rows.map(presentModule);
  },
  async forCodes(codes) {
    const rows = await moduleRepo.findByCodes(codes);
    return rows.map(presentModule);
  },
};

export function presentModule(row) {
  return {
    code: row.code,
    label: row.label,
    path: row.path,
    phase: row.phase,
    requiredPermission: row.requiredPermission,
    description: row.description,
    sortOrder: row.sortOrder,
  };
}
