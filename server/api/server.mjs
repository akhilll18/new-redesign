// EZY HR API server — Fastify + PostgreSQL.
//   DATABASE_URL=postgres://… JWT_SECRET=… node api/server.mjs
// Also serves the built web app (../dist) so one process can host everything. Run several behind a load balancer;
// they share nothing but the database.
import Fastify from "fastify";
import compress from "@fastify/compress";
import cors from "@fastify/cors";
import fstatic from "@fastify/static";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./db.mjs";
import * as auth from "./auth.mjs";
import * as data from "./data.mjs";
import * as S from "./scale.mjs";
import { migrate } from "../db/migrate.mjs";
import { startWorker } from "./jobs.mjs";
import { registerAi } from "./ai.mjs";
import { invalidate } from "./cache.mjs";
import { createCompany } from "../db/create-company.mjs";

const PORT = Number(process.env.PORT || 8080);
const app = Fastify({ logger: process.env.LOG === "1" ? { level: "info" } : false, bodyLimit: 25 * 1024 * 1024, trustProxy: true });

await app.register(compress, { global: true, threshold: 2048, encodings: ["br", "gzip"], brotliOptions: { params: { 1: 4 } } });
const origins = (process.env.CORS_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
// Capacitor apps call from capacitor://localhost (iOS) and https://localhost (Android)
await app.register(cors, { origin: origins.length ? [...origins, "capacitor://localhost", "https://localhost", "http://localhost"] : true, credentials: false });
app.addContentTypeParser("text/csv", { parseAs: "string", bodyLimit: 200 * 1024 * 1024 }, (req, body, done) => done(null, body));

// ── latency metrics (per route, last 2,000 calls) ──
const lat = new Map();
app.addHook("onResponse", async (req, reply) => {
  const k = `${req.method} ${req.routeOptions?.url || "?"}`;
  const arr = lat.get(k) || lat.set(k, []).get(k);
  arr.push(reply.elapsedTime);
  if (arr.length > 2000) arr.shift();
});
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return Math.round((s[Math.min(s.length - 1, Math.floor(p * s.length))] || 0) * 10) / 10; };
const metrics = () => [...lat].filter(([k]) => k.includes("/api/")).map(([route, a]) => ({ route, calls: a.length, p50_ms: pct(a, 0.5), p95_ms: pct(a, 0.95), p99_ms: pct(a, 0.99) })).sort((x, y) => y.calls - x.calls);

app.addHook("onSend", async (req, reply, payload) => {
  reply.header("x-content-type-options", "nosniff");
  reply.header("referrer-policy", "same-origin");
  if (req.url.startsWith("/api/")) reply.header("cache-control", "no-store");
  // hashed build files never change → cache for a year (fast repeat visits, better Core Web Vitals)
  else if (req.url.startsWith("/assets/") && reply.statusCode === 200) reply.header("cache-control", "public, max-age=31536000, immutable");
  else if (req.url.startsWith("/assets/")) reply.header("cache-control", "public, max-age=31536000, immutable"); // file names carry a content hash
  else reply.header("cache-control", "no-cache");
  return payload;
});

// ── simple rate limit for sign-in (per IP) ──
const hits = new Map();
function limited(ip, max = Number(process.env.LOGIN_RATE_PER_MIN || 20)) {
  const now = Date.now();
  const h = (hits.get(ip) || []).filter((t) => now - t < 60000);
  h.push(now);
  hits.set(ip, h);
  if (hits.size > 100000) hits.clear();
  return h.length > max;
}

// ── auth guard ──
const guard = (roles) => async (req, reply) => {
  const a = await auth.authenticate(req);
  if (!a) return reply.code(401).send({ error: "Sign in again." });
  if (roles && !roles.includes(a.role)) return reply.code(403).send({ error: "Not allowed for your role." });
  req.auth = a;
};
const ANY = guard();
const ADMIN = guard(["admin", "superadmin"]);
const SUPER = guard(["superadmin"]);
const send = (reply, r) => reply.code(r.status).send(r.body);
const or404 = (reply, v) => (v ? v : reply.code(404).send({ error: "Not found." }));

// The app calls this when it starts: if it answers, the app runs in server mode.
app.get("/api/v1/config", async () => ({
  server: "ezy-hr", version: "10.8.0",
  default_tenant: process.env.DEFAULT_TENANT || "demo",
  demo_tenants: (process.env.DEMO_TENANTS || "demo,scale").split(",").map((s) => s.trim()).filter(Boolean),
  signup: process.env.ALLOW_SIGNUP === "1",
}));
app.get("/api/v1/config/tenant/:id", async (req) => {
  const r = await pool.query("SELECT name, status FROM tenants WHERE tenant_id = $1", [String(req.params.id).toLowerCase()]);
  return r.rows[0] ? { exists: true, name: r.rows[0].name, active: r.rows[0].status === "active" } : { exists: false };
});
// Pricing page → "Create my workspace" (only when ALLOW_SIGNUP=1). Makes a company with one Super Admin login.
app.post("/api/v1/signup", async (req, reply) => {
  if (process.env.ALLOW_SIGNUP !== "1") return reply.code(403).send({ error: "Sign-up is switched off on this server. Contact EZY HR sales." });
  if (limited(`signup:${req.ip}`, 5)) return reply.code(429).send({ error: "Too many attempts. Wait a minute." });
  const b = req.body || {};
  try {
    const slug = String(b.tenant || b.company || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);
    const r = await createCompany({ tenant: slug, name: b.company, country: b.country || "IN", owner: b.name, email: String(b.email || "").toLowerCase(), password: b.password, pin: b.pin, phone: b.phone, plan: b.plan });
    return reply.code(201).send(r);
  } catch (e) { return reply.code(400).send({ error: e.message }); }
});

