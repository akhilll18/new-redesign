// v10.10 · EZY HR AI — everything the assistant can do. Each action:
//   match(text, ctx)   → strength 0–1 that the sentence asks for this action
//   extract(text, ctx) → field values read from the sentence
//   fields(values, ctx)→ the editable fields on the preview card (with defaults and choices)
//   run(values, ctx)   → does it through the app's own functions (same checks and audit as the screens)
// kind: "write" (preview → Confirm) · "read" (runs at once: reports, answers) · "nav" (opens a screen)
import { ALL_FIELDS, COUNTRIES, GRADES, WORKER_TYPES, fieldApplies, validateEmployee } from "../../data/employeeFields.js";
import { fieldOptions } from "../../components/kit/FieldInput.jsx";
import { nextSeq } from "../../lib/utils.js";
import { REPORTS, reportsFor, runReport } from "../../lib/reports.js";
import { IT_CATEGORIES, IT_PRIORITY } from "../../lib/itdesk.js";
import { listOptions } from "../../lib/optionLists.js";
import { customFieldsActive } from "../../lib/customFields.js";
import { ASSET_CATEGORIES, chainLabel, currentAdminStep, defaultChain, stepModule } from "../../lib/requests.js";
import { ACCESS_PROFILES } from "../../pages/superadmin/UsersAccess.jsx";
import { amountIn, cityIn, codeFrom, fieldCode, geoOf, countIn, countryIn, CURRENCY_OF, datesIn, emailIn, isoDay, norm, numberIn, periodIn, phoneIn, phraseAfter, pickFrom, quotedIn, slugCode, titleCase } from "./nlu.js";

const CREATE = "(?:create|add|new|make|set ?up|setup|register|open|start|build|onboard|hire|enrol|enroll|introduce|define|declare|post|raise|i want|please)";
const has = (t, re) => new RegExp(re, "i").test(t);
const today = () => isoDay(new Date());
const isSuper = (ctx) => ctx.user.role === "superadmin";
const isAdmin = (ctx) => ctx.user.role === "admin" || ctx.user.role === "superadmin";
const emps = (ctx) => ctx.data.employees || [];
const personIn = (text, ctx) => pickFrom(text, emps(ctx), (e) => e.full_name, (e) => [e.employee_code, e.full_name.split(" ")[0].length > 3 ? e.full_name.split(" ")[0] : null]);
const deptNames = (ctx) => [...new Set([...(ctx.data.orgUnits || []).map((o) => o.name || o.org_unit_id), ...(ctx.data.employees || []).map((e) => e.department)].filter(Boolean))];
const deptIn = (text, ctx) => pickFrom(text, deptNames(ctx)) || null;
const companyIn = (text, ctx) => pickFrom(text, ctx.data.companies || [], (c) => c.name, (c) => [c.short, c.company_id]);
const locationIn = (text, ctx) => pickFrom(text, ctx.data.workLocations || [], (l) => l.name, (l) => [l.city, l.location_id]);
const opt = (list, val = (x) => x, lab = (x) => x) => list.map((x) => [val(x), lab(x)]);
const countryOptions = () => COUNTRIES.map((c) => (Array.isArray(c) ? [c[0], c[1]] : [c.code || c.id, c.name || c.label]));
const deptOptions = (ctx) => (ctx.data.orgUnits || []).map((o) => [o.name || o.org_unit_id, o.name || o.org_unit_id]);
const peopleOptions = (ctx) => emps(ctx).filter((e) => e.status !== "rejected").map((e) => [e.employee_code, `${e.full_name} · ${e.employee_code}`]);
const link = (to, label) => ({ to, label });
const fail = (r, fallback = "That did not work.") => ({ ok: false, error: r?.error || (r?.errors ? Object.values(r.errors).filter(Boolean).slice(0, 4).join(" · ") : fallback) });

