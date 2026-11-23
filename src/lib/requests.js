// Leave, expense, advance and loan rules. Used live by the forms and again by the store on submit.
import { FORM_TYPES } from "./forms.js";
import { DAY, isoDate } from "./utils.js";
import { workerTypeOf } from "../data/employeeFields.js";

const ZERO_LEAVE_TYPES = ["intern", "contract", "freelance"];

export const REQUEST_TYPES = {
  leave: { label: "Leave", prefix: "LV-", module: "leave" },
  expense: { label: "Expense claim", prefix: "EXP-", module: "expense" },
  advance: { label: "Advance", prefix: "ADV-", module: "advance" },
  loan: { label: "Salary loan", prefix: "LN-", module: "loan" },
  regularize: { label: "Attendance correction", prefix: "REG-", module: "attendance" },
  asset: { label: "Asset request", prefix: "AST-", module: "assets" },
  screenoff: { label: "Screen-off time claim", prefix: "SOF-", module: "attendance" },
  asset_purchase: { label: "Asset purchase request", prefix: "APR-", module: "assets" },
  // IT support tickets live in the IT desk; this request only carries the manager's approval before IT picks it up.
  itsupport: { label: "IT support", prefix: "ITS-", module: "it" },
  // v10.13: work from home, travel, overtime, letter and grievance forms
  ...Object.fromEntries(Object.entries(FORM_TYPES).map(([k, d]) => [k, { label: d.label, prefix: d.prefix, module: d.module }])),
};

// ── v10.11: approval chains as a list of steps ───────────────────────────
// A chain is stored as tokens joined by "_": "manager" = reporting manager, "admin" = the admin for the
// request's own module, and named admin steps "it", "hr", "finance". So "manager_it_hr_finance" means
// Reporting manager → IT admin → HR admin → Finance admin. Older values ("manager_admin", "manager", "admin") still work.
export const CHAIN_ROLES = {
  it: { label: "IT admin", module: "it" },
  hr: { label: "HR admin", module: "accounts" },
  finance: { label: "Finance admin", module: "expense" },
};
const HR_TYPES = ["leave", "regularize", "screenoff", "points", "wfh", "overtime", "letter", "grievance"]; // v10.13: travel goes to Finance
export const adminLabelFor = (type) => (HR_TYPES.includes(type) ? "HR admin" : type === "itsupport" ? "IT admin" : type === "asset" || type === "asset_purchase" ? "Asset admin" : "Finance admin");
export const DEFAULT_CHAIN = { screenoff: "manager", asset_purchase: "manager_it_hr_finance", itsupport: "manager_it", ...Object.fromEntries(Object.entries(FORM_TYPES).map(([k, d]) => [k, d.chain])) };
export const defaultChain = (type) => DEFAULT_CHAIN[type] || "manager_admin";

/** The steps of a chain: [{ level: "manager" } | { level: "admin", role, module, label }]. */
export function chainSteps(chain, type) {
  return String(chain || defaultChain(type)).split("_").filter(Boolean).map((t) => {
    if (t === "manager") return { level: "manager" };
    if (CHAIN_ROLES[t]) return { level: "admin", role: t, module: CHAIN_ROLES[t].module, label: CHAIN_ROLES[t].label };
    return { level: "admin", role: null, module: REQUEST_TYPES[type]?.module, label: adminLabelFor(type) };
  });
}
export const chainLabel = (chain, type) => {
  const st = chainSteps(chain, type);
  return st.map((s) => (s.level === "manager" ? "Reporting manager" : s.label)).join(" → ") + (st.length === 1 ? " only" : "");
};
// v10.12: every request type offers the same standard chains, plus the Super Admin's own chains (settings.custom_chains).
export const STANDARD_CHAINS = ["manager_it_hr_finance", "manager_admin", "manager", "admin", "manager_it_finance", "manager_it"];
/** Building blocks for a custom chain. "admin" is the admin for the request's own module (HR for leave, Finance for expenses…). */
export const CHAIN_TOKENS = [
  ["manager", "Reporting manager", "The employee's manager (skip-level / fallback rules apply)"],
  ["admin", "Module admin", "HR admin for leave & attendance, Finance admin for money, Asset admin for assets, IT admin for IT support"],
  ["it", "IT admin", "An admin with the IT service desk module"],
  ["hr", "HR admin", "An admin with the HR accounts module"],
  ["finance", "Finance admin", "An admin with the expenses module"],
];
/** Problems with a chain string, or "" when it can be used. */
export function chainProblem(chain) {
  const t = String(chain || "").split("_").filter(Boolean);
  if (!t.length) return "Add at least one approver.";
  if (t.some((x) => !CHAIN_TOKENS.some(([k]) => k === x))) return "Unknown step.";
  if (t.indexOf("manager") > 0 || t.filter((x) => x === "manager").length > 1) return "The reporting manager can only be the first step.";
  if (new Set(t).size !== t.length) return "Each approver can appear only once.";
  if (t.length > 6) return "Use at most 6 steps.";
  return "";
}
/** Chain choices for one request type: the standard chains, then custom ones. Chains that read the same for this type
 *  (e.g. "Reporting manager → IT admin" twice for IT support) are shown once; the chain in use (keep) is always listed. */
