// v10.10 · A clean company: only the Super Admin (and app settings). No companies, locations, departments, leave
// types, holidays, pay components, people, requests, attendance, payslips, chats, tickets or history — the Super Admin
// (or EZY HR AI) creates them.
// Used by the browser app (its starting data) and by the server (`create-company.mjs`).

// lists that are set-up, not activity — kept as they are
// v10.10: everything is removed except the Super Admin. Only two built-in form layouts stay (they are part of the
// product, not company data): the offer-letter field list and the payslip designs.
export const KEEP_LISTS = new Set(["offerFields", "payslipDesigns"]);
// settings-style objects kept whole
// (product defaults with no company data in them)
const KEEP_OBJECTS = new Set(["settings", "contractSettings", "payslipDesignRules", "brand", "automation", "shifts", "fx"]);
// product content inside objects — kept (not company data): subscription plans and add-ons, the statutory law-update
// feed, the default data-retention schedule and the rewards voucher catalogue
const KEEP_PATHS = ["suite.billing.plans", "suite.billing.addons", "suite.ruleUpdates", "suite.privacy.retention", "suite.vouchers"];
const getPath = (o, p) => p.split(".").reduce((x, k) => (x == null ? x : x[k]), o);
function setPath(o, p, v) { const ks = p.split("."); let x = o; for (const k of ks.slice(0, -1)) { if (!x[k] || typeof x[k] !== "object") return; x = x[k]; } x[ks[ks.length - 1]] = v; }
// company data held as objects — emptied
const EMPTY_OBJECTS = ["budget", "jobPostings", "atsProfiles", "complianceStatus", "loanLedger", "healthTiers", "cycle", "compCycle", "hcTrend", "revenue", "demo_clock"];

// objects filed by person / record id ("EMP001", "R-2603", "CD-1", "LN-0008", "NA|PAYE|2026-09-20") are data
const personKeyed = (o) => { const k = Object.keys(o || {}); return k.length > 0 && k.every((x) => /^[A-Z]{1,5}-?\d+/i.test(x) || x.includes("|")); };
const periodKeyed = (o) => { const k = Object.keys(o || {}); return k.length > 0 && k.every((x) => /^\d{4}(-\d{2}){0,2}$|^W\d+|^Q[1-4]/.test(x)); };
// records (lists of objects) go at any depth; anything filed by person or by period goes; plain options stay
function cleanObject(o, depth = 0) {
  if (personKeyed(o) || periodKeyed(o)) return {};
  const out = {};
  for (const [k, v] of Object.entries(o)) {
    if (Array.isArray(v)) out[k] = v.length && v.some((x) => x && typeof x === "object") ? [] : v;
    else if (v && typeof v === "object") out[k] = depth < 5 ? cleanObject(v, depth + 1) : {};
    else out[k] = v;
  }
  return out;
}

// Settings keep their structure but lose the sample company's names, people, prefixes and connections.
function scrubCompanyText(data) {
  const blank = (o) => (o && typeof o === "object" ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "string" ? "" : typeof v === "boolean" || typeof v === "number" ? v : v && typeof v === "object" && !Array.isArray(v) ? blank(v) : v])) : o);
  const walk = (o) => {
    if (Array.isArray(o)) return o.map(walk);
    if (!o || typeof o !== "object") return typeof o === "string" ? o.replace(/ONAS(Tech)?[ _]?(Consulting Services Pvt Ltd|Global Services Pvt Ltd)?/g, "{{company}}").replace(/\{\{company\}\}\/(CW|VN)\//g, "$1/") : o;
    const out = {};
    for (const [k, v] of Object.entries(o)) {
      if (k === "signature" && v && typeof v === "object") out[k] = { ...v, name: "", title: "", image: null };
      else if (["offer_company", "payslip_company", "dpo"].includes(k)) out[k] = blank(v);
      else out[k] = walk(v);
    }
    return out;
  };
  data.settings = walk(data.settings || {});
  data.contractSettings = walk(data.contractSettings || {});
  data.payslipDesigns = (data.payslipDesigns || []).map((d, i) => walk({ ...d, name: ["Classic", "Contractor advice", "Compact"][i] || d.name, description: "Standard EZY HR payslip layout." }));
  if (data.suite) {
    data.suite = walk(data.suite);
    data.suite.values = [];
    if (data.suite.privacy) data.suite.privacy = { ...data.suite.privacy, dpo: { name: "", email: "", phone: "" } };
    if (data.suite.alertSettings) data.suite.alertSettings = { ...data.suite.alertSettings, recipients: ["SA001"] };
    if (data.suite.integrations) data.suite.integrations = Object.fromEntries(Object.keys(data.suite.integrations).map((k) => [k, { connected: false }]));
  }
}

