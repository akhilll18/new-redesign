// v10.5 · Bulk actions — data loaders for HR admins and the Super Admin.
// Flow (as in the classic HRMS bulk screens): pick a loader → download a prefilled (filtered) or blank Excel / CSV
// template → edit it → upload → Validate (Existing records · Consolidated · Valid · Errors · Warnings) → apply.
//  • Frequent load: updates existing employees only; blank cells leave the value unchanged.
//  • One-time load: the initial / migration load; rows without a known employee code create new employees
//    (they go to account approval like any new joiner), and blank cells clear the value.
import { EMPLOYEE_SECTIONS, ALL_FIELDS, REGIONS, COUNTRIES, validateEmployee, workerTypeOf, fieldApplies, isContingent, monthlyEquivalent, WORKER_TYPES } from "../data/employeeFields.js";
import { isZeroLeaveWorker } from "./statutory.js";

const SEC = Object.fromEntries(EMPLOYEE_SECTIONS.map((s) => [s.id, s]));
const FIELD = Object.fromEntries(ALL_FIELDS.map((f) => [f.key, f]));
const fieldsOf = (sections) => sections.flatMap((id) => SEC[id].fields.map((f) => f.key));

export const LOADER_GROUPS = [
  ["data", "Data loaders", "Manage the company's bulk uploads"],
  ["settings", "Employee settings", "Manage employee settings in bulk"],
  ["salary", "Salary", "Manage salary and bank details of employees"],
  ["leave", "Earned leave and other events", "Manage leave balances of employees"],
];

export const LOADERS = [
  { id: "employee-all", group: "data", label: "Bulk employee data upload", desc: "Upload employee records from an Excel spreadsheet — every employee master field.", fields: fieldsOf(["core", "contact", "employment", "workforce", "engagement", "pay"]), allowNew: true },
  { id: "core", group: "data", label: "Employee master data upload", desc: "Name, job title, department, manager, grade, dates, country, company and location.", fields: fieldsOf(["core"]), allowNew: true },
  { id: "contact", group: "data", label: "Contacts & emergency contacts upload", desc: "Work and personal email / phone, addresses, blood group and emergency contacts.", fields: fieldsOf(["contact"]) },
  { id: "employment", group: "data", label: "Employment data upload", desc: "Probation, review dates, notice period, recruitment, right to work, shift, leave and expense policy.", fields: fieldsOf(["employment"]) },
  { id: "workforce", group: "data", label: "Workforce & devices upload", desc: "Attendance method, geofence, field staff, biometric ID, call tracking, promotion and potential.", fields: fieldsOf(["workforce"]) },
  { id: "engagement", group: "data", label: "Contract & engagement upload", desc: "Contract rate, hours, payment route, vendor, GST / TDS and renewal for contingent workers.", fields: fieldsOf(["engagement"]) },
  { id: "pay", group: "data", label: "Pay & statutory upload", desc: "Gross pay, tax regime, PAN, UAN, PF and bank details.", fields: fieldsOf(["pay"]) },
  { id: "rtw", group: "data", label: "Right to work & background checks upload", desc: "Right-to-work and background-check status.", fields: ["right_to_work", "background_check"] },
  { id: "shift", group: "settings", label: "Employee shift details upload", desc: "Shift, attendance method, work geofence and biometric ID.", fields: ["shift", "attendance_mode", "primary_geofence", "biometric_id"] },
  { id: "work-pattern", group: "settings", label: "Assign work pattern", desc: "Work schedule, FTE and shift to many employees.", fields: ["employment_type", "fte", "shift"] },
  { id: "team", group: "settings", label: "Manage team members (reports to)", desc: "Set or change reporting managers.", fields: ["reporting_manager"] },
  { id: "location", group: "settings", label: "Assign company & location", desc: "Move employees between legal entities, branches and work cities.", fields: ["location_id", "city", "region"] },
  { id: "policies", group: "settings", label: "Assign leave & expense policy", desc: "Leave and expense policy per employee.", fields: ["leave_policy", "expense_policy"] },
  { id: "salary", group: "salary", label: "Salary data upload", desc: "Monthly gross, pay cycle and tax regime.", fields: ["monthly_gross", "pay_cycle", "tax_regime"] },
  { id: "bank", group: "salary", label: "Bank detail data upload", desc: "Payment mode, bank name, account number and IFSC.", fields: ["payment_mode", "bank_name", "bank_account", "bank_ifsc"] },
  { id: "leave-balance", group: "leave", label: "Leave balance data upload", desc: "Opening / corrected leave balances: this year's and next year's entitlement and remaining balance.", kind: "leave" },
];
export const LOADER_BY = Object.fromEntries(LOADERS.map((l) => [l.id, l]));

