// Contract management for contingent workers (contract / fixed-term, freelance, consultant, agency, intern, temporary, apprentice).
// Modelled on SAP Fieldglass work orders + SuccessFactors Employee Central, and Oracle HCM contingent-worker assignments:
// a contract (work order / SOW) per engagement, rate history and amendments, weekly timesheets and milestones that are
// approved by the timesheet approver, a monthly contractor pay run that posts payroll-route workers into the payslip
// workflow and raises self-billed invoices (freelancers, consultants) or vendor invoices (agency workers), plus
// compliance flags (expiry, NDA, co-employment, licence, budget) and the printable contract.
import { isoDate, DAY } from "./utils.js";
import { WORKER_TYPE_BY, workerTypeOf, isContingent, payRouteOf, SELF_EMPLOYED, TDS_SECTIONS, COUNTRIES, RATE_UNIT } from "../data/employeeFields.js";

export const CONTRACT_STATUS = {
  draft: { label: "Draft", tone: "neutral" },
  pending_approval: { label: "Pending approval", tone: "warn" },
  active: { label: "Active", tone: "good" },
  upcoming: { label: "Starts soon", tone: "info" },
  expiring: { label: "Expiring", tone: "warn" },
  expired: { label: "Expired", tone: "bad" },
  suspended: { label: "On hold", tone: "warn" },
  terminated: { label: "Terminated", tone: "bad" },
  renewed: { label: "Renewed", tone: "neutral" },
  rejected: { label: "Rejected", tone: "bad" },
};
export const TS_STATUS = {
  draft: { label: "Draft", tone: "neutral" },
  submitted: { label: "Awaiting approval", tone: "warn" },
  approved: { label: "Approved", tone: "good" },
  rejected: { label: "Sent back", tone: "bad" },
  processed: { label: "Paid in run", tone: "info" },
};
export const MS_STATUS = {
  planned: { label: "Planned", tone: "neutral" },
  submitted: { label: "Submitted", tone: "warn" },
  approved: { label: "Approved", tone: "good" },
  rejected: { label: "Sent back", tone: "bad" },
  processed: { label: "Paid in run", tone: "info" },
};
export const RUN_STATUS = {
  draft: { label: "Draft", tone: "neutral" },
  pending_approval: { label: "Waiting for Finance", tone: "warn" },
  approved: { label: "Approved", tone: "info" },
  posted: { label: "Posted", tone: "good" },
  rejected: { label: "Rejected", tone: "bad" },
};
export const INVOICE_STATUS = {
  approved: { label: "Approved · to pay", tone: "warn" },
  paid: { label: "Paid", tone: "good" },
  cancelled: { label: "Cancelled", tone: "bad" },
};
export const BILLING_CYCLES = [["monthly", "Monthly"], ["semi_monthly", "Twice a month"], ["weekly", "Weekly"]];
export const WORK_LOCATIONS = [["onsite", "On site"], ["remote", "Remote"], ["hybrid", "Hybrid"]];
export const AMENDMENT_TYPES = [["rate", "Rate change"], ["extension", "Extension (new end date)"], ["scope", "Scope / SOW change"], ["hours", "Standard hours change"], ["budget", "Budget change"]];
export const TERMINATION_REASONS = [["completed", "Work completed early"], ["budget", "Budget withdrawn"], ["performance", "Performance / quality"], ["conduct", "Conduct / breach of contract"], ["conversion", "Converted to permanent employee"], ["resigned", "Worker ended the contract"], ["other", "Other"]];

