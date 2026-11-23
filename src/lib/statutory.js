// v10.3 — Statutory profile of every employee and every payroll group.
//
// 1. Frozen defaults. An employee's country, currency, tax engine and default language are not chosen by hand: they follow
//    the legal entity (company) and the work location the person is registered at. Country = the location's country,
//    currency = that country's currency, language = English (other local languages are offered in the language dropdown).
//
// 2. Payroll registration modes, per company (legal entity):
//    • central  – one payroll for the whole entity under the company registration (TAN / PAYE ref / EIN…); every location
//                 rolls up into it. Use when locations are not separately registered.
//    • location – every location is registered on its own (its own TAN / PT / ESIC sub-code / S&E licence…) and runs its own
//                 payroll, bank file, challans and returns.
//    • hybrid   – registered locations run their own payroll; unregistered locations roll up into the head office.
//    A location in a different country from its company can never roll up: it always runs a local payroll in local currency
//    (branch / PE registration), or is flagged "needs local registration or EOR" when it has no registration.
//
// 3. Local payslips. Payslips for staff outside India are generated from their own country engine, in their own currency,
//    with the engine's local line names (PAYE, NIC, CPF, Lohnsteuer…) — see localPayslipRow().
import { COUNTRIES, computePay, toEngineEmp, periodContext } from "./payroll/index.js";
import { workerTypeOf, payRouteOf } from "../data/employeeFields.js";
import { PACKS } from "../country/countryPacks.js";

export const PAYROLL_MODES = [
  { id: "central", label: "Central (company-level)", short: "Central", text: "One payroll for the whole legal entity under the company registration. All locations roll up into head office; taxes and contributions are paid once, by the entity." },
  { id: "location", label: "Location-wise (each registered location)", short: "Location-wise", text: "Every location is registered on its own and runs its own payroll, bank file, challans and returns. Taxes are paid to the government under each location's registration." },
  { id: "hybrid", label: "Hybrid (registered locations + head office)", short: "Hybrid", text: "Locations with their own registration run their own payroll; locations without one roll up into head office payroll." },
];
export const MODE_BY = Object.fromEntries(PAYROLL_MODES.map((m) => [m.id, m]));

// Registration numbers asked for, by country. [key, label, level] — level "company" fields sit on the entity, "location" on each site.
export const REG_FIELDS = {
  IN: [["tan", "TAN (TDS deductor)", "location"], ["pf_code", "PF establishment code (EPFO)", "company"], ["esic_code", "ESIC code / sub-code", "location"], ["pt_reg", "Professional tax registration (state)", "location"], ["lwf_reg", "Labour welfare fund registration", "location"], ["se_licence", "Shops & establishment licence", "location"]],
  GB: [["paye_ref", "Employer PAYE reference", "location"], ["ao_ref", "Accounts office reference", "location"]],
  US: [["fein", "Federal EIN", "company"], ["state_wh", "State withholding account", "location"], ["sui", "State unemployment (SUI) account", "location"]],
  IE: [["paye_reg", "Revenue employer PAYE registration", "location"]],
  DE: [["betriebsnummer", "Betriebsnummer", "location"], ["finanzamt", "Finanzamt tax number", "location"]],
  FR: [["siret", "SIRET", "location"], ["urssaf", "URSSAF account", "location"]],
  CA: [["bn_rp", "CRA business number (RP)", "location"]],
  MX: [["rfc", "RFC", "company"], ["imss_reg", "IMSS registro patronal", "location"]],
  BR: [["cnpj", "CNPJ (branch)", "location"]],
  AE: [["mohre", "MOHRE establishment ID", "location"], ["wps_id", "WPS employer ID", "location"]],
  SA: [["mol", "Qiwa / MoL establishment no.", "location"], ["gosi", "GOSI registration", "location"]],
  SG: [["cpf_csn", "CPF submission number (CSN)", "location"]],
  ZA: [["paye_za", "PAYE reference (7…)", "location"], ["uif", "UIF reference", "location"], ["sdl", "SDL reference", "location"]],
  default: [["employer_tax", "Employer tax / withholding registration", "location"], ["social_reg", "Social security registration", "location"]],
};
export const regFieldsFor = (cc) => REG_FIELDS[cc] || REG_FIELDS.default;