export function chainOptions(type, { custom = [], keep } = {}) {
  const all = [...STANDARD_CHAINS, ...custom.filter((c) => !chainProblem(c))];
  if (keep && !all.includes(keep)) all.push(keep);
  const byLabel = new Map();
  all.forEach((c) => { const l = chainLabel(c, type); if (!byLabel.has(l) || c === keep) byLabel.set(l, c); });
  const pick = new Set(byLabel.values());
  return all.filter((c, i) => pick.has(c) && all.indexOf(c) === i);
}
/** The admin step a pending request is waiting on (null while it is with the manager). */
export const currentAdminStep = (r) => (r?.stage === "admin" ? (r.steps || []).find((st) => st.level === "admin" && st.status === "pending") || null : null);
export const stepModule = (r, st) => st?.module || REQUEST_TYPES[r.type]?.module;
export const stepLabel = (r, st) => (st.level === "manager" ? "Manager" : st.role && CHAIN_ROLES[st.role] ? CHAIN_ROLES[st.role].label : adminLabelFor(r.type));

export function validateAssetPurchase(form) {
  const errors = {};
  if (!(form.item || "").trim()) errors.item = "What should be bought?";
  if (!form.category) errors.category = "Choose a category.";
  const q = Number(form.quantity);
  if (!Number.isInteger(q) || q < 1 || q > 500) errors.quantity = "Quantity must be 1 to 500.";
  const c = Number(form.est_cost);
  if (!Number.isFinite(c) || c <= 0) errors.est_cost = "Enter the estimated cost per unit.";
  if ((form.reason || "").trim().length < 10) errors.reason = "Say why it is needed (at least 10 characters).";
  if (!form.needed_by) errors.needed_by = "When is it needed?";
  else if (form.needed_by < isoDate()) errors.needed_by = "Choose today or later.";
  return { errors, total: (Number(form.quantity) || 0) * (Number(form.est_cost) || 0) };
}

// Why the screen was off while the employee was working (screen-off claim → manager approval → added to worked hours).
export const SCREENOFF_REASONS = [
  ["meeting", "Meeting / discussion away from the desk"],
  ["call", "Client or team phone call"],
  ["training", "Training, workshop or interview panel"],
  ["field", "Site visit / field work"],
  ["offline", "Offline work (whiteboard, reading, paperwork)"],
  ["system", "System / network / power issue"],
  ["other", "Other"],
];
export const fmtMins = (m) => `${Math.floor((Number(m) || 0) / 60)}h ${String(Math.round(Number(m) || 0) % 60).padStart(2, "0")}m`;

