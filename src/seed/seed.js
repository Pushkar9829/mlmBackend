import bcrypt from "bcryptjs";
import { config } from "../config/index.js";
import { connectDb } from "../config/db.js";
import { Role } from "../modules/roles/role.model.js";
import { permissionRepo, roleRepo } from "../modules/roles/role.repo.js";
import { moduleRepo } from "../modules/modules/module.repo.js";
import { User } from "../modules/users/user.model.js";
import { userRepo } from "../modules/users/user.repo.js";
import { appModules, demoPassword, demoUsers, permissions, roles } from "./catalog.js";
import { seedBusiness } from "./business.js";
import { feedModules } from "./feed.js";

export async function seed() {
  await permissionRepo.upsertMany(permissions);
  await moduleRepo.upsertMany(appModules);
  for (const role of roles) {
    await roleRepo.upsertByCode(role.code, role);
  }
  await upsertUser({
    name: "Platform Admin",
    email: config.seedAdminEmail,
    password: config.seedAdminPassword,
    roleCode: "admin",
  });
  if (config.seedDemoUsers) {
    for (const person of demoUsers) {
      await upsertUser({
        name: person.name,
        email: person.email,
        password: demoPassword,
        roleCode: person.role,
      });
    }
  }
  await seedBusiness();
  await feedModules();
  await User.deleteMany({ email: { $in: ["stockist@mlm.local", "super@mlm.local"] } });
  await Role.deleteMany({ code: { $in: ["stockist", "super_distributor"] } });
}

async function upsertUser({ name, email, password, roleCode }) {
  const role = await roleRepo.findByCode(roleCode);
  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await userRepo.findByEmail(email);
  if (!existing) {
    await userRepo.create({
      name,
      email,
      passwordHash,
      role: role._id,
      status: "active",
    });
    return;
  }
  await userRepo.updateById(existing._id, { name, role: role._id, status: "active" });
  await userRepo.setPassword(existing._id, passwordHash);
}

const isDirectRun = process.argv[1] && process.argv[1].endsWith("seed.js");
if (isDirectRun) {
  connectDb()
    .then(() => seed())
    .then(() => {
      console.log("Seed complete.");
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