export const DEFAULT_CONTRACT_SETTINGS = {
  renewal_alert_days: 30,
  final_alert_days: 7,
  max_hours_week: 60,
  min_entry_hours: 0.5,
  timesheet_due_day: "monday", // submit last week's sheet by Monday
  block_holiday_timesheets: true, // v10.7: HR can stop time being entered on public holidays
  timesheet_projects: "Client delivery, Internal tooling, Support & maintenance, Training",
  gst_rate: 18,
  require_nda: true,
  require_worker_signature: true,
  co_employment_months: 11,
  max_renewals: 2,
  invoice_prefix: "ONAS/CW/",
  vendor_invoice_prefix: "ONAS/VN/",
  payment_terms_days: 15,
  auto_expire: true,
  approval_by: "finance", // finance → a payroll admin approves; super → Super Admin only
  allow_backdated_timesheets_weeks: 4,
  clause_template:
    "1. ENGAGEMENT. {{company}} engages {{worker}} as {{worker_type}} for the role of {{title}} from {{start}} to {{end}}.\n" +
    "2. FEES. {{rate_text}}. Overtime approved in advance is paid at {{ot_multiplier}}× the hourly rate. {{payment_text}}\n" +
    "3. HOURS & TIMESHEETS. Standard hours are {{hours}} per week. Timesheets are submitted weekly in PeopleHub and approved by {{approver}}. Only approved time is paid.\n" +
    "4. TAXES. {{tax_text}}\n" +
    "5. CONFIDENTIALITY & IP. All work product, inventions and confidential information created or received under this contract belong to {{company}}. The NDA / IP assignment forms part of this contract.\n" +
    "6. TERMINATION. Either party may end this contract with {{notice}} days' written notice. {{company}} may end it immediately for breach.\n" +
    "7. RENEWAL. {{renewal_text}}\n" +
    "8. NATURE OF RELATIONSHIP. {{relationship_text}}\n" +
    "9. GOVERNING LAW. This contract is governed by the laws of {{country}}.",
};

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const daysBetween = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / DAY);
export const addDays = (d, n) => isoDate(new Date(`${d}T12:00:00`).getTime() + n * DAY);
export function weekStart(d = isoDate()) {
  const dt = new Date(`${d}T12:00:00`);
  const dow = (dt.getDay() + 6) % 7; // Monday = 0
  return isoDate(dt.getTime() - dow * DAY);
}
export const weekDays = (ws) => Array.from({ length: 7 }, (_, i) => addDays(ws, i));
export const currencyOf = (rec) => COUNTRIES.find((c) => c.code === (rec?.country_code || "IN"))?.currency || "INR";
const SYM = { INR: "₹", GBP: "£", USD: "$", EUR: "€" };
export function money(n, cur = "INR") {
  const v = (Number(n) || 0).toLocaleString(cur === "INR" ? "en-IN" : "en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${SYM[cur] || `${cur} `}${v}`;
}
export function monthKeyOf(d) {
  return String(d || "").slice(0, 7);
}
export function monthBounds(period) {
  const [y, m] = period.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { start: `${period}-01`, end: `${period}-${String(last).padStart(2, "0")}`, days: last };
}

/** Rate in force on a date (rate history from amendments). */
export function rateOn(c, date) {
  const hist = (c.rate_history || []).filter((h) => h.from <= date).sort((a, b) => b.from.localeCompare(a.from));
  return Number(hist[0]?.rate ?? c.rate) || 0;
}

/** Status shown to people: stored status plus time (starts soon / expiring / expired). */
export function contractState(c, settings = DEFAULT_CONTRACT_SETTINGS, today = isoDate()) {
  if (["draft", "pending_approval", "terminated", "renewed", "rejected", "suspended"].includes(c.status)) return c.status;
  if (c.end_date && c.end_date < today) return "expired";
  if (c.start_date > today) return "upcoming";
  if (c.end_date && daysBetween(today, c.end_date) <= (settings.renewal_alert_days || 30)) return "expiring";
  return "active";
}
export const isLive = (c, s, t) => ["active", "expiring", "upcoming"].includes(contractState(c, s, t));
export const daysLeft = (c, today = isoDate()) => (c.end_date ? daysBetween(today, c.end_date) : null);

export function contractFor(data, empCode) {
  const list = (data.contracts || []).filter((c) => c.employee_code === empCode);
  const order = ["active", "expiring", "upcoming", "suspended", "pending_approval", "draft", "expired", "terminated", "renewed", "rejected"];
  return list.sort((a, b) => order.indexOf(contractState(a, data.contractSettings)) - order.indexOf(contractState(b, data.contractSettings)) || b.id.localeCompare(a.id))[0] || null;
}

export function rateText(c) {
  const cur = c.currency || "INR";
  if (c.pay_basis === "milestone") return `Fixed fee of ${money(c.rate, cur)} paid on accepted milestones`;
  return `${money(rateOn(c, isoDate()), cur)} ${RATE_UNIT[c.pay_basis] || ""}`.trim();
}

// ── Timesheets ───────────────────────────────────────
/** Units an entry earns: hours for hourly, days for daily (≥ 4 h = 1 day, otherwise ½ day). */
export function entryUnits(c, e) {
  const h = Number(e.hours) || 0;
  if (c.pay_basis === "daily") return h <= 0 ? 0 : h >= 4 ? 1 : 0.5;
  return h;
}
export function timesheetTotals(ts) {
  const hours = r2((ts.entries || []).reduce((s, e) => s + (Number(e.hours) || 0), 0));
  const ot = r2((ts.entries || []).reduce((s, e) => s + (Number(e.ot_hours) || 0), 0));
  return { hours, ot, total: r2(hours + ot) };
}
/** Value of a timesheet at the contract rates in force on each day. */
export function timesheetValue(c, ts) {
  let base = 0;
  let ot = 0;
  (ts.entries || []).forEach((e) => {
    const rate = rateOn(c, e.date);
    const hourly = c.pay_basis === "daily" ? rate / 8 : c.pay_basis === "monthly" ? rate / ((Number(c.std_hours_week) || 40) * 52 / 12) : rate;
    if (c.pay_basis === "hourly" || c.pay_basis === "daily") base += entryUnits(c, e) * rate;
    ot += (Number(e.ot_hours) || 0) * hourly * (Number(c.ot_multiplier) || 1);
  });
  return { base: r2(base), ot: r2(ot), total: r2(base + ot) };
}
export function validateTimesheet(c, ts, settings = DEFAULT_CONTRACT_SETTINGS, today = isoDate()) {
  const errors = [];
  if (!c) return ["There is no contract for this timesheet."];
  const max = Number(settings.max_hours_week) || 60;
  const t = timesheetTotals(ts);
  if (t.total <= 0) errors.push("Enter the hours you worked.");
  if (t.total > max) errors.push(`${t.total} hours is more than the weekly maximum of ${max}. Split overtime or talk to your approver.`);
  (ts.entries || []).forEach((e) => {
    const h = Number(e.hours) || 0;
    const o = Number(e.ot_hours) || 0;
    if (h < 0 || o < 0) errors.push(`${e.date}: hours cannot be negative.`);
    if (h + o > 16) errors.push(`${e.date}: more than 16 hours in one day.`);
    if ((h || o) && (e.date < c.start_date || (c.end_date && e.date > c.end_date))) errors.push(`${e.date} is outside the contract (${c.start_date} to ${c.end_date || "open"}).`);
    if ((h || o) && e.date > today) errors.push(`${e.date} is in the future.`);
    if (o > 0 && !String(e.task || "").trim()) errors.push(`${e.date}: say what the overtime was for.`);
  });
  const oldest = addDays(weekStart(today), -7 * (Number(settings.allow_backdated_timesheets_weeks) || 4));
  if (ts.week_start < oldest) errors.push(`Timesheets older than ${settings.allow_backdated_timesheets_weeks} weeks need HR to enter them.`);
  return [...new Set(errors)];
}
export const approverOf = (c, emp) => c?.timesheet_approver || emp?.reporting_manager || null;

// ── Pay calculation ──────────────────────────────────
export function tdsRate(section) {
  return Number(TDS_SECTIONS.find(([k]) => k === section)?.[2]) || 0;
}
/** One contract's earnings for a pay month from approved, unpaid timesheets and milestones. */
export function contractPayLine(data, c, period, { lopDays = 0 } = {}) {
  const emp = data.employees.find((e) => e.employee_code === c.employee_code);
  const settings = data.contractSettings || DEFAULT_CONTRACT_SETTINGS;
  const { start, end, days } = monthBounds(period);
  // Every approved, unpaid timesheet for a week that starts on or before the month end is paid whole (no split weeks).
  const sheets = (data.timesheets || []).filter((t) => t.contract_id === c.id && t.status === "approved" && t.week_start <= end);
  const miles = (c.milestones || []).filter((m) => m.status === "approved");
  let units = 0;
  let base = 0;
  let ot = 0;
  let otHours = 0;
  if (c.pay_basis === "hourly" || c.pay_basis === "daily") {
    sheets.forEach((t) => {
      const v = timesheetValue(c, t);
      units += t.entries.reduce((s, e) => s + entryUnits(c, e), 0);
      otHours += timesheetTotals(t).ot;
      base += v.base;
      ot += v.ot;
    });
  } else if (c.pay_basis === "monthly") {
    // Pro-rate for days outside the contract in this month and approved loss-of-pay days.
    const from = c.start_date > start ? c.start_date : start;
    const to = c.end_date && c.end_date < end ? c.end_date : end;
    const active = to >= from ? daysBetween(from, to) + 1 : 0;
    const payable = Math.max(0, active - lopDays);
    units = r2(payable / days);
    base = r2(rateOn(c, start) * (payable / days));
    sheets.forEach((t) => {
      const v = timesheetValue(c, t);
      otHours += timesheetTotals(t).ot;
      ot += v.ot;
    });
  }
  const milestones = r2(miles.reduce((s, m) => s + (Number(m.amount) || 0), 0));
  const gross = r2(base + ot + milestones);
  const route = c.payment_route || payRouteOf(emp);
  const vendor = route === "vendor" ? (data.contractVendors || []).find((v) => v.id === c.vendor_id) : null;
  let markup = 0;
  let gst = 0;
  let tds = 0;
  let invoiceBase = gross;
  if (route === "vendor") {
    markup = r2(gross * ((Number(vendor?.markup_pct) || 0) / 100));
    invoiceBase = r2(gross + markup);
    gst = vendor?.gstin ? r2(invoiceBase * ((Number(settings.gst_rate) || 18) / 100)) : 0;
    tds = r2(invoiceBase * (tdsRate(c.tds_section || "194C") / 100));
  } else if (route === "invoice") {
    gst = c.gst_registered === "yes" ? r2(gross * ((Number(settings.gst_rate) || 18) / 100)) : 0;
    tds = r2(gross * (tdsRate(c.tds_section) / 100));
  }
  const net = route === "payroll" ? gross : r2(invoiceBase + gst - tds);
  const hasWork = gross > 0;
  return {
    contract_id: c.id, employee_code: c.employee_code, name: emp?.full_name || c.employee_code, route, basis: c.pay_basis, currency: c.currency || currencyOf(emp),
    units: r2(units), rate: rateOn(c, end), ot_hours: r2(otHours), base: r2(base), ot: r2(ot), milestones, gross, markup, invoice_base: invoiceBase, gst, tds, net,
    vendor_id: vendor?.id || null, timesheet_ids: sheets.map((t) => t.id), milestone_ids: miles.map((m) => m.id), lop_days: lopDays, has_work: hasWork,
    budget_left: c.budget_amount ? r2(Number(c.budget_amount) - contractSpend(data, c) - gross) : null,
  };
}
/** Everything already paid against a contract (posted runs). */
export function contractSpend(data, c) {
  return r2((data.contractRuns || []).filter((r) => r.status === "posted").flatMap((r) => r.lines).filter((l) => l.contract_id === c.id).reduce((s, l) => s + (l.route === "vendor" ? l.invoice_base : l.gross), 0));
}
export function contractHoursLogged(data, c) {
  return r2((data.timesheets || []).filter((t) => t.contract_id === c.id && ["approved", "processed"].includes(t.status)).reduce((s, t) => s + timesheetTotals(t).total, 0));
}

// ── Compliance (SAP Fieldglass / Oracle-style alerts) ──
export function contractFlags(data, c, today = isoDate()) {
  const s = data.contractSettings || DEFAULT_CONTRACT_SETTINGS;
  const emp = data.employees.find((e) => e.employee_code === c.employee_code);
  const st = contractState(c, s, today);
  const flags = [];
  const add = (level, code, text) => flags.push({ level, code, text, contract_id: c.id, employee_code: c.employee_code });
  if (["terminated", "renewed", "rejected"].includes(st)) return flags;
  const left = daysLeft(c, today);
  if (st === "expired" && c.status === "active") add("high", "expired", `Contract ended ${-left} day(s) ago but is still marked active. Renew, extend or close it.`);
  else if (left != null && left >= 0 && left <= (s.final_alert_days || 7)) add("high", "expiring", `Ends in ${left} day(s) (${c.end_date}). Decide: renew, extend or let it end.`);
  else if (left != null && left >= 0 && left <= (s.renewal_alert_days || 30)) add("medium", "expiring", `Ends in ${left} days. Renewal review due.`);
  const wt = c.worker_type || workerTypeOf(emp);
  if (s.require_nda && ["freelance", "consultant", "agency"].includes(wt) && c.nda_signed !== "yes") add("high", "nda", "NDA / IP assignment not signed.");
  if (s.require_worker_signature && !c.signed?.worker && ["active", "expiring", "upcoming"].includes(st)) add("medium", "unsigned", "The worker has not e-signed the contract yet.");
  if (c.budget_amount) {
    const spent = contractSpend(data, c);
    const pct = (spent / Number(c.budget_amount)) * 100;
    if (pct >= 100) add("high", "budget", `Budget exhausted: ${Math.round(pct)}% of ${money(c.budget_amount, c.currency)} used.`);
    else if (pct >= 80) add("medium", "budget", `${Math.round(pct)}% of the budget is used.`);
  }
  // Co-employment / misclassification signals.
  const chain = chainOf(data, c);
  const tenureMonths = Math.round(daysBetween(chain[0].start_date, today) / 30.44);
  if (SELF_EMPLOYED.includes(wt) && tenureMonths >= (s.co_employment_months || 11)) add("medium", "tenure", `Engaged continuously for ${tenureMonths} months. Review for misclassification / deemed employment.`);
  if (chain.length - 1 > (s.max_renewals || 2)) add("medium", "renewals", `Renewed ${chain.length - 1} times. Repeated fixed-term renewals can create a claim to permanency.`);
  if (SELF_EMPLOYED.includes(wt)) {
    const recent = (data.timesheets || []).filter((t) => t.contract_id === c.id && t.week_start >= addDays(weekStart(today), -28));
    const heavy = recent.filter((t) => timesheetTotals(t).total > 45).length;
    if (heavy >= 3) add("medium", "hours", `${heavy} of the last 4 weeks above 45 hours. Freelancers working full-time hours look like employees.`);
  }
  if (wt === "agency") {
    const v = (data.contractVendors || []).find((x) => x.id === c.vendor_id);
    if (!v) add("high", "vendor", "No staffing vendor linked.");
    else if (v.licence_expiry && v.licence_expiry < today) add("high", "licence", `${v.name}'s Contract Labour licence expired on ${v.licence_expiry}.`);
    else if (v.licence_expiry && daysBetween(today, v.licence_expiry) <= 30) add("medium", "licence", `${v.name}'s Contract Labour licence expires on ${v.licence_expiry}.`);
  }
  if ((emp?.country_code || "IN") === "IN" && c.payment_route !== "vendor" && !emp?.pan) add("medium", "pan", "No PAN on file: TDS must be deducted at 20% (section 206AA).");
  if (c.gst_registered === "yes" && !c.gstin && !emp?.gstin) add("medium", "gstin", "GST registered but no GSTIN.");
  const late = (data.timesheets || []).filter((t) => t.contract_id === c.id && t.status === "submitted" && daysBetween(String(t.submitted_at || today).slice(0, 10), today) > 5);
  if (late.length) add("low", "approval", `${late.length} timesheet(s) waiting more than 5 days for approval.`);
  const weekCovered = (data.timesheets || []).some((t) => t.contract_id === c.id && t.week_start === addDays(weekStart(today), -7));
  if (["hourly", "daily"].includes(c.pay_basis) && ["active", "expiring"].includes(st) && !weekCovered && c.start_date <= addDays(weekStart(today), -7)) add("low", "missing_ts", "Last week's timesheet has not been submitted.");
  return flags;
}
/** The contract and all the contracts it renewed (oldest first). */
export function chainOf(data, c) {
  const all = data.contracts || [];
  const chain = [c];
  let cur = c;
  while (cur.parent_id) {
    const p = all.find((x) => x.id === cur.parent_id);
    if (!p || chain.includes(p)) break;
    chain.unshift(p);
    cur = p;
  }
  return chain;
}
export function allContractFlags(data, today = isoDate()) {
  return (data.contracts || []).flatMap((c) => contractFlags(data, c, today));
}

// ── Contract document ────────────────────────────────
export function fillTemplate(tpl, vars) {
  return String(tpl || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (vars[k] ?? `{{${k}}}`));
}
export function contractVars(data, c, companyName) {
  const emp = data.employees.find((e) => e.employee_code === c.employee_code) || {};
  const wt = WORKER_TYPE_BY[c.worker_type || workerTypeOf(emp)];
  const approver = approverOf(c, emp);
  const nameOf = (code) => data.employees.find((e) => e.employee_code === code)?.full_name || code || "the reporting manager";
  const route = c.payment_route;
  return {
    company: companyName,
    worker: emp.full_name || c.employee_code,
    worker_type: wt?.label?.toLowerCase() || "contract worker",
    title: c.title || emp.designation || "",
    start: c.start_date,
    end: c.end_date || "until ended by notice",
    rate_text: rateText(c),
    ot_multiplier: c.ot_multiplier || 1,
    hours: c.std_hours_week || 40,
    approver: nameOf(approver),
    notice: c.notice_days || 15,
    payment_text: route === "payroll" ? "Fees are paid monthly through company payroll with a payslip." : route === "vendor" ? "Fees are invoiced by the staffing vendor, who pays the worker." : `The company issues a self-billed invoice each month and pays within ${(data.contractSettings || DEFAULT_CONTRACT_SETTINGS).payment_terms_days} days of approval.`,
    tax_text: route === "payroll" ? "Income tax is deducted at source under section 192 through payroll." : route === "vendor" ? "TDS under section 194C is deducted from the vendor's invoice." : `TDS under section ${c.tds_section || "194J"} is deducted from each payment${c.gst_registered === "yes" ? "; GST is added to fees at the applicable rate" : ""}. The worker is responsible for their own taxes and statutory filings.`,
    renewal_text: c.renewal_option === "auto" ? "This contract renews automatically for the same term unless either party gives notice." : c.renewal_option === "end" ? "This contract ends on the end date and does not renew." : !c.renewal_option || c.renewal_option === "review" ? "The parties will review renewal at least 30 days before the end date." : `On expiry: ${c.renewal_option}.`,
    relationship_text: SELF_EMPLOYED.includes(wt?.id) ? "The worker is an independent contractor, not an employee, and controls how the work is done. No employee benefits apply." : wt?.id === "agency" ? "The worker is employed by the staffing vendor. The vendor is the principal employer's contractor under the Contract Labour Act." : "The worker is a fixed-term employee of the company for the period above; statutory employee benefits apply.",
    country: COUNTRIES.find((x) => x.code === (emp.country_code || "IN"))?.name || "India",
    po_number: c.po_number || "—",
    contract_id: c.id,
  };
}

// ── Helpers for the employee form → contract ─────────
export function contractFromEmployee(emp) {
  return {
    employee_code: emp.employee_code,
    worker_type: workerTypeOf(emp),
    title: emp.designation,
    department: emp.department,
    pay_basis: emp.pay_basis || WORKER_TYPE_BY[workerTypeOf(emp)]?.basis || "monthly",
    rate: Number(emp.pay_rate) || 0,
    currency: currencyOf(emp),
    std_hours_week: Number(emp.std_hours_week) || 40,
    ot_multiplier: Number(emp.ot_multiplier) || 1,
    payment_route: emp.payment_route || payRouteOf(emp),
    vendor_id: emp.vendor_id || "",
    tds_section: emp.tds_section || WORKER_TYPE_BY[workerTypeOf(emp)]?.tds || "192",
    gst_registered: emp.gst_registered || "no",
    gstin: emp.gstin || "",
    business_name: emp.business_name || "",
    start_date: emp.date_of_joining,
    end_date: emp.fixed_term_end_date || "",
    notice_days: Number(emp.notice_period) || 15,
    renewal_option: emp.renewal_option || "review",
    po_number: emp.po_number || "",
    cost_centre: emp.cost_centre || emp.department,
    timesheet_approver: emp.timesheet_approver || "",
    nda_signed: emp.nda_signed || "no",
    billing_cycle: "monthly",
    work_location: "hybrid",
    budget_amount: "",
    deliverables: "",
  };
}
export { isContingent, workerTypeOf };