/** available: minutes of screen-off time on that day not yet approved or pending in another claim. */
export function validateScreenOff(form, { settings, available }) {
  const errors = {};
  const today = isoDate();
  const window = Number(settings?.regularize_window_days) || 30;
  if (!form.date) errors.date = "Choose the day.";
  else if (form.date > today) errors.date = "You can only claim past or current days.";
  else if ((toDate(today) - toDate(form.date)) / DAY > window) errors.date = `Claims are allowed for the last ${window} days.`;
  const m = Math.round(Number(form.minutes));
  if (!Number.isFinite(m) || m < 5) errors.minutes = "Claim at least 5 minutes.";
  else if (available != null && m > Math.floor(available)) errors.minutes = available < 5 ? "There is no unclaimed screen-off time on this day." : `Only ${fmtMins(Math.floor(available))} of screen-off time is left to claim on this day.`;
  if (!form.reason_code) errors.reason_code = "Choose a reason.";
  if ((form.reason || "").trim().length < 10) errors.reason = "Say what you were working on (at least 10 characters).";
  return { errors };
}

export const ASSET_CATEGORIES = ["Laptop", "Monitor", "Phone", "SIM", "Headset", "Access card", "Vehicle", "Other"];
export const REG_REASONS = [
  ["forgot_punch", "Forgot to punch"],
  ["device_issue", "Biometric device not working"],
  ["client_site", "Working at a client site"],
  ["network", "No mobile network / GPS"],
  ["wfh", "Worked from home (approved)"],
  ["other", "Other"],
];

export function validateRegularize(form, { settings, punches = [], emp }) {
  const errors = {};
  const today = isoDate();
  if (!form.date) errors.date = "Choose the day to correct.";
  else if (form.date > today) errors.date = "You can only correct past or current days.";
  else if ((toDate(today) - toDate(form.date)) / DAY > settings.regularize_window_days) errors.date = `Corrections are allowed for the last ${settings.regularize_window_days} days.`;
  if (!/^\d{2}:\d{2}$/.test(form.in_time || "")) errors.in_time = "Enter the in time.";
  if (!/^\d{2}:\d{2}$/.test(form.out_time || "")) errors.out_time = "Enter the out time.";
  else if (form.in_time && form.out_time <= form.in_time) errors.out_time = "Out time must be after in time.";
  if (!form.reason_code) errors.reason_code = "Choose a reason.";
  if (!(form.reason || "").trim()) errors.reason = "Explain what happened.";
  if (form.date && emp && punches.some((p) => p.employee_code === emp.employee_code && p.source === "regularized" && p.ts.startsWith(form.date))) errors.date = "This day was already corrected.";
  return { errors };
}

export function validateAssetRequest(form) {
  const errors = {};
  if (!form.category) errors.category = "Choose what you need.";
  if (!(form.reason || "").trim()) errors.reason = "Say why you need it.";
  if (!form.needed_by) errors.needed_by = "When do you need it?";
  else if (form.needed_by < isoDate()) errors.needed_by = "Choose today or later.";
  return { errors };
}

const toDate = (s) => new Date(`${s}T12:00:00`);

export function workingDays(from, to, holidays = []) {
  if (!from || !to || to < from) return 0;
  const hol = new Set(holidays.filter((h) => h.type === "holiday").map((h) => h.date));
  let n = 0;
  for (let d = toDate(from); d <= toDate(to); d = new Date(d.getTime() + DAY)) {
    const iso = isoDate(d);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6 && !hol.has(iso)) n += 1;
  }
  return n;
}

export function leaveDays(form, holidays) {
  const base = workingDays(form.from_date, form.to_date, holidays);
  if (form.half_day && form.half_day !== "none" && form.from_date === form.to_date && base === 1) return 0.5;
  return base;
}

