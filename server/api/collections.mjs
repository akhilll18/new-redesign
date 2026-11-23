// Maps the web app's data collections onto database tables — used by the demo import, /sync and /bootstrap.
//
//   typed tables   employees, admins + superAdmins (accounts), companies, workLocations, orgUnits, requests,
//                  punches, notifications, audit, payslipBatches (+ payslips)
//   entity_records every other list (goals, BGV, documents, tickets, chat, contracts, …) — one row per record
//   tenant_docs    every non-list value (settings, suite, policies, …) — one JSON document each
import { createHash } from "node:crypto";

export const TYPED = new Set(["employees", "admins", "superAdmins", "companies", "workLocations", "orgUnits", "requests", "punches", "notifications", "audit", "payslipBatches"]);
// Collections the server never accepts from an app (they change only through dedicated, checked endpoints).
export const SERVER_ONLY = new Set(["superAdmins", "admins", "companies", "workLocations", "orgUnits", "payslipBatches"]);
const SECRET_FIELDS = ["password_hash", "security_pin_hash", "mfa_secret"];
const ID_FIELDS = ["id", "request_id", "log_id", "code", "key", "ticket_id", "batch_id"];

export const sha1 = (s) => createHash("sha1").update(s).digest("hex");
// 53-bit string hash (cyrb53) — identical to src/lib/server/sync.js, so app and server agree on record keys
export function hash53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
export const keyOf = (rec) => {
  if (rec && typeof rec === "object") for (const f of ID_FIELDS) if (rec[f] !== undefined && rec[f] !== null && rec[f] !== "") return `${f}:${rec[f]}`;
  return `h:${hash53(JSON.stringify(rec))}`;
};
export const stripSecrets = (o) => { const c = { ...o }; for (const f of SECRET_FIELDS) delete c[f]; return c; };
const d = (v) => (v && /^\d{4}-\d{2}-\d{2}/.test(v) ? String(v).slice(0, 10) : null);
const ts = (v) => (v && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : new Date().toISOString());
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// ── row builders ───────────────────────────────────────────
export function employeeRow(t, e) {
  return [t, e.employee_code, e.full_name || e.employee_code, e.email || null, e.login_id || null, e.designation || null, e.department || null,
    e.reporting_manager || null, e.company_id || null, e.location_id || null, e.country_code || null, e.employment_type || null, e.worker_type || null,
    e.grade_code || null, e.status || "active", d(e.date_of_joining), d(e.date_of_birth), d(e.exit_date || e.last_working_day), num(e.monthly_gross),
    e.must_reset === true, num(e.failed_attempts), JSON.stringify(stripSecrets(e)), e.password_hash || null];
}
export const EMPLOYEE_UPSERT = `
  INSERT INTO employees (tenant_id, employee_code, full_name, email, login_id, designation, department, reporting_manager, company_id, location_id,
    country_code, employment_type, worker_type, grade_code, status, date_of_joining, date_of_birth, exit_date, monthly_gross, must_reset, failed_attempts, doc, password_hash)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
  ON CONFLICT (tenant_id, employee_code) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, login_id = EXCLUDED.login_id,
    designation = EXCLUDED.designation, department = EXCLUDED.department, reporting_manager = EXCLUDED.reporting_manager, company_id = EXCLUDED.company_id,
    location_id = EXCLUDED.location_id, country_code = EXCLUDED.country_code, employment_type = EXCLUDED.employment_type, worker_type = EXCLUDED.worker_type,
    grade_code = EXCLUDED.grade_code, status = EXCLUDED.status, date_of_joining = EXCLUDED.date_of_joining, date_of_birth = EXCLUDED.date_of_birth,
    exit_date = EXCLUDED.exit_date, monthly_gross = EXCLUDED.monthly_gross, doc = EXCLUDED.doc, version = employees.version + 1, updated_at = now(),
    must_reset = employees.must_reset,
    failed_attempts = CASE WHEN employees.status = 'locked' AND EXCLUDED.status <> 'locked' THEN 0 ELSE employees.failed_attempts END`;