export const LEAVE_COLUMNS = ["Employee Id", "First Name", "Last Name", "Leave Name", "This Year Entitlement", "Next Year Entitlement", "This Year Remaining Balance", "Next Year Remaining Balance"];
const READ_ONLY = (f) => f.type === "calc" || !f.editableBy?.length;

/** Option list [value, label] for a select field (static or from data). */
export function optionsOf(f, data, rec = {}) {
  if (!f || f.type !== "select") return null;
  if (f.options === "departments") return data.orgUnits.map((o) => [o.org_unit_id, o.name]);
  if (f.options === "managers") return data.employees.filter((e) => e.status === "active").map((e) => [e.employee_code, `${e.full_name} (${e.employee_code})`]);
  if (f.options === "companies") return (data.companies || []).map((c) => [c.company_id, `${c.short} · ${c.name}`]);
  if (f.options === "locations") return (data.workLocations || []).map((l) => [l.location_id, `${l.name} · ${l.city}`]);
  if (f.options === "geofences") return (data.geofences || []).map((g) => [g.id, g.name]);
  if (f.options === "vendors") return (data.contractVendors || []).map((v) => [v.id, v.name]);
  if (f.options === "regions") return REGIONS[rec.country_code || "IN"] || Object.values(REGIONS).flat();
  if (f.key === "worker_type") return WORKER_TYPES.map((w) => [w.id, w.label]);
  if (f.key === "country_code") return COUNTRIES.map((c) => [c.code, c.name]);
  return Array.isArray(f.options) ? f.options : null;
}

/** Template columns for a loader: Employee code + Full name first (reference), then the loader's fields. */
export function columnsOf(loader) {
  if (loader.kind === "leave") return LEAVE_COLUMNS.map((h) => ({ header: h, key: h, required: ["Employee Id", "Leave Name", "This Year Entitlement", "This Year Remaining Balance"].includes(h) }));
  const keys = ["employee_code", ...(loader.fields.includes("full_name") ? [] : ["full_name"]), ...loader.fields.filter((k) => k !== "employee_code")];
  return keys
    .filter((k) => FIELD[k] && FIELD[k].type !== "calc" && k !== "status")
    .map((k) => ({ header: FIELD[k].label, key: k, required: k === "employee_code" || !!FIELD[k].required, reference: k === "full_name" && !loader.fields.includes("full_name"), rule: FIELD[k].rule }));
}

const display = (f, v, data, rec) => {
  if (v === undefined || v === null) return "";
  const opts = optionsOf(f, data, rec);
  if (opts) return opts.find(([val]) => String(val) === String(v))?.[1] ?? String(v);
  return String(v);
};

/** Current values for the employees in scope, as template rows (header → display value). */
export function prefillRows(loader, data, employees) {
  const cols = columnsOf(loader);
  if (loader.kind === "leave") {
    const out = [];
    employees.forEach((e) => {
      const [first, ...rest] = e.full_name.split(" ");
      data.leaveTypes.filter((t) => t.active && t.annual != null).forEach((t) => {
        const o = e.leave_overrides?.[t.code];
        out.push({ "Employee Id": e.employee_code, "First Name": first, "Last Name": rest.join(" "), "Leave Name": t.name, "This Year Entitlement": o?.entitled ?? "", "Next Year Entitlement": o?.next_entitled ?? "", "This Year Remaining Balance": o?.remaining ?? "", "Next Year Remaining Balance": o?.next_remaining ?? "" });
      });
    });
    return out;
  }
  return employees.map((e) => Object.fromEntries(cols.map((c) => [c.header, display(FIELD[c.key], e[c.key], data, e)])));
}

