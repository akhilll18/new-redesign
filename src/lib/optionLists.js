// v10.13 · Dropdown lists that can grow. The Super Admin can add to every list; an admin can add to the lists that belong
// to their work (their modules). New values are kept in settings.custom_options[listKey] and appear wherever the list is used.
// Only lists whose values are plain labels are here — lists that drive calculations (worker type, pay basis, tax section…) stay fixed.
import { ASSET_CATEGORIES } from "./requests.js";
import { FILE_CATEGORIES } from "../store/fileActions.js";
import { ALL_FIELDS } from "../data/employeeFields.js";
import { customListDef } from "./customFields.js";

export const OPTION_LISTS = {
  asset_category: { label: "Asset categories", module: "assets", used: "Asset request · Asset purchase request · Assets register", base: ASSET_CATEGORIES },
  grade_code: { label: "Grades", module: "accounts", used: "Employee form · Employment", base: null /* from the employee field */ },
  method_of_recruitment: { label: "Method of recruitment", module: "recruitment", used: "Employee form · Employment", base: null },
  notice_period: { label: "Notice period (days)", module: "accounts", used: "Employee form · Employment", base: null, numeric: true },
  // v10.15: the rest of the employee form's free-choice dropdowns (label-only values; rule-bound lists stay fixed)
  blood_group: { label: "Blood groups", module: "accounts", used: "Employee form · Contacts", base: null },
  employment_type: { label: "Work schedules", module: "accounts", used: "Employee form · Personal details", base: null },
  fte: { label: "FTE values", module: "accounts", used: "Employee form · Personal details", base: null, numeric: { min: 0.1, max: 1, decimals: 2, unit: "FTE", hint: "a number from 0.1 to 1.0, e.g. 0.75" } },
  probation_status: { label: "Probation statuses", module: "accounts", used: "Employee form · Employment", base: null },
  background_check: { label: "Background check statuses", module: "accounts", used: "Employee form · Employment · Background verification", base: null },
  right_to_work: { label: "Right-to-work statuses", module: "accounts", used: "Employee form · Employment", base: null },
  shift: { label: "Shifts", module: "attendance", used: "Employee form · Employment · Shift reports", base: null },
  ot_multiplier: { label: "Overtime rates", module: "payroll", used: "Employee form · Contract & engagement · Contracts", base: null, numeric: { min: 1, max: 4, decimals: 2, unit: "×", hint: "a multiplier from 1 to 4, e.g. 1.75" } },
  renewal_option: { label: "On-expiry options", module: "accounts", used: "Employee form · Contract & engagement · Contracts", base: null },
  payment_mode: { label: "Payment modes", module: "payroll", used: "Employee form · Pay & statutory · Payslips", base: null },
  wfh_reason: { label: "Work-from-home reasons", module: "attendance", used: "Work from home request", base: ["Personal work at home", "Unwell but able to work", "Travel or commute disruption", "Family care", "Focused work day", "Other"] },
  travel_mode: { label: "Travel modes", module: "expense", used: "Travel request", base: ["Flight", "Train", "Bus", "Cab", "Own vehicle"] },
  travel_purpose: { label: "Travel purposes", module: "expense", used: "Travel request", base: ["Client meeting", "Site visit", "Training or conference", "Internal meeting", "Sales visit", "Other"] },
  overtime_reason: { label: "Overtime reasons", module: "attendance", used: "Overtime claim", base: ["Release or deadline", "Production issue", "Month-end close", "Covering a colleague", "Customer escalation", "Other"] },
  letter_type: { label: "Letter types", module: "accounts", used: "Letter request", base: ["Employment verification", "Salary certificate", "Address proof", "Visa / travel letter", "Bank / loan letter", "Experience letter", "No-objection certificate"] },
  grievance_category: { label: "Grievance categories", module: "accounts", used: "Grievance / speak-up", base: ["Workplace behaviour", "Harassment (POSH)", "Discrimination", "Pay or benefits", "Manager concern", "Health & safety", "Policy or ethics concern", "Other"] },
  // v10.13 · more plain-label lists, each linked to the dropdowns that use it
  candidate_source: { label: "Candidate sources", module: "recruitment", used: "Recruitment · add candidate (ATS) · Hire pipeline", base: ["Careers page", "Referral", "Job portal", "Agency", "Campus", "LinkedIn"] },
  job_work_mode: { label: "Job work modes", module: "recruitment", used: "Recruitment · job posting", base: ["On-site", "Hybrid", "Remote"] },
  asset_condition: { label: "Asset return conditions", module: "assets", used: "Assets register · return an asset (anything other than “Good” goes to repair)", base: ["Good", "Damaged", "Missing parts"] },
  it_purchase_category: { label: "IT purchase categories", module: "it", used: "IT admin · purchase request", base: ["Laptop / desktop", "Monitor", "Mobile phone", "Peripherals (keyboard, mouse, headset)", "Software licence", "Network / Wi-Fi equipment", "Printer / scanner", "Other IT item"] },
  training_mode: { label: "Training modes", module: "learning", used: "Learning · training request", base: ["Online", "Classroom", "Workshop", "Certification", "Mentoring"] },
  learning_category: { label: "Learning categories", module: "learning", used: "Learning hub · new course or review", base: ["Skill", "Product knowledge", "Tools & systems", "Process / SOP", "Compliance", "Soft skills", "Certification prep"] },
  exit_reason: { label: "Exit reasons", module: "accounts", used: "Exits · start an exit · resignation · exit interview", base: ["Better opportunity", "Higher studies", "Relocation", "Compensation", "Manager / team", "Work-life balance", "Health / personal", "Career change", "Retirement", "Other"] },
  offcycle_reason: { label: "Off-cycle payroll reasons", module: "payroll", used: "Payroll agent · off-cycle run", base: ["Arrears & corrections", "Joiners after cut-off", "Full & final settlements", "Bonus / incentive payout", "Reimbursements"] },
  file_category: { label: "Document categories", module: "payslips", used: "My files · documents shared with employees", base: FILE_CATEGORIES },
};

