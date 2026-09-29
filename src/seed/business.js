import { compensationRepo } from "../modules/compensation/compensation.repo.js";
import { customerRepo } from "../modules/customers/customer.repo.js";
import { kycRepo } from "../modules/kyc/kyc.repo.js";
import { agreementRepo, partnerRepo } from "../modules/partners/partner.repo.js";
import { productRepo } from "../modules/products/product.repo.js";
import { userRepo } from "../modules/users/user.repo.js";

export async function seedBusiness() {
  await agreementRepo.upsert("1", {
    version: "1",
    title: "Distributor agreement",
    body: "You sell goods. You earn only from qualifying product sales under the active plan. Recruitment alone does not pay. You will use only approved product and income statements.",
    active: true,
  });

  const customer = await userRepo.findByEmail("customer@mlm.local");
  if (customer) {
    await customerRepo.upsert(customer._id, {
      phone: "9999999999",
      addressLine: "12 Market Road",
      city: "Jaipur",
      state: "Rajasthan",
      pincode: "302001",
    });
  }

  const partnerUser = await userRepo.findByEmail("partner@mlm.local");
  if (partnerUser) {
    const existing = await partnerRepo.findByUser(partnerUser._id);
    if (!existing) {
      await partnerRepo.create({
        user: partnerUser._id,
        phone: "9888888888",
        addressLine: "44 Station Road",
        city: "Jaipur",
        state: "Rajasthan",
        pincode: "302006",
        applicationStatus: "active",
        sponsorLocked: true,
        placementLocked: true,
        agreementVersion: "1",
        agreementAcceptedAt: new Date(),
        bankAccountName: "Partner User",
        bankAccountNumber: "123456789012",
        bankIfsc: "HDFC0001234",
        bankVerified: true,
        taxId: "ABCDE1234F",
        currentRank: "starter",
      });
    }
    for (const kind of ["identity", "address", "bank", "tax"]) {
      const doc = await kycRepo.findByUserAndKind(partnerUser._id, kind);
      if (!doc) {
        await kycRepo.create({ user: partnerUser._id, kind, status: "verified", referenceNumber: `SEED-${kind.toUpperCase()}` });
      }
    }
  }

  if (!await productRepo.findBySku("NUTR-1")) {
    await productRepo.create({
      name: "Daily Nutrition",
      sku: "NUTR-1",
      price: 10000,
      pv: 1000,
      bv: 8000,
      commissionEligible: true,
      rankEligible: true,
      bonusEligible: true,
      retailEligible: true,
      networkEligible: true,
      active: true,
    });
  }

  if (!await compensationRepo.activePlan()) {
    await compensationRepo.createPlan({
      name: "Sample direct selling plan",
      version: 1,
      status: "active",
      commissionBase: "bv",
      directPercent: 10,
      levelPercents: [5, 3],
      binaryMatchPercent: 10,
      binaryCap: 50000,
      minPv: 100,
      withholdingPercent: 0,
      payoutMinimum: 500,
      rankRules: [
        { code: "bronze", minPv: 100, minEachLeg: 0 },
        { code: "silver", minPv: 500, minEachLeg: 1000 },
        { code: "gold", minPv: 1000, minEachLeg: 5000 },
      ],
    });
  }

  if (!await compensationRepo.openPeriod()) {
    const start = new Date();
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    await compensationRepo.createPeriod({
      name: `Week of ${start.toISOString().slice(0, 10)}`,
      startsOn: start,
      endsOn: end,
      status: "open",
    });
  }
}