// ── Directory used by pure functions (payslip renderer) that do not get the store ──
let DIR = { companies: [], locations: [], settings: {} };
export function setStatutoryDirectory(d) {
  DIR = { companies: d?.companies || [], locations: d?.workLocations || [], settings: d?.settings || {} };
}

const fallbackLoc = (e, locations) => locations.find((l) => l.location_id === e?.location_id) || null;

/** Is the location registered on its own (has at least one location-level registration number)? */
export function isRegistered(loc) {
  const reg = loc?.statutory || {};
  return regFieldsFor(loc?.country).filter(([, , lvl]) => lvl === "location").some(([k]) => String(reg[k] || "").trim());
}

/** Frozen defaults for one employee: entity, location, country, currency, language, tax engine. */
export function entityProfile(e, d = DIR) {
  const companies = d.companies || [];
  const locations = d.workLocations || d.locations || [];
  const loc = fallbackLoc(e, locations);
  const company = companies.find((c) => c.company_id === (loc?.company_id || e?.company_id)) || null;
  const lock = (d.settings?.lock_country_to_location ?? true) !== false;
  const country = (lock && loc?.country) || e?.country_code || company?.country || "IN";
  const pack = PACKS[country] || {};
  const currency = COUNTRIES[country]?.currency || company?.currency || "INR";
  return {
    company, location: loc, country, currency, symbol: pack.symbol || currency, locale: pack.locale || "en-GB",
    language: e?.preferred_language || "English", languages: ["English", ...((pack.languages || []).filter((l) => l !== "English"))],
    engine: COUNTRIES[country] ? `${COUNTRIES[country].name} payroll engine` : "No payroll engine",
    locked: lock && !!loc,
    crossBorder: !!(company && loc && company.country !== loc.country),
  };
}

/** Which payroll group (registration) a location falls in for its company's mode. */
export function groupOfLocation(loc, company, locations) {
  if (!loc || !company) return null;
  const mode = company.payroll_mode || "central";
  const hq = locations.find((l) => l.company_id === company.company_id && l.type === "head_office" && l.country === company.country)
    || locations.find((l) => l.company_id === company.company_id && l.country === company.country)
    || null;
  if (loc.country !== company.country) {
    return { id: `${company.company_id}:${loc.location_id}`, kind: isRegistered(loc) ? "foreign" : "unregistered_foreign", registrationAt: loc, mode };
  }
  if (mode === "location") return { id: `${company.company_id}:${loc.location_id}`, kind: isRegistered(loc) ? "location" : "location_unregistered", registrationAt: loc, mode };
  if (mode === "hybrid" && isRegistered(loc) && loc !== hq) return { id: `${company.company_id}:${loc.location_id}`, kind: "location", registrationAt: loc, mode };
  return { id: `${company.company_id}:HQ`, kind: "central", registrationAt: hq || loc, mode };
}

const onPayroll = (e) => e.status === "active" && payRouteOf(e) === "payroll";