/** A list's definition: a built-in list, or a dropdown the Super Admin created (v10.15). */
export function listDef(key, data) { return OPTION_LISTS[key] || customListDef(data, key); }

const clean = (v) => String(v ?? "").replace(/\s+/g, " ").trim();

const numLabel = (def, v) => (!def?.numeric ? String(v) : def.numeric === true ? `${v} days` : def.numeric.unit === "×" ? `${v}×` : `${v} ${def.numeric.unit}`);

/** Values of a list: built-in first, then the ones added on this account. Returns [[value, label]]. */
export function listOptions(data, key, base) {
  const def = listDef(key, data);
  const fieldBase = def && !def.base ? ALL_FIELDS.find((f) => f.key === key && Array.isArray(f.options))?.options : null; // employee-form lists
  const builtIn = (base || def?.base || fieldBase || []).map((o) => (Array.isArray(o) ? [String(o[0]), o[1]] : [String(o), String(o)]));
  const extra = (data?.settings?.custom_options?.[key] || []).filter((v) => !builtIn.some(([o, l]) => o.toLowerCase() === String(v).toLowerCase() || String(l).toLowerCase() === String(v).toLowerCase()));
  return [...builtIn, ...extra.map((v) => [String(v), numLabel(def, v)])];
}

/** Can this signed-in user add values to the list? */
export function canEditList(user, data, key) {
  const def = listDef(key, data);
  if (!def || !user) return false;
  if (user.role === "superadmin") return true;
  if (user.role !== "admin") return false;
  const a = (data?.admins || []).find((x) => x.admin_code === user.code);
  const mods = a?.modules || user.modules || [];
  return a?.status !== "suspended" && mods.includes(def.module);
}

/** Checks a new value; returns { value } or { error }. */
export function checkNewOption(data, key, raw, base) {
  const def = listDef(key, data);
  if (!def) return { error: "This list can't be changed." };
  let v = clean(raw);
  if (!v) return { error: "Type the new value." };
  if (v.length > 60) return { error: "Keep it under 60 characters." };
  if (def.numeric === true) { const n = Number(v.replace(/days?/i, "").trim()); if (!Number.isInteger(n) || n < 0 || n > 365) return { error: "Enter a number of days from 0 to 365." }; v = String(n); }
  else if (def.numeric) {
    const { min, max, decimals, hint } = def.numeric;
    const n = Number(v.replace(/[×x]|fte/gi, "").trim());
    if (!Number.isFinite(n) || n < min || n > max) return { error: `Enter ${hint}.` };
    v = String(Number(n.toFixed(decimals)));
  }
  if (key === "grade_code") v = v.toUpperCase().replace(/\s+/g, "");
  if (listOptions(data, key, base).some(([o, l]) => o.toLowerCase() === v.toLowerCase() || String(l).toLowerCase() === v.toLowerCase())) return { error: "That value is already in the list." };
  return { value: v };
}
