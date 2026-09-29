const base = "http://127.0.0.1:4000";

function fail(message) {
  console.error("FAIL", message);
  process.exit(1);
}

async function tryLogin(email, password) {
  const response = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json();
  if (response.status !== 200) return null;
  return body;
}

async function login(email, password) {
  const body = await tryLogin(email, password);
  if (!body) fail(`${email} login failed`);
  return body;
}

async function call(path, token, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { message: text };
  }
  return { status: response.status, body };
}

async function must(path, token, options, label) {
  const result = await call(path, token, options);
  if (result.status >= 400) fail(`${label} ${result.status} ${result.body.message || JSON.stringify(result.body)}`);
  return result.body;
}

async function walk(orderId, token, statuses) {
  for (const status of statuses) {
    await must(`/api/orders/${orderId}/status`, token, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }, `order ${status}`);
  }
}

const admin = await login("admin@mlm.local", "Admin@12345");
const customer = await login("customer@mlm.local", "Demo@12345");
const partner = await login("partner@mlm.local", "Demo@12345");
const warehouse = await login("warehouse@mlm.local", "Demo@12345");
const finance = await login("finance@mlm.local", "Demo@12345");
const compliance = await login("compliance@mlm.local", "Demo@12345");
const grievance = await login("grievance@mlm.local", "Demo@12345");

const denied = await call("/api/users", customer.accessToken);
if (denied.status !== 403) fail(`customer users expected 403 got ${denied.status}`);

const profile = await must("/api/customers/me", customer.accessToken, {
  method: "PUT",
  body: JSON.stringify({ phone: "9999999999", addressLine: "12 Market Road", city: "Jaipur", state: "Rajasthan", pincode: "302001" }),
}, "customer profile");
if (profile.data.city !== "Jaipur") fail("customer profile city");

let downline = await tryLogin("downline@mlm.local", "Demo@12345");
if (!downline) {
  const created = await call("/api/users", admin.accessToken, {
    method: "POST",
    body: JSON.stringify({
      name: "Downline Partner",
      email: "downline@mlm.local",
      password: "Demo@12345",
      roleCode: "partner",
    }),
  });
  if (created.status !== 201 && created.status !== 409) fail(`create downline ${created.status} ${created.body.message}`);
  downline = await login("downline@mlm.local", "Demo@12345");
}

await must("/api/partners/me", downline.accessToken, {
  method: "PUT",
  body: JSON.stringify({
    phone: "9777777777",
    city: "Jaipur",
    state: "Rajasthan",
    pincode: "302001",
    sponsorEmail: "partner@mlm.local",
    bankAccountName: "Downline Partner",
    bankAccountNumber: "998877665544",
    bankIfsc: "HDFC0001234",
    taxId: "ABCDE1234F",
    nomineeName: "Asha",
    nomineeRelation: "spouse",
  }),
}, "partner application");

for (const kind of ["identity", "address", "bank", "tax"]) {
  await must(`/api/kyc/me/${kind}`, downline.accessToken, {
    method: "PUT",
    body: JSON.stringify({ referenceNumber: `DL-${kind}` }),
  }, `kyc ${kind}`);
}

const kyc = await must("/api/kyc", compliance.accessToken, {}, "kyc queue");
const mine = kyc.data.filter((row) => row.email === "downline@mlm.local" && row.status !== "verified");
for (const row of mine) {
  await must(`/api/kyc/${row.id}/review`, compliance.accessToken, {
    method: "PATCH",
    body: JSON.stringify({ status: "verified", reviewNote: "Checked" }),
  }, `verify ${row.kind}`);
}

const agreed = await must("/api/partners/me/agreement", downline.accessToken, { method: "POST" }, "agreement");
if (agreed.data.partner.applicationStatus !== "pending_first_order" && agreed.data.partner.applicationStatus !== "active") {
  fail(`expected pending first order, got ${agreed.data.partner.applicationStatus}`);
}

if (agreed.data.partner.applicationStatus === "pending_first_order") {
  await must("/api/network/placement", partner.accessToken, {
    method: "POST",
    body: JSON.stringify({
      userId: downline.user.id,
      parentUserId: partner.user.id,
      side: "left",
      reason: "Opening left seat",
    }),
  }, "placement");
}

const products = await must("/api/products", downline.accessToken, {}, "products");
const product = products.data.find((item) => item.sku === "NUTR-1");
if (!product) fail("seed product missing");