// Super Admin / admin: make a user set a new password at next sign-in (temporary password Welcome@123 or the one given)
app.post("/api/v1/admin/users/force-reset", { preHandler: ADMIN }, async (req, reply) => {
  const { role, code, temp_password } = req.body || {};
  if (role !== "emp" && req.auth.role !== "superadmin") return reply.code(403).send({ error: "Only the Super Admin resets admin passwords." });
  const hash = await auth.hashPassword(String(temp_password || "Welcome@123"));
  const r = role === "emp"
    ? await pool.query("UPDATE employees SET password_hash = $3, must_reset = true, failed_attempts = 0, status = CASE WHEN status = 'locked' THEN 'active' ELSE status END WHERE tenant_id = $1 AND employee_code = $2", [req.auth.t, code, hash])
    : await pool.query("UPDATE accounts SET password_hash = $3, doc = jsonb_set(doc, '{must_reset}', 'true'), failed_attempts = 0, status = CASE WHEN status = 'locked' THEN 'active' ELSE status END WHERE tenant_id = $1 AND code = $2", [req.auth.t, code, hash]);
  await pool.query("UPDATE auth_sessions SET revoked = true WHERE tenant_id = $1 AND code = $2", [req.auth.t, code]);
  invalidate(req.auth.t);
  return r.rowCount ? { ok: true } : reply.code(404).send({ error: "No such user." });
});

// health
app.get("/health", async () => ({ ok: true }));
app.get("/ready", async (req, reply) => { try { await pool.query("SELECT 1"); return { ok: true }; } catch { return reply.code(503).send({ ok: false }); } });

// auth
app.post("/api/v1/auth/login", async (req, reply) => (limited(req.ip) ? reply.code(429).send({ error: "Too many sign-in attempts. Wait a minute." }) : send(reply, await auth.login(req))));
app.post("/api/v1/auth/mfa", async (req, reply) => (limited(req.ip) ? reply.code(429).send({ error: "Too many attempts. Wait a minute." }) : send(reply, await auth.verifyMfa(req))));
app.post("/api/v1/auth/reset-password", async (req, reply) => send(reply, await auth.completeReset(req)));
app.post("/api/v1/auth/change-password", { preHandler: ANY }, async (req, reply) => send(reply, await auth.changePassword(req.auth, req)));
app.post("/api/v1/auth/logout", { preHandler: ANY }, async (req, reply) => send(reply, await auth.logout(req.auth, req)));
app.get("/api/v1/me", { preHandler: ANY }, async (req) => ({ role: req.auth.role, code: req.auth.code, employee_code: req.auth.emp, tenant: req.auth.t }));

// the app's data
app.get("/api/v1/bootstrap", { preHandler: ANY }, async (req) => data.bootstrap(req.auth));
app.post("/api/v1/sync", { preHandler: ANY }, async (req, reply) => send(reply, await data.sync(req.auth, req.body)));
app.get("/api/v1/changes", { preHandler: ANY }, async (req) => data.changesSince(req.auth, req.query.since));

// employees at scale
app.get("/api/v1/employees", { preHandler: ANY }, async (req) => S.listEmployees(req.auth, req.query));
app.get("/api/v1/employees/export.csv", { preHandler: ADMIN }, async (req, reply) => { await S.exportEmployees(req.auth, req.query, reply); return reply; });
app.post("/api/v1/employees/import", { preHandler: ADMIN }, async (req, reply) => send(reply, await S.importEmployees(req.auth, typeof req.body === "string" ? req.body : req.body?.csv)));
app.get("/api/v1/employees/:code", { preHandler: ANY }, async (req, reply) => or404(reply, await S.getEmployee(req.auth, req.params.code)));
app.get("/api/v1/employees/:code/reports", { preHandler: ANY }, async (req) => S.reportsOf(req.auth, req.params.code, req.query));

// dashboards
app.get("/api/v1/stats/headcount", { preHandler: ADMIN }, async (req) => S.headcount(req.auth, req.query));
app.get("/api/v1/stats/celebrations", { preHandler: ANY }, async (req) => S.celebrations(req.auth, req.query));