// ─────────────────────────────────────────────────────────────────────────────
export const ACTIONS = [
  // ── Organisation ──────────────────────────────────────────────────────────
  {
    id: "create_company", kind: "write", group: "Organisation", title: "Create a company (legal entity)", example: "Create a company Acme Industries Pvt Ltd in India",
    words: "create company legal entity subsidiary organisation business firm",
    allowed: isSuper,
    match: (t) => (has(t, `${CREATE}.*\\b(company|legal entity|entity|subsidiary|organi[sz]ation|firm|business)\\b`) ? 0.9 : has(t, "\\bcompany\\b") ? 0.3 : 0),
    extract: (t) => {
      const name = quotedIn(t) || phraseAfter(t, ["company named", "company called", "entity named", "entity called", "named", "called", "legal entity", "company", "subsidiary", "entity", "business"]);
      const country = countryIn(t) || "IN";
      return { name: name ? titleCase(name).replace(/\b(Pvt|Ltd|Llp|Inc)\b/g, (m) => ({ Pvt: "Pvt", Ltd: "Ltd", Llp: "LLP", Inc: "Inc" }[m])) : "", country, currency: CURRENCY_OF[country] || "INR", address: cityIn(t) || "" };
    },
    fields: (v) => [
      { key: "name", label: "Registered name", required: true },
      { key: "company_id", label: "Company code", required: true, default: codeFrom(v.name), help: "Short code, e.g. ACME-IN" },
      { key: "country", label: "Country", type: "select", options: countryOptions(), required: true },
      { key: "currency", label: "Currency", default: CURRENCY_OF[v.country] || "INR" },
      { key: "registration", label: "Registration no. (CIN etc.)" },
      { key: "address", label: "Registered address" },
    ],
    run: (v, ctx) => { const r = ctx.store.upsertCompany({ ...v, company_id: v.company_id.toUpperCase(), isNew: true }); return r.ok ? { ok: true, message: `Company **${v.name}** (${v.company_id.toUpperCase()}) created.`, link: link("/companies", "Open Companies & locations") } : fail(r); },
  },
  {
    id: "create_location", kind: "write", group: "Organisation", title: "Create a location / office", example: "Add a Hyderabad office for Acme",
    words: "create location office branch site warehouse plant store city",
    allowed: isSuper,
    match: (t) => (has(t, `${CREATE}.*\\b(location|office|branch|site|warehouse|plant|factory|store|outlet)\\b`) ? 0.85 : 0),
    extract: (t, ctx) => {
      const city = cityIn(t) || phraseAfter(t, ["office in", "branch in", "location in", "site in", "in"]);
      const co = companyIn(t, ctx) || ctx.data.companies?.[0];
      const name = quotedIn(t) || phraseAfter(t, ["location named", "office named", "named", "called"]) || (city ? `${titleCase(city)} office` : "");
      const type = has(t, "head ?office|hq|headquarter") ? "head_office" : has(t, "warehouse") ? "warehouse" : has(t, "plant|factory") ? "plant" : has(t, "store|outlet") ? "store" : "office";
      return { name, city: city ? titleCase(city) : "", company_id: co?.company_id || "", type };
    },
    fields: (v, ctx) => [
      { key: "name", label: "Location name", required: true },
      { key: "city", label: "City" },
      { key: "company_id", label: "Company", type: "select", options: (ctx.data.companies || []).map((c) => [c.company_id, c.name]), required: true, help: (ctx.data.companies || []).length ? "" : "No company yet — ask me to “create a company” first." },
      { key: "location_id", label: "Location code", required: true, default: `${(v.company_id || "LOC").split("-")[0]}-${slugCode(v.city || v.name, 3)}` },
      { key: "type", label: "Type", type: "select", options: [["head_office", "Head office"], ["office", "Office"], ["warehouse", "Warehouse"], ["plant", "Plant"], ["store", "Store"], ["remote", "Remote hub"]] },
      // its attendance geofence is created with it (centre of the city; adjust as needed)
      { key: "lat", label: "Geofence latitude", type: "number", default: geoOf(v.city)?.[0] ?? "", help: "Attendance zone centre" },
      { key: "lng", label: "Geofence longitude", type: "number", default: geoOf(v.city)?.[1] ?? "" },
      { key: "radius_m", label: "Geofence radius (m)", type: "number", default: 300 },
    ],
    run: (v, ctx) => {
      let geofence_id = "";
      if (v.lat !== "" && v.lng !== "" && v.lat != null && v.lng != null) {
        const co = (ctx.data.companies || []).find((c) => c.company_id === v.company_id);
        const g = ctx.store.upsertGeofence({ name: v.name, lat: v.lat, lng: v.lng, radius_m: v.radius_m || 300, type: v.type === "warehouse" ? "warehouse" : "office", country: co?.country || "IN" });
        if (!g?.ok) return fail(g);
        // the id the app gives a new geofence (same rule as upsertGeofence)
        geofence_id = `GF-${String(v.name).trim().replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase()}${(ctx.data.geofences || []).length + 1}`;
      }
      const r = ctx.store.upsertLocation({ ...v, location_id: v.location_id.toUpperCase(), geofence_id, isNew: true });
      return r.ok ? { ok: true, message: `Location **${v.name}** created${geofence_id ? ` with its attendance geofence (${v.radius_m || 300} m)` : ""}.`, link: link("/companies", "Open Companies & locations") } : fail(r);
    },
  },
  {
    id: "create_department", kind: "write", group: "Organisation", title: "Create a department / team", example: "Create a Sales department under Operations",
    words: "create department team division function org unit",
    allowed: isSuper,
    match: (t) => (has(t, `${CREATE}.*\\b(department|dept|team|division|function|org unit|business unit|vertical)\\b`) ? 0.85 : 0),
    extract: (t, ctx) => {
      const name = quotedIn(t) || phraseAfter(t, ["department named", "department called", "team named", "team called", "named", "called"]) || (t.match(/\b(?:a|an|new)\s+([A-Za-z&][\w& ]{1,40}?)\s+(?:department|dept|team|division)\b/i) || [])[1];
      const parent = (t.match(/\b(?:under|within|inside|part of)\s+([A-Za-z&][\w& ]+)/i) || [])[1];
      const p = parent ? pickFrom(parent, ctx.data.orgUnits || [], (o) => o.name || o.org_unit_id) : null;
      return { name: name ? titleCase(name) : "", parent_unit: p ? p.org_unit_id : "" };
    },
    fields: (v, ctx) => [
      { key: "name", label: "Department name", required: true },
      { key: "parent_unit", label: "Part of", type: "select", options: [["", "— top level —"], ...(ctx.data.orgUnits || []).map((o) => [o.org_unit_id, o.name || o.org_unit_id])] },
    ],
    run: (v, ctx) => {
      const list = ctx.data.orgUnits || [];
      if (list.some((o) => norm(o.name || o.org_unit_id) === norm(v.name))) return { ok: false, error: `${v.name} already exists.` };
      const r = ctx.store.updateMaster("orgUnits", [...list, { org_unit_id: v.name, name: v.name, parent_unit: v.parent_unit || null }]);
      return r?.ok ? { ok: true, message: `Department **${v.name}** created.`, link: link("/organization", "Open the org chart") } : fail(r);
    },
  },
  {
    id: "create_holiday", kind: "write", group: "Organisation", title: "Add a holiday", example: "Add holiday Diwali on 8 November",
    words: "add holiday festival public holiday optional holiday",
    allowed: isSuper,
    match: (t) => (has(t, `${CREATE}.*\\bholiday\\b|\\bholiday\\b.*\\b(on|for)\\b.*\\d`) && !has(t, "\\b(apply|take|request)\\b") ? 0.85 : 0),
    extract: (t) => {
      const name = quotedIn(t) || phraseAfter(t, ["holiday for", "holiday called", "holiday named", "holiday", "add"]) || "";
      return { name: titleCase(name.replace(/\b(holiday|on|for)\b/gi, "").trim()), date: datesIn(t)[0] || "", type: has(t, "optional|restricted|floating") ? "optional" : "holiday" };
    },
    fields: () => [
      { key: "name", label: "Holiday", required: true },
      { key: "date", label: "Date", type: "date", required: true },
      { key: "type", label: "Type", type: "select", options: [["holiday", "Public holiday"], ["optional", "Optional / restricted"]] },
    ],
    run: (v, ctx) => {
      const list = ctx.data.holidays || [];
      if (list.some((h) => h.date === v.date && norm(h.name) === norm(v.name))) return { ok: false, error: "That holiday is already on the calendar." };
      const r = ctx.store.updateMaster("holidays", [...list, { date: v.date, name: v.name, type: v.type }].sort((a, b) => a.date.localeCompare(b.date)));
      return r?.ok ? { ok: true, message: `**${v.name}** added on ${v.date}.`, link: link("/leave", "Open Leave & holidays") } : fail(r);
    },
  },
  {
    id: "create_leave_type", kind: "write", group: "Organisation", title: "Create a leave type", example: "Create a leave type Paternity leave with 10 days a year",
    words: "create leave type policy earned casual sick maternity paternity",
    allowed: isSuper,
    match: (t) => (has(t, `${CREATE}.*\\b(leave type|type of leave|leave policy|leave category)\\b`) || has(t, `${CREATE}\\s+(a |an |new )?[a-z ]{2,24}leave\\b.*\\b(days?|per year|a year|annual)`) ? 0.85 : 0),
    extract: (t) => {
      const raw = quotedIn(t) || phraseAfter(t, ["leave type called", "leave type named", "leave type", "type of leave", "named", "called"]) || (t.match(/\b(?:a|an|new)\s+([a-z ]{2,24}?leave)\b/i) || [])[1] || "";
      const name = titleCase(/leave$/i.test(raw) ? raw : `${raw} leave`.trim());
      return { name, code: slugCode(name.replace(/leave/i, ""), 3) || "LV", annual: countIn(t, "days?|day") || numberIn(t) || 12, carry_forward: has(t, "carry|accumulat") ? numberIn(t.split(/carry/i)[1] || "") || 0 : 0 };
    },
    fields: () => [
      { key: "name", label: "Leave type", required: true },
      { key: "code", label: "Code", required: true },
      { key: "annual", label: "Days per year", type: "number", required: true },
      { key: "carry_forward", label: "Max carry forward (days)", type: "number" },
      { key: "min_notice_days", label: "Notice needed (days)", type: "number", default: 0 },
    ],
    run: (v, ctx) => {
      const list = ctx.data.leaveTypes || [];
      if (list.some((l) => l.code === v.code.toUpperCase())) return { ok: false, error: `Code ${v.code} is already used.` };
      const r = ctx.store.updateMaster("leaveTypes", [...list, { code: v.code.toUpperCase(), name: v.name, annual: Number(v.annual) || 0, carry_forward: Number(v.carry_forward) || 0, min_notice_days: Number(v.min_notice_days) || 0, doc_after_days: null, active: true }]);
      return r?.ok ? { ok: true, message: `Leave type **${v.name}** (${Number(v.annual)} days a year) created.`, link: link("/policies", "Open Policies & rules") } : fail(r);
    },
  },
  {
    id: "create_expense_category", kind: "write", group: "Organisation", title: "Create an expense category", example: "Add expense category Internet with a ₹1,500 limit",
    words: "create expense category type head limit",
    allowed: isSuper,
    match: (t) => (has(t, `${CREATE}.*\\bexpense (category|type|head)\\b`) ? 0.9 : 0),
    extract: (t) => { const name = titleCase(quotedIn(t) || phraseAfter(t, ["expense category called", "expense category named", "expense category", "expense type", "expense head"]) || ""); return { name, code: fieldCode(name, 10), limit: amountIn(t.split(/limit|cap|up to|upto|max/i)[1] || "") || 0, receipt_always: has(t, "receipt") }; },
    fields: () => [
      { key: "name", label: "Category", required: true }, { key: "code", label: "Code", required: true },
      { key: "limit", label: "Limit per claim (₹, 0 = none)", type: "number" }, { key: "receipt_always", label: "Receipt always needed", type: "bool" },
    ],
    run: (v, ctx) => {
      const list = ctx.data.expenseCategories || [];
      if (list.some((c) => c.code === v.code.toUpperCase())) return { ok: false, error: `Code ${v.code} is already used.` };
      const r = ctx.store.updateMaster("expenseCategories", [...list, { code: v.code.toUpperCase(), name: v.name, limit: Number(v.limit) || 0, receipt_always: !!v.receipt_always }]);
      return r?.ok ? { ok: true, message: `Expense category **${v.name}** created.`, link: link("/policies", "Open Policies & rules") } : fail(r);
    },
  },
  {
    id: "create_pay_component", kind: "write", group: "Payroll", title: "Add a pay component (payslip field)", example: "Add an earning called Night shift allowance",
    words: "add pay component salary component earning deduction allowance payslip field",
    allowed: isAdmin,
    match: (t) => (has(t, `${CREATE}.*\\b(pay component|salary component|payslip (field|component|line)|allowance|earning|deduction|reimbursement)\\b`) ? 0.85 : 0),
    extract: (t) => {
      const label = titleCase(quotedIn(t) || phraseAfter(t, ["called", "named", "component", "allowance", "earning", "deduction"]) || "");
      const section = has(t, "deduction|recover") ? "deduction" : has(t, "reimburs") ? "reimbursement" : has(t, "contribution|employer") ? "contribution" : "earning";
      return { label: label || (has(t, "allowance") ? "Allowance" : ""), code: fieldCode(label), section };
    },
    fields: () => [
      { key: "label", label: "Label on payslip", required: true }, { key: "code", label: "Code (upload column)", required: true },
      { key: "section", label: "Section", type: "select", options: [["earning", "Earning"], ["deduction", "Deduction"], ["contribution", "Employer contribution"], ["reimbursement", "Reimbursement"], ["detail", "Detail"]] },
    ],
    run: (v, ctx) => { const r = ctx.store.proposeComponent({ code: v.code.toUpperCase(), label: v.label, section: v.section, type: "amount", visible: true, required: false }); return r?.ok ? { ok: true, message: `**${v.label}** proposed as a ${v.section} — it goes live once Finance approves it.`, link: link("/payslips", "Open Payslips") } : fail(r); },
  },

  {
    id: "create_geofence", kind: "write", group: "Organisation", title: "Create an attendance geofence", example: "Create a geofence for the Pune office with 200 m radius",
    words: "create geofence attendance zone punch area radius",
    allowed: isSuper,
    match: (t) => (has(t, `${CREATE}.*\\b(geofence|geo-fence|attendance zone|punch zone)\\b`) ? 0.9 : 0),
    extract: (t, ctx) => { const loc = locationIn(t, ctx); const city = cityIn(t) || loc?.city || ""; const g = geoOf(city); return { name: loc?.name || (city ? `${titleCase(city)} office` : ""), lat: g?.[0] ?? "", lng: g?.[1] ?? "", radius_m: (t.match(/(\d{2,4})\s*(m|metre|meter)/i) || [])[1] ? Number(t.match(/(\d{2,4})\s*(m|metre|meter)/i)[1]) : 300 }; },
    fields: () => [{ key: "name", label: "Name", required: true }, { key: "lat", label: "Latitude", type: "number", required: true }, { key: "lng", label: "Longitude", type: "number", required: true }, { key: "radius_m", label: "Radius (m, 30–5,000)", type: "number", required: true }],
    run: (v, ctx) => { const r = ctx.store.upsertGeofence({ name: v.name, lat: v.lat, lng: v.lng, radius_m: v.radius_m, type: "office", country: "IN" }); return r?.ok ? { ok: true, message: `Geofence **${v.name}** created (${v.radius_m} m).`, link: link("/geofences", "Open geofences") } : fail(r); },
  },

  // ── People ────────────────────────────────────────────────────────────────
  {
    id: "create_admin", kind: "write", group: "People", title: "Create an admin (HR / Finance / IT)", example: "Create an HR admin Swathi Rao swathi@acme.in",
    words: "create admin administrator hr admin finance admin it admin access",
    allowed: isSuper,
    match: (t) => (has(t, `${CREATE}.*\\b(admin|administrator)\\b`) && !has(t, "admin code") ? 0.95 : 0),
    extract: (t) => {
      const email = emailIn(t);
      const kind = has(t, "\\bit\\b|service desk|helpdesk") ? "it" : has(t, "hr.*finance|finance.*hr|both") ? "hr_finance" : has(t, "finance|payroll|accounts") ? "finance" : "hr";
      const name = quotedIn(t) || phraseAfter(t, ["admin named", "admin called", "named", "called", "admin", "administrator"]);
      return { full_name: name && !/@/.test(name) ? titleCase(name.replace(/\b(hr|finance|it|admin)\b/gi, "").trim()) : "", email: email || "", access_profile: kind, temp: "Welcome@123" };
    },
    fields: () => [
      { key: "full_name", label: "Full name", required: true }, { key: "email", label: "Work e-mail (login)", type: "email", required: true },
      { key: "access_profile", label: "Admin type", type: "select", options: [["hr", "HR admin"], ["finance", "Finance admin"], ["hr_finance", "HR + Finance admin"], ["it", "IT admin (service desk)"]] },
      { key: "temp", label: "Temporary password", required: true, help: "They change it at first sign-in." },
    ],
    run: async (v, ctx) => {
      const prof = ACCESS_PROFILES.find(([k]) => k === v.access_profile);
      const modules = v.access_profile === "it" ? ["it", "assets"] : prof?.[2] || ["leave"];
      const scope = prof?.[3] || ["approve", "bulk", "export", "flag", "escalate"];
      const units = (ctx.data.orgUnits || []).map((o) => o.org_unit_id);
      const code = nextSeq(ctx.data.admins || [], "ADM", "admin_code", 2);
      const r = await ctx.store.upsertAdmin({ full_name: v.full_name, email: v.email, login_id: v.email.toLowerCase(), org_units: units.length ? units : ["Head Office"], modules, permissions_scope: scope, access_profile: v.access_profile, locale_access: false, employee_code: "" }, v.temp);
      return r?.ok ? { ok: true, message: `Admin **${v.full_name}** created as **${code}**. They sign in with ${v.email}, admin code ${code} and the temporary password **${v.temp}**.${r.chains?.length ? ` Approval workflow set up automatically — approver for: ${r.chains.join("; ")}.` : ""}`, link: link("/users", "Open Users & access") } : fail(r);
    },
  },
  {
    id: "create_employee", kind: "write", group: "People", title: "Create an employee", example: "Create employee Ravi Kumar ravi@acme.in as Sales Executive in Sales joining 1 Dec, ₹45k a month",
    words: "create employee add staff new joiner hire onboard worker intern contractor freelancer person member",
    allowed: isAdmin,
    match: (t) => (has(t, `${CREATE}.*\\b(employee|staff|joiner|hire|worker|intern|contractor|freelancer|consultant|team member|person|apprentice)\\b`) || has(t, "\\b(hire|onboard)\\b\\s+[A-Z]") ? 0.9 : 0),
    extract: (t, ctx) => {
      const email = emailIn(t);
      let name = quotedIn(t) || phraseAfter(t, ["employee named", "employee called", "staff named", "named", "called", "hire", "onboard", "employee", "joiner", "intern", "contractor", "freelancer"]);
      if (name && /@/.test(name)) name = null;
      const designation = phraseAfter(t, ["as an", "as a", "as", "designation", "role of", "title"]);
      const dept = deptIn(t, ctx) || phraseAfter(t, ["in the", "department", "dept", "team"]);
      const mgrText = (t.match(/\b(?:reporting to|reports to|under|manager is|manager)\s+([A-Za-z][\w ]+)/i) || [])[1];
      const mgr = mgrText ? personIn(mgrText, ctx) : null;
      const doj = datesIn(t.split(/join|start/i)[1] || "")[0] || (has(t, "join|start") ? datesIn(t)[0] : null);
      const dob = datesIn(t.split(/born|dob|birth/i)[1] || "")[0];
      const gross = has(t, "salary|ctc|gross|pay|₹|rs|lpa|lakh|k\\b|per month|a month") ? amountIn(t.replace(/\d{4}-\d{2}-\d{2}/g, "").split(/salary|ctc|gross|pay|₹|rs\.?/i).slice(1).join(" ") || t, { monthly: true }) : null;
      const loc = locationIn(t, ctx);
      const wt = has(t, "\\bintern") ? "intern" : has(t, "freelanc") ? "freelance" : has(t, "consultant") ? "consultant" : has(t, "contract") ? "contract" : has(t, "apprentice") ? "apprentice" : "permanent";
      const gender = has(t, "\\b(she|her|female|woman|ms\\.?|mrs\\.?)\\b") ? "Female" : has(t, "\\b(he|his|male|man|mr\\.?)\\b") ? "Male" : "";
      return {
        full_name: name ? titleCase(name) : "", email: email || "", phone: phoneIn(t) || "", designation: designation ? titleCase(designation) : "", department: dept ? titleCase(dept) : "",
        reporting_manager: mgr?.employee_code || "", date_of_joining: doj || today(), date_of_birth: dob || "", monthly_gross: gross || "", location_id: loc?.location_id || "", worker_type: wt, gender,
      };
    },
    fields: (v, ctx) => {
      const base = [
        { key: "full_name", label: "Full name", required: true }, { key: "email", label: "Work e-mail (login)", type: "email", required: true },
        { key: "designation", label: "Job title", required: true }, { key: "department", label: "Department", type: deptOptions(ctx).length ? "select" : "text", options: deptOptions(ctx), required: true },
        { key: "reporting_manager", label: "Reports to", type: "select", options: [["", "— nobody —"], ...peopleOptions(ctx)] },
        { key: "date_of_joining", label: "Joining date", type: "date", required: true },
        { key: "location_id", label: "Location", type: "select", options: (ctx.data.workLocations || []).map((l) => [l.location_id, l.name]), default: (ctx.data.workLocations || [])[0]?.location_id ?? "" },
        { key: "worker_type", label: "Worker type", type: "select", options: WORKER_TYPES.map((w) => [w.id, w.label || w.short]) },
        { key: "monthly_gross", label: "Monthly gross (₹)", type: "number" },
      ];
      // every other field the employee master requires right now, with its own choices
      const rec = employeeRecord(v, ctx);
      const errs = validateEmployee(rec, { role: "super", employees: emps(ctx) });
      const shown = new Set(base.map((f) => f.key));
      const more = ALL_FIELDS.filter((f) => !shown.has(f.key) && f.key !== "employee_code" && errs[f.key] && fieldApplies(f, rec))
        .map((f) => ({ key: f.key, label: f.label, required: true, type: f.type === "date" ? "date" : f.type === "number" ? "number" : (f.options || f.type === "select") ? "select" : "text", options: selectOptions(f, rec, ctx), more: true }));
      // v10.15: required dropdowns the Super Admin created
      const custom = customFieldsActive(ctx.data).filter((c) => c.required).map((c) => ({ key: c.key, label: c.label, required: true, type: "select", options: listOptions(ctx.data, c.key), more: true }));
      return [...base, ...more, ...custom];
    },
    run: (v, ctx) => {
      const rec = employeeRecord(v, ctx);
      const code = nextSeq(emps(ctx), "EMP", "employee_code", 3);
      const r = ctx.store.upsertEmployee(rec);
      if (!r?.ok) return { ok: false, error: Object.entries(r?.errors || {}).slice(0, 5).map(([k, e]) => `${ALL_FIELDS.find((f) => f.key === k)?.label || k}: ${String(e).split(/(?<=\.)\s/)[0]}`).join(" · ") || r?.error || "Some details are missing.", fieldErrors: r?.errors };
      return { ok: true, message: `**${v.full_name}** created as **${code}** — waiting for account approval. Temporary password **Welcome@123** once approved.`, link: link("/employees", "Open Employee database") };
    },
  },
  {
    id: "create_login", kind: "write", group: "People", title: "Create a login / reset a password", example: "Create a login for Ravi Kumar",
    words: "create login give access reset password unlock account",
    allowed: isSuper,
    match: (t) => (has(t, "\\b(create|give|set ?up|enable|issue|reset|send)\\b.*\\b(login|sign[- ]?in|access|password|credentials)\\b") && !has(t, "admin access") ? 0.8 : 0),
    extract: (t, ctx) => { const p = personIn(t, ctx); const a = pickFrom(t, ctx.data.admins || [], (x) => x.full_name, (x) => [x.admin_code]); return { who: a ? `admin:${a.admin_code}` : p ? `emp:${p.employee_code}` : "" }; },
    fields: (v, ctx) => [{ key: "who", label: "Person", type: "select", required: true, options: [...(ctx.data.admins || []).map((a) => [`admin:${a.admin_code}`, `${a.full_name} · ${a.admin_code} (admin)`]), ...peopleOptions(ctx).map(([c, l]) => [`emp:${c}`, l])] }],
    run: async (v, ctx) => { const [role, code] = v.who.split(":"); const r = await ctx.store.forceReset(role, code); return r?.ok === false ? fail(r) : { ok: true, message: `Login ready for **${code}**: temporary password **Welcome@123** (changed at first sign-in).`, link: link("/users", "Open Users & access") }; },
  },
  {
    id: "approve_account", kind: "write", group: "People", title: "Approve a new employee's account", example: "Approve Ravi Kumar's account · Approve all pending accounts",
    words: "approve account activate new joiner pending approval",
    allowed: (ctx) => isAdmin(ctx),
    match: (t) => (has(t, "\\b(approve|activate|accept)\\b.*\\b(account|accounts|joiner|joiners|signup|sign-up)\\b") ? 0.95 : 0),
    extract: (t, ctx) => ({ who: has(t, "\\ball\\b") ? "__all" : personIn(t, ctx)?.employee_code || "", note: "" }),
    fields: (v, ctx) => {
      const pend = emps(ctx).filter((e) => e.status === "pending_approval");
      return [{ key: "who", label: "Account", type: "select", required: true, options: [["__all", `All waiting (${pend.length})`], ...pend.map((e) => [e.employee_code, `${e.full_name} · ${e.employee_code} · ${e.department || ""}`])], help: pend.length ? "" : "Nobody is waiting for approval." }];
    },
    run: (v, ctx) => {
      const list = v.who === "__all" ? emps(ctx).filter((e) => e.status === "pending_approval").map((e) => e.employee_code) : [v.who];
      if (!list.length) return { ok: false, error: "Nobody is waiting for approval." };
      let done = 0, last;
      for (const c of list) { last = ctx.store.decideAccount(c, true, ""); if (last?.ok !== false) done++; }
      return done ? { ok: true, message: `Approved ${done} account${done > 1 ? "s" : ""}. They can sign in with the temporary password **Welcome@123**.`, link: link("/approvals", "Open Approvals") } : fail(last);
    },
  },
  {
    id: "set_user_status", kind: "write", group: "People", title: "Suspend or reactivate a user", example: "Suspend Ravi Kumar · Reactivate Swathi Rao",
    words: "suspend deactivate disable block reactivate unlock enable user account",
    allowed: isSuper,
    match: (t, ctx) => (has(t, "\\b(suspend|deactivate|disable|block|reactivate|re-activate|unlock|enable|unsuspend)\\b") && (personIn(t, ctx) || pickFrom(t, ctx.data.admins || [], (a) => a.full_name)) ? 0.9 : 0),
    extract: (t, ctx) => { const a = pickFrom(t, ctx.data.admins || [], (x) => x.full_name, (x) => [x.admin_code]); const p = personIn(t, ctx); return { who: a ? `admin:${a.admin_code}` : p ? `emp:${p.employee_code}` : "", status: has(t, "suspend|deactivate|disable|block") ? "suspended" : "active" }; },
    fields: (v, ctx) => [
      { key: "who", label: "Person", type: "select", required: true, options: [...(ctx.data.admins || []).map((a) => [`admin:${a.admin_code}`, `${a.full_name} · ${a.admin_code} (admin)`]), ...peopleOptions(ctx).map(([c, l]) => [`emp:${c}`, l])] },
      { key: "status", label: "Set to", type: "select", options: [["suspended", "Suspended (cannot sign in)"], ["active", "Active"]] },
    ],
    run: (v, ctx) => { const [role, code] = v.who.split(":"); const r = ctx.store.setUserStatus(role, code, v.status); return r?.ok === false ? fail(r) : { ok: true, message: `${code} is now **${v.status === "active" ? "active" : "suspended"}**.`, link: link("/users", "Open Users & access") }; },
  },
  {
    id: "update_employee", kind: "write", group: "People", title: "Change an employee's details", example: "Change Ravi Kumar's department to Marketing · Promote Ravi to Team Lead · Set Ravi's salary to 60k",
    words: "change update set move transfer promote edit employee department designation manager salary phone location grade",
    allowed: isAdmin,
    match: (t, ctx) => (has(t, "\\b(change|update|set|move|transfer|promote|edit|make|assign|increase|raise|revise)\\b") && personIn(t, ctx) ? 0.8 : 0),
    extract: (t, ctx) => {
      const p = personIn(t, ctx);
      let field = "", value = "";
      const after = (t.match(/\b(?:to|as|=|into)\s+(.+)$/i) || [])[1] || "";
      if (has(t, "promot|designation|title|\\brole\\b")) { field = "designation"; value = titleCase(after); }
      else if (has(t, "salary|ctc|gross|pay\\b|increment|raise")) { field = "monthly_gross"; value = amountIn(after || t, { monthly: true }) || ""; }
      else if (has(t, "manager|reporting|reports to|report to")) { field = "reporting_manager"; value = personIn(after, ctx)?.employee_code || ""; }
      else if (has(t, "phone|mobile")) { field = "phone"; value = phoneIn(t) || ""; }
      else if (has(t, "e-?mail")) { field = "email"; value = emailIn(t) || ""; }
      else if (has(t, "grade|band|level")) { field = "grade_code"; value = (after.match(/\b(P[1-4]|M[1-3])\b/i) || [])[1]?.toUpperCase() || ""; }
      else if (has(t, "location|office|branch|city")) { field = "location_id"; value = locationIn(after, ctx)?.location_id || ""; }
      else if (has(t, "department|dept|team|move|transfer")) { field = "department"; value = deptIn(after, ctx) || titleCase(after); }
      else { const f = ALL_FIELDS.find((x) => has(t, `\\b${x.label.toLowerCase().replace(/[^a-z ]/g, "")}\\b`)); if (f) { field = f.key; value = after; } }
      return { employee_code: p?.employee_code || "", field, value };
    },
    fields: (v, ctx) => {
      const f = ALL_FIELDS.find((x) => x.key === v.field);
      const e = emps(ctx).find((x) => x.employee_code === v.employee_code);
      return [
        { key: "employee_code", label: "Employee", type: "select", options: peopleOptions(ctx), required: true },
        { key: "field", label: "Field", type: "select", required: true, options: ALL_FIELDS.filter((x) => !["employee_code", "login_id"].includes(x.key)).map((x) => [x.key, x.label]) },
        { key: "value", label: f ? `New ${f.label.toLowerCase()}${e && e[v.field] ? ` (now: ${e[v.field]})` : ""}` : "New value", required: true, type: f?.type === "date" ? "date" : f?.type === "number" || v.field === "monthly_gross" ? "number" : f && (f.options || f.type === "select") ? "select" : "text", options: f ? selectOptions(f, e || {}, ctx) : undefined },
      ];
    },
    run: (v, ctx) => {
      const e = emps(ctx).find((x) => x.employee_code === v.employee_code);
      if (!e) return { ok: false, error: "Choose the employee." };
      const val = v.field === "monthly_gross" ? Number(v.value) : v.value;
      const r = ctx.store.upsertEmployee({ ...e, [v.field]: val });
      const label = ALL_FIELDS.find((x) => x.key === v.field)?.label || v.field;
      return r?.ok ? { ok: true, message: `${e.full_name}: **${label}** is now **${v.field === "monthly_gross" ? `₹${Number(val).toLocaleString("en-IN")}` : val}**.`, link: link("/employees", "Open Employee database") } : fail(r);
    },
  },

  // ── Hiring ───────────────────────────────────────────────────────────────
  {
    id: "create_job", kind: "write", group: "Hiring", title: "Open a job (requisition)", example: "Open 2 jobs for Senior Java Developer in Engineering, budget 18 lakh",
    words: "create job opening vacancy position requisition hiring role post",
    allowed: isAdmin,
    match: (t) => (has(t, `${CREATE}.*\\b(job|jobs|opening|openings|vacancy|vacancies|position|positions|requisition|req)\\b`) || has(t, "\\bwe (need|are hiring|want) (to hire )?\\d*\\s*[a-z]") ? 0.9 : 0),
    extract: (t, ctx) => {
      const role = quotedIn(t) || phraseAfter(t, ["jobs? for", "openings? for", "vacanc(?:y|ies) for", "positions? for", "requisition for", "job of", "hire", "hiring", "role of", "for a", "for an", "for"]) || "";
      return { role: titleCase(role.replace(/\b(job|jobs|opening|position|role)\b/gi, "").trim()), dept: deptIn(t, ctx) || titleCase(phraseAfter(t, ["in the", "in", "department"]) || ""), n: countIn(t, "jobs?|openings?|positions?|seats?|vacanc(?:y|ies)|people|developers?|engineers?|executives?|[a-z]+s\\b") || 1, cost: amountIn(t.split(/budget|ctc|salary|package/i)[1] || "") || 0, hiring_manager: personIn(t.split(/manager|hiring manager|reporting/i)[1] || "", ctx)?.employee_code || "" };
    },
    fields: (v, ctx) => [
      { key: "role", label: "Job title", required: true }, { key: "dept", label: "Department", type: deptOptions(ctx).length ? "select" : "text", options: deptOptions(ctx), required: true },
      { key: "n", label: "Openings", type: "number", required: true }, { key: "cost", label: "Budget per hire (₹ / year)", type: "number" },
      { key: "hiring_manager", label: "Hiring manager", type: "select", options: [["", "—"], ...peopleOptions(ctx)] },
    ],
    run: (v, ctx) => { const r = ctx.store.upsertReq({ role: v.role, dept: v.dept, n: Number(v.n) || 1, cost: Number(v.cost) || 0, hiring_manager: v.hiring_manager || "" }); return r?.ok ? { ok: true, message: `Job **${v.role}** opened in ${v.dept} (${v.n} opening${Number(v.n) > 1 ? "s" : ""}).`, link: link("/recruitment", "Open Recruitment") } : fail(r); },
  },

  // ── Self-service ─────────────────────────────────────────────────────────
  {
    id: "apply_leave", kind: "write", group: "Leave & requests", title: "Apply for leave", example: "Apply sick leave tomorrow · Take casual leave from 24 Dec to 26 Dec for a family function",
    words: "apply leave take day off vacation sick casual earned request leave",
    allowed: (ctx) => ctx.user.role === "emp",
    match: (t) => (has(t, "\\b(apply|request|take|book|need|want|put in)\\b.*\\b(leave|day off|days off|vacation|time off|holiday)\\b") || has(t, "\\b(sick|casual|earned|privilege) leave\\b") ? 0.9 : 0),
    extract: (t, ctx) => {
      const types = ctx.leaveTypes || [];
      const lt = pickFrom(t, types, (l) => l.name, (l) => [l.code, l.name.replace(/ leave/i, "")]) || (has(t, "sick|unwell|fever|ill") ? types.find((l) => /sick/i.test(l.name)) : null) || types[0];
      const ds = datesIn(t);
      return { leave_type: lt?.code || "", from_date: ds[0] || today(), to_date: ds[1] || ds[0] || today(), reason: phraseAfter(t, ["because", "for", "reason"]) || (has(t, "sick|fever|unwell") ? "Not feeling well" : "") };
    },
    fields: (v, ctx) => [
      { key: "leave_type", label: "Leave type", type: "select", required: true, options: (ctx.leaveTypes || []).map((l) => [l.code, l.name]), help: (ctx.leaveTypes || []).length ? "" : "No leave types yet — your Super Admin can ask me to “create a leave type”." },
      { key: "from_date", label: "From", type: "date", required: true }, { key: "to_date", label: "To", type: "date", required: true }, { key: "reason", label: "Reason", required: true },
    ],
    run: (v, ctx) => { const r = ctx.store.createRequest("leave", { leave_type: v.leave_type, from_date: v.from_date, to_date: v.to_date, reason: v.reason, half_day: false }); return r?.ok ? { ok: true, message: `Leave requested (${v.from_date}${v.to_date !== v.from_date ? ` → ${v.to_date}` : ""}). Your manager has been notified.`, link: link("/leave", "Open Leave") } : fail(r); },
  },
  {
    id: "asset_purchase", kind: "write", group: "Leave & requests", title: "Request an asset purchase", example: "Buy 2 Dell monitors for the design team, about 15k each, needed by 15 Dec",
    words: "purchase buy procure order new laptop monitor phone asset equipment request",
    allowed: (ctx) => ctx.user.role === "emp",
    match: (t) => (has(t, "^\\s*(please\\s+)?(approve|reject|decline|accept|show|list|how many)\\b") ? 0 : has(t, "\\b(purchase|procure|procurement)\\b") || has(t, "\\b(buy|order)\\b.*\\b(laptop|monitor|phone|mobile|desktop|keyboard|mouse|headset|chair|printer|tablet|ipad|macbook|equipment|asset|licen[cs]e|software)s?\\b") ? 0.92 : 0),
    extract: (t) => {
      const cat = ASSET_CATEGORIES.find((c) => has(t, `\\b${c.split(/[ /]/)[0]}`)) || (has(t, "macbook|notebook") ? ASSET_CATEGORIES.find((c) => /laptop/i.test(c)) : has(t, "mobile|iphone") ? ASSET_CATEGORIES.find((c) => /phone/i.test(c)) : null) || ASSET_CATEGORIES[ASSET_CATEGORIES.length - 1];
      const qm = t.match(/\b(?:buy|purchase|procure|order|need|get)\s+(?:request\s+for\s+)?(\d{1,3})\b(?!\s*(?:k|lakh|lac|l|cr|rs|inr|₹|%|days?|years?))/i) || t.match(/\b(\d{1,3})\s*(?:x|×|nos?\.?|units?|pcs|pieces)\b/i);
      const qty = qm ? Number(qm[1]) : 1;
      const cm = t.match(/(?:₹|rs\.?|inr|about|around|approx\w*|costing|cost|at|budget)\s*([\d.,]+\s*(?:k|lakh|lac|l|cr)?)\b/i) || t.match(/\b([\d.,]+\s*(?:k|lakh|lac|cr))\b/i);
      const cost = cm ? amountIn(cm[1]) : "";
      const item = (quotedIn(t) || t.replace(/^.*?\b(purchase|buy|procure|order)\b\s*(request\s*(for)?)?\s*/i, "").replace(/\b(for|because|about|around|approx\w*|at|costing|needed|by|within)\b.*$/i, "").replace(/^\d+\s*(x|×|nos?\.?|units?)?\s*/i, "").replace(/^(request\s+)?(for\s+)?(a|an)?\s*(new\s+)?/i, "").trim()).slice(0, 80);
      const ds = datesIn(t);
      return { item: item ? item.charAt(0).toUpperCase() + item.slice(1) : "", category: cat, quantity: qty, est_cost: cost || "", needed_by: ds[0] || isoDay(new Date(Date.now() + 14 * 86400000)), reason: (() => { const b = phraseAfter(t, ["because", "reason", "as"]); if (b) return b.charAt(0).toUpperCase() + b.slice(1); const f = t.match(/\bfor (the |our |my )?([\w\s]+?(?:team|project|department|office|joiner|joiners|hire|hires))\b/i) || t.match(/\bfor ((?:the |our |my )?(?!a\b|an\b|new\b)[a-z][\w\s-]{5,60}?)(?=\s*(?:,|\.|$|\babout\b|\baround\b|\bneeded\b|\bby\b|\bcosting\b|\bat\b|\bbudget\b))/i); if (!f) return ""; const txt = f[2] !== undefined ? `${f[1] || ""}${f[2]}` : f[1]; return `For ${txt.trim()}`; })() };
    },
    fields: (v, ctx) => [
      { key: "item", label: "What should be bought", required: true }, { key: "category", label: "Category", type: "select", required: true, options: listOptions(ctx.data, "asset_category") },
      { key: "quantity", label: "Quantity", type: "number", required: true }, { key: "est_cost", label: "Estimated cost per unit (₹)", type: "number", required: true },
      { key: "needed_by", label: "Needed by", type: "date", required: true }, { key: "reason", label: "Why it is needed (10+ characters)", required: true },
      { key: "_chain", label: "Approval", type: "info", value: chainLabel(ctx.data.settings?.workflow?.asset_purchase || defaultChain("asset_purchase"), "asset_purchase") },
    ],
    run: (v, ctx) => {
      const r = ctx.store.createRequest("asset_purchase", { item: v.item, category: v.category, quantity: Number(v.quantity), est_cost: Number(v.est_cost), needed_by: v.needed_by, reason: v.reason, vendor: "" });
      return r?.ok ? { ok: true, message: `Purchase request sent: ${v.quantity} × ${v.item}. Approval: ${chainLabel(ctx.data.settings?.workflow?.asset_purchase || defaultChain("asset_purchase"), "asset_purchase")}.`, link: link("/assets", "Open My assets") } : fail(r);
    },
  },
  {
    id: "raise_ticket", kind: "write", group: "IT & support", title: "Raise an IT ticket", example: "My laptop is not charging — raise a ticket",
    words: "raise ticket it support issue problem laptop vpn printer wifi email not working broken",
    allowed: () => true,
    match: (t) => (has(t, "\\b(raise|create|log|open|file|report)\\b.*\\b(ticket|issue|problem|incident)\\b") || has(t, "\\b(laptop|printer|scanner|vpn|wi-?fi|internet|network|mouse|keyboard|monitor|screen|headset|phone|outlook|email|teams|software|system|computer|pc|access card)\\b.*\\b(not working|broken|issue|problem|error|slow|crash|stopped|won't|doesn't|cannot|can't|isn't|not \\w+ing|keeps|unable|fail\\w*|dead|frozen|hangs?|stuck|cracked|damaged|lost|stolen)\\b") ? 0.85 : 0),
    extract: (t) => {
      const cat = has(t, "printer|scanner") ? "printer" : has(t, "laptop|monitor|mouse|keyboard|hardware|charg|phone") ? "hardware" : has(t, "vpn|wi-?fi|internet|network") ? "network" : has(t, "phish|virus|malware|hack|suspicious") ? "security" : has(t, "access|password|login|account") ? "access" : has(t, "email|outlook|teams|calendar") ? "email" : has(t, "software|install|app|licen") ? "software" : "other";
      const subject = (t.replace(/[—-]?\s*(please )?(raise|create|log|open)( an?)? (it )?(ticket|issue).*/i, "").trim() || t).slice(0, 80);
      const subj = subject.replace(/[\s,;:.-]+$/, "");
      return { subject: subj.charAt(0).toUpperCase() + subj.slice(1), description: t.length >= 10 ? t : `${t} — please help.`, category: IT_CATEGORIES.some(([k]) => k === cat) ? cat : IT_CATEGORIES[0]?.[0] || "", priority: has(t, "phish|virus|malware|hack|ransom|everyone|whole team|all of us|outage") ? "critical" : has(t, "urgent|asap|blocked|cannot work|can't work|down") ? "high" : "normal" };
    },
    fields: () => [
      { key: "subject", label: "Short title", required: true }, { key: "description", label: "What happened", required: true },
      { key: "category", label: "Category", type: "select", options: IT_CATEGORIES.map(([k, l]) => [k, l]) }, { key: "priority", label: "Priority", type: "select", options: Object.entries(IT_PRIORITY).map(([k, p]) => [k, p.label]) },
    ],
    run: (v, ctx) => { const r = ctx.store.createItTicket(v); return r?.ok ? { ok: true, message: `IT ticket raised${r.id ? ` (${r.id})` : ""}.${r.chain ? ` It goes for approval first (${r.chain}${r.awaiting ? ` — now with ${ctx.store.nameOf?.(r.awaiting) || r.awaiting}` : ""}), then to the IT admin.` : " The service desk replies within 30 minutes to 1 hour."}`, link: link("/assets", "Open IT support") } : fail(r); },
  },
  {
    id: "decide_requests", kind: "write", group: "Leave & requests", title: "Approve or reject requests", example: "Approve all pending leave requests · Reject Ravi's expense",
    words: "approve reject decline accept pending requests leave expense advance",
    allowed: (ctx) => isAdmin(ctx) || (ctx.data.employees || []).some((e) => e.reporting_manager === ctx.user.employee_code),
    match: (t) => (has(t, "\\b(approve|reject|decline)\\b.*\\b(account|accounts|joiner|joiners)\\b") ? 0 : has(t, "^\\s*(please )?(approve|reject|decline|accept|okay|ok)\\b") || has(t, "\\b(approve|reject|decline)\\b.*\\b(request|leave|expense|advance|loan|claim|all|pending|purchase|ticket)\\b") ? 0.9 : 0),
    extract: (t, ctx) => ({ decision: has(t, "reject|decline|deny") ? "reject" : "approve", type: has(t, "purchase|buy") ? "asset_purchase" : has(t, "it support|it ticket|ticket") ? "itsupport" : (t.match(/\b(leave|expense|advance|loan|regularize|asset)\b/i) || [])[1]?.toLowerCase() || "", person: personIn(t, ctx)?.employee_code || "", note: phraseAfter(t, ["because", "note", "reason"]) || "" }),
    fields: (v, ctx) => [
      { key: "decision", label: "Decision", type: "select", options: [["approve", "Approve"], ["reject", "Reject"]] },
      { key: "type", label: "Type", type: "select", options: [["", "All types"], ["leave", "Leave"], ["expense", "Expense"], ["advance", "Advance"], ["loan", "Loan"], ["regularize", "Attendance fix"], ["asset", "Asset"], ["asset_purchase", "Asset purchase"], ["itsupport", "IT support"]] },
      { key: "person", label: "Person", type: "select", options: [["", "Everyone"], ...peopleOptions(ctx)] },
      { key: "note", label: v.decision === "reject" ? "Reason (sent to them)" : "Note", required: v.decision === "reject" },
      { key: "_matches", label: "Requests", type: "info", value: pendingFor(v, ctx).map((r) => `${r.request_id} · ${ctx.store.nameOf?.(r.employee_code) || r.employee_code} · ${r.type}`).slice(0, 8).join("\n") || "Nothing pending matches." },
    ],
    run: (v, ctx) => { const ids = pendingFor(v, ctx).map((r) => r.request_id); if (!ids.length) return { ok: false, error: "Nothing pending matches." }; const r = ctx.store.bulkDecideRequests(ids, v.decision === "approve", v.note || ""); return r?.ok === false ? fail(r) : { ok: true, message: `${v.decision === "approve" ? "Approved" : "Rejected"} ${r?.done ?? ids.length} request(s).`, link: link("/inbox", "Open Inbox") }; },
  },

  // ── Reports, answers, navigation (no confirm) ───────────────────────────
  {
    id: "run_report", kind: "read", group: "Reports", title: "Run a report", example: "Run the headcount report · Show leave balances · Attendance report for last month",
    words: "run report show generate list register summary headcount attrition joiners exits attendance leave payroll payslip expense overtime late",
    allowed: isAdmin,
    match: (t, ctx) => (has(t, "\\breport\\b") || (has(t, "\\b(run|show|generate|give me|get|pull|export|download|list)\\b") && reportIn(t, ctx)) ? 0.85 : reportIn(t, ctx) && has(t, "\\b(register|summary|balances?)\\b") ? 0.6 : 0),
    extract: (t, ctx) => { const r = reportIn(t, ctx); const per = periodIn(t); return { report: r?.id || "", from: per?.[0] || `${new Date().getFullYear()}-01-01`, to: per?.[1] || today() }; },
    fields: (v, ctx) => [
      { key: "report", label: "Report", type: "select", required: true, options: reportsFor(ctx.user).map((r) => [r.id, `${r.name} · ${r.group}`]) },
      { key: "from", label: "From", type: "date" }, { key: "to", label: "To", type: "date" },
    ],
    run: (v, ctx) => {
      const def = REPORTS.find((r) => r.id === v.report);
      if (!def) return { ok: false, error: "Choose a report." };
      const all = emps(ctx);
      const empBy = Object.fromEntries(all.map((e) => [e.employee_code, e]));
      const rows = runReport(def, { data: ctx.data, emps: all, empBy, nameOf: ctx.store.nameOf || ((c) => empBy[c]?.full_name || c), from: v.from, to: v.to });
      return { ok: true, message: `**${def.name}** · ${rows.length} row${rows.length === 1 ? "" : "s"} (${v.from} → ${v.to}).`, table: { columns: [["employee", "Employee"], ...def.columns.filter((c) => c[0] !== "employee" && c.key !== "employee").map((c) => (Array.isArray(c) ? c : [c.key, c.label]))].slice(0, 7), rows, name: def.name }, link: link(`/reports?report=${def.id}`, "Open in Reports") };
    },
  },
  {
    id: "answer_count", kind: "read", group: "Answers", title: "How many / who", example: "How many employees are in Sales? · Who is Ravi Kumar?",
    words: "how many count number who is find search people employees headcount",
    allowed: () => true,
    match: (t, ctx) => (has(t, "^\\s*(how many|count|number of)\\b") ? 0.85 : has(t, "^\\s*(who is|who's|find|search|look up|show me)\\b") && personIn(t, ctx) ? 0.8 : 0),
    extract: (t, ctx) => ({ q: t, dept: deptIn(t, ctx) || "", person: personIn(t, ctx)?.employee_code || "" }),
    fields: () => [],
    run: (v, ctx) => {
      if (v.person) { const e = emps(ctx).find((x) => x.employee_code === v.person); return { ok: true, message: `**${e.full_name}** (${e.employee_code}) — ${e.designation || "no title"}, ${e.department || "no department"}${e.reporting_manager ? `, reports to ${ctx.store.nameOf?.(e.reporting_manager) || e.reporting_manager}` : ""}. Status: ${e.status}.` }; }
      const list = emps(ctx).filter((e) => e.status === "active" && (!v.dept || norm(e.department) === norm(v.dept)));
      const by = {};
      for (const e of list) by[e.department || "—"] = (by[e.department || "—"] || 0) + 1;
      const total = ctx.data.__server?.employees_active && !v.dept ? ctx.data.__server.employees_active : list.length;
      const waiting = emps(ctx).filter((e) => e.status === "pending_approval" && (!v.dept || norm(e.department) === norm(v.dept))).length;
      return { ok: true, message: `**${total.toLocaleString("en-IN")}** active employee${total === 1 ? "" : "s"}${v.dept ? ` in ${v.dept}` : ""}${waiting ? ` (+${waiting} waiting for account approval)` : ""}.${!v.dept && Object.keys(by).length > 1 ? `\n\n${Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([d, n]) => `• ${d}: ${n}`).join("\n")}` : ""}` };
    },
  },
  {
    id: "open_page", kind: "nav", group: "Navigate", title: "Open a screen", example: "Open payroll · Go to my payslips · Take me to the org chart",
    words: "open go to show take me navigate page screen",
    allowed: () => true,
    match: (t, ctx) => (has(t, "^\\s*(open|go to|goto|take me to|navigate to|show me the|jump to)\\b") && navIn(t, ctx) ? 0.9 : 0),
    extract: (t, ctx) => ({ to: navIn(t, ctx)?.id || "" }),
    fields: (v, ctx) => [{ key: "to", label: "Screen", type: "select", options: (ctx.nav || []).map((n) => [n.id, n.label]) }],
    run: (v, ctx) => { const n = (ctx.nav || []).find((x) => x.id === v.to); if (!n) return { ok: false, error: "I could not find that screen." }; ctx.navigate(`/${n.id}`); return { ok: true, message: `Opened **${n.label}**.` }; },
  },
];

