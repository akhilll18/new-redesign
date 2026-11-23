// /bootstrap — the bounded "working set" the web app loads after sign-in (never the whole 10-lakh company).
// /sync      — the app's changes, checked per role and written to the right tables.
// /changes   — what other people changed since the app last asked (inbox, notifications, shared settings).
import { many, one, pool, tx } from "./db.mjs";
import * as C from "./collections.mjs";
import { cached, invalidate } from "./cache.mjs";

const LIMITS = {
  employeesAdmin: Number(process.env.WS_EMPLOYEES_ADMIN || 1500),
  employeesEmp: Number(process.env.WS_EMPLOYEES_EMP || 400),
  perList: Number(process.env.WS_PER_LIST || 3000),
  requests: 5000,
  punchesDays: 45,
  punchesMax: 60000,
};
const isAdmin = (a) => a.role === "admin" || a.role === "superadmin";

// ── working set of employees ───────────────────────────────────────────
async function workingSet(a) {
  const me = a.emp || "";
  const t = a.t;
  const lim = isAdmin(a) ? LIMITS.employeesAdmin : LIMITS.employeesEmp;
  const md = nextDays(16);
  const self = await one("SELECT department FROM employees WHERE tenant_id = $1 AND employee_code = $2", [t, me]);
  // each part is one indexed lookup; they run side by side
  const parts = await Promise.all([
    many(`WITH RECURSIVE chain AS (
            SELECT employee_code, reporting_manager, 0 AS lvl FROM employees WHERE tenant_id = $1 AND employee_code = $2
            UNION ALL
            SELECT e.employee_code, e.reporting_manager, c.lvl + 1 FROM employees e JOIN chain c ON e.tenant_id = $1 AND e.employee_code = c.reporting_manager WHERE c.lvl < 12)
          SELECT employee_code FROM chain`, [t, me]),
    many("SELECT employee_code FROM employees WHERE tenant_id = $1 AND reporting_manager = $2 ORDER BY employee_code LIMIT 2000", [t, me]),
    many("SELECT employee_code FROM accounts WHERE tenant_id = $1 AND employee_code IS NOT NULL", [t]),
    many("SELECT DISTINCT employee_code FROM (SELECT employee_code FROM requests WHERE tenant_id = $1 AND pending_with = ANY($2) AND created_at > now() - interval '180 days' ORDER BY created_at DESC LIMIT 2000) r", [t, inboxKeys(a)]),
    many("SELECT employee_code FROM employees WHERE tenant_id = $1 AND status = 'active' AND (extract(month from date_of_birth) * 100 + extract(day from date_of_birth)) = ANY($2) LIMIT 300", [t, md]),
    many("SELECT employee_code FROM employees WHERE tenant_id = $1 AND status = 'active' AND (extract(month from date_of_joining) * 100 + extract(day from date_of_joining)) = ANY($2) LIMIT 300", [t, md]),
    self?.department ? many("SELECT employee_code FROM employees WHERE tenant_id = $1 AND department = $2 AND status = 'active' ORDER BY full_name, employee_code LIMIT 200", [t, self.department]) : [],
    // admins also get the first people of the directory; employees do not need them
    isAdmin(a) ? many("SELECT employee_code FROM employees WHERE tenant_id = $1 AND status IN ('active', 'pending_approval', 'locked', 'suspended') ORDER BY status, full_name, employee_code LIMIT $2", [t, lim]) : [],
  ]);
  const out = new Set();
  for (const rows of parts) for (const r of rows) { if (out.size >= lim + 600) break; out.add(r.employee_code); }
  const codes = [...out];
  // records (requests, punches, documents …) are loaded for everyone in the set for admins, but only for
  // themselves and their direct reports for employees and managers
  codes.detail = isAdmin(a) ? codes : [me, ...parts[1].map((r) => r.employee_code)].filter(Boolean);
  return codes;
}
const inboxKeys = (a) => [a.emp, a.code, ...(isAdmin(a) ? ["role:admin", "role:hr", "role:finance", "role:it", "role:super"] : [])].filter(Boolean);
function nextDays(n) {
  const out = [];
  for (let i = -2; i < n; i++) { const d = new Date(Date.now() + i * 86400000); out.push((d.getUTCMonth() + 1) * 100 + d.getUTCDate()); }
  return out;
}

