// Load test against a running server and the 10-lakh "scale" company.
//   API=http://localhost:8080 node bench/bench.mjs [seconds=15] [connections=50]
import autocannon from "autocannon";
import { writeFileSync } from "node:fs";
import { createLogins } from "../test/demo-logins.mjs";

const API = process.env.API || "http://localhost:8080";
const TENANT = process.env.SCALE_TENANT || "scale";
const SECS = Number(process.argv[2] || 15);
const CONN = Number(process.argv[3] || 50);
const post = (p, b) => fetch(`${API}/api/v1${p}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then((r) => r.json());
async function token(role, login_id, entered_code, pin) {
  let r = await post("/auth/login", { tenant: TENANT, role, login_id, password: "Points@2026", entered_code });
  // v10.9: only the Super Admin has a login at first — it creates this one
  if (r.no_login) { await createLogins(TENANT, [{ role, code: entered_code, login_id }]); r = await post("/auth/login", { tenant: TENANT, role, login_id, password: "Points@2026", entered_code }); }
  if (r.next === "mfa") r = await post("/auth/mfa", { challenge_id: r.challenge_id, otp: r.otp, pin });
  if (!r.token) throw new Error(`sign-in failed: ${JSON.stringify(r)} (start the server with DEMO_OTP=1 and LOGIN_RATE_PER_MIN=1000 for load tests)`);
  return r.token;
}
const sa = await token("superadmin", "praveen.kumar@peoplehub.demo", undefined, "4321");
const emp = await token("emp", "akhil.reddy@peoplehub.demo", "EMP001");
const NAMES = ["kavya", "rohan sharma", "priya reddy", "arjun iyer", "meera nair", "farhan khan", "sneha", "e0123", "lavanya bose", "kunal"];
let n = 0;
const SCENARIOS = [
  ["Dashboard headcount (10 lakh)", { path: "/api/v1/stats/headcount", headers: { authorization: `Bearer ${sa}` } }],
  ["Directory: first page", { path: "/api/v1/employees?limit=50", headers: { authorization: `Bearer ${sa}` } }],
  ["Directory: name search", { requests: [{ setupRequest: (r) => ({ ...r, path: `/api/v1/employees?limit=50&q=${encodeURIComponent(NAMES[n++ % NAMES.length])}` }) }], headers: { authorization: `Bearer ${sa}` } }],
  ["Directory: department filter", { path: "/api/v1/employees?limit=50&department=Engineering", headers: { authorization: `Bearer ${sa}` } }],
  ["Approvals inbox (thousands pending)", { path: "/api/v1/inbox?limit=100", headers: { authorization: `Bearer ${sa}` } }],
  ["Employee profile lookup", { requests: [{ setupRequest: (r) => ({ ...r, path: `/api/v1/employees/E${String(1 + ((n++ * 7919) % 999000)).padStart(7, "0")}` }) }], headers: { authorization: `Bearer ${sa}` } }],
  ["Punch in (single, write)", { method: "POST", requests: [{ setupRequest: (r) => ({ ...r, body: JSON.stringify({ employee_code: `E${String(1 + ((n++ * 104729) % 999000)).padStart(7, "0")}`, type: "out", source: "biometric" }) }) }], headers: { authorization: `Bearer ${sa}`, "content-type": "application/json" }, path: "/api/v1/attendance/punches" }],
  ["Employee app start (bootstrap)", { path: "/api/v1/bootstrap", headers: { authorization: `Bearer ${emp}`, "accept-encoding": "gzip" }, connections: Math.min(CONN, 20) }],
];
const results = [];
for (const [name, opts] of SCENARIOS) {
  const { path = "/", ...rest } = opts;
  // (autocannon ignores a query string in `url`, so the path goes in `requests`)
  if (!rest.requests) rest.requests = [{ path }];
  else rest.requests = rest.requests.map((q) => ({ ...q, setupRequest: (r) => q.setupRequest({ ...r, path }) }));
  const r = await autocannon({ url: API, connections: opts.connections || CONN, duration: SECS, method: opts.method || "GET", ...rest });
  const codes = Object.keys(r.statusCodeStats || {}).join(",");
  const row = { scenario: name, req_per_sec: Math.round(r.requests.average), p50_ms: r.latency.p50, p90_ms: r.latency.p90, p99_ms: r.latency.p99, errors: r.errors + r.non2xx, total: r.requests.total, status_codes: codes };
  results.push(row);
  console.log(`${name.padEnd(38)} ${String(row.req_per_sec).padStart(6)} req/s · p50 ${row.p50_ms} ms · p90 ${row.p90_ms} ms · p99 ${row.p99_ms} ms · errors ${row.errors} · HTTP ${row.status_codes}`);
}
writeFileSync("bench/results.json", JSON.stringify({ at: new Date().toISOString(), seconds: SECS, connections: CONN, results }, null, 2));