/** Employees matching the download filters (companies, locations, departments, job role, grade, worker type, specific, exclude). */
export function filterEmployees(data, f = {}) {
  const has = (arr, v) => !arr?.length || arr.includes(v);
  return data.employees.filter((e) => !["rejected"].includes(e.status)
    && has(f.companies, e.company_id) && has(f.locations, e.location_id) && has(f.departments, e.department) && has(f.roles, e.designation)
    && has(f.grades, e.grade_code) && has(f.types, workerTypeOf(e)) && (!f.specific?.length || f.specific.includes(e.employee_code)) && !(f.exclude || []).includes(e.employee_code));
}

// ── parsing a cell into a stored value ──
function toIsoDate(v) {
  if (v instanceof Date && !Number.isNaN(v)) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); // dd/mm/yyyy
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  if (/^\d{5}$/.test(s)) return new Date(Math.round((Number(s) - 25569) * 86400000)).toISOString().slice(0, 10); // Excel serial
  const d = new Date(s);
  return Number.isNaN(d) ? null : d.toISOString().slice(0, 10);
}
function parseCell(f, raw, data, rec) {
  if (raw === undefined || raw === null || String(raw).trim() === "") return { empty: true };
  const s = String(raw instanceof Date ? raw.toISOString() : raw).trim();
  if (f.type === "date") { const d = toIsoDate(raw); return d ? { value: d } : { error: `${f.label}: "${s}" is not a date (use YYYY-MM-DD).` }; }
  if (f.type === "number") { const n = Number(s.replace(/[, ₹]/g, "")); return Number.isNaN(n) ? { error: `${f.label}: "${s}" is not a number.` } : { value: n }; }
  const opts = optionsOf(f, data, rec);
  if (opts) {
    const code = s.match(/\(([A-Z]+\d+)\)\s*$/)?.[1];
    const hit = opts.find(([v, l]) => String(v).toLowerCase() === s.toLowerCase() || String(l).toLowerCase() === s.toLowerCase() || (code && v === code));
    if (!hit) return { error: `${f.label}: "${s}" is not an allowed value.` };
    return { value: hit[0] };
  }
  if (["pan", "bank_ifsc", "gstin", "pf_number"].includes(f.key)) return { value: s.toUpperCase() };
  if (f.type === "email") return { value: s.toLowerCase() };
  return { value: s };
}