/** Every payroll group the current setup produces ("possibilities"), with people, currency, authorities and warnings. */
export function payrollGroups(data) {
  const companies = data.companies || [];
  const locations = (data.workLocations || []).filter((l) => l.status !== "inactive");
  const groups = new Map();
  for (const c of companies.filter((x) => x.status !== "inactive")) {
    for (const loc of locations.filter((l) => l.company_id === c.company_id)) {
      const g = groupOfLocation(loc, c, locations);
      if (!g) continue;
      const cc = g.kind === "central" ? c.country : loc.country;
      const cur = COUNTRIES[cc]?.currency || c.currency;
      const at = g.registrationAt;
      if (!groups.has(g.id)) {
        groups.set(g.id, {
          id: g.id, company: c, country: cc, currency: cur, mode: g.mode, kind: g.kind,
          label: g.kind === "central" ? `${c.short} · head-office payroll` : `${c.short} · ${at.name}`,
          registrationAt: at, registration: { ...(c.statutory || {}), ...(at?.statutory || {}) },
          locations: [], employees: [], warnings: [],
          authorities: PACKS[cc]?.authorities || [],
        });
      }
      const grp = groups.get(g.id);
      grp.locations.push(loc);
      grp.employees.push(...data.employees.filter((e) => e.location_id === loc.location_id && onPayroll(e)));
    }
  }
  for (const g of groups.values()) {
    const fields = regFieldsFor(g.country);
    const missing = fields.filter(([k]) => !String(g.registration[k] || "").trim()).map(([, l]) => l);
    if (g.kind === "unregistered_foreign") g.warnings.push(`${g.registrationAt.name} is in ${COUNTRIES[g.country]?.name || g.country}, outside the entity's country, and has no local registration. Register a branch / PE payroll or move these people to an Employer of Record.`);
    if (g.kind === "location_unregistered") g.warnings.push(`Location-wise mode, but ${g.registrationAt.name} has no registration of its own. Add its registration numbers or switch the company to Hybrid so it rolls up into head office.`);
    if (missing.length && g.employees.length) g.warnings.push(`Missing: ${missing.join(", ")}.`);
  }
  return [...groups.values()].sort((a, b) => a.company.company_id.localeCompare(b.company.company_id) || (a.kind === "central" ? -1 : 1));
}

/** The payroll group an employee is paid in. */
export function groupOfEmployee(data, e) {
  const loc = (data.workLocations || []).find((l) => l.location_id === e.location_id);
  const c = (data.companies || []).find((x) => x.company_id === (loc?.company_id || e.company_id));
  return groupOfLocation(loc, c, data.workLocations || []);
}

/** Text line with the registration numbers that apply to an employee (printed on the payslip). */
export function registrationLine(e, d = DIR) {
  const p = entityProfile(e, d);
  if (!p.location) return "";
  const g = groupOfLocation(p.location, p.company, d.workLocations || d.locations || []);
  const reg = { ...(p.company?.statutory || {}), ...(g?.registrationAt?.statutory || {}) };
  return regFieldsFor(p.country).filter(([k]) => reg[k]).map(([k, l]) => `${l.replace(/ \(.*\)/, "")}: ${reg[k]}`).join(" · ");
}

/** Company block for a payslip: the employee's own legal entity when it is not the India head-office template. */
export function payslipEntity(emp, fallback) {
  const p = entityProfile(emp, DIR);
  const reg = registrationLine(emp, DIR);
  if (!p.company || p.country === "IN") return { ...fallback, registration: reg };
  return {
    ...fallback,
    name: p.company.name,
    address: [p.location?.name ? `${p.location.name}${p.location.city ? `, ${p.location.city}` : ""}` : "", p.crossBorder ? `${COUNTRIES[p.country]?.name} branch of ${p.company.short}` : p.company.address].filter(Boolean),
    registration: [p.company.registration, reg].filter(Boolean).join(" · "),
  };
}