const order = await must("/api/orders", downline.accessToken, {
  method: "POST",
  body: JSON.stringify({ productId: product.id, qty: 1 }),
}, "order");
await walk(order.data.id, warehouse.accessToken, ["paid", "packed", "shipped", "delivered"]);

const volume = await must("/api/compensation/volume", partner.accessToken, {}, "volume");
if (!volume.data.some((row) => row.kind === "leg" && row.side === "left" && row.amount === 8000 && row.status === "posted")) {
  fail(`left leg volume missing ${JSON.stringify(volume.data)}`);
}

const legs = await must("/api/network/legs", partner.accessToken, {}, "legs");
if (!legs.data.left.members.some((member) => member.email === "downline@mlm.local")) fail("downline not on left leg");
if (legs.data.left.volume < 8000) fail(`left volume ${legs.data.left.volume}`);

const periods = await must("/api/compensation/periods", finance.accessToken, {}, "periods");
const open = periods.data.find((row) => row.status === "open");
if (!open) fail("no open period");
await must(`/api/compensation/periods/${open.id}/close`, finance.accessToken, { method: "POST" }, "close period");

const ledger = await must("/api/compensation/ledger", partner.accessToken, {}, "ledger");
const direct = ledger.data.find((row) => row.type === "direct" && row.net === 800 && row.status === "payable");
if (!direct) fail(`direct payable 800 missing ${JSON.stringify(ledger.data)}`);

const ranks = await must("/api/compensation/ranks", downline.accessToken, {}, "ranks");
if (ranks.data.currentRank !== "bronze") fail(`rank ${ranks.data.currentRank}`);

const wallet = await must("/api/wallet", partner.accessToken, {}, "wallet");
if (wallet.data.available < 500) fail(`available ${wallet.data.available}`);
const payout = await must("/api/wallet/payouts", partner.accessToken, {
  method: "POST",
  body: JSON.stringify({ amount: 500 }),
}, "payout");
await must(`/api/wallet/payouts/${payout.data.id}`, finance.accessToken, {
  method: "PATCH",
  body: JSON.stringify({ status: "approved", reason: "Bank verified" }),
}, "approve payout");

const dispute = await must("/api/wallet/disputes", partner.accessToken, {
  method: "POST",
  body: JSON.stringify({ ledgerLineId: direct.id, reason: "Check the direct line" }),
}, "dispute");
await must(`/api/wallet/disputes/${dispute.data.id}`, finance.accessToken, {
  method: "PATCH",
  body: JSON.stringify({ status: "rejected", resolution: "Line matches the plan" }),
}, "reject dispute");

async function refundOne() {
  const placed = await must("/api/orders", downline.accessToken, {
    method: "POST",
    body: JSON.stringify({ productId: product.id, qty: 1 }),
  }, "refund order");
  await walk(placed.data.id, warehouse.accessToken, ["paid", "packed", "shipped", "delivered", "return_requested", "returned", "refunded"]);
  return placed.data.id;
}

await refundOne();
await refundOne();

const afterRefund = await must("/api/compensation/ledger", admin.accessToken, {}, "ledger after refund");
if (!afterRefund.data.some((row) => row.type === "direct_clawback" && row.net === -800)) {
  fail("clawback line missing");
}

const fraud = await must("/api/fraud", compliance.accessToken, {}, "fraud");
if (!fraud.data.some((row) => row.pattern === "repeated_refund" && row.userEmail === "downline@mlm.local")) {
  fail("repeated refund case missing");
}

await must("/api/grievances", customer.accessToken, {
  method: "POST",
  body: JSON.stringify({ subject: "Late parcel", message: "The parcel has not arrived." }),
}, "grievance");
const queue = await must("/api/grievances", grievance.accessToken, {}, "grievance queue");
const ticket = queue.data.find((row) => row.subject === "Late parcel");
if (!ticket) fail("grievance not visible to officer");
await must(`/api/grievances/${ticket.id}`, grievance.accessToken, {
  method: "PATCH",
  body: JSON.stringify({ status: "closed", response: "We have traced the parcel." }),
}, "grievance response");

const today = new Date();
const next = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
await must("/api/campaigns", finance.accessToken, {
  method: "POST",
  body: JSON.stringify({
    name: "Nutrition week",
    product: product.id,
    startsOn: today.toISOString().slice(0, 10),
    endsOn: next.toISOString().slice(0, 10),
    budget: 10000,
    awardAmount: 200,
    status: "live",
  }),
}, "campaign");

