// Loads the web app's demo company (the same data the browser version starts with) into tenant "demo".
//   node db/seed-demo.mjs [--tenant demo] [--reset]
import { pool, tx } from "../api/db.mjs";
import { migrate } from "./migrate.mjs";
import * as C from "../api/collections.mjs";

const arg = (k, def) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : def; };
const tenant = arg("tenant", "demo");
const reset = process.argv.includes("--reset");

export async function importDataset(t, data, { name = "Demo company", log = console.log } = {}) {
  await tx(async (c) => {
    await c.query("INSERT INTO tenants (tenant_id, name) VALUES ($1,$2) ON CONFLICT (tenant_id) DO UPDATE SET name = EXCLUDED.name", [t, name]);
    // employees — de-duplicated on code (the last record wins)
    const emps = [...new Map(data.employees.map((e) => [e.employee_code, e])).values()];
    await C.bulk(c, C.EMPLOYEE_UPSERT, emps.map((e) => C.employeeRow(t, e)));
    // keep the demo passwords: the app hashes them with SHA-256; the server upgrades each to scrypt on first sign-in
    for (const e of emps) if (e.password_hash) await c.query("UPDATE employees SET password_hash = $3, security_pin_hash = $4 WHERE tenant_id = $1 AND employee_code = $2", [t, e.employee_code, e.password_hash, e.security_pin_hash || null]);
    for (const a of data.admins || []) await c.query(C.ACCOUNT_UPSERT, C.accountRow(t, "admin", a));
    for (const a of data.superAdmins || []) await c.query(C.ACCOUNT_UPSERT, C.accountRow(t, "superadmin", a));
    for (const co of data.companies || []) await c.query("INSERT INTO companies (tenant_id, company_id, name, country, currency, status, doc) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (tenant_id, company_id) DO UPDATE SET doc = EXCLUDED.doc, name = EXCLUDED.name", [t, co.company_id, co.name, co.country, co.currency, co.status || "active", JSON.stringify(co)]);
    for (const l of data.workLocations || []) await c.query("INSERT INTO locations (tenant_id, location_id, company_id, name, doc) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (tenant_id, location_id) DO UPDATE SET doc = EXCLUDED.doc", [t, l.location_id, l.company_id, l.name, JSON.stringify(l)]);
    for (const o of data.orgUnits || []) await c.query("INSERT INTO org_units (tenant_id, org_unit_id, name, parent_unit, doc) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (tenant_id, org_unit_id) DO UPDATE SET doc = EXCLUDED.doc", [t, o.org_unit_id, o.name, o.parent_unit, JSON.stringify(o)]);
    for (const r of data.requests || []) await c.query(C.REQUEST_UPSERT, C.requestRow(t, r));
    await C.bulk(c, C.PUNCH_UPSERT, (data.punches || []).map((p) => C.punchRow(t, p)));
    await C.bulk(c, C.NOTE_UPSERT, [...new Map((data.notifications || []).map((n) => [n.id + n.at, n])).values()].map((n) => C.noteRow(t, n)));
    await C.bulk(c, C.AUDIT_INSERT, (data.audit || []).map((a) => C.auditRow(t, a)));
    for (const b of data.payslipBatches || []) {
      await c.query(C.BATCH_UPSERT, C.batchRow(t, b));
      await C.bulk(c, C.SLIP_UPSERT, C.slipRows(t, b));
    }
    let lists = 0, docs = 0;
    for (const [k, v] of Object.entries(data)) {
      if (C.TYPED.has(k)) continue;
      if (Array.isArray(v) && v.every((x) => x && typeof x === "object" && !Array.isArray(x))) {
        await c.query("DELETE FROM entity_records WHERE tenant_id = $1 AND collection = $2", [t, k]);
        const rows = [...new Map(v.map((r) => [C.keyOf(r), C.entityRow(t, k, r)])).values()];
        await C.bulk(c, C.ENTITY_UPSERT, rows);
        await c.query(C.DOC_UPSERT, [t, `__list:${k}`, JSON.stringify({ order: v.map(C.keyOf) .slice(0, 5000) })]);
        lists++;
      } else {
        await c.query(C.DOC_UPSERT, [t, k, JSON.stringify(v === undefined ? null : v)]);
        docs++;
      }
    }
    log(`tenant ${t}: ${emps.length} employees, ${(data.requests || []).length} requests, ${(data.punches || []).length} punches, ${lists} list modules, ${docs} settings documents`);
  });
  // maintenance step: no API statement time limit (a cold database can take longer than 15 s on 10 lakh rows)
  const c = await pool.connect();
  try { await c.query("SET statement_timeout = 0"); await c.query("REFRESH MATERIALIZED VIEW mv_headcount"); } finally { c.release(); }
}

if (process.argv[1]?.endsWith("seed-demo.mjs")) {
  (async () => {
    await migrate({ quiet: true });
    if (reset) await pool.query("DELETE FROM tenants WHERE tenant_id = $1", [tenant]).then(() => Promise.all(["punches", "attendance_daily", "requests", "payslips", "payslip_batches", "notifications", "audit_log", "entity_records", "jobs"].map((tb) => pool.query(`DELETE FROM ${tb} WHERE tenant_id = $1`, [tenant]))));
    const { buildDemoSeed: buildSeed } = await import("../../src/data/seed.js"); // the full sample company (test fixture)
    await importDataset(tenant, buildSeed(), { name: "ONAS Global Services (demo)" });
    await pool.end();
  })().catch((e) => { console.error(e); process.exit(1); });
}