const merge = (doc, extra) => ({ ...doc, ...extra });
// The typed columns are the source of truth; records loaded in bulk (CSV import, generators) may carry only a few
// fields in `doc`, so the columns are merged back and the fields every screen reads get safe defaults.
export const EMP_COLS = "employee_code, full_name, email, login_id, designation, department, reporting_manager, company_id, location_id, country_code, employment_type, worker_type, grade_code, status, to_char(date_of_joining, 'YYYY-MM-DD') AS date_of_joining, to_char(date_of_birth, 'YYYY-MM-DD') AS date_of_birth, monthly_gross";
const EMP_DEFAULTS = { designation: "", department: "", reporting_manager: "", grade_code: "", employment_type: "full_time", worker_type: "permanent", fte: "1", country_code: "IN", region: "", city: "", email: "", login_id: "", work_phone: "", phone: "", personal_mobile: "", personal_email: "", current_address: "", permanent_address: "", blood_group: "", emergency_contact_name: "", emergency_contact_phone: "", probation_status: "confirmed", notice_period: "30", shift: "general", leave_policy: "standard", expense_policy: "standard", pay_cycle: "monthly", tax_regime: "new", pan: "", uan: "", bank_name: "", bank_account: "", bank_ifsc: "", profile_photo: null, attendance_mode: "any", field_staff: "no", gender: "", preferred_language: "English", date_of_birth: "", date_of_joining: "", monthly_gross: 0 };
export function empDoc(e) {
  const cols = {};
  for (const k of ["employee_code", "full_name", "email", "login_id", "designation", "department", "reporting_manager", "company_id", "location_id", "country_code", "employment_type", "worker_type", "grade_code", "status", "date_of_joining", "date_of_birth", "monthly_gross"]) if (e[k] !== null && e[k] !== undefined) cols[k] = e[k];
  return { ...EMP_DEFAULTS, ...e.doc, ...cols, must_reset: !!e.must_reset, failed_attempts: e.failed_attempts || 0, ...(e.has_login === undefined ? {} : { has_login: e.has_login }) };
}
export async function bootstrap(a) {
  const t = a.t;
  const codes = await workingSet(a);
  const detail = codes.detail;
  const [docs, emps, accts, cos, locs, ous, reqs, punches, notes, audit, batches, ents, total] = await Promise.all([
    // company-wide parts are the same for everyone: cached per company for 30 s, cleared on every change
    cached(t, `boot-docs:${t}`, 30, () => many("SELECT name, doc FROM tenant_docs WHERE tenant_id = $1 AND name NOT LIKE '\\_\\_%'", [t])),
    many(`SELECT doc, ${EMP_COLS}, must_reset, failed_attempts, password_hash IS NOT NULL AS has_login FROM employees WHERE tenant_id = $1 AND employee_code = ANY($2)`, [t, codes]),
    cached(t, `boot-acct:${t}`, 30, () => many("SELECT role, doc, status, password_hash IS NOT NULL AS has_login FROM accounts WHERE tenant_id = $1 ORDER BY code", [t])),
    cached(t, `boot-co:${t}`, 30, () => many("SELECT doc FROM companies WHERE tenant_id = $1 ORDER BY company_id", [t])),
    cached(t, `boot-loc:${t}`, 30, () => many("SELECT doc FROM locations WHERE tenant_id = $1 ORDER BY location_id", [t])),
    cached(t, `boot-ou:${t}`, 30, () => many("SELECT doc FROM org_units WHERE tenant_id = $1 ORDER BY org_unit_id", [t])),
    many(`SELECT doc FROM (
            (SELECT doc, created_at FROM requests WHERE tenant_id = $1 AND employee_code = ANY($2) AND created_at > now() - interval '120 days' ORDER BY created_at DESC LIMIT $4)
            UNION
            (SELECT doc, created_at FROM requests WHERE tenant_id = $1 AND pending_with = ANY($3) ORDER BY created_at DESC LIMIT $4)
          ) x ORDER BY created_at DESC LIMIT $4`, [t, detail, inboxKeys(a), LIMITS.requests]),
    many(`SELECT doc FROM punches WHERE tenant_id = $1 AND employee_code = ANY($2) AND ts > now() - make_interval(days => $3) ORDER BY ts DESC LIMIT $4`,
      [t, detail, isAdmin(a) ? 7 : LIMITS.punchesDays, LIMITS.punchesMax]),
    many("SELECT doc, read FROM notifications WHERE tenant_id = $1 AND recipient = ANY($2) AND at > now() - interval '90 days' ORDER BY at DESC LIMIT 400", [t, [a.code, a.emp].filter(Boolean)]),
    isAdmin(a) ? many("SELECT jsonb_build_object('log_id', log_id, 'user_code', user_code, 'role', role, 'action', action, 'timestamp', ts, 'ip', ip, 'details', details) || doc AS doc FROM audit_log WHERE tenant_id = $1 AND ts > now() - interval '30 days' ORDER BY ts DESC LIMIT 500", [t])
               : many("SELECT jsonb_build_object('log_id', log_id, 'user_code', user_code, 'role', role, 'action', action, 'timestamp', ts, 'ip', ip, 'details', details) || doc AS doc FROM audit_log WHERE tenant_id = $1 AND user_code = $2 AND ts > now() - interval '90 days' ORDER BY ts DESC LIMIT 100", [t, a.emp]),
    many("SELECT batch_id, period, doc, employees FROM payslip_batches WHERE tenant_id = $1 ORDER BY period DESC, created_at DESC LIMIT 24", [t]),
    Promise.all([
      cached(t, `boot-shared:${t}`, 30, () => many(`SELECT collection, doc, ord FROM (
            SELECT collection, doc, ord, row_number() OVER (PARTITION BY collection ORDER BY updated_at DESC) AS rn
            FROM entity_records WHERE tenant_id = $1 AND employee_code IS NULL) x
          WHERE rn <= $2`, [t, LIMITS.perList])),
      many(`SELECT collection, doc, ord FROM (
            SELECT collection, doc, ord, row_number() OVER (PARTITION BY collection ORDER BY updated_at DESC) AS rn
            FROM entity_records WHERE tenant_id = $1 AND (employee_code = ANY($2) OR employee_code = $3)) x
          WHERE rn <= $4`, [t, detail, a.code, LIMITS.perList]),
    ]).then(([sh, mine]) => [...sh, ...mine].sort((x, y) => (x.collection < y.collection ? -1 : x.collection > y.collection ? 1 : x.ord - y.ord))),
    one("SELECT coalesce(sum(n), 0) AS n, coalesce(sum(n) FILTER (WHERE status = 'active'), 0) AS active FROM mv_headcount WHERE tenant_id = $1", [t]),
  ]);
  // payslips: everyone gets their own; admins also get the working set's (full batches are paged on the server screen)
  const slipCodes = isAdmin(a) ? codes : [a.emp].filter(Boolean);
  const slips = batches.length ? await many("SELECT batch_id, doc FROM payslips WHERE tenant_id = $1 AND batch_id = ANY($2) AND employee_code = ANY($3)", [t, batches.map((b) => b.batch_id), slipCodes]) : [];
  const slipsBy = new Map();
  for (const s of slips) (slipsBy.get(s.batch_id) || slipsBy.set(s.batch_id, []).get(s.batch_id)).push(s.doc);

  const data = {};
  for (const d of docs) data[d.name] = d.doc;
  const lists = {};
  for (const r of ents) (lists[r.collection] || (lists[r.collection] = [])).push(r.doc);
  Object.assign(data, lists);
  // a list that exists but has no rows in the working set must still be an array
  for (const k of await cached(t, `boot-cols:${t}`, 60, async () => (await many("SELECT DISTINCT collection FROM entity_records WHERE tenant_id = $1", [t])).map((r) => r.collection))) if (!data[k]) data[k] = [];
  // employees see colleagues without pay, bank, ID numbers or personal contact details
  const PRIVATE = ["monthly_gross", "annual_ctc", "pan", "uan", "aadhaar", "bank_account", "bank_ifsc", "bank_name", "personal_mobile", "personal_email", "current_address", "permanent_address", "emergency_contact_phone", "esic", "pf_number"];
  data.employees = emps.map((e) => {
    const doc = empDoc(e);
    if (!isAdmin(a) && doc.employee_code !== a.emp) for (const k of PRIVATE) if (k in doc) doc[k] = k === "monthly_gross" || k === "annual_ctc" ? 0 : "";
    return doc;
  });
  data.admins = accts.filter((x) => x.role === "admin").map((x) => merge(x.doc, { status: x.status, has_login: x.has_login }));
  data.superAdmins = accts.filter((x) => x.role === "superadmin").map((x) => merge(x.doc, { status: x.status }));
  data.companies = cos.map((r) => r.doc);
  data.workLocations = locs.map((r) => r.doc);
  data.orgUnits = ous.map((r) => r.doc);
  data.requests = reqs.map((r) => r.doc);
  data.punches = punches.map((r) => r.doc);
  data.notifications = notes.map((r) => ({ ...r.doc, read: r.read }));
  data.audit = audit.map((r) => r.doc);
  data.payslipBatches = batches.map((b) => ({ ...b.doc, slips: slipsBy.get(b.batch_id) || [], slips_total: b.employees }));
  data.version = data.version || 3;
  data.__server = { tenant: t, employees_total: Number(total?.n || 0), employees_active: Number(total?.active || 0), employees_loaded: data.employees.length, partial: Number(total?.n || 0) > data.employees.length, at: new Date().toISOString() };
  return data;
}