// Entitlement is pro-rated for joiners this year. Pending requests count as booked.
export function leaveBalances(emp, leaveTypes, requests, { excludeId } = {}) {
  const year = new Date().getFullYear();
  const doj = toDate(emp.date_of_joining);
  const monthsThisYear = doj.getFullYear() < year ? 12 : 12 - doj.getMonth();
  const mine = requests.filter((r) => r.type === "leave" && r.employee_code === emp.employee_code && r.request_id !== excludeId && r.from_date?.startsWith(String(year)));
  return leaveTypes
    .filter((t) => t.active)
    .map((t) => {
      // v10.4: interns, contract and freelance workers hold a zero balance on every paid leave type (request-level leave only).
      const zero = ZERO_LEAVE_TYPES.includes(workerTypeOf(emp)) || emp.leave_policy === "intern";
      const entitled = t.annual == null ? null : zero ? 0 : Math.round((t.annual * monthsThisYear) / 12 * 2) / 2;
      const taken = mine.filter((r) => r.leave_type === t.code && r.status === "Approved").reduce((s, r) => s + r.days - (r.lop_days || 0), 0);
      const pending = mine.filter((r) => r.leave_type === t.code && r.status === "Pending").reduce((s, r) => s + r.days - (r.lop_days || 0), 0);
      // v10.5: a leave balance loaded by HR (Bulk actions → Leave balance data upload) replaces the accrual: the remaining
      // balance at load time, less leave approved (taken) after the load and leave still pending.
      const o = !zero && t.annual != null ? emp.leave_overrides?.[t.code] : null;
      if (o && o.year === year) {
        const takenAfter = mine.filter((r) => r.leave_type === t.code && r.status === "Approved" && String([...(r.history || [])].reverse().find((h) => h.status === "Approved")?.at || r.created_at || "") > o.loaded_at).reduce((s, r) => s + r.days - (r.lop_days || 0), 0);
        return { ...t, entitled: o.entitled, taken: Math.max(0, o.entitled - o.remaining) + takenAfter, pending, available: o.remaining - takenAfter - pending, zero_balance: false, loaded: true, next_entitled: o.next_entitled, next_remaining: o.next_remaining };
      }
      return { ...t, entitled, taken, pending, available: entitled == null ? null : zero ? 0 : entitled - taken - pending, zero_balance: zero && t.annual != null };
    });
}

export function validateLeave(form, { emp, leaveTypes, holidays, requests }) {
  const errors = {};
  const flags = [];
  let lop = 0;
  const today = isoDate();
  const type = leaveTypes.find((t) => t.code === form.leave_type);
  if (!type) errors.leave_type = "Choose a leave type.";
  if (!form.from_date) errors.from_date = "Choose the first day.";
  if (!form.to_date) errors.to_date = "Choose the last day.";
  else if (form.from_date && form.to_date < form.from_date) errors.to_date = "The last day must be on or after the first day.";
  const days = leaveDays(form, holidays);
  if (form.from_date && form.to_date && !errors.to_date && days === 0) errors.to_date = "These dates are all weekends or holidays.";
  if (form.half_day !== "none" && form.from_date !== form.to_date) errors.half_day = "Half days apply to single-day leave only.";
  if (type && form.from_date && !errors.from_date) {
    const notice = Math.round((toDate(form.from_date) - toDate(today)) / DAY);
    if (type.code !== "SL" && form.from_date < today) errors.from_date = "Only sick leave can be applied for past dates.";
    else if (type.code === "SL" && notice < -7) errors.from_date = "Sick leave can be applied up to 7 days after.";
    else if (notice >= 0 && notice < type.min_notice_days) flags.push({ code: "SHORT_NOTICE", level: "warn", text: `${type.name} needs ${type.min_notice_days} day(s) notice; this is ${notice}.` });
    if (type.floater_only) {
      const floaters = new Set(holidays.filter((h) => h.type === "floater").map((h) => h.date));
      for (let d = toDate(form.from_date); form.to_date && d <= toDate(form.to_date); d = new Date(d.getTime() + DAY)) {
        if (d.getDay() % 6 && !floaters.has(isoDate(d))) {
          errors.leave_type = "Floater leave can only be taken on a floater holiday.";
          break;
        }
      }
    }
    if (type.doc_after_days && days > type.doc_after_days && !form.attachment) errors.attachment = `Attach a medical certificate for more than ${type.doc_after_days} days of ${type.name.toLowerCase()}.`;
  }
  if (type && type.annual != null && emp && days) {
    const bal = leaveBalances(emp, leaveTypes, requests, { excludeId: form.request_id }).find((b) => b.code === type.code);
    if (bal?.zero_balance) flags.push({ code: "REQUEST_ONLY", level: "info", text: `No paid ${type.name.toLowerCase()} balance for your worker type — this is a leave request; your manager and HR decide how the days are treated under your terms.` });
    // v10.6: when the balance is exhausted the extra days become loss of pay (LOP) automatically instead of blocking.
    else if (bal && days > bal.available) { lop = days - Math.max(0, bal.available); flags.push({ code: "LOP_AUTO", level: "warn", text: `You have ${Math.max(0, bal.available)} day(s) of ${type.name.toLowerCase()} left; ${lop} day(s) of this request will be loss of pay (LOP) and deducted in payroll.` }); }
  }
  if (form.from_date && form.to_date && emp) {
    const overlap = requests.find((r) => r.type === "leave" && r.employee_code === emp.employee_code && r.request_id !== form.request_id && ["Pending", "Approved"].includes(r.status) && !(r.to_date < form.from_date || r.from_date > form.to_date));
    if (overlap) errors.from_date = `Overlaps ${overlap.request_id} (${overlap.from_date} to ${overlap.to_date}).`;
  }
  if (!(form.reason || "").trim()) errors.reason = "Add a reason for your manager.";
  else if (form.reason.length > 300) errors.reason = "Keep it under 300 characters.";
  return { errors, flags, days, lop };
}