// approvals
app.get("/api/v1/inbox", { preHandler: ANY }, async (req) => S.inbox(req.auth, req.query));
app.post("/api/v1/requests/decision", { preHandler: ANY }, async (req, reply) => send(reply, await S.bulkDecision(req.auth, req.body)));

// attendance
app.post("/api/v1/attendance/punches", { preHandler: ANY }, async (req, reply) => send(reply, await S.postPunches(req.auth, req.body)));
app.get("/api/v1/attendance/register", { preHandler: ADMIN }, async (req) => S.attendanceRegister(req.auth, req.query));

// payroll & jobs
app.post("/api/v1/payroll/runs", { preHandler: ADMIN }, async (req, reply) => send(reply, await S.startPayroll(req.auth, req.body)));
app.get("/api/v1/payroll/batches/:id", { preHandler: ADMIN }, async (req, reply) => or404(reply, await S.payrollSummary(req.auth, req.params.id)));
app.get("/api/v1/payroll/batches/:id/payslips", { preHandler: ANY }, async (req, reply) => or404(reply, await S.listPayslips(req.auth, req.params.id, req.query)));
app.get("/api/v1/payroll/batches/:id/bank-file.csv", { preHandler: ADMIN }, async (req, reply) => { await S.bankFile(req.auth, req.params.id, reply); return reply; });
app.post("/api/v1/jobs", { preHandler: ADMIN }, async (req, reply) => {
  const kind = req.body?.kind;
  if (!["attendance_rollup", "refresh_stats"].includes(kind)) return reply.code(400).send({ error: "Unknown job." });
  const r = await pool.query("INSERT INTO jobs (tenant_id, kind, params, created_by) VALUES ($1,$2,$3,$4) RETURNING job_id, status", [req.auth.t, kind, JSON.stringify(req.body?.params || {}), req.auth.code]);
  return reply.code(202).send(r.rows[0]);
});
app.get("/api/v1/jobs", { preHandler: ADMIN }, async (req) => S.listJobs(req.auth));
app.get("/api/v1/jobs/:id", { preHandler: ADMIN }, async (req, reply) => or404(reply, await S.jobStatus(req.auth, req.params.id)));

// generative AI (Claude) for signed-in users — key stays on the server
registerAi(app, ANY);

// operations
app.get("/api/v1/admin/database", { preHandler: SUPER }, async () => S.dbHealth(metrics));
app.get("/api/v1/admin/metrics", { preHandler: ADMIN }, async () => metrics());

// the web app (single page, hash routes)
const dist = process.env.WEB_DIST || join(dirname(fileURLToPath(import.meta.url)), "..", "..", "dist");
if (existsSync(dist)) {
  // v10.8 SEO: public pages, robots.txt and sitemap.xml carry "__SITE_URL__" placeholders (unless the build set SITE_URL);
  // the server fills in this site's address per request, so canonical URLs are right on any domain.
  const seoFiles = { "/": "index.html", "/index.html": "index.html", "/pricing/": "pricing/index.html", "/contact/": "contact/index.html",
    "/service-desk/": "service-desk/index.html", "/login/": "login/index.html", "/robots.txt": "robots.txt", "/sitemap.xml": "sitemap.xml" };
  const seoCache = new Map();
  const siteOf = (req) => (process.env.SITE_URL || `${req.protocol}://${req.headers["x-forwarded-host"] || req.headers.host}`).replace(/\/+$/, "");
  for (const [route, file] of Object.entries(seoFiles)) {
    app.get(route, async (req, reply) => {
      const full = join(dist, file);
      if (!existsSync(full)) return reply.callNotFound();
      const st = statSync(full).mtimeMs;
      let hit = seoCache.get(file);
      if (!hit || hit.mtime !== st) seoCache.set(file, (hit = { mtime: st, body: readFileSync(full, "utf8") }));
      const type = file.endsWith(".xml") ? "application/xml; charset=utf-8" : file.endsWith(".txt") ? "text/plain; charset=utf-8" : "text/html; charset=utf-8";
      reply.header("content-type", type).header("cache-control", "public, max-age=300");
      return hit.body.replaceAll("__SITE_URL__", siteOf(req));
    });
  }
  for (const p of ["/pricing", "/contact", "/service-desk", "/login"]) app.get(p, async (req, reply) => reply.redirect(`${p}/`, 301));
  await app.register(fstatic, { root: dist, prefix: "/", cacheControl: false, index: false, wildcard: true });
}

app.setErrorHandler((err, req, reply) => {
  if (err.validation || err.statusCode === 400) return reply.code(400).send({ error: err.message });
  console.error(req.method, req.url, err.message);
  reply.code(err.statusCode && err.statusCode < 600 ? err.statusCode : 500).send({ error: "Something went wrong on the server. Try again." });
});

if (process.env.AUTO_MIGRATE !== "0") await migrate({ quiet: true });
if (process.env.WORKER_INLINE !== "0") startWorker({ log: () => {} });
await app.listen({ port: PORT, host: "0.0.0.0" });
console.log(`EZY HR API on :${PORT}`);
