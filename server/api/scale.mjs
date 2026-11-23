// Endpoints built for 10,000 – 10,00,000+ employees: keyset paging, index-only searches, cached statistics,
// streaming export, COPY-based import, set-based payroll and bulk approvals.
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import copyStreams from "pg-copy-streams";
import { many, one, pool, q, tx } from "./db.mjs";
import { cached, invalidate } from "./cache.mjs";

// Streams a COPY … TO STDOUT to the HTTP response. If the browser cancels the download, the query is cancelled and
// the connection is thrown away (never handed back to the pool half-way through a COPY).
async function streamCopy(sql, reply, filename) {
  const c = await pool.connect();
  const pid = (await c.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
  let done = false;
  reply.raw.writeHead(200, { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${filename}"` });
  reply.raw.on("close", () => { if (!done) pool.query("SELECT pg_cancel_backend($1)", [pid]).catch(() => {}); });
  try {
    await pipeline(c.query(copyStreams.to(sql)), reply.raw);
    done = true;
    c.release();
  } catch {
    done = true;
    c.release(true);
    if (!reply.raw.destroyed) reply.raw.destroy();
  }
}
const isAdmin = (a) => a.role === "admin" || a.role === "superadmin";
const clampLimit = (v, def = 50, max = 500) => Math.min(Math.max(Number(v) || def, 1), max);
const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const dec = (s) => { try { return JSON.parse(Buffer.from(String(s), "base64url").toString()); } catch { return null; } };

// ── Employee directory ─────────────────────────────────────────────────
const LIST_COLS = "employee_code, full_name, designation, department, reporting_manager, company_id, location_id, status, employment_type, date_of_joining, email";
function filters(a, qs, params) {
  const w = ["tenant_id = $1"];
  params.push(a.t);
  const add = (sql, v) => { params.push(v); w.push(sql.replace("?", `$${params.length}`)); };
  if (qs.status && qs.status !== "all") add("status = ?", qs.status);
  else w.push("status <> 'deleted'");
  if (qs.department) add("department = ?", qs.department);
  if (qs.company_id) add("company_id = ?", qs.company_id);
  if (qs.location_id) add("location_id = ?", qs.location_id);
  if (qs.manager) add("reporting_manager = ?", qs.manager);
  if (qs.employment_type) add("employment_type = ?", qs.employment_type);
  const s = String(qs.q || "").trim().toLowerCase();
  if (s) {
    if (/^[a-z]*\d+$/i.test(s) && s.length >= 3) add("employee_code LIKE ?", `${s.toUpperCase()}%`);  // a code → prefix index
    else if (s.length >= 3) add("search_text LIKE ?", `%${s}%`);                                       // trigram index
    else add("search_text LIKE ?", `${s}%`);
  }
  if (!isAdmin(a)) { /* employees see the directory without pay or personal data — columns below are already limited */ }
  return w.join(" AND ");
}
export async function listEmployees(a, qs) {
  const params = [];
  const where = filters(a, qs, params);
  const limit = clampLimit(qs.limit);
  const sort = qs.sort === "code" ? ["employee_code"] : qs.sort === "joined" ? ["date_of_joining", "employee_code"] : ["full_name", "employee_code"];
  // With a text search, match first (trigram index) and sort the matches; without one, read straight from the sort index.
  // (Otherwise PostgreSQL walks the name index hoping to meet 50 matches early — slow for common names.)
  const searching = !!String(qs.q || "").trim();
  const col = (c) => (searching ? `(${c} || '')` : c);
  const desc = qs.dir === "desc";
  const cur = qs.after ? dec(qs.after) : null;
  let keyset = "";
  if (cur && cur.length === sort.length) {
    const ph = cur.map((v) => { params.push(v); return `$${params.length}`; });
    keyset = ` AND (${sort.map(col).join(", ")}) ${desc ? "<" : ">"} (${ph.join(", ")})`;
  }
  params.push(limit + 1);
  const rows = await many(`SELECT ${LIST_COLS} FROM employees WHERE ${where}${keyset} ORDER BY ${sort.map((c) => `${col(c)} ${desc ? "DESC" : "ASC"}`).join(", ")} LIMIT $${params.length}`, params);
  const more = rows.length > limit;
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  // Totals: exact up to 1,000 matches, otherwise "1,000+"; the unfiltered total comes from the statistics view.
  // (An exact count over lakhs of rows costs hundreds of ms on every page turn.)
  const cp = [];
  const cw = filters(a, qs, cp);
  const plain = !qs.q && !qs.department && !qs.company_id && !qs.location_id && !qs.manager && !qs.employment_type;
  if (plain) {
    const hc = await cached(a.t, `dirtotal:${a.t}:${qs.status || ""}`, 60, () => one(`SELECT coalesce(sum(n), 0) AS n FROM mv_headcount WHERE tenant_id = $1 ${qs.status && qs.status !== "all" ? "AND status = $2" : "AND status <> 'deleted'"}`, qs.status && qs.status !== "all" ? [a.t, qs.status] : [a.t]));
    return { rows: page, next: more && last ? enc(sort.map((c) => last[c])) : null, total: Number(hc.n), total_capped: false };
  }
  const cnt = await one(`SELECT count(*) AS n FROM (SELECT 1 FROM employees WHERE ${cw} LIMIT 1001) x`, cp);
  return { rows: page, next: more && last ? enc(sort.map((c) => last[c])) : null, total: Math.min(cnt.n, 1000), total_capped: cnt.n > 1000 };
}
export async function getEmployee(a, code) {
  const { EMP_COLS, empDoc } = await import("./data.mjs");
  const r = await one(`SELECT doc, ${EMP_COLS}, must_reset, failed_attempts FROM employees WHERE tenant_id = $1 AND employee_code = $2`, [a.t, code]);
  if (!r) return null;
  const doc = empDoc(r);
  if (!isAdmin(a) && code !== a.emp) for (const k of ["monthly_gross", "annual_ctc", "pan", "uan", "bank_account", "bank_ifsc", "bank_name", "date_of_birth", "personal_mobile", "personal_email", "current_address", "permanent_address"]) delete doc[k];
  return doc;
}
export const reportsOf = (a, code, qs) => listEmployees(a, { ...qs, manager: code, status: qs.status || "active" });

// Streams CSV straight out of PostgreSQL (COPY … TO STDOUT): 10 lakh rows in ~10 s, constant memory.
export async function exportEmployees(a, qs, reply) {
  const params = [];
  const where = filters(a, qs, params);
  const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;
  const sql = `COPY (SELECT employee_code, full_name, email, designation, department, reporting_manager, company_id, location_id, status, employment_type,
                 date_of_joining, ${isAdmin(a) ? "monthly_gross" : "NULL AS monthly_gross"} FROM employees WHERE ${where.replace(/\$(\d+)/g, (_, i) => lit(params[i - 1]))}
                 ORDER BY employee_code) TO STDOUT WITH (FORMAT csv, HEADER true)`;
  await streamCopy(sql, reply, `employees-${a.t}.csv`);
}

// CSV import via COPY into a temp table, then one INSERT … ON CONFLICT: ~1 lakh rows in a few seconds.
const IMPORT_COLS = ["employee_code", "full_name", "email", "login_id", "designation", "department", "reporting_manager", "company_id", "location_id", "employment_type", "status", "date_of_joining", "date_of_birth", "monthly_gross"];
export async function importEmployees(a, csvText) {
  const lines = String(csvText || "").replace(/\r/g, "").split("\n").filter(Boolean);
  if (lines.length < 2) return { status: 400, body: { error: "Send a CSV with a header row and at least one employee." } };
  const head = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const missing = ["employee_code", "full_name"].filter((k) => !head.includes(k));
  if (missing.length) return { status: 400, body: { error: `Missing column(s): ${missing.join(", ")}` } };
  const cols = head.filter((h) => IMPORT_COLS.includes(h));
  const idx = cols.map((c) => head.indexOf(c));
  const body = lines.slice(1).map((l) => { const f = l.split(","); return idx.map((i) => (f[i] ?? "").trim().replace(/[\t\\]/g, " ")).join("\t"); }).join("\n") + "\n";
  const t0 = Date.now();
  // one salted hash for the batch's temporary password; everyone must set their own at first sign-in
  const { hashPassword } = await import("./auth.mjs");
  const tempHash = await hashPassword(process.env.TEMP_PASSWORD || "Welcome@123");
  const res = await tx(async (c) => {
    await c.query(`CREATE TEMP TABLE imp (${cols.map((x) => `${x} text`).join(", ")}) ON COMMIT DROP`);
    await pipeline(async function* () { yield body; }, c.query(copyStreams.from(`COPY imp (${cols.join(", ")}) FROM STDIN WITH (FORMAT text, NULL '')`)));
    const v = (k, cast = "") => (cols.includes(k) ? `nullif(${k}, '')${cast}` : "NULL");
    const r = await c.query(`
      INSERT INTO employees (tenant_id, employee_code, full_name, email, login_id, designation, department, reporting_manager, company_id, location_id,
                             employment_type, status, date_of_joining, date_of_birth, monthly_gross, must_reset, doc, password_hash)
      SELECT $1, upper(employee_code), full_name, ${v("email")}, coalesce(${v("login_id")}, ${v("email")}), ${v("designation")}, ${v("department")}, ${v("reporting_manager")},
             ${v("company_id")}, ${v("location_id")}, coalesce(${v("employment_type")}, 'full_time'), coalesce(${v("status")}, 'active'),
             ${v("date_of_joining", "::date")}, ${v("date_of_birth", "::date")}, coalesce(${v("monthly_gross", "::numeric")}, 0), true,
             jsonb_strip_nulls(jsonb_build_object('employee_code', upper(employee_code), 'full_name', full_name, 'email', ${v("email")}, 'login_id', coalesce(${v("login_id")}, ${v("email")}),
               'designation', ${v("designation")}, 'department', ${v("department")}, 'reporting_manager', ${v("reporting_manager")}, 'company_id', ${v("company_id")},
               'location_id', ${v("location_id")}, 'employment_type', coalesce(${v("employment_type")}, 'full_time'), 'date_of_joining', ${v("date_of_joining")},
               'date_of_birth', ${v("date_of_birth")}, 'monthly_gross', coalesce(${v("monthly_gross", "::numeric")}, 0), 'status', coalesce(${v("status")}, 'active'))), $2
      FROM (SELECT DISTINCT ON (upper(employee_code)) * FROM imp WHERE coalesce(employee_code, '') <> '' AND coalesce(full_name, '') <> '' ORDER BY upper(employee_code)) i
      ON CONFLICT (tenant_id, employee_code) DO UPDATE SET full_name = EXCLUDED.full_name, email = coalesce(EXCLUDED.email, employees.email),
        designation = coalesce(EXCLUDED.designation, employees.designation), department = coalesce(EXCLUDED.department, employees.department),
        reporting_manager = coalesce(EXCLUDED.reporting_manager, employees.reporting_manager), company_id = coalesce(EXCLUDED.company_id, employees.company_id),
        location_id = coalesce(EXCLUDED.location_id, employees.location_id), monthly_gross = CASE WHEN EXCLUDED.monthly_gross > 0 THEN EXCLUDED.monthly_gross ELSE employees.monthly_gross END,
        doc = employees.doc || EXCLUDED.doc, version = employees.version + 1, updated_at = now()
      RETURNING (xmax = 0) AS inserted`, [a.t, tempHash]);
    return { inserted: r.rows.filter((x) => x.inserted).length, updated: r.rows.filter((x) => !x.inserted).length, skipped: lines.length - 1 - r.rowCount };
  });
  await q("INSERT INTO jobs (tenant_id, kind, created_by) VALUES ($1, 'refresh_stats', $2)", [a.t, a.code]);
  invalidate(a.t);
  return { status: 200, body: { ...res, ms: Date.now() - t0 } };
}

// ── Statistics (dashboards) — materialised view + 60 s cache ─────────────
export async function headcount(a, qs) {
  const key = `hc:${a.t}:${qs.company_id || ""}:${qs.location_id || ""}`;
  return cached(a.t, key, 60, async () => {
    const p = [a.t];
    let w = "tenant_id = $1";
    if (qs.company_id) { p.push(qs.company_id); w += ` AND company_id = $${p.length}`; }
    if (qs.location_id) { p.push(qs.location_id); w += ` AND location_id = $${p.length}`; }
    const [tot, byDept, byCo, byType, today, pend] = await Promise.all([
      one(`SELECT sum(n) FILTER (WHERE status = 'active') AS active, sum(n) AS all_records, sum(joined_this_month) AS joined, sum(left_this_month) AS left,
                  sum(gross_total) FILTER (WHERE status = 'active') AS monthly_gross FROM mv_headcount WHERE ${w}`, p),
      many(`SELECT department, sum(n)::int AS n FROM mv_headcount WHERE ${w} AND status = 'active' GROUP BY 1 ORDER BY 2 DESC LIMIT 25`, p),
      many(`SELECT company_id, sum(n)::int AS n FROM mv_headcount WHERE ${w} AND status = 'active' GROUP BY 1 ORDER BY 2 DESC`, p),
      many(`SELECT employment_type, sum(n)::int AS n FROM mv_headcount WHERE ${w} AND status = 'active' GROUP BY 1 ORDER BY 2 DESC`, p),
      one(`SELECT count(DISTINCT employee_code) AS punched_in FROM punches WHERE tenant_id = $1 AND ts >= date_trunc('day', now()) AND type = 'in'`, [a.t]),
      many(`SELECT type, count(*)::int AS n FROM requests WHERE tenant_id = $1 AND pending_with IS NOT NULL AND created_at > now() - interval '180 days' GROUP BY 1 ORDER BY 2 DESC`, [a.t]),
    ]);
    const stats = await one("SELECT max(last_refresh) AS refreshed FROM (SELECT now() AS last_refresh) x");
    return { ...tot, by_department: byDept, by_company: byCo, by_type: byType, punched_in_today: today.punched_in, pending_by_type: pend, as_of: stats.refreshed };
  });
}
export async function celebrations(a, qs) {
  const days = Math.min(Number(qs.days) || 14, 31);
  return cached(a.t, `cel:${a.t}:${days}`, 600, async () => {
    const md = [];
    for (let i = 0; i < days; i++) { const d = new Date(Date.now() + i * 86400000); md.push((d.getUTCMonth() + 1) * 100 + d.getUTCDate()); }
    const [b, w] = await Promise.all([
      many(`SELECT employee_code, full_name, department, date_of_birth FROM employees WHERE tenant_id = $1 AND status = 'active'
            AND (extract(month from date_of_birth) * 100 + extract(day from date_of_birth)) = ANY($2) LIMIT 200`, [a.t, md]),
      many(`SELECT employee_code, full_name, department, date_of_joining FROM employees WHERE tenant_id = $1 AND status = 'active' AND date_of_joining < now() - interval '300 days'
            AND (extract(month from date_of_joining) * 100 + extract(day from date_of_joining)) = ANY($2) LIMIT 200`, [a.t, md]),
    ]);
    return { birthdays: b, anniversaries: w };
  });
}

// ── Approvals at scale ───────────────────────────────────────────────────
export async function inbox(a, qs) {
  const keys = [a.emp, a.code, ...(isAdmin(a) ? ["role:admin"] : [])].filter(Boolean);
  const limit = clampLimit(qs.limit, 100, 500);
  const p = [a.t, keys];
  let w = "tenant_id = $1 AND pending_with = ANY($2)";
  if (qs.type) { p.push(qs.type); w += ` AND type = $${p.length}`; }
  const cur = qs.after ? dec(qs.after) : null;
  if (cur) { p.push(cur[0], cur[1]); w += ` AND (created_at, request_id) < ($${p.length - 1}, $${p.length})`; }
  p.push(limit + 1);
  const rows = await many(`SELECT request_id, type, employee_code, status, stage, amount, from_date, to_date, created_at,
      (SELECT full_name FROM employees e WHERE e.tenant_id = r.tenant_id AND e.employee_code = r.employee_code) AS full_name,
      doc->>'reason' AS reason, doc->>'title' AS title, doc->>'leave_type' AS leave_type, doc->>'days' AS days
    FROM requests r WHERE ${w} ORDER BY created_at DESC, request_id DESC LIMIT $${p.length}`, p);
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  const cnt = await one(`SELECT count(*) AS n FROM requests WHERE tenant_id = $1 AND pending_with = ANY($2)`, [a.t, keys]);
  return { rows: page, next: rows.length > limit && last ? enc([last.created_at, last.request_id]) : null, total: cnt.n };
}
// Approve / reject many at once. Manager stage → admin stage → final, exactly like the app's two-level flow.
export async function bulkDecision(a, body) {
  const ids = (body?.ids || []).slice(0, 5000).map(String);
  const approve = body?.decision === "approve";
  const note = String(body?.note || "").slice(0, 500);
  if (!ids.length) return { status: 400, body: { error: "No requests chosen." } };
  const keys = [a.emp, a.code, ...(isAdmin(a) ? ["role:admin"] : [])].filter(Boolean);
  const now = new Date().toISOString();
  const r = await tx(async (c) => {
    const rows = (await c.query("SELECT created_at, request_id, stage, doc FROM requests WHERE tenant_id = $1 AND request_id = ANY($2) AND pending_with = ANY($3) FOR UPDATE", [a.t, ids, keys])).rows;
    let done = 0;
    for (const x of rows) {
      const d = x.doc;
      const level = x.stage === "manager" ? "manager" : "admin";
      d.steps = [...(d.steps || []).filter((s) => !(s.level === level && s.status === "pending")), { level, approver: level === "manager" ? a.emp : a.code, status: approve ? "approved" : "rejected", at: now, note }];
      d.history = [...(d.history || []), { at: now, by: a.code, action: `${approve ? "Approved" : "Rejected"} (${level})${note ? ` · ${note}` : ""}` }];
      let pendingWith = null;
      if (!approve) { d.status = "Rejected"; d.stage = null; }
      else if (level === "manager") { d.status = "Pending"; d.stage = "admin"; pendingWith = "role:admin"; }
      else { d.status = "Approved"; d.stage = null; }
      await c.query("UPDATE requests SET status = $4, stage = $5, pending_with = $6, doc = $7, updated_at = now() WHERE tenant_id = $1 AND created_at = $2 AND request_id = $3",
        [a.t, x.created_at, x.request_id, d.status, d.stage, pendingWith, JSON.stringify(d)]);
      await c.query("INSERT INTO notifications (tenant_id, id, at, recipient, doc) VALUES ($1, $2, now(), $3, $4)",
        [a.t, `N-S${Date.now()}-${done}`, d.employee_code, JSON.stringify({ id: `N-S${Date.now()}-${done}`, to: d.employee_code, text: `Your ${d.type} request ${d.request_id} was ${approve ? (pendingWith ? "approved by your manager and sent to HR" : "approved") : "rejected"}.`, at: now, read: false, link: "/inbox" })]);
      done++;
    }
    await c.query("INSERT INTO audit_log (tenant_id, log_id, ts, user_code, role, action, details, doc) VALUES ($1,$2,now(),$3,$4,$5,$6,'{}')",
      [a.t, `AUD-S${Date.now()}`, a.code, a.role, approve ? "BULK_APPROVE" : "BULK_REJECT", `${done} request(s)`]);
    return { done, skipped: ids.length - done };
  });
  return { status: 200, body: r };
}

// ── Attendance ──────────────────────────────────────────────────────────
// Biometric devices / kiosks / the mobile app post punches here. Batches of up to 5,000 are one INSERT.
export async function postPunches(a, body) {
  const list = (Array.isArray(body?.punches) ? body.punches : [body]).slice(0, 5000);
  const rows = [];
  for (const p of list) {
    const code = isAdmin(a) ? p.employee_code || a.emp : a.emp;
    if (!code) continue;
    const ts = p.ts && !Number.isNaN(Date.parse(p.ts)) ? new Date(p.ts).toISOString() : new Date().toISOString();
    const id = p.id || `PN-S${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    const doc = { ...p, id, employee_code: code, ts, type: p.type === "out" ? "out" : "in" };
    rows.push([a.t, id, ts, code, doc.type, p.source || "api", p.inside ?? null, p.flag || null, JSON.stringify(doc)]);
  }
  if (!rows.length) return { status: 400, body: { error: "No punches." } };
  const { bulk, PUNCH_UPSERT } = await import("./collections.mjs");
  await bulk(pool, PUNCH_UPSERT, rows, 1000);
  return { status: 200, body: { saved: rows.length } };
}
export async function attendanceRegister(a, qs) {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(qs.day || "") ? qs.day : new Date().toISOString().slice(0, 10);
  const limit = clampLimit(qs.limit, 100, 1000);
  const p = [a.t, day];
  let w = "a.tenant_id = $1 AND a.day = $2";
  if (qs.status) { p.push(qs.status); w += ` AND a.status = $${p.length}`; }
  if (qs.department) { p.push(qs.department); w += ` AND e.department = $${p.length}`; }
  if (qs.after) { p.push(qs.after); w += ` AND a.employee_code > $${p.length}`; }
  p.push(limit + 1);
  const rows = await many(`SELECT a.employee_code, e.full_name, e.department, a.status, a.first_in, a.last_out, a.worked_minutes, a.late
    FROM attendance_daily a JOIN employees e ON e.tenant_id = a.tenant_id AND e.employee_code = a.employee_code
    WHERE ${w} ORDER BY a.employee_code LIMIT $${p.length}`, p);
  const summary = await cached(a.t, `att:${a.t}:${day}`, 120, () => many("SELECT status, count(*)::int AS n FROM attendance_daily WHERE tenant_id = $1 AND day = $2 GROUP BY 1 ORDER BY 2 DESC", [a.t, day]));
  return { day, rows: rows.slice(0, limit), next: rows.length > limit ? rows[limit - 1].employee_code : null, summary };
}

// ── Payroll & jobs ──────────────────────────────────────────────────────
export async function startPayroll(a, body) {
  const period = /^\d{4}-\d{2}$/.test(body?.period || "") ? body.period : null;
  if (!period) return { status: 400, body: { error: "Give the month as YYYY-MM." } };
  const j = await one("INSERT INTO jobs (tenant_id, kind, params, created_by) VALUES ($1, 'payroll_run', $2, $3) RETURNING job_id, status", [a.t, JSON.stringify({ period, company_id: body.company_id || null }), a.code]);
  return { status: 202, body: j };
}
export const jobStatus = (a, id) => one("SELECT job_id, kind, params, status, progress, result, error, created_at, started_at, finished_at FROM jobs WHERE tenant_id = $1 AND job_id = $2", [a.t, Number(id)]);
export const listJobs = (a) => many("SELECT job_id, kind, params, status, progress, result, error, created_at, finished_at FROM jobs WHERE tenant_id = $1 ORDER BY job_id DESC LIMIT 30", [a.t]);
export async function payrollSummary(a, batch) {
  const b = await one("SELECT batch_id, period, status, employees, gross_total, net_total, created_at FROM payslip_batches WHERE tenant_id = $1 AND batch_id = $2", [a.t, batch]);
  if (!b) return null;
  const month = `${b.period}-01`;
  const byDept = await cached(a.t, `pay:${a.t}:${batch}`, 300, () => many(`SELECT e.department, count(*)::int AS n, sum(p.gross)::numeric(18,2) AS gross, sum(p.net)::numeric(18,2) AS net, sum(p.lop_days)::numeric(12,1) AS lop_days
      FROM payslips p JOIN employees e ON e.tenant_id = p.tenant_id AND e.employee_code = p.employee_code
      WHERE p.tenant_id = $1 AND p.period_month = $2 AND p.batch_id = $3 GROUP BY 1 ORDER BY 2 DESC`, [a.t, month, batch]));
  return { ...b, by_department: byDept };
}
export async function listPayslips(a, batch, qs) {
  const b = await one("SELECT period FROM payslip_batches WHERE tenant_id = $1 AND batch_id = $2", [a.t, batch]);
  if (!b) return null;
  const limit = clampLimit(qs.limit, 100, 1000);
  const p = [a.t, `${b.period}-01`, batch];
  let w = "p.tenant_id = $1 AND p.period_month = $2 AND p.batch_id = $3";
  if (!isAdmin(a)) { p.push(a.emp); w += ` AND p.employee_code = $${p.length}`; }
  if (qs.after) { p.push(qs.after); w += ` AND p.employee_code > $${p.length}`; }
  p.push(limit + 1);
  const rows = await many(`SELECT p.employee_code, e.full_name, e.department, p.gross, p.deductions, p.net, p.lop_days FROM payslips p
    JOIN employees e ON e.tenant_id = p.tenant_id AND e.employee_code = p.employee_code WHERE ${w} ORDER BY p.employee_code LIMIT $${p.length}`, p);
  return { rows: rows.slice(0, limit), next: rows.length > limit ? rows[limit - 1].employee_code : null };
}
export async function bankFile(a, batch, reply) {
  const b = await one("SELECT period FROM payslip_batches WHERE tenant_id = $1 AND batch_id = $2", [a.t, batch]);
  if (!b) return reply.code(404).send({ error: "No such batch." });
  const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;
  const sql = `COPY (SELECT p.employee_code, e.full_name, e.doc->>'bank_name' AS bank_name, e.doc->>'bank_account' AS account_no, e.doc->>'bank_ifsc' AS ifsc, p.net AS amount
      FROM payslips p JOIN employees e ON e.tenant_id = p.tenant_id AND e.employee_code = p.employee_code
      WHERE p.tenant_id = ${lit(a.t)} AND p.period_month = ${lit(`${b.period}-01`)} AND p.batch_id = ${lit(batch)} AND p.net > 0 ORDER BY p.employee_code)
    TO STDOUT WITH (FORMAT csv, HEADER true)`;
  await streamCopy(sql, reply, `bank-advice-${batch}.csv`);
}

// ── Database health (Super Admin) ────────────────────────────────────────
export async function dbHealth(metrics) {
  const [size, tables, cache, conns, parts, jobs] = await Promise.all([
    one("SELECT pg_database_size(current_database()) AS bytes, version() AS version"),
    many(`SELECT c.relname AS table, coalesce(sum(s.n_live_tup), 0)::bigint AS rows, pg_total_relation_size(c.oid) +
            coalesce((SELECT sum(pg_total_relation_size(i.inhrelid)) FROM pg_inherits i WHERE i.inhparent = c.oid), 0) AS bytes
          FROM pg_class c LEFT JOIN pg_inherits i ON i.inhparent = c.oid LEFT JOIN pg_stat_user_tables s ON s.relid = coalesce(i.inhrelid, c.oid)
          WHERE c.relname IN ('employees','punches','attendance_daily','requests','payslips','notifications','audit_log','entity_records','tenant_docs') AND c.relkind IN ('r','p')
          GROUP BY c.relname, c.oid ORDER BY bytes DESC`),
    one("SELECT round(100.0 * sum(blks_hit) / nullif(sum(blks_hit) + sum(blks_read), 0), 2) AS hit_pct FROM pg_stat_database WHERE datname = current_database()"),
    one("SELECT count(*) AS total, count(*) FILTER (WHERE state = 'active') AS active FROM pg_stat_activity WHERE datname = current_database()"),
    one("SELECT count(*) AS n FROM pg_inherits"),
    many("SELECT kind, status, count(*)::int AS n FROM jobs WHERE created_at > now() - interval '7 days' GROUP BY 1, 2"),
  ]);
  return { database_bytes: size.bytes, version: size.version, tables, cache_hit_pct: cache.hit_pct, connections: conns, partitions: parts.n,
    pool: { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount }, jobs, api: metrics() };
}