export function expenseTotal(items = []) {
  return items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
}

export function validateExpense(form, { emp, expenseCategories, settings }) {
  const errors = {};
  const itemErrors = [];
  const flags = [];
  const today = isoDate();
  if (emp?.expense_policy === "none") errors.title = "No expense policy is assigned to you. Ask HR to assign one.";
  if (!(form.title || "").trim()) errors.title = errors.title || "Give the claim a title, like the trip or event.";
  if (!(form.purpose || "").trim()) errors.purpose = "Say what the spend was for.";
  if (!form.items?.length) errors.items = "Add at least one expense line.";
  (form.items || []).forEach((it, i) => {
    const e = {};
    const cat = expenseCategories.find((c) => c.code === it.category);
    const amt = Number(it.amount);
    if (!it.date) e.date = "Date required.";
    else if (it.date > today) e.date = "Cannot be in the future.";
    else if ((toDate(today) - toDate(it.date)) / DAY > settings.expense_claim_window_days) e.date = `Older than ${settings.expense_claim_window_days} days.`;
    if (!cat) e.category = "Choose a category.";
    if (!(it.description || "").trim()) e.description = "Describe it.";
    if (!it.amount || Number.isNaN(amt) || amt <= 0) e.amount = "Enter an amount.";
    else if (cat && amt > cat.limit) e.amount = `Policy limit is ₹${cat.limit.toLocaleString("en-IN")}.`;
    if (cat && amt > 0 && !it.receipt && (cat.receipt_always || amt > settings.receipt_required_above)) e.receipt = "Receipt required.";
    if (it.receipt && it.receipt.size > settings.max_file_mb * 1024 * 1024) e.receipt = `Over ${settings.max_file_mb} MB.`;
    if (cat && amt >= cat.limit * 0.9 && amt <= cat.limit) flags.push({ code: "NEAR_LIMIT", level: "info", text: `Line ${i + 1} is within 10% of the ${cat.name} limit.` });
    itemErrors[i] = e;
  });
  if (itemErrors.some((e) => e && Object.keys(e).length)) errors.items = errors.items || "Fix the highlighted lines.";
  if (!form.declaration) errors.declaration = "Confirm the declaration.";
  return { errors, itemErrors, flags, total: expenseTotal(form.items) };
}