// ── sync ────────────────────────────────────────────────────────────────
const EMP_PROTECTED = ["monthly_gross", "status", "reporting_manager", "designation", "department", "company_id", "location_id", "grade_code", "login_id", "employment_type", "worker_type", "annual_ctc", "bank_account", "bank_ifsc"];
const EMP_DOC_BLOCK = new Set(["settings", "paySettings", "contractSettings", "payslipDesignRules", "automation", "fx", "budget", "compCycle", "complianceStatus"]);

async function reportsOf(c, a) {
  if (!a.emp) return new Set();
  return new Set((await c.query("SELECT employee_code FROM employees WHERE tenant_id = $1 AND reporting_manager = $2", [a.t, a.emp])).rows.map((r) => r.employee_code));
}

// Applies a document patch: [{ path: [k1, k2?], op: "set" | "unset" | "upsert" | "remove", value | items: [{ item, front }] | keys }]
function applyPatch(doc, ops) {
  const root = doc && typeof doc === "object" && !Array.isArray(doc) ? doc : {};
  for (const o of ops) {
    if (!Array.isArray(o.path) || !o.path.length) { if (o.op === "set") return o.value; continue; }
    let parent = root;
    for (const k of o.path.slice(0, -1)) { if (!parent[k] || typeof parent[k] !== "object" || Array.isArray(parent[k])) parent[k] = {}; parent = parent[k]; }
    const last = o.path[o.path.length - 1];
    if (o.op === "set") parent[last] = o.value;
    else if (o.op === "unset") delete parent[last];
    else if (o.op === "upsert") {
      const arr = Array.isArray(parent[last]) ? parent[last] : (parent[last] = []);
      const idx = new Map(arr.map((x, i) => [C.keyOf(x), i]));
      for (const { item, front } of o.items || []) {
        const k = C.keyOf(item);
        if (idx.has(k)) arr[idx.get(k)] = item;
        else if (front) arr.unshift(item); else arr.push(item);
        if (front) { idx.clear(); arr.forEach((x, i) => idx.set(C.keyOf(x), i)); } else idx.set(k, arr.length - 1);
      }
    } else if (o.op === "remove" && Array.isArray(parent[last])) {
      const kill = new Set(o.keys || []);
      parent[last] = parent[last].filter((x) => !kill.has(C.keyOf(x)));
    }
  }
  return root;
}