// ── Local payslips (outside India) ──
const TAX_RE = /tax|PAYE|TDS|PCB|MTD|\bISR\b|IRRF|Lohnsteuer|Solidarit|Kirchen|Prélèvement|\bUSC\b|PPh|withholding/i;
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Payslip row for a non-India employee from their own country engine, in local currency, with local line names. */
export function localPayslipRow(e, { period, lopDays = 0, otPay = 0, reimbursement = 0 }) {
  const cc = e.country_code || "IN";
  const [y, m] = period.split("-").map(Number);
  const dim = new Date(y, m, 0).getDate();
  const pay = computePay(toEngineEmp(e), periodContext(`${period}-15`, { lopDays, otPay }));
  const earning = pay.earnings.filter(([, v]) => Number(v)).map(([k, v]) => [k, r2(v)]);
  const sumE = r2(earning.reduce((s, [, v]) => s + v, 0));
  if (Math.abs(sumE - r2(pay.earned)) > 0.5) earning.push(["Adjustment", r2(pay.earned - sumE)]);
  const tax = pay.deductions.filter(([k, v]) => Number(v) && TAX_RE.test(k)).map(([k, v]) => [k, r2(v)]);
  const social = pay.deductions.filter(([k, v]) => Number(v) && !TAX_RE.test(k)).map(([k, v]) => [k, r2(v)]);
  const sum = (a) => r2(a.reduce((s, [, v]) => s + v, 0));
  return {
    employee_code: e.employee_code,
    actual_payable_days: dim,
    total_working_days: dim,
    lop_days: lopDays,
    days_payable: r2(dim - lopDays),
    currency: COUNTRIES[cc]?.currency || "INR",
    local_lines: { earning, contribution: social, deduction: tax },
    values: { GROSS_PAY: r2(pay.earned), SOCIAL_EE: sum(social), LOCAL_TAX: sum(tax), OTHER_DED: 0, REIMB: r2(reimbursement) },
  };
}

// ── Worker access (contract & freelance self-service) ──
export const RESTRICTED_DEFAULT = ["contract", "freelance"];
const DAY = 86400000;

/** First day of the engagement: the earliest of the joining date and any contract start (renewals keep the original start). */
export function engagementStart(data, e) {
  const starts = [e?.date_of_joining, ...(data?.contracts || []).filter((c) => c.employee_code === e?.employee_code).map((c) => c.start_date)].filter(Boolean).sort();
  return starts[0] || null;
}
export function tenureDays(data, e, today = new Date()) {
  const s = engagementStart(data, e);
  return s ? Math.floor((today - new Date(`${s}T00:00:00`)) / DAY) : 0;
}
/** Contract and freelance workers (configurable) get request-leave only — no pay & payslips, leave balances or spend card. */
export function isRestrictedWorker(e, settings) {
  if (!e) return false;
  const types = settings?.restricted_worker_types || RESTRICTED_DEFAULT;
  return types.includes(workerTypeOf(e));
}
/** Long-term restricted workers (more than a year, configurable) keep benefits & wellness. */
export function benefitsEligible(data, e) {
  if (!isRestrictedWorker(e, data?.settings)) return true;
  return tenureDays(data, e) > (Number(data?.settings?.long_term_days) || 365);
}

/** v10.4: interns, contract and freelance workers carry a zero leave balance and use request-level leave only. */
export const ZERO_LEAVE_DEFAULT = ["intern", "contract", "freelance"];
export function isZeroLeaveWorker(e, settings) {
  if (!e) return false;
  const types = settings?.zero_leave_worker_types || ZERO_LEAVE_DEFAULT;
  return types.includes(workerTypeOf(e)) || e.leave_policy === "intern";
}

// ── Admin kinds ──
const FIN = ["payroll", "expense", "advance", "loan"];
/** "finance" – holds money modules but not HR accounts; "hr" – holds HR accounts / people; else "custom". */
export function adminKind(user) {
  if (!user || user.role !== "admin") return null;
  // v10.4: the Super Admin can set an explicit access profile (Employee + HR, Employee + Finance, Employee + HR + Finance).
  if (["hr", "finance", "hr_finance", "it"].includes(user.access_profile)) return user.access_profile;
  const m = user.modules || [];
  if (m.includes("accounts") || (user.permissions_scope || []).includes("people")) return "hr";
  if (m.some((x) => FIN.includes(x))) return "finance";
  return "custom";
}

/** v10.4: HR and Finance admins switch country / language only when the Super Admin has enabled it for them. */
// v10.7: language and legal-entity selectors are for HR admins and the Super Admin only.
export function canSwitchLocale(user) {
  if (!user) return false;
  if (user.role === "superadmin") return true;
  if (user.role === "admin") return ["hr", "hr_finance"].includes(adminKind(user));
  return false;
}
export const canSwitchEntity = canSwitchLocale;