export function validateAdvance(form, { settings, requests, emp }) {
  const errors = {};
  const amt = Number(form.request_amount);
  if (!form.request_amount || Number.isNaN(amt) || amt <= 0) errors.request_amount = "Enter the amount you need.";
  else if (amt > settings.max_advance_inr) errors.request_amount = `The most you can request is ₹${settings.max_advance_inr.toLocaleString("en-IN")}.`;
  if (!form.request_date) errors.request_date = "Request date required.";
  if (!form.required_by) errors.required_by = "When do you need it?";
  else if (form.required_by < isoDate()) errors.required_by = "Choose today or a later date.";
  if (!(form.purpose || "").trim()) errors.purpose = "Say what the advance is for.";
  const open = requests.find((r) => r.type === "advance" && r.employee_code === emp?.employee_code && (r.status === "Pending" || (r.status === "Disbursed" && !r.settled)));
  if (open) errors.request_amount = `Settle ${open.request_id} before asking for another advance.`;
  return { errors };
}

export function validateLoan(form, { settings, emp, requests }) {
  const errors = {};
  const amt = Number(form.amount);
  const max = (emp?.monthly_gross || 0) * settings.loan_max_multiple;
  if (!form.amount || Number.isNaN(amt) || amt <= 0) errors.amount = "Enter the loan amount.";
  else if (amt > max) errors.amount = `The most you can borrow is ₹${max.toLocaleString("en-IN")} (${settings.loan_max_multiple}× monthly gross).`;
  const t = Number(form.tenure_months);
  if (!t || t < 1 || t > settings.loan_max_tenure_months) errors.tenure_months = `1 to ${settings.loan_max_tenure_months} months.`;
  if (!(form.reason || "").trim()) errors.reason = "Add a reason.";
  if (requests.some((r) => r.type === "loan" && r.employee_code === emp?.employee_code && ["Pending", "Approved", "Disbursed"].includes(r.status) && !r.closed)) errors.amount = "You already have an open loan.";
  return { errors, emi: amt && t ? Math.ceil(amt / t) : 0 };
}

export function requestSummary(r, { leaveTypes = [], fmt = (n) => n } = {}) {
  if (r.type === "leave") return { title: `${leaveTypes.find((t) => t.code === r.leave_type)?.name || r.leave_type}`, detail: `${r.from_date === r.to_date ? r.from_date : `${r.from_date} → ${r.to_date}`}`, amount: `${r.days} day${r.days === 1 ? "" : "s"}` };
  // v10.8: requests that came in through the API or an import may carry only a total amount, no lines
  if (r.type === "expense") return { title: r.title || "Expense claim", detail: `${(r.items || []).length || 1} line(s) · ${r.project || "No project"}`, amount: `₹${fmt(r.approved_amount ?? (r.items?.length ? expenseTotal(r.items) : Number(r.amount) || 0))}` };
  if (r.type === "advance") return { title: r.purpose, detail: `Needed by ${r.required_by}`, amount: `₹${fmt(r.approved_amount ?? r.request_amount)}` };
  if (r.type === "regularize") return { title: `Correct ${r.date}`, detail: `${r.in_time} – ${r.out_time} · ${(REG_REASONS.find((x) => x[0] === r.reason_code) || [])[1] || ""}`, amount: "1 day" };
  if (r.type === "asset") return { title: `${r.category}${r.priority === "high" ? " · urgent" : ""}`, detail: r.reason, amount: r.assigned_asset || "—" };
  if (r.type === "screenoff") return { title: `Screen-off on ${r.date}`, detail: `${(SCREENOFF_REASONS.find((x) => x[0] === r.reason_code) || [])[1] || ""}${r.from_time ? ` · ${r.from_time}–${r.to_time}` : ""}`, amount: fmtMins(r.approved_minutes ?? r.minutes) };
  if (r.type === "loan") return { title: r.reason, detail: `${r.tenure_months} months · EMI ₹${fmt(r.emi)}`, amount: `₹${fmt(r.approved_amount ?? r.amount)}` };
  if (r.type === "asset_purchase") return { title: `${r.quantity} × ${r.item}`, detail: `${r.category} · needed by ${r.needed_by} · ${r.reason}`, amount: `₹${fmt(r.total_cost)}` };
  if (r.type === "itsupport") return { title: r.subject, detail: `IT ticket ${r.ticket_id} · ${r.reason}`, amount: r.priority };
  if (FORM_TYPES[r.type]) return FORM_TYPES[r.type].summary(r, fmt);
  return { title: "", detail: "", amount: "" };
}