// A free employee code from the tenant's counter (started from the highest EMPnnn already used).
async function nextEmployeeCode(c, t) {
  await c.query(`INSERT INTO code_counters (tenant_id, prefix, last)
    SELECT $1, 'EMP', coalesce(max(substring(employee_code from '^EMP(\\d+)$')::bigint), 0) FROM employees WHERE tenant_id = $1 AND employee_code ~ '^EMP\\d+$'
    ON CONFLICT DO NOTHING`, [t]);
  for (;;) {
    const n = (await c.query("UPDATE code_counters SET last = last + 1 WHERE tenant_id = $1 AND prefix = 'EMP' RETURNING last", [t])).rows[0].last;
    const code = `EMP${String(n).padStart(3, "0")}`;
    if (!(await c.query("SELECT 1 FROM employees WHERE tenant_id = $1 AND employee_code = $2", [t, code])).rowCount) return code;
  }
}
const suffix = () => Math.random().toString(36).slice(2, 6).toUpperCase();
// Records the app just created whose key is already taken on the server get a new key; the app is told so it can follow.
async function freeKeys(c, t, col, ups, created, renamed) {
  if (!created.size) return;
  const field = { requests: "request_id", punches: "id", audit: "log_id" }[col];
  for (const r of ups) {
    const k = field ? `${r?.[field]}` : C.keyOf(r);
    if (!created.has(k) && !created.has(`${field}:${k}`)) continue;
    let exists;
    if (col === "requests") exists = (await c.query("SELECT 1 FROM requests WHERE tenant_id = $1 AND request_id = $2 LIMIT 1", [t, r.request_id])).rowCount;
    else if (col === "punches") exists = (await c.query("SELECT 1 FROM punches WHERE tenant_id = $1 AND id = $2 AND ts > now() - interval '400 days' LIMIT 1", [t, r.id])).rowCount;
    else if (col === "audit") exists = (await c.query("SELECT 1 FROM audit_log WHERE tenant_id = $1 AND log_id = $2 LIMIT 1", [t, r.log_id])).rowCount;
    else exists = (await c.query("SELECT 1 FROM entity_records WHERE tenant_id = $1 AND collection = $2 AND record_key = $3", [t, col, k])).rowCount;
    if (!exists) continue;
    const f = field || (k.startsWith("h:") ? null : k.split(":")[0]);
    if (!f) continue; // content-keyed records cannot collide with different content
    const from = r[f];
    r[f] = `${from}-${suffix()}`;
    renamed.push({ c: col, field: f, from, to: r[f] });
  }
}