// ── helpers used by several actions ─────────────────────────────────────
function selectOptions(f, rec, ctx) {
  try {
    const o = fieldOptions(f, rec, { orgUnits: ctx.data.orgUnits || [], employees: emps(ctx), geofences: ctx.data.geofences || [], vendors: ctx.data.contractVendors || [], companies: ctx.data.companies || [], locations: ctx.data.workLocations || [] });
    if (Array.isArray(o) && o.length) return o.map((x) => (Array.isArray(x) ? x : typeof x === "object" ? [x.value ?? x.id ?? x.code, x.label ?? x.name] : [x, x]));
  } catch { /* fall back */ }
  if (f.key === "grade_code") return GRADES.map((g) => [g, g]);
  if (Array.isArray(f.options)) return f.options.map((x) => (Array.isArray(x) ? x : [x, x]));
  return undefined;
}
// The full record the employee master expects: sensible defaults + what was said
export function employeeRecord(v, ctx) {
  const loc = (ctx.data.workLocations || []).find((l) => l.location_id === v.location_id) || (ctx.data.workLocations || [])[0];
  const wt = v.worker_type || "permanent";
  const country = loc?.country || ctx.data.companies?.[0]?.country || "IN";
  const rec = {
    grade_code: "P2", employment_type: wt === "intern" ? "intern" : wt === "permanent" ? "full_time" : "contract", fte: "1", country_code: country, region: "", city: loc?.city || "",
    leave_policy: "standard", expense_policy: "standard", attendance_mode: "any", primary_geofence: ctx.data.geofences?.[0]?.id || "", field_staff: "no", call_tracking: "no",
    tax_regime: "new", payment_mode: "Bank Transfer", pay_cycle: "monthly", shift: "general", preferred_language: "English", std_hours_week: 40,
  };
  for (const [k, val] of Object.entries(v)) if (val !== "" && val != null && !k.startsWith("_")) rec[k] = val;
  rec.login_id = (v.email || "").toLowerCase();
  rec.location_id = loc?.location_id || v.location_id || "";
  if (!v.primary_geofence && loc?.geofence_id) rec.primary_geofence = loc.geofence_id;
  if (!v.region && geoOf(loc?.city)?.[2]) rec.region = geoOf(loc.city)[2];
  if (rec.monthly_gross !== undefined && rec.monthly_gross !== "") rec.monthly_gross = Number(rec.monthly_gross);
  return rec;
}
function pendingFor(v, ctx) {
  const me = ctx.user;
  return (ctx.data.requests || []).filter((r) => /^pending/i.test(r.status || "") && (!v.type || r.type === v.type) && (!v.person || r.employee_code === v.person) &&
    (me.role === "superadmin" || (me.role === "admin" ? r.stage === "admin" && (me.modules || (ctx.data.admins || []).find((a) => a.admin_code === me.code)?.modules || []).includes(stepModule(r, currentAdminStep(r))) : r.stage === "manager" && (ctx.data.employees || []).find((e) => e.employee_code === r.employee_code)?.reporting_manager === me.employee_code)));
}
function reportIn(t, ctx) {
  const list = reportsFor(ctx.user);
  const ALIAS = { attrition: "staff-turnover", turnover: "staff-turnover", headcount: "headcount", joiners: "joiners", "new joiners": "joiners", exits: "exits", leavers: "exits", "leave balance": "leave-balance", "leave balances": "leave-balance", leave: "leave-register", attendance: "monthly-att-summary", late: "late-early", overtime: "overtime", payroll: "payslip-register", payslip: "payslip-register", salary: "salary-cost", expenses: "expenses", expense: "expenses", assets: "assets", audit: "audit", logins: "logins", birthdays: "headcount", probation: "probation", "top earners": "top-earners", "gender pay": "gender-pay", "bank transfer": "bank-transfer", statutory: "statutory", approvals: "approvals", candidates: "candidates", requisitions: "requisitions", contracts: "contracts", timesheets: "timesheets" };
  const byName = pickFrom(t, list, (r) => r.name, (r) => [r.id.replace(/-/g, " ")]);
  if (byName) return byName;
  const t2 = ` ${norm(t)} `;
  const key = Object.keys(ALIAS).sort((a, b) => b.length - a.length).find((k) => t2.includes(` ${k} `));
  return key ? list.find((r) => r.id === ALIAS[key]) || null : null;
}
function navIn(t, ctx) {
  const target = norm(t).replace(/^(open|go to|goto|take me to|navigate to|show me the|show me|jump to)\s+/, "").replace(/^(the|my)\s+/, "").replace(/\s+(page|screen|tab)$/, "");
  return pickFrom(` ${target} `, ctx.nav || [], (n) => n.label, (n) => [n.id.replace(/-/g, " "), ...(n.alias || [])]) || (ctx.nav || []).find((n) => norm(n.label).startsWith(target) || norm(n.label).includes(target));
}
export const ACTION_BY = Object.fromEntries(ACTIONS.map((a) => [a.id, a]));