const norm = (h) => String(h || "").toLowerCase().replace(/\*|\(reference\)/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Validate uploaded rows. Returns { consolidated, valid, errors, warnings, unknown } where each row is
 * { line, code, name, isNew, changes, messages, status }.
 */
export function validateRows(loader, rows, data, { mode, role }) {
  const cols = columnsOf(loader);
  const headerMap = {};
  const fileHeaders = Object.keys(rows[0] || {});
  fileHeaders.forEach((h) => { const c = cols.find((x) => norm(x.header) === norm(h) || norm(x.key) === norm(h)); if (c) headerMap[h] = c; });
  const unknown = fileHeaders.filter((h) => !headerMap[h] && !/^__/.test(h));
  const empBy = Object.fromEntries(data.employees.map((e) => [e.employee_code, e]));
  const out = [];
  if (loader.kind === "leave") return validateLeaveRows(rows, data, headerMap, unknown);
  const seen = new Map();
  rows.forEach((row, i) => {
    const line = i + 2;
    const val = (key) => { const h = Object.keys(headerMap).find((x) => headerMap[x].key === key); return h ? row[h] : undefined; };
    let code = String(val("employee_code") ?? "").trim().toUpperCase();
    const existing = code ? empBy[code] : null;
    const messages = [];
    const isNew = !existing;
    if (isNew && !(mode === "onetime" && loader.allowNew)) {
      out.push({ line, code: code || "—", name: String(val("full_name") || ""), isNew, status: "error", changes: {}, messages: [code ? `Employee ${code} does not exist. New employees can only be added with a one-time load of the Core HR or full employee loader.` : "Employee code is missing."] });
      return;
    }
    if (code && seen.has(code)) { out.push({ line, code, name: String(val("full_name") || ""), isNew, status: "error", changes: {}, messages: [`Duplicate of line ${seen.get(code)} — each employee once per file.`] }); return; }
    if (code) seen.set(code, line);
    const base = existing ? { ...existing } : { worker_type: "permanent", country_code: "IN" };
    const changes = {};
    // worker type and country first so dependent options resolve
    const ordered = [...cols].sort((a, b) => ["worker_type", "country_code", "company_id", "location_id"].indexOf(b.key) - ["worker_type", "country_code", "company_id", "location_id"].indexOf(a.key));
    let fieldErr = false;
    ordered.forEach((c) => {
      if (c.key === "employee_code" || c.reference) return;
      const f = FIELD[c.key];
      if (!f || READ_ONLY(f)) return;
      const raw = val(c.key);
      if (raw === undefined) return; // column not in file
      const p = parseCell(f, raw, data, { ...base, ...changes });
      if (p.error) { messages.push(p.error); fieldErr = true; return; }
      if (p.empty) { if (mode === "onetime" && !isNew && existing[c.key] != null && existing[c.key] !== "") changes[c.key] = ""; return; }
      if (!isNew && String(existing[c.key] ?? "") === String(p.value)) return;
      changes[c.key] = p.value;
    });
    const merged = { ...base, ...changes };
    merged.worker_type = workerTypeOf(merged);
    if (isContingent(merged)) merged.monthly_gross = monthlyEquivalent(merged);
    // fields that don't apply to this worker type are ignored with a warning
    Object.keys(changes).forEach((k) => { if (FIELD[k] && !fieldApplies(FIELD[k], merged)) { messages.push(`warning: ${FIELD[k].label} does not apply to a ${merged.worker_type} worker — ignored.`); delete changes[k]; } });
    const errs = validateEmployee(merged, { role: "super", employees: data.employees.filter((e) => e.employee_code !== code) });
    const relevant = Object.entries(errs).filter(([k]) => isNew || k in changes);
    relevant.forEach(([k, m]) => messages.push(`${FIELD[k]?.label || k}: ${m}`));
    if (loader.fields.includes("reporting_manager") && changes.reporting_manager && !empBy[changes.reporting_manager]) messages.push("Reporting manager: unknown employee.");
    const hasErr = fieldErr || relevant.length > 0 || messages.some((m) => m.startsWith("Reporting manager: unknown"));
    if (!hasErr && !isNew && !Object.keys(changes).length) messages.push("warning: no changes — this row is already up to date.");
    if (!hasErr && changes.monthly_gross && existing?.monthly_gross && Math.abs(changes.monthly_gross - existing.monthly_gross) / existing.monthly_gross > 0.5) messages.push(`warning: gross pay changes by more than 50% (${existing.monthly_gross} → ${changes.monthly_gross}).`);
    if (!hasErr && changes.date_of_joining && existing && changes.date_of_joining !== existing.date_of_joining) messages.push("warning: date of joining changes — check service-based benefits.");
    out.push({ line, code: isNew ? "NEW" : code, name: merged.full_name || "", isNew, changes, merged, status: hasErr ? "error" : messages.some((m) => m.startsWith("warning:")) ? "warning" : "valid", messages: messages.map((m) => m.replace(/^warning: /, "")) });
  });
  return summarise(out, unknown);
}

function validateLeaveRows(rows, data, headerMap, unknown) {
  const empBy = Object.fromEntries(data.employees.map((e) => [e.employee_code, e]));
  const out = [];
  const seen = new Map();
  rows.forEach((row, i) => {
    const line = i + 2;
    const v = (h) => { const k = Object.keys(headerMap).find((x) => headerMap[x].key === h); return k ? row[k] : undefined; };
    const code = String(v("Employee Id") ?? "").trim().toUpperCase();
    const e = empBy[code];
    const lt = data.leaveTypes.find((t) => [t.name, t.code].map((x) => String(x).toLowerCase()).includes(String(v("Leave Name") ?? "").trim().toLowerCase()));
    const num = (h) => { const x = v(h); if (x === undefined || String(x).trim() === "") return null; const n = Number(x); return Number.isNaN(n) ? NaN : n; };
    const ent = num("This Year Entitlement"), rem = num("This Year Remaining Balance"), nent = num("Next Year Entitlement"), nrem = num("Next Year Remaining Balance");
    const msgs = [];
    let err = false;
    if (!e) { msgs.push(code ? `Employee ${code} does not exist.` : "Employee Id is missing."); err = true; }
    if (!lt) { msgs.push(`Leave "${v("Leave Name") ?? ""}" is not a leave type.`); err = true; }
    else if (lt.annual == null) { msgs.push(`${lt.name} has no balance (unlimited / unpaid).`); err = true; }
    [["This Year Entitlement", ent], ["This Year Remaining Balance", rem], ["Next Year Entitlement", nent], ["Next Year Remaining Balance", nrem]].forEach(([h, n]) => { if (Number.isNaN(n)) { msgs.push(`${h} must be a number.`); err = true; } else if (n != null && n < 0) { msgs.push(`${h} cannot be negative.`); err = true; } });
    if (ent == null || rem == null) { msgs.push("This year's entitlement and remaining balance are required."); err = true; }
    if (!err && e && isZeroLeaveWorker(e, data.settings) && (ent > 0 || rem > 0)) { msgs.push(`${e.full_name} is a ${workerTypeOf(e)} worker — leave balance stays 0 (request-level leave only).`); err = true; }
    const key = `${code}|${lt?.code}`;
    if (!err && seen.has(key)) { msgs.push(`Duplicate of line ${seen.get(key)}.`); err = true; }
    seen.set(key, line);
    let status = err ? "error" : "valid";
    if (!err && rem > ent) { msgs.push("Remaining balance is more than the entitlement (carry-forward?)."); status = "warning"; }
    const o = e?.leave_overrides?.[lt?.code];
    if (!err && o && o.entitled === ent && o.remaining === rem && (o.next_entitled ?? null) === nent && (o.next_remaining ?? null) === nrem) { msgs.push("No changes — already loaded with these values."); status = "warning"; }
    out.push({ line, code: code || "—", name: e?.full_name || "", leave: lt?.name || String(v("Leave Name") ?? ""), status, isNew: false, changes: err ? {} : { leave_type: lt.code, entitled: ent, remaining: rem, next_entitled: nent, next_remaining: nrem }, messages: msgs });
  });
  return summarise(out, unknown);
}

function summarise(out, unknown) {
  return { consolidated: out, valid: out.filter((r) => r.status === "valid" || (r.status === "warning" && Object.keys(r.changes || {}).length)), errors: out.filter((r) => r.status === "error"), warnings: out.filter((r) => r.status === "warning"), unknown };
}

// ── Excel / CSV I/O (exceljs is loaded only when needed) ──
async function excel() {
  const m = await import("exceljs");
  return m.default || m;
}
function saveBlob(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
const csvCell = (v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

/** Write the template (prefilled rows or blank) as .xlsx (with a Lists and a Guide sheet) or .csv. */
export async function writeTemplate(loader, data, rows, { format = "xlsx", name }) {
  const cols = columnsOf(loader);
  const fname = `${name || (rows.length ? "Prefilled" : "Template")}_${loader.label.replace(/[^a-z0-9]+/gi, "_")}.${format}`;
  if (format === "csv") {
    const text = [cols.map((c) => c.header).join(","), ...rows.map((r) => cols.map((c) => csvCell(r[c.header])).join(","))].join("\n");
    return saveBlob(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }), fname);
  }
  const ExcelJS = await excel();
  const wb = new ExcelJS.Workbook();
  wb.creator = "EZY HR";
  const ws = wb.addWorksheet(loader.kind === "leave" ? "Leave balances" : "Employees", { views: [{ state: "frozen", xSplit: 1, ySplit: 1 }] });
  ws.columns = cols.map((c) => ({ header: c.header, key: c.header, width: Math.min(40, Math.max(14, c.header.length + 4)) }));
  ws.getRow(1).eachCell((cell, i) => {
    const c = cols[i - 1];
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: c.reference ? "FF7F8C8D" : c.required ? "FFE53935" : "FF1E9BD7" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    if (c.rule) cell.note = c.rule;
  });
  ws.getRow(1).height = 30;
  rows.forEach((r) => ws.addRow(r));
  // Lists sheet: allowed values per dropdown column, plus Excel drop-downs on the data sheet.
  if (loader.kind !== "leave") {
    const lists = wb.addWorksheet("Lists");
    let li = 1;
    cols.forEach((c, i) => {
      const opts = optionsOf(FIELD[c.key], data);
      if (!opts?.length || c.reference || c.key === "employee_code") return;
      lists.getColumn(li).header = c.header;
      lists.getCell(1, li).font = { bold: true };
      opts.forEach(([, l], j) => { lists.getCell(j + 2, li).value = l; });
      const colL = lists.getColumn(li).letter;
      const ref = `Lists!$${colL}$2:$${colL}$${opts.length + 1}`;
      for (let r = 2; r <= Math.max(rows.length + 200, 300); r++) ws.getCell(r, i + 1).dataValidation = { type: "list", allowBlank: true, formulae: [ref], showErrorMessage: true, errorTitle: "Not allowed", error: `Pick a value from the list for ${c.header}.` };
      lists.getColumn(li).width = 32;
      li++;
    });
  } else {
    const lists = wb.addWorksheet("Lists");
    lists.getCell(1, 1).value = "Leave Name";
    lists.getCell(1, 1).font = { bold: true };
    data.leaveTypes.filter((t) => t.active && t.annual != null).forEach((t, j) => { lists.getCell(j + 2, 1).value = t.name; });
    lists.getColumn(1).width = 28;
  }
  const guide = wb.addWorksheet("Guide");
  guide.columns = [{ header: "Column", key: "c", width: 32 }, { header: "Required", key: "r", width: 10 }, { header: "Rule", key: "u", width: 90 }];
  guide.getRow(1).font = { bold: true };
  cols.forEach((c) => guide.addRow({ c: c.header, r: c.reference ? "reference" : c.required ? "yes" : "", u: c.reference ? "For reference only — not loaded." : c.rule || (loader.kind === "leave" ? "Numbers in days. Leave Name must match a leave type." : "") }));
  guide.addRow({});
  guide.addRow({ c: "Red header = required · Blue = optional · Grey = reference only." });
  guide.addRow({ c: "Frequent load: blank cells keep the current value. One-time load: blank cells clear it; rows without a known Employee code create new employees (Core HR / full loaders)." });
  const buf = await wb.xlsx.writeBuffer();
  saveBlob(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), fname);
}

function parseCsvText(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/** Read an uploaded .xlsx / .csv into [{ header: value }]. */
export async function readUpload(file) {
  let matrix;
  if (/\.csv$/i.test(file.name) || file.type === "text/csv") {
    matrix = parseCsvText((await file.text()).replace(/^﻿/, ""));
  } else {
    const ExcelJS = await excel();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const ws = wb.worksheets.find((w) => !["Lists", "Guide"].includes(w.name)) || wb.worksheets[0];
    matrix = [];
    ws.eachRow({ includeEmpty: false }, (r) => {
      const vals = [];
      for (let c = 1; c <= ws.columnCount; c++) {
        let v = r.getCell(c).value;
        if (v && typeof v === "object" && !(v instanceof Date)) v = v.text ?? v.result ?? (v.richText ? v.richText.map((t) => t.text).join("") : "");
        vals.push(v ?? "");
      }
      matrix.push(vals);
    });
  }
  const [head = [], ...body] = matrix;
  const headers = head.map((h) => String(h).trim());
  return body.filter((r) => r.some((v) => String(v ?? "").trim() !== "")).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""]).filter(([h]) => h)));
}
