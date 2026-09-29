const base = "http://127.0.0.1:4000";

async function login(email, password) {
  const response = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json();
  const cookie = response.headers.get("set-cookie") || "";
  return { status: response.status, body, cookie };
}

async function authed(path, token, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const body = await response.json();
  return { status: response.status, body };
}

function fail(message) {
  console.error("FAIL", message);
  process.exitCode = 1;
}

const admin = await login("admin@mlm.local", "Admin@12345");
if (admin.status !== 200) fail(`admin login ${admin.status} ${admin.body.message}`);
const adminToken = admin.body.accessToken;
const adminModules = admin.body.user.modules.map((item) => item.code);
if (!adminModules.includes("users") || !adminModules.includes("customers") || !adminModules.includes("audit")) {
  fail(`admin modules missing ${adminModules.join(",")}`);
}
if (!admin.body.user.permissions.includes("users.read")) fail("admin missing users.read");

const customer = await login("customer@mlm.local", "Demo@12345");
if (customer.status !== 200) fail(`customer login ${customer.status}`);
const customerModules = customer.body.user.modules.map((item) => item.code);
if (customerModules.includes("users") || customerModules.includes("audit")) fail(`customer saw staff modules ${customerModules}`);
if (!customerModules.includes("home") || !customerModules.includes("products")) fail("customer missing home/products");
if (customer.body.user.role.code !== "customer") fail("customer role");

const denied = await authed("/api/users", customer.body.accessToken);
if (denied.status !== 403) fail(`expected 403 got ${denied.status}`);

const partnerBefore = await login("partner@mlm.local", "Demo@12345");
if (partnerBefore.status !== 200) fail("partner login before suspend");
const partnerModules = partnerBefore.body.user.modules.map((item) => item.code);
if (!partnerModules.includes("sponsorship") || partnerModules.includes("users")) fail(`partner modules ${partnerModules}`);

const users = await authed("/api/users", adminToken);
const partner = users.body.data.find((item) => item.email === "partner@mlm.local");
if (!partner) fail("partner user missing");

const suspended = await authed(`/api/users/${partner.id}/status`, adminToken, {
  method: "PATCH",
  body: JSON.stringify({ status: "suspended", reason: "Verification hold" }),
});
if (suspended.status !== 200) fail(`suspend ${suspended.status} ${suspended.body.message}`);

const blocked = await login("partner@mlm.local", "Demo@12345");
if (blocked.status !== 403) fail(`suspended login should be 403, got ${blocked.status}`);

const audit = await authed("/api/audit?action=user.status_changed&actorEmail=admin@mlm.local", adminToken);
const line = audit.body.data?.find((item) => item.entityId === partner.id && item.reason === "Verification hold");
if (!line) fail("status change audit line missing");
if (line.before?.status !== "active" || line.after?.status !== "suspended") fail("audit before/after mismatch");

const deniedAudit = await authed("/api/audit?action=access.denied", adminToken);
if (!deniedAudit.body.data?.some((item) => item.actorEmail === "customer@mlm.local")) {
  fail("access denial was not audited");
}

const restored = await authed(`/api/users/${partner.id}/status`, adminToken, {
  method: "PATCH",
  body: JSON.stringify({ status: "active", reason: "Verification complete" }),
});
if (restored.status !== 200) fail("restore failed");

const refresh = await fetch(`${base}/api/auth/refresh`, {
  method: "POST",
  headers: { Cookie: admin.cookie.split(";")[0] },
});
const refreshBody = await refresh.json();
if (refresh.status !== 200 || !refreshBody.accessToken) fail(`refresh ${refresh.status}`);

const finance = await login("finance@mlm.local", "Demo@12345");
const financeModules = finance.body.user.modules.map((item) => item.code);
if (!financeModules.includes("audit") || financeModules.includes("users")) fail(`finance modules ${financeModules}`);

if (!process.exitCode) console.log("Phase 1 API checks passed.");