export async function sync(a, body) {
  const t = a.t;
  const rejected = [];
  const renamed = [];
  let applied = 0;
  const changes = Array.isArray(body?.changes) ? body.changes : [];
  const docs = Array.isArray(body?.docs) ? body.docs : [];
  if (changes.length > 200 || docs.length > 200) return { status: 413, body: { error: "Too many changes in one sync." } };
  await tx(async (c) => {
    const reports = isAdmin(a) ? null : await reportsOf(c, a);
    const mine = (code) => isAdmin(a) || code === a.emp || (reports && reports.has(code));
    for (const ch of changes) {
      const col = String(ch.c || "");
      const ups = (ch.upsert || []).slice(0, 5000);
      const dels = (ch.delete || []).slice(0, 5000);
      const front = new Set(ch.front || []);
      if (col === "superAdmins" || (C.SERVER_ONLY.has(col) && !isAdmin(a)) || (col === "admins" && a.role !== "superadmin")) { rejected.push({ c: col, reason: "not allowed for your role" }); continue; }
      if (col === "employees") {
        const created = new Set((ch.created || []).map((k) => String(k).replace(/^\w+:/, "")));
        for (const e of ups) {
          if (!e?.employee_code) continue;
          // a record the app just created must not land on an existing code (another admin may have taken it)
          if (created.has(e.employee_code) && isAdmin(a) && (await c.query("SELECT 1 FROM employees WHERE tenant_id = $1 AND employee_code = $2", [t, e.employee_code])).rowCount) {
            const to = await nextEmployeeCode(c, t);
            renamed.push({ c: col, field: "employee_code", from: e.employee_code, to });
            e.employee_code = to;
          }
          if (!isAdmin(a)) {
            if (e.employee_code !== a.emp) { rejected.push({ c: col, key: e.employee_code, reason: "you can only change your own record" }); continue; }
            const cur = (await c.query("SELECT doc, status FROM employees WHERE tenant_id = $1 AND employee_code = $2", [t, a.emp])).rows[0];
            if (cur) for (const f of EMP_PROTECTED) e[f] = f === "status" ? cur.status : cur.doc[f];
          }
          await c.query(C.EMPLOYEE_UPSERT, C.employeeRow(t, e)); applied++;
        }
        if (dels.length) { if (a.role === "superadmin" || a.role === "admin") { await c.query("UPDATE employees SET status = 'deleted', updated_at = now() WHERE tenant_id = $1 AND employee_code = ANY($2)", [t, dels.map((k) => String(k).replace(/^\w+:/, ""))]); applied += dels.length; } else rejected.push({ c: col, reason: "only admins remove employees" }); }
      } else if (col === "admins") {
        for (const x of ups) { await c.query(C.ACCOUNT_UPSERT, C.accountRow(t, "admin", x)); applied++; }
      } else if (col === "requests") {
        await freeKeys(c, t, col, ups, new Set((ch.created || []).map(String)), renamed);
        for (const r of ups) {
          if (!r?.request_id) continue;
          if (!isAdmin(a)) {
            const cur = (await c.query("SELECT employee_code, pending_with FROM requests WHERE tenant_id = $1 AND request_id = $2 LIMIT 1", [t, r.request_id])).rows[0];
            const ok = cur ? (cur.employee_code === a.emp || cur.pending_with === a.emp || mine(cur.employee_code)) : r.employee_code === a.emp;
            if (!ok) { rejected.push({ c: col, key: r.request_id, reason: "not your request or approval" }); continue; }
          }
          // created_at is part of the key: keep the stored one so an edit never makes a second row
          const cur = (await c.query("SELECT created_at FROM requests WHERE tenant_id = $1 AND request_id = $2 LIMIT 1", [t, r.request_id])).rows[0];
          if (cur) r.created_at = r.created_at || cur.created_at.toISOString();
          const row = C.requestRow(t, r);
          if (cur && new Date(row[2]).getTime() !== new Date(cur.created_at).getTime()) row[2] = cur.created_at.toISOString();
          await c.query(C.REQUEST_UPSERT, row); applied++;
        }
        for (const k of dels) { const id = String(k).replace(/^\w+:/, ""); await c.query(`DELETE FROM requests WHERE tenant_id = $1 AND request_id = $2 ${isAdmin(a) ? "" : "AND employee_code = $3"}`, isAdmin(a) ? [t, id] : [t, id, a.emp]); applied++; }
      } else if (col === "punches") {
        await freeKeys(c, t, col, ups, new Set((ch.created || []).map(String)), renamed);
        const ok = ups.filter((p) => p?.id && p.ts && mine(p.employee_code));
        if (ok.length < ups.length) rejected.push({ c: col, reason: `${ups.length - ok.length} punch(es) for other people ignored` });
        applied += await C.bulk(c, C.PUNCH_UPSERT, [...new Map(ok.map((p) => [p.id + p.ts, C.punchRow(t, p)])).values()]);
        if (dels.length && isAdmin(a)) { await c.query("DELETE FROM punches WHERE tenant_id = $1 AND id = ANY($2) AND ts > now() - interval '400 days'", [t, dels.map((k) => String(k).replace(/^id:/, ""))]); applied += dels.length; }
      } else if (col === "notifications") {
        const rows = [];
        for (const n of ups) {
          if (!n?.id) continue;
          // anyone may notify anyone (e.g. "your manager has a leave request"); only the recipient may mark one read
          if (n.read && !isAdmin(a) && ![a.code, a.emp].includes(n.to)) n.read = false;
          rows.push(C.noteRow(t, n));
        }
        applied += await C.bulk(c, C.NOTE_UPSERT, [...new Map(rows.map((r) => [r[1] + r[2], r])).values()]);
        if (dels.length) { await c.query("DELETE FROM notifications WHERE tenant_id = $1 AND id = ANY($2) AND recipient = ANY($3)", [t, dels.map((k) => String(k).replace(/^id:/, "")), [a.code, a.emp]]); applied += dels.length; }
      } else if (col === "audit") {
        await freeKeys(c, t, col, ups, new Set((ch.created || []).map(String)), renamed);
        applied += await C.bulk(c, C.AUDIT_INSERT, ups.filter((x) => x?.log_id).map((x) => C.auditRow(t, { ...x, user_code: isAdmin(a) ? x.user_code : a.emp || a.code })));
        // audit is append-only: deletes are ignored
      } else if (col === "payslipBatches") {
        for (const b of ups) {
          if (!b?.id || !b.period) continue;
          await c.query(C.BATCH_UPSERT, C.batchRow(t, b));
          if ((b.slips || []).length) await C.bulk(c, C.SLIP_UPSERT, C.slipRows(t, b), 300);
          applied++;
        }
      } else if (["companies", "workLocations", "orgUnits"].includes(col)) {
        for (const x of ups) {
          if (col === "companies") await c.query("INSERT INTO companies (tenant_id, company_id, name, country, currency, status, doc) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (tenant_id, company_id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status, doc = EXCLUDED.doc, updated_at = now()", [t, x.company_id, x.name, x.country, x.currency, x.status || "active", JSON.stringify(x)]);
          if (col === "workLocations") await c.query("INSERT INTO locations (tenant_id, location_id, company_id, name, doc) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (tenant_id, location_id) DO UPDATE SET company_id = EXCLUDED.company_id, name = EXCLUDED.name, doc = EXCLUDED.doc, updated_at = now()", [t, x.location_id, x.company_id, x.name, JSON.stringify(x)]);
          if (col === "orgUnits") await c.query("INSERT INTO org_units (tenant_id, org_unit_id, name, parent_unit, doc) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (tenant_id, org_unit_id) DO UPDATE SET name = EXCLUDED.name, parent_unit = EXCLUDED.parent_unit, doc = EXCLUDED.doc", [t, x.org_unit_id, x.name, x.parent_unit, JSON.stringify(x)]);
          applied++;
        }
      } else {
        // every other list → entity_records
        await freeKeys(c, t, col, ups, new Set((ch.created || []).map(String)), renamed);
        const rows = [];
        for (const r of ups) {
          const owner = r?.employee_code;
          if (!isAdmin(a) && owner && !mine(owner) && owner !== a.code) { rejected.push({ c: col, key: C.keyOf(r), reason: "belongs to someone else" }); continue; }
          rows.push(C.entityRow(t, col, r));
        }
        const uniq = [...new Map(rows.map((r) => [r[2], r])).values()];
        if (uniq.length) {
          const ends = (await c.query("SELECT coalesce(min(ord), 0) AS lo, coalesce(max(ord), 0) AS hi FROM entity_records WHERE tenant_id = $1 AND collection = $2", [t, col])).rows[0];
          let lo = ends.lo, hi = ends.hi;
          // new records go to the front or the back of the list, as they did in the app; existing ones keep their place
          const existing = new Set((await c.query("SELECT record_key FROM entity_records WHERE tenant_id = $1 AND collection = $2 AND record_key = ANY($3)", [t, col, uniq.map((r) => r[2])])).rows.map((r) => r.record_key));
          const sql = `INSERT INTO entity_records (tenant_id, collection, record_key, employee_code, doc, ord) VALUES ($1,$2,$3,$4,$5,$6)
            ON CONFLICT (tenant_id, collection, record_key) DO UPDATE SET employee_code = EXCLUDED.employee_code, doc = EXCLUDED.doc, updated_at = now()`;
          const withOrd = uniq.map((r) => [...r, existing.has(r[2]) ? 0 : front.has(r[2]) ? --lo : ++hi]);
          applied += await C.bulk(c, sql, withOrd);
        }
        if (dels.length) {
          const q = isAdmin(a)
            ? c.query("DELETE FROM entity_records WHERE tenant_id = $1 AND collection = $2 AND record_key = ANY($3)", [t, col, dels])
            : c.query("DELETE FROM entity_records WHERE tenant_id = $1 AND collection = $2 AND record_key = ANY($3) AND (employee_code IS NULL OR employee_code = ANY($4))", [t, col, dels, [a.emp, a.code, ...(reports || [])]]);
          applied += (await q).rowCount;
        }
      }
    }
    // settings-style documents: patched under a row lock, so two people saving different parts never overwrite each other
    for (const d of docs) {
      const name = String(d.name || "");
      if (!name || name.startsWith("__") || C.TYPED.has(name)) continue;
      if (!isAdmin(a) && EMP_DOC_BLOCK.has(name)) { rejected.push({ c: name, reason: "only admins change this" }); continue; }
      const cur = (await c.query("SELECT doc FROM tenant_docs WHERE tenant_id = $1 AND name = $2 FOR UPDATE", [t, name])).rows[0];
      const next = applyPatch(cur ? cur.doc : null, d.ops || []);
      await c.query(C.DOC_UPSERT, [t, name, JSON.stringify(next ?? null)]);
      applied++;
    }
  });
  if (applied) invalidate(t);
  return { status: 200, body: { ok: true, applied, rejected, renamed, server_time: new Date().toISOString() } };
}