/**
 * @param seed   the full sample data set (buildDemoSeed())
 * @param owner  { full_name, email, login_id?, employee_code?, designation?, keepEntities? }
 *               keepEntities: keep the seed's companies / locations / org units (browser edition); otherwise the caller sets them
 */
export function freshCompany(seed, owner) {
  const data = {};
  for (const [k, v] of Object.entries(seed)) {
    if (Array.isArray(v)) {
      if (!KEEP_LISTS.has(k)) { data[k] = []; continue; }
      data[k] = k === "chatChannels" ? v.filter((c) => !/^CH-dm/i.test(c.id || "")).map((c) => ({ ...c, members: [], last_at: null })) : v;
    } else if (v && typeof v === "object") data[k] = KEEP_OBJECTS.has(k) ? v : cleanObject(v);
    else data[k] = v;
  }
  for (const k of EMPTY_OBJECTS) if (k in data) data[k] = Array.isArray(seed[k]) ? [] : {};
  // expense apps: same structure, nothing connected
  if (seed.expenseHub) data.expenseHub = { ...cleanObject(seed.expenseHub), connections: Object.fromEntries(Object.keys(seed.expenseHub.connections || {}).map((k) => [k, { connected: false }])) };
  if (data.settings?.payslip_company) data.settings = { ...data.settings, payslip_company: Object.fromEntries(Object.keys(data.settings.payslip_company).map((k) => [k, ""])) };
  scrubCompanyText(data);
  for (const p of KEEP_PATHS) { const v = getPath(seed, p); if (v !== undefined) setPath(data, p, JSON.parse(JSON.stringify(v))); }
  if (!owner.keepEntities) { data.companies = []; data.workLocations = []; data.orgUnits = []; data.geofences = []; }
  const company = data.companies[0] || {};
  const location = data.workLocations.find((l) => l.company_id === company.company_id) || data.workLocations[0] || {};
  const code = owner.employee_code || "EMP001";
  const today = new Date().toISOString().slice(0, 10);
  data.employees = [{
    employee_code: code, full_name: owner.full_name, designation: owner.designation || "Founder & Super Admin", department: "Management", reporting_manager: "",
    grade_code: "M3", employment_type: "full_time", worker_type: "permanent", fte: "1", date_of_joining: owner.date_of_joining || today,
    country_code: company.country || "IN", region: "", city: location.city || "", email: owner.email, login_id: owner.login_id || owner.email, phone: owner.phone || "",
    status: "active", must_reset: false, failed_attempts: 0, company_id: company.company_id, location_id: location.location_id, monthly_gross: 0,
    pay_cycle: "monthly", tax_regime: "new", leave_policy: "standard", expense_policy: "standard", shift: "general", attendance_mode: "any",
    preferred_language: "English", primary_geofence: data.geofences?.[0]?.id || "", password_hash: null, has_login: false,
  }];
  data.admins = [];
  const sa = (seed.superAdmins || [])[0] || {};
  data.superAdmins = [{ ...sa, superadmin_code: "SA001", employee_code: code, full_name: owner.full_name, email: owner.email, login_id: owner.login_id || owner.email,
    status: "active", failed_attempts: 0, last_login: null }];
  data.notifications = [];
  data.audit = [];
  data.fresh_company = true;   // (no leading "__": the server keeps "__" names to itself)
  return data;
}