// (password_hash is written only when the record is new — e.g. an admin creating an employee with a temporary password)

export function requestRow(t, r) {
  const pend = /^pending/i.test(r.status || "");
  const step = (r.steps || []).find((s) => s.status === "pending" && s.approver);
  const pendingWith = !pend ? null : step?.approver || (r.stage === "manager" ? null : `role:${r.stage || "admin"}`);
  const amount = r.amount ?? (Array.isArray(r.items) ? r.items.reduce((a, i) => a + num(i.amount), 0) : null);
  return [t, r.request_id, ts(r.created_at), r.type || "request", r.employee_code, r.company_id || null, r.status || "Pending", r.stage || null,
    pendingWith, pend && r.stage === "manager" && !pendingWith, amount, d(r.from_date), d(r.to_date), JSON.stringify(r)];
}
// $10 = "look up the manager": the approver for a manager-stage request is the employee's current reporting manager.
export const REQUEST_UPSERT = `
  INSERT INTO requests (tenant_id, request_id, created_at, type, employee_code, company_id, status, stage, pending_with, amount, from_date, to_date, doc)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,
    CASE WHEN $10::boolean THEN (SELECT reporting_manager FROM employees WHERE tenant_id = $1 AND employee_code = $5) ELSE $9 END,
    $11,$12,$13,$14)
  ON CONFLICT (tenant_id, created_at, request_id) DO UPDATE SET type = EXCLUDED.type, status = EXCLUDED.status, stage = EXCLUDED.stage,
    pending_with = EXCLUDED.pending_with, amount = EXCLUDED.amount, from_date = EXCLUDED.from_date, to_date = EXCLUDED.to_date, doc = EXCLUDED.doc, updated_at = now()`;

export const punchRow = (t, p) => [t, String(p.id), ts(p.ts), p.employee_code, p.type || "in", p.source || null, p.inside ?? null, p.flag || null, JSON.stringify(p)];
export const PUNCH_UPSERT = `INSERT INTO punches (tenant_id, id, ts, employee_code, type, source, inside, flag, doc) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
  ON CONFLICT (tenant_id, ts, id) DO UPDATE SET type = EXCLUDED.type, inside = EXCLUDED.inside, flag = EXCLUDED.flag, doc = EXCLUDED.doc`;

export const noteRow = (t, n) => [t, String(n.id), ts(n.at), n.to || "", !!n.read, JSON.stringify(n)];
export const NOTE_UPSERT = `INSERT INTO notifications (tenant_id, id, at, recipient, read, doc) VALUES ($1,$2,$3,$4,$5,$6)
  ON CONFLICT (tenant_id, at, id) DO UPDATE SET read = EXCLUDED.read, doc = EXCLUDED.doc`;

export const auditRow = (t, a) => [t, a.log_id, ts(a.timestamp), a.user_code || null, a.role || null, a.action || null, a.ip || null, a.details || null, JSON.stringify(a)];
export const AUDIT_INSERT = `INSERT INTO audit_log (tenant_id, log_id, ts, user_code, role, action, ip, details, doc) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
  ON CONFLICT DO NOTHING`;

export const entityRow = (t, c, r) => [t, c, keyOf(r), r?.employee_code || r?.to || r?.by || null, JSON.stringify(r)];
export const ENTITY_UPSERT = `INSERT INTO entity_records (tenant_id, collection, record_key, employee_code, doc) VALUES ($1,$2,$3,$4,$5)
  ON CONFLICT (tenant_id, collection, record_key) DO UPDATE SET employee_code = EXCLUDED.employee_code, doc = EXCLUDED.doc, updated_at = now()`;

export const DOC_UPSERT = `INSERT INTO tenant_docs (tenant_id, name, doc) VALUES ($1,$2,$3)
  ON CONFLICT (tenant_id, name) DO UPDATE SET doc = EXCLUDED.doc, version = tenant_docs.version + 1, updated_at = now()`;