const report = await must("/api/reports/summary", finance.accessToken, {}, "report");
if (report.data.orders < 1 || report.data.refunded < 2) fail(`report ${JSON.stringify(report.data)}`);

const notices = await must("/api/notifications", downline.accessToken, {}, "notices");
if (!notices.data.length) fail("no notices");

const linked = await must("/api/customers/link", customer.accessToken, {
  method: "PUT",
  body: JSON.stringify({ partnerEmail: "partner@mlm.local" }),
}, "partner link");
if (!linked.data.active || linked.data.partnerEmail !== "partner@mlm.local") fail("partner link was not stored");
const linkedOrder = await must("/api/orders", customer.accessToken, {
  method: "POST",
  body: JSON.stringify({ productId: product.id, qty: 1 }),
}, "order from saved link");
if (linkedOrder.data.attributedPartner?.email !== "partner@mlm.local") fail("saved link was not used");

const skipActive = await call(`/api/partners/${downline.user.id}/review`, compliance.accessToken, {
  method: "PATCH",
  body: JSON.stringify({ applicationStatus: "active", reason: "Skip the order" }),
});
if (skipActive.status !== 400) fail(`mark active should be refused, got ${skipActive.status}`);

const rankGap = await must("/api/compensation/ranks", downline.accessToken, {}, "rank gap");
if (!rankGap.data.nextRank || rankGap.data.gap == null) fail("rank gap missing");

let spill = await tryLogin("spill@mlm.local", "Demo@12345");
if (!spill) {
  const created = await call("/api/users", admin.accessToken, {
    method: "POST",
    body: JSON.stringify({ name: "Spill Partner", email: "spill@mlm.local", password: "Demo@12345", roleCode: "partner" }),
  });
  if (created.status !== 201 && created.status !== 409) fail(`create spill ${created.status} ${created.body.message}`);
  spill = await login("spill@mlm.local", "Demo@12345");
}
await must("/api/partners/me", spill.accessToken, {
  method: "PUT",
  body: JSON.stringify({
    phone: "9666666666", city: "Jaipur", state: "Rajasthan", pincode: "302001",
    sponsorEmail: "partner@mlm.local", bankAccountName: "Spill Partner", bankAccountNumber: "998877665544",
    bankIfsc: "HDFC0001234", taxId: "ABCDE1234F", nomineeName: "Ravi", nomineeRelation: "sibling",
  }),
}, "spill application");
for (const kind of ["identity", "address", "bank", "tax"]) {
  await must(`/api/kyc/me/${kind}`, spill.accessToken, {
    method: "PUT",
    body: JSON.stringify({ referenceNumber: `SP-${kind}` }),
  }, `spill kyc ${kind}`);
}
const spillKyc = await must("/api/kyc", compliance.accessToken, {}, "spill kyc queue");
for (const row of spillKyc.data.filter((item) => item.email === "spill@mlm.local" && item.status !== "verified")) {
  await must(`/api/kyc/${row.id}/review`, compliance.accessToken, {
    method: "PATCH",
    body: JSON.stringify({ status: "verified", reviewNote: "Checked" }),
  }, `verify spill ${row.kind}`);
}
const spillAgreed = await must("/api/partners/me/agreement", spill.accessToken, { method: "POST" }, "spill agreement");
if (spillAgreed.data.partner.applicationStatus === "pending_first_order") {
  const spillOrder = await must("/api/orders", spill.accessToken, {
    method: "POST",
    body: JSON.stringify({ productId: product.id, qty: 1 }),
  }, "spill order");
  await walk(spillOrder.data.id, warehouse.accessToken, ["paid", "packed", "shipped", "delivered"]);
  const tree = await must("/api/network/placement", partner.accessToken, {}, "spill placement");
  const root = tree.data.find((node) => node.email === "partner@mlm.local");
  if (!root?.right || root.right.email !== "spill@mlm.local") {
    fail(`spillover seat ${JSON.stringify(root)}`);
  }
}

console.log("All phase checks passed.");
console.log(JSON.stringify({
  directNet: direct.net,
  rank: ranks.data.currentRank,
  availableBeforePayout: wallet.data.available,
  leftVolume: legs.data.left.volume,
  orders: report.data.orders,
  refunded: report.data.refunded,
}, null, 2));