// ── changes since ───────────────────────────────────────────────────────
export async function changesSince(a, since) {
  const t = a.t;
  const at = since && !Number.isNaN(Date.parse(since)) ? new Date(since) : new Date(Date.now() - 60000);
  const keys = inboxKeys(a);
  const [notes, reqs, docs] = await Promise.all([
    many("SELECT doc, read FROM notifications WHERE tenant_id = $1 AND recipient = ANY($2) AND at > $3::timestamptz - interval '5 minutes' ORDER BY at DESC LIMIT 200", [t, [a.code, a.emp].filter(Boolean), at]),
    many(`SELECT doc FROM requests WHERE tenant_id = $1 AND updated_at > $3::timestamptz AND (pending_with = ANY($2) OR employee_code = $4) ORDER BY updated_at DESC LIMIT 500`, [t, keys, at, a.emp || ""]),
    many("SELECT name, doc FROM tenant_docs WHERE tenant_id = $1 AND updated_at > $2::timestamptz AND name NOT LIKE '\\_\\_%'", [t, at]),
  ]);
  return { server_time: new Date().toISOString(), notifications: notes.map((r) => ({ ...r.doc, read: r.read })), requests: reqs.map((r) => r.doc), docs: Object.fromEntries(docs.map((d) => [d.name, d.doc])) };
}
export { pool };