// Payslip batch → header row + one payslips row per slip.
export function slipRows(t, b) {
  const month = `${b.period}-01`;
  return (b.slips || []).map((s) => {
    const v = s.values || {};
    const ded = ["PF_EE", "ESI_EE", "PT", "TDS", "LWF_EE", "LOAN_EMI", "ADV_REC", "OTHER_DED"].reduce((a, k) => a + num(v[k]), 0);
    const gross = Object.entries(v).filter(([k, x]) => typeof x === "number" && !["PF_EE", "ESI_EE", "PT", "TDS", "LWF_EE", "LOAN_EMI", "ADV_REC", "OTHER_DED", "NET_PAY", "GROSS", "GROSS_EARNINGS", "CTC"].includes(k)).reduce((a, [, x]) => a + x, 0);
    return [t, month, b.id, s.employee_code, s.id || `${b.id}-${s.employee_code}`, num(v.GROSS || v.GROSS_EARNINGS || gross), ded, num(v.NET_PAY || gross - ded), num(s.lop_days), JSON.stringify(s)];
  });
}
export const SLIP_UPSERT = `INSERT INTO payslips (tenant_id, period_month, batch_id, employee_code, slip_id, gross, deductions, net, lop_days, doc)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
  ON CONFLICT (tenant_id, period_month, batch_id, employee_code) DO UPDATE SET gross = EXCLUDED.gross, deductions = EXCLUDED.deductions,
    net = EXCLUDED.net, lop_days = EXCLUDED.lop_days, doc = EXCLUDED.doc`;
export const BATCH_UPSERT = `INSERT INTO payslip_batches (tenant_id, batch_id, period, status, employees, gross_total, net_total, doc)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
  ON CONFLICT (tenant_id, batch_id) DO UPDATE SET status = EXCLUDED.status, employees = EXCLUDED.employees, gross_total = EXCLUDED.gross_total,
    net_total = EXCLUDED.net_total, doc = EXCLUDED.doc`;
export function batchRow(t, b) {
  const rows = slipRows(t, b);
  const { slips, ...head } = b;
  return [t, b.id, b.period, b.status || "Draft", rows.length || b.employees || 0, rows.reduce((a, r) => a + r[5], 0), rows.reduce((a, r) => a + r[7], 0), JSON.stringify(head)];
}

export function accountRow(t, role, a) {
  const code = role === "admin" ? a.admin_code : a.superadmin_code;
  return [t, code, role, a.login_id, a.employee_code || null, a.password_hash || null, a.security_pin_hash || null, a.mfa_secret || null, a.status || "active", JSON.stringify(stripSecrets(a))];
}
export const ACCOUNT_UPSERT = `INSERT INTO accounts (tenant_id, code, role, login_id, employee_code, password_hash, security_pin_hash, mfa_secret, status, doc)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
  ON CONFLICT (tenant_id, code) DO UPDATE SET login_id = EXCLUDED.login_id, employee_code = EXCLUDED.employee_code, status = EXCLUDED.status,
    doc = EXCLUDED.doc, updated_at = now(),
    failed_attempts = CASE WHEN accounts.status = 'locked' AND EXCLUDED.status <> 'locked' THEN 0 ELSE accounts.failed_attempts END`;

// Multi-row upsert: send up to `chunk` rows per statement (one round trip) — ~20× faster than one by one.
export async function bulk(client, sql, rows, chunk = 500) {
  if (!rows.length) return 0;
  const m = sql.match(/VALUES\s*\(([\s\S]*?)\)\s*(ON CONFLICT[\s\S]*)?$/i);
  const width = rows[0].length;
  // statements with sub-selects in VALUES (requests) go one by one
  if (!m || /SELECT/i.test(m[1])) { for (const r of rows) await client.query(sql, r); return rows.length; }
  const head = sql.slice(0, sql.search(/VALUES/i));
  const tail = m[2] || "";
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk);
    const params = [];
    const vals = part.map((r, j) => `(${r.map((_, k) => `$${j * width + k + 1}`).join(",")})`);
    part.forEach((r) => params.push(...r));
    await client.query(`${head} VALUES ${vals.join(",")} ${tail}`, params);
  }
  return rows.length;
}
