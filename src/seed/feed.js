import bcrypt from "bcryptjs";
import { AuditLog } from "../modules/audit/audit.model.js";
import { LedgerLine, Period, RankResult, VolumeEntry } from "../modules/compensation/compensation.model.js";
import { Campaign, Grievance } from "../modules/control/control.model.js";
import { FraudCase } from "../modules/control/fraud.model.js";
import { Notification } from "../modules/control/notification.model.js";
import { Customer } from "../modules/customers/customer.model.js";
import { KycDocument } from "../modules/kyc/kyc.model.js";
import { Order } from "../modules/orders/order.model.js";
import { Partner } from "../modules/partners/partner.model.js";
import { Product } from "../modules/products/product.model.js";
import { Role } from "../modules/roles/role.model.js";
import { User } from "../modules/users/user.model.js";
import { Dispute, Payout } from "../modules/wallet/wallet.model.js";
import { demoPassword } from "./catalog.js";

const kinds = ["identity", "address", "bank", "tax"];

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function daysAhead(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function ensureUser(passwordHash, roles, person) {
  const existing = await User.findOne({ email: person.email });
  if (existing) return existing;
  return User.create({
    name: person.name,
    email: person.email,
    passwordHash,
    role: roles[person.role]._id,
    status: person.status || "active",
    lastLoginAt: person.lastLoginAt || null,
  });
}

async function ensurePartner(user, fields) {
  const existing = await Partner.findOne({ user: user._id });
  if (existing) return existing;
  return Partner.create({ user: user._id, ...fields });
}

async function ensureCustomer(user, fields) {
  const existing = await Customer.findOne({ user: user._id });
  if (existing) return existing;
  return Customer.create({ user: user._id, ...fields });
}

async function ensureKyc(user, rows) {
  for (const row of rows) {
    const existing = await KycDocument.findOne({ user: user._id, kind: row.kind });
    if (!existing) await KycDocument.create({ user: user._id, ...row });
  }
}

async function ensureProduct(fields) {
  const existing = await Product.findOne({ sku: fields.sku });
  if (existing) return existing;
  return Product.create(fields);
}

async function ensureOrder(fields) {
  const existing = await Order.findOne({ number: fields.number });
  if (existing) return existing;
  return Order.create(fields);
}

export async function feedModules() {
  const passwordHash = await bcrypt.hash(demoPassword, 10);
  const roleRows = await Role.find({ code: { $in: ["partner", "customer"] } });
  const roles = Object.fromEntries(roleRows.map((role) => [role.code, role]));
  const rootUser = await User.findOne({ email: "partner@mlm.local" });
  const mainCustomer = await User.findOne({ email: "customer@mlm.local" });
  const admin = await User.findOne({ email: "admin@mlm.local" });
  if (!rootUser || !roles.partner || !roles.customer) return;

  const people = {
    anita: await ensureUser(passwordHash, roles, { name: "Anita Rao", email: "anita.left@mlm.local", role: "partner", lastLoginAt: daysAgo(2) }),
    ravi: await ensureUser(passwordHash, roles, { name: "Ravi Mehta", email: "ravi.ll@mlm.local", role: "partner", lastLoginAt: daysAgo(6) }),
    meera: await ensureUser(passwordHash, roles, { name: "Meera Iyer", email: "meera.lr@mlm.local", role: "partner" }),
    karan: await ensureUser(passwordHash, roles, { name: "Karan Singh", email: "karan.right@mlm.local", role: "partner", lastLoginAt: daysAgo(1) }),
    pooja: await ensureUser(passwordHash, roles, { name: "Pooja Nair", email: "pooja.rl@mlm.local", role: "partner" }),
    imran: await ensureUser(passwordHash, roles, { name: "Imran Qureshi", email: "imran.rr@mlm.local", role: "partner" }),
    neha: await ensureUser(passwordHash, roles, { name: "Neha Kapoor", email: "neha.sponsor@mlm.local", role: "partner" }),
    aisha: await ensureUser(passwordHash, roles, { name: "Aisha Khan", email: "aisha.buyer@mlm.local", role: "customer", lastLoginAt: daysAgo(3) }),
    vikram: await ensureUser(passwordHash, roles, { name: "Vikram Das", email: "vikram.buyer@mlm.local", role: "customer" }),
    lila: await ensureUser(passwordHash, roles, { name: "Lila Bose", email: "lila.buyer@mlm.local", role: "customer" }),
    omar: await ensureUser(passwordHash, roles, { name: "Omar Sheikh", email: "omar.buyer@mlm.local", role: "customer", status: "suspended" }),
    sara: await ensureUser(passwordHash, roles, { name: "Sara D'Souza", email: "sara.buyer@mlm.local", role: "customer" }),
  };

  const address = (city, state, pincode) => ({ addressLine: "12 Market Road", city, state, pincode });
  await ensurePartner(rootUser, {
    phone: "9888888888",
    ...address("Jaipur", "Rajasthan", "302006"),
    applicationStatus: "active",
    sponsorLocked: true,
    placementLocked: true,
    agreementVersion: "1",
    agreementAcceptedAt: daysAgo(40),
    bankAccountName: "Partner User",
    bankAccountNumber: "123456789012",
    bankIfsc: "HDFC0001234",
    bankVerified: true,
    taxId: "ABCDE1234F",
    nomineeName: "Riya User",
    nomineeRelation: "spouse",
    currentRank: "silver",
    activityStatus: "active",
    carryLeft: 2400,
    carryRight: 800,
    carryWeeks: 1,
  });
  await Partner.updateOne({ user: rootUser._id, currentRank: "starter" }, { currentRank: "silver", carryLeft: 2400, carryRight: 800, carryWeeks: 1 });

  const partnerFields = {
    anita: { sponsor: rootUser._id, placementParent: rootUser._id, placementSide: "left", applicationStatus: "active", currentRank: "bronze", bankVerified: true, placementLocked: true, sponsorLocked: true, agreementVersion: "1", agreementAcceptedAt: daysAgo(20), activityStatus: "active", phone: "9811111111", nomineeName: "Arun Rao", nomineeRelation: "spouse", bankAccountName: "Anita Rao", bankAccountNumber: "222233334444", bankIfsc: "HDFC0001111", taxId: "ANITA1234A", ...address("Ahmedabad", "Gujarat", "380001") },
    ravi: { sponsor: people.anita._id, placementParent: people.anita._id, placementSide: "left", applicationStatus: "pending_first_order", placementLocked: false, sponsorLocked: true, agreementVersion: "1", agreementAcceptedAt: daysAgo(5), phone: "9822222222", ...address("Surat", "Gujarat", "395003") },
    meera: { sponsor: people.anita._id, placementParent: people.anita._id, placementSide: "right", applicationStatus: "active", currentRank: "starter", bankVerified: true, placementLocked: true, sponsorLocked: true, agreementVersion: "1", agreementAcceptedAt: daysAgo(12), phone: "9833333333", bankAccountName: "Meera Iyer", bankAccountNumber: "555566667777", bankIfsc: "ICIC0002222", taxId: "MEERA1234B", ...address("Pune", "Maharashtra", "411001") },
    karan: { sponsor: rootUser._id, placementParent: rootUser._id, placementSide: "right", applicationStatus: "active", currentRank: "bronze", bankVerified: true, placementLocked: true, sponsorLocked: true, agreementVersion: "1", agreementAcceptedAt: daysAgo(18), activityStatus: "active", phone: "9844444444", bankAccountName: "Karan Singh", bankAccountNumber: "888899990000", bankIfsc: "SBIN0003333", taxId: "KARAN1234C", ...address("Lucknow", "Uttar Pradesh", "226001") },
    pooja: { sponsor: people.karan._id, placementParent: people.karan._id, placementSide: "left", applicationStatus: "kyc_pending", sponsorLocked: true, phone: "9855555555", ...address("Kochi", "Kerala", "682001") },
    imran: { sponsor: people.karan._id, placementParent: people.karan._id, placementSide: "right", applicationStatus: "agreement_pending", sponsorLocked: true, phone: "9866666666", ...address("Hyderabad", "Telangana", "500001") },
    neha: { sponsor: rootUser._id, applicationStatus: "applied", sponsorLocked: true, phone: "9877777777", ...address("Indore", "Madhya Pradesh", "452001") },
  };
  const leftTaken = await Partner.findOne({ placementParent: rootUser._id, placementSide: "left" });
  const rightTaken = await Partner.findOne({ placementParent: rootUser._id, placementSide: "right" });
  if (leftTaken) {
    delete partnerFields.anita.placementParent;
    delete partnerFields.anita.placementSide;
    delete partnerFields.anita.placementLocked;
  }
  if (rightTaken) {
    delete partnerFields.karan.placementParent;
    delete partnerFields.karan.placementSide;
    delete partnerFields.karan.placementLocked;
  }
  for (const [key, fields] of Object.entries(partnerFields)) {
    await ensurePartner(people[key], fields);
  }

  const kycByStatus = {
    active: kinds.map((kind) => ({ kind, status: "verified", referenceNumber: `KYC-${kind}` })),
    pending_first_order: kinds.map((kind) => ({ kind, status: "verified", referenceNumber: `KYC-${kind}` })),
    agreement_pending: kinds.map((kind) => ({ kind, status: "verified", referenceNumber: `KYC-${kind}` })),
    kyc_pending: [
      { kind: "identity", status: "submitted", referenceNumber: "KYC-ID" },
      { kind: "address", status: "in_review", referenceNumber: "KYC-AD" },
      { kind: "bank", status: "not_started", referenceNumber: "" },
      { kind: "tax", status: "not_started", referenceNumber: "" },
    ],
    applied: kinds.map((kind) => ({ kind, status: "not_started", referenceNumber: "" })),
  };
  await ensureKyc(rootUser, kycByStatus.active);
  await ensureKyc(people.anita, kycByStatus.active);
  await ensureKyc(people.meera, kycByStatus.active);
  await ensureKyc(people.karan, kycByStatus.active);
  await ensureKyc(people.ravi, kycByStatus.pending_first_order);
  await ensureKyc(people.imran, kycByStatus.agreement_pending);
  await ensureKyc(people.pooja, kycByStatus.kyc_pending);
  await ensureKyc(people.neha, [
    { kind: "identity", status: "rejected", referenceNumber: "KYC-BAD", reviewNote: "Photo did not match the name." },
    { kind: "address", status: "expired", referenceNumber: "KYC-OLD", expiresAt: daysAgo(3) },
    { kind: "bank", status: "not_started", referenceNumber: "" },
    { kind: "tax", status: "not_started", referenceNumber: "" },
  ]);

  if (mainCustomer) {
    await ensureCustomer(mainCustomer, { phone: "9999999999", ...address("Jaipur", "Rajasthan", "302001"), linkPartner: rootUser._id, linkFirstUsedAt: daysAgo(10) });
    await Customer.updateOne({ user: mainCustomer._id, linkPartner: null }, { linkPartner: rootUser._id, linkFirstUsedAt: daysAgo(10) });
  }
  await ensureCustomer(people.aisha, { phone: "9900000001", ...address("Ahmedabad", "Gujarat", "380015"), linkPartner: people.anita._id, linkFirstUsedAt: daysAgo(4) });
  await ensureCustomer(people.vikram, { phone: "9900000002", ...address("Pune", "Maharashtra", "411014"), linkPartner: people.meera._id, linkFirstUsedAt: daysAgo(40) });
  await ensureCustomer(people.lila, { phone: "9900000003", ...address("Lucknow", "Uttar Pradesh", "226010"), linkPartner: people.karan._id, linkFirstUsedAt: daysAgo(8) });
  await ensureCustomer(people.omar, { phone: "9900000004", ...address("Delhi", "Delhi", "110001") });
  await ensureCustomer(people.sara, { phone: "9900000005", ...address("Bengaluru", "Karnataka", "560001"), linkPartner: rootUser._id, linkFirstUsedAt: daysAgo(1) });

  const products = {
    nutr: await ensureProduct({ name: "Daily Nutrition", sku: "NUTR-1", price: 10000, pv: 1000, bv: 8000, commissionEligible: true, rankEligible: true, bonusEligible: true, retailEligible: true, networkEligible: true, active: true }),
    tea: await ensureProduct({ name: "Herbal Tea", sku: "TEA-1", price: 1500, pv: 150, bv: 1200, commissionEligible: true, rankEligible: true, bonusEligible: true, retailEligible: true, networkEligible: true, active: true }),
    care: await ensureProduct({ name: "Skin Care Set", sku: "CARE-2", price: 4500, pv: 450, bv: 3600, commissionEligible: true, rankEligible: true, bonusEligible: true, retailEligible: true, networkEligible: true, active: true }),
    oil: await ensureProduct({ name: "Hair Oil", sku: "OIL-3", price: 800, pv: 80, bv: 600, commissionEligible: true, rankEligible: false, bonusEligible: true, retailEligible: true, networkEligible: true, active: true }),
    kit: await ensureProduct({ name: "Welcome Kit", sku: "KIT-4", price: 2000, pv: 0, bv: 0, commissionEligible: false, rankEligible: false, bonusEligible: false, retailEligible: true, networkEligible: false, active: true }),
    old: await ensureProduct({ name: "Retired Blend", sku: "OLD-9", price: 500, pv: 50, bv: 400, commissionEligible: false, rankEligible: false, bonusEligible: false, retailEligible: false, networkEligible: false, active: false }),
  };

  const open = await Period.findOne({ status: "open" }).sort({ startsOn: -1 });
  let locked = await Period.findOne({ name: "Seed week locked" });
  if (!locked) {
    locked = await Period.create({
      name: "Seed week locked",
      startsOn: daysAgo(14),
      endsOn: daysAgo(7),
      status: "locked",
      closedAt: daysAgo(7),
    });
  }

  const orderRows = [
    ["SEED-1001", mainCustomer || people.aisha, rootUser, products.nutr, 1, "delivered", daysAgo(12), true],
    ["SEED-1002", people.aisha, people.anita, products.care, 2, "delivered", daysAgo(9), true],
    ["SEED-1003", people.lila, people.karan, products.tea, 3, "delivered", daysAgo(6), true],
    ["SEED-1004", people.sara, rootUser, products.oil, 1, "delivered", daysAgo(2), true],
    ["SEED-1005", people.vikram, people.meera, products.tea, 1, "shipped", null, false],
    ["SEED-1006", people.aisha, people.anita, products.nutr, 1, "packed", null, false],
    ["SEED-1007", people.lila, people.karan, products.care, 1, "paid", null, false],
    ["SEED-1008", people.sara, rootUser, products.tea, 2, "payment_pending", null, false],
    ["SEED-1009", people.omar, null, products.oil, 1, "cancelled", null, false],
    ["SEED-1010", people.aisha, people.anita, products.care, 1, "return_requested", daysAgo(20), true],
    ["SEED-1011", people.lila, people.karan, products.tea, 1, "returned", daysAgo(25), true],
    ["SEED-1012", mainCustomer || people.sara, rootUser, products.oil, 2, "refunded", daysAgo(28), true],
    ["SEED-1013", people.vikram, null, products.kit, 1, "delivered", daysAgo(3), false],
    ["SEED-1014", people.sara, rootUser, products.nutr, 1, "delivered", daysAgo(45), true],
  ];

  const orders = {};
  for (const [number, buyer, partner, product, qty, status, deliveredAt, posted] of orderRows) {
    if (!buyer) continue;
    orders[number] = await ensureOrder({
      number,
      buyer: buyer._id,
      attributedPartner: partner?._id || null,
      product: product._id,
      productName: product.name,
      sku: product.sku,
      qty,
      price: product.price,
      pv: product.pv,
      bv: product.bv,
      commissionEligible: product.commissionEligible,
      rankEligible: product.rankEligible,
      bonusEligible: product.bonusEligible,
      networkEligible: product.networkEligible,
      total: product.price * qty,
      status,
      deliveredAt,
      volumePosted: posted && product.commissionEligible,
      clawedBack: status === "refunded",
    });
  }

  const periodId = open?._id || locked._id;
  const volumeRows = [
    [rootUser, orders["SEED-1001"], "pv", "personal", 1000],
    [rootUser, orders["SEED-1001"], "leg", "left", 8000],
    [people.anita, orders["SEED-1002"], "pv", "personal", 900],
    [people.anita, orders["SEED-1002"], "leg", "left", 7200],
    [rootUser, orders["SEED-1002"], "leg", "left", 7200],
    [people.karan, orders["SEED-1003"], "pv", "personal", 450],
    [people.karan, orders["SEED-1003"], "leg", "right", 3600],
    [rootUser, orders["SEED-1003"], "leg", "right", 3600],
    [rootUser, orders["SEED-1004"], "pv", "personal", 80],
    [rootUser, orders["SEED-1012"], "pv", "personal", -160],
  ].filter((row) => row[1]);

  for (const [user, order, kind, side, amount] of volumeRows) {
    const exists = await VolumeEntry.findOne({ user: user._id, order: order._id, kind, side });
    if (!exists) {
      await VolumeEntry.create({
        user: user._id,
        order: order._id,
        period: periodId,
        kind,
        side,
        amount,
        status: amount < 0 ? "reversed" : "posted",
      });
    }
  }

  const ledgerPlan = [
    [rootUser, orders["SEED-1001"], "direct", 8000, 10, 800, "payable", "SEED direct on delivered nutrition"],
    [people.anita, orders["SEED-1002"], "direct", 7200, 10, 720, "payable", "SEED direct on skin care"],
    [rootUser, orders["SEED-1002"], "level", 7200, 5, 360, "payable", "SEED level 2 compressed to sponsor"],
    [people.karan, orders["SEED-1003"], "direct", 3600, 10, 360, "calculated", "SEED direct waiting for period close"],
    [rootUser, locked, "binary", 3600, 10, 360, "payable", "SEED binary match for the locked week"],
    [rootUser, orders["SEED-1012"], "direct", 1200, 10, -120, "payable", "SEED refund reversal"],
  ];

  const ledger = [];
  for (const [user, source, type, baseAmount, rate, net, status, note] of ledgerPlan) {
    const order = source?.number ? source : null;
    const period = source?.number ? periodId : source._id;
    const exists = await LedgerLine.findOne({ user: user._id, note });
    const line = exists || await LedgerLine.create({
      user: user._id,
      period,
      order: order?._id || null,
      type,
      sourceUser: order?.buyer || null,
      planVersion: 1,
      commissionBase: "bv",
      baseAmount,
      rate,
      gross: net,
      adjustment: 0,
      withholding: 0,
      net,
      status,
      note,
    });
    ledger.push(line);
  }
  const reversal = ledger.find((line) => line.note.startsWith("SEED refund"));
  const original = ledger.find((line) => line.note.startsWith("SEED direct on delivered"));
  if (reversal && original && !reversal.reversalOf) {
    reversal.reversalOf = original._id;
    await reversal.save();
  }

  const rankRows = [
    [rootUser, locked, "silver", "achieved", 1000, 15200, 3600],
    [people.anita, locked, "bronze", "qualified", 900, 7200, 0],
    [rootUser, open || locked, "silver", "grace", 80, 2400, 800],
    [people.karan, open || locked, "starter", "downgraded", 450, 0, 3600],
  ];
  for (const [user, period, rank, status, personalVolume, leftVolume, rightVolume] of rankRows) {
    if (!period) continue;
    const exists = await RankResult.findOne({ user: user._id, period: period._id, status });
    if (!exists) {
      await RankResult.create({ user: user._id, period: period._id, rank, status, personalVolume, leftVolume, rightVolume });
    }
  }

  const payouts = [
    [rootUser, 500, "requested", "SEED payout requested"],
    [rootUser, 1200, "paid", "SEED payout paid"],
    [people.anita, 500, "approved", "SEED payout approved"],
    [people.karan, 500, "rejected", "SEED payout rejected"],
  ];
  for (const [user, amount, status, reason] of payouts) {
    if (!await Payout.findOne({ user: user._id, reason })) {
      await Payout.create({ user: user._id, amount, status, reason });
    }
  }

  const disputeLine = ledger.find((line) => line.note.startsWith("SEED level"));
  const anitaLine = ledger.find((line) => String(line.user) === String(people.anita._id));
  if (disputeLine && !await Dispute.findOne({ ledgerLine: disputeLine._id })) {
    await Dispute.create({ user: rootUser._id, ledgerLine: disputeLine._id, reason: "SEED level rate looks short.", status: "open", resolution: "" });
  }
  if (anitaLine && !await Dispute.findOne({ ledgerLine: anitaLine._id })) {
    await Dispute.create({ user: people.anita._id, ledgerLine: anitaLine._id, reason: "SEED dispute already approved.", status: "approved", resolution: "Rate confirmed." });
  }

  const campaigns = [
    ["Monsoon tea push", products.tea, "live", 20000, 200, 4000],
    ["Skin care launch", products.care, "draft", 50000, 500, 0],
    ["Nutrition quarter", products.nutr, "closed", 80000, 800, 64000],
  ];
  for (const [name, product, status, budget, awardAmount, spent] of campaigns) {
    if (!await Campaign.findOne({ name })) {
      await Campaign.create({ name, product: product._id, startsOn: daysAgo(10), endsOn: daysAhead(20), budget, awardAmount, spent, status });
    }
  }

  const grievances = [
    [mainCustomer || people.aisha, "Late delivery", "SEED order arrived after the promised week.", "open", ""],
    [people.aisha, "Damaged jar", "SEED the nutrition jar lid was cracked.", "under_review", ""],
    [people.lila, "Wrong item", "SEED hair oil was sent instead of tea.", "closed", "Replacement shipped."],
    [rootUser, "Payout delay", "SEED the paid payout is not in the bank yet.", "open", ""],
  ];
  for (const [user, subject, message, status, response] of grievances) {
    if (user && !await Grievance.findOne({ user: user._id, subject })) {
      await Grievance.create({ user: user._id, subject, message, status, response });
    }
  }

  const frauds = [
    [people.omar, "repeated_refund", "open", "SEED two refunds on the same buyer.", orders["SEED-1012"]],
    [people.vikram, "duplicate_account", "cleared", "SEED same address as an existing buyer. Cleared.", null],
    [people.aisha, "repeated_refund", "confirmed", "SEED refund pattern confirmed. Ledger kept.", orders["SEED-1010"]],
  ];
  for (const [user, pattern, status, note, order] of frauds) {
    if (!await FraudCase.findOne({ user: user._id, note })) {
      await FraudCase.create({ user: user._id, pattern, status, note, order: order?._id || null });
    }
  }

  const notices = [
    [rootUser, "Rank held", "SEED silver is in grace for this open week."],
    [people.anita, "Payout approved", "SEED finance approved ₹500."],
    [people.pooja, "KYC waiting", "SEED address document is in review."],
    [mainCustomer || people.sara, "Order delivered", "SEED Daily Nutrition was delivered."],
    [admin, "Period locked", "SEED the previous week is locked."],
  ];
  for (const [user, title, body] of notices) {
    if (user && !await Notification.findOne({ user: user._id, title })) {
      await Notification.create({ user: user._id, title, body, read: false });
    }
  }

  const audits = [
    ["user.created", "user", "seed-anita", "anita.left@mlm.local", "Opened a partner account"],
    ["kyc.verified", "kyc", "seed-anita-bank", "compliance@mlm.local", "Bank document matched"],
    ["order.delivered", "order", "SEED-1001", "warehouse@mlm.local", "Marked delivered"],
    ["period.locked", "period", "seed-week", "finance@mlm.local", "Closed the sample week"],
    ["payout.requested", "payout", "seed-payout", "partner@mlm.local", "Requested ₹500"],
    ["fraud.reviewed", "fraud", "seed-omar", "compliance@mlm.local", "Left the refund case open"],
  ];
  for (const [action, entity, entityId, actorEmail, reason] of audits) {
    if (!await AuditLog.findOne({ action, entityId })) {
      await AuditLog.create({
        actor: admin?._id || null,
        actorEmail,
        action,
        entity,
        entityId,
        before: null,
        after: { source: "seed" },
        reason,
        ip: "127.0.0.1",
        at: daysAgo(2),
      });
    }
  }
}
