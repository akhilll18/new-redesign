// Granular report catalogue (v8.8). Every report returns row-level data with the employee's department, location,
// country and worker type attached, so the Report centre can filter, group, total, drill down and export any of them.
// `modules`: an HR / Finance admin sees a report when they hold any of these modules. `superOnly`: Super Admin only.
import { isoDate } from "./utils.js";
import { dayAttendance, hoursInRange } from "./hrcalc.js";
import { expenseTotal, leaveBalances, SCREENOFF_REASONS } from "./requests.js";
import { payslipTotals, periodLabel } from "../data/payslipFields.js";
import { WORKER_TYPE_BY, workerTypeOf, COUNTRIES } from "../data/employeeFields.js";
import { bgvStatus } from "./collab.js";
import { contractState, rateText, timesheetTotals, timesheetValue } from "./contracts.js";

export const HR_MODULES = ["accounts", "leave", "attendance", "recruitment", "onboarding", "bgv", "performance", "workforce", "learning"];
export const FINANCE_MODULES = ["payroll", "payslips", "expense", "advance", "loan", "benefits", "assets", "contracts"];

const inRange = (d, from, to) => !!d && String(d).slice(0, 10) >= from && String(d).slice(0, 10) <= to;
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const tenure = (doj) => r2((Date.now() - new Date(`${doj}T12:00:00`)) / (365.25 * 86400000));
const countryName = (c) => COUNTRIES.find((x) => x.code === (c || "IN"))?.name || c;
const lastAction = (r) => r.history?.[r.history.length - 1];
const decidedAt = (r) => [...(r.history || [])].reverse().find((h) => ["Approved", "Rejected", "Paid", "Disbursed"].includes(h.status))?.at;
const turnaround = (r) => { const d = decidedAt(r); return d ? r2((new Date(d) - new Date(r.created_at)) / 86400000) : null; };
const approverNow = (r, nameOf) => (r.status === "Pending" ? nameOf(r.steps?.find((s) => s.status === "pending")?.approver) : "");

const C = (k, l, t = "text", extra = {}) => ({ k, l, t, ...extra });
// Columns every employee-based report can show.
const EMP_COLS = [C("employee_code", "Code"), C("employee", "Employee"), C("department", "Department"), C("location", "Location"), C("country", "Country"), C("worker_type", "Worker type")];

export const REPORT_GROUPS = ["Workforce", "Time & attendance", "Leave", "Hiring & onboarding", "Talent", "Contract workforce", "Payroll & payslips", "Expenses & loans", "Benefits & assets", "System & audit"];

export const REPORTS = [
  // ── Workforce ──
  {
    id: "headcount", group: "Workforce", name: "Headcount register", modules: HR_MODULES, date: "joined", dateNote: "Joined up to the end date",
    desc: "Every person on the roll with role, manager, grade, worker type, joining date, tenure and status.",
    columns: [...EMP_COLS, C("designation", "Job title"), C("manager", "Manager"), C("grade", "Grade"), C("doj", "Joined", "date"), C("tenure", "Tenure (yrs)", "num"), C("status", "Status")],
    build: ({ emps, nameOf, to }) => emps.filter((e) => e.date_of_joining <= to).map((e) => ({ _emp: e, _date: e.date_of_joining, designation: e.designation, manager: nameOf(e.reporting_manager) || "", grade: e.grade_code || "", doj: e.date_of_joining, tenure: tenure(e.date_of_joining), status: e.status })),
  },
  {
    id: "joiners", group: "Workforce", name: "Joiners in period", modules: HR_MODULES,
    desc: "People who joined between the dates, with source of hire and probation end.",
    columns: [...EMP_COLS, C("designation", "Job title"), C("doj", "Joined", "date"), C("source", "Recruited via"), C("probation_end", "Probation ends", "date"), C("recruitment_cost", "Hiring cost", "money")],
    build: ({ emps, from, to }) => emps.filter((e) => inRange(e.date_of_joining, from, to)).map((e) => ({ _emp: e, _date: e.date_of_joining, designation: e.designation, doj: e.date_of_joining, source: e.method_of_recruitment || "", probation_end: e.probation_end_date || "", recruitment_cost: Number(e.recruitment_cost) || 0 })),
  },
  {
    id: "exits", group: "Workforce", name: "Exits & attrition", modules: HR_MODULES,
    desc: "Leavers by department, country, type and reason.",
    columns: [C("date", "Exit date", "date"), C("department", "Department"), C("country", "Country"), C("type", "Type"), C("reason", "Reason"), C("count", "Exits", "num")],
    build: ({ data, from, to }) => (data.exits || []).filter((x) => inRange(x.d, from, to)).map((x) => ({ _date: x.d, date: x.d, department: x.dept, country: countryName(x.ctry), type: x.type, reason: x.r, count: 1 })),
  },
  {
    id: "probation", group: "Workforce", name: "Probation & reviews due", modules: HR_MODULES,
    desc: "Probation end and next review dates falling in the period.",
    columns: [...EMP_COLS, C("designation", "Job title"), C("probation_status", "Probation"), C("probation_end", "Probation ends", "date"), C("next_review", "Next review", "date"), C("manager", "Manager")],
    build: ({ emps, nameOf, from, to }) => emps.filter((e) => inRange(e.probation_end_date, from, to) || inRange(e.next_review_date, from, to)).map((e) => ({ _emp: e, _date: e.probation_end_date || e.next_review_date, designation: e.designation, probation_status: e.probation_status || "", probation_end: e.probation_end_date || "", next_review: e.next_review_date || "", manager: nameOf(e.reporting_manager) || "" })),
  },
  {
    id: "documents", group: "Workforce", name: "Employee documents", modules: ["onboarding", "bgv", "accounts"],
    desc: "Joining and statutory documents by status: missing, submitted, verified, re-upload needed.",
    columns: [...EMP_COLS, C("doc", "Document"), C("status", "Status"), C("updated", "Updated", "date"), C("reviewed_by", "Reviewed by")],
    build: ({ data, empBy, nameOf, from, to }) => (data.empDocs || []).filter((x) => empBy[x.employee_code] && (!x.updated_at || inRange(x.updated_at, from, to) || x.status !== "verified")).map((x) => ({ _emp: empBy[x.employee_code], _date: x.updated_at, _status: x.status, doc: x.doc_name, status: x.status, updated: x.updated_at || "", reviewed_by: nameOf(x.reviewed_by) || "" })),
  },
  // ── Time & attendance ──
  {
    id: "attendance-daily", group: "Time & attendance", name: "Daily attendance register", modules: ["attendance", "workforce"],
    desc: "One row per person per day: first in, last out, hours, late flag, punch source and geofence flags.",
    columns: [...EMP_COLS, C("date", "Date", "date"), C("in", "In"), C("out", "Out"), C("hours", "Net hours", "hours"), C("ot", "Overtime", "hours"), C("status", "Status"), C("source", "Source"), C("flagged", "Flag")],
    build: ({ data, emps, from, to }) => {
      const by = {};
      data.punches.forEach((p) => { const d = p.ts.slice(0, 10); if (d < from || d > to) return; (by[`${p.employee_code}|${d}`] = by[`${p.employee_code}|${d}`] || []).push(p); });
      const set = new Set(emps.map((e) => e.employee_code));
      const empBy = Object.fromEntries(emps.map((e) => [e.employee_code, e]));
      return Object.entries(by).filter(([k]) => set.has(k.split("|")[0])).map(([k, ps]) => {
        const [code, d] = k.split("|");
        const a = dayAttendance(ps);
        const status = a.open ? "Missing out-punch" : a.late ? "Late" : "On time";
        return { _emp: empBy[code], _date: d, _status: status, date: d, in: a.inT || "", out: a.outT || "", hours: r2(a.hours), ot: r2(a.ot), status, source: String(a.source || "").replace("_", " "), flagged: a.flagged ? "Outside geofence" : "" };
      });
    },
  },
  {
    id: "hours", group: "Time & attendance", name: "Worked, screen-off & total hours", modules: ["attendance", "workforce", "payroll"],
    desc: "Per person for the period: total time (first in → last out), system screen-off / idle time, worked hours, days present, average and late days.",
    columns: [...EMP_COLS, C("present", "Days present", "num"), C("worked", "Worked", "hours"), C("claimed", "Approved screen-off claims (in worked)", "hours"), C("screen_off", "Screen off", "hours"), C("total", "Total hours", "hours"), C("avg", "Avg worked / day", "hours"), C("late", "Late days", "num"), C("measured", "Days with activity data", "num")],
    build: ({ data, emps, from, to }) => emps.filter((e) => e.status === "active").map((e) => { const h = hoursInRange(data, e.employee_code, from, to); return { _emp: e, present: h.present, worked: h.worked, claimed: h.claimed, screen_off: h.screenOff, total: h.total, avg: h.avg, late: h.late, measured: h.measuredDays }; }).filter((r) => r.present > 0),
  },
  {
    id: "screenoff-claims", group: "Time & attendance", name: "Screen-off time claims", modules: ["attendance", "workforce", "payroll"],
    desc: "Screen-off time employees claimed as work: day, time claimed, reason, approver and status. Approved claims are added to worked hours.",
    columns: [...EMP_COLS, C("id", "Request"), C("date", "For date", "date"), C("hours", "Claimed", "hours"), C("reason_code", "Reason"), C("reason", "What they worked on"), C("status", "Status"), C("waiting_with", "Waiting with / decided by")],
    build: ({ data, empBy, nameOf, from, to }) => data.requests.filter((r) => r.type === "screenoff" && empBy[r.employee_code] && inRange(r.date, from, to)).map((r) => ({ _emp: empBy[r.employee_code], _date: r.date, _status: r.status, id: r.request_id, date: r.date, hours: Math.round(((r.approved_minutes ?? r.minutes) / 60) * 100) / 100, reason_code: (SCREENOFF_REASONS.find((x) => x[0] === r.reason_code) || [])[1] || r.reason_code, reason: r.reason, status: r.status, waiting_with: nameOf(r.status === "Pending" ? r.steps.find((st) => st.status === "pending")?.approver : r.steps.filter((st) => st.status !== "skipped" && st.at).slice(-1)[0]?.approver) })),
  },
  {
    id: "regularize", group: "Time & attendance", name: "Attendance corrections", modules: ["attendance", "leave"],
    desc: "Regularisation requests with the corrected times, reason and approval status.",
    columns: [...EMP_COLS, C("id", "Request"), C("date", "For date", "date"), C("in_time", "In"), C("out_time", "Out"), C("reason", "Reason"), C("status", "Status"), C("waiting_with", "Waiting with")],
    build: ({ data, empBy, nameOf, from, to }) => data.requests.filter((r) => r.type === "regularize" && empBy[r.employee_code] && inRange(r.date || r.created_at, from, to)).map((r) => ({ _emp: empBy[r.employee_code], _date: r.date, _status: r.status, id: r.request_id, date: r.date, in_time: r.in_time, out_time: r.out_time, reason: r.reason_code || r.reason, status: r.status, waiting_with: approverNow(r, nameOf) })),
  },
  // ── Leave ──
  {
    id: "leave-register", group: "Leave", name: "Leave register", modules: ["leave"],
    desc: "Every leave request in the period with type, dates, days, status, approver and turnaround.",
    columns: [...EMP_COLS, C("id", "Request"), C("leave_type", "Type"), C("from", "From", "date"), C("to", "To", "date"), C("days", "Days", "num"), C("status", "Status"), C("waiting_with", "Waiting with"), C("turnaround", "Turnaround (days)", "num")],
    build: ({ data, empBy, nameOf, from, to }) => data.requests.filter((r) => r.type === "leave" && empBy[r.employee_code] && (inRange(r.from_date, from, to) || inRange(r.to_date, from, to))).map((r) => ({ _emp: empBy[r.employee_code], _date: r.from_date, _status: r.status, id: r.request_id, leave_type: data.leaveTypes.find((t) => t.code === r.leave_type)?.name || r.leave_type, from: r.from_date, to: r.to_date, days: Number(r.days) || 0, status: r.status, waiting_with: approverNow(r, nameOf), turnaround: turnaround(r) })),
  },
  {
    id: "leave-balance", group: "Leave", name: "Leave balances", modules: ["leave"], noDate: true,
    desc: "Entitled, taken, pending and available days per person and leave type for this year.",
    columns: [...EMP_COLS, C("leave_type", "Leave type"), C("entitled", "Entitled", "num"), C("taken", "Taken", "num"), C("pending", "Pending", "num"), C("available", "Available", "num")],
    build: ({ data, emps }) => emps.filter((e) => e.status === "active" && e.leave_policy !== "none").flatMap((e) => leaveBalances(e, data.leaveTypes, data.requests).filter((b) => b.entitled != null).map((b) => ({ _emp: e, leave_type: b.name, entitled: b.entitled, taken: b.taken, pending: b.pending, available: b.available }))),
  },
  // ── Hiring & onboarding ──
  {
    id: "requisitions", group: "Hiring & onboarding", name: "Requisitions & hiring funnel", modules: ["recruitment"],
    desc: "Requisitions opened in the period with applicants, screened, interviewed, offers, acceptances, time to fill and cost.",
    columns: [C("id", "Requisition"), C("role", "Role"), C("department", "Department"), C("open", "Opened", "date"), C("closed", "Closed", "date"), C("positions", "Positions", "num"), C("applicants", "Applicants", "num"), C("screened", "Screened", "num"), C("interviewed", "Interviewed", "num"), C("offers", "Offers", "num"), C("accepted", "Accepted", "num"), C("days_to_fill", "Days to fill", "num"), C("cost", "Cost", "money")],
    build: ({ data, from, to }) => (data.reqs || []).filter((r) => inRange(r.open, from, to) || (r.open <= to && (!r.closed || r.closed >= from))).map((r) => ({ _date: r.open, _status: r.closed ? "Closed" : "Open", id: r.id, role: r.role, department: r.dept, open: r.open, closed: r.closed || "", positions: r.n, applicants: r.app, screened: r.scr, interviewed: r.int, offers: r.off, accepted: r.acc, days_to_fill: r.closed ? Math.round((new Date(r.closed) - new Date(r.open)) / 86400000) : null, cost: r.cost || 0 })),
  },
  {
    id: "candidates", group: "Hiring & onboarding", name: "Candidate pipeline", modules: ["recruitment"], noDate: true,
    desc: "Candidates by requisition, stage, source and rating.",
    columns: [C("id", "Candidate"), C("name", "Name"), C("req", "Requisition"), C("stage", "Stage"), C("source", "Source"), C("rating", "Rating", "num"), C("updated", "Updated", "date")],
    build: ({ data }) => (data.candidates || []).map((c) => ({ _status: c.stage, id: c.id, name: c.name, req: `${c.req_id} · ${(data.reqs || []).find((r) => r.id === c.req_id)?.role || ""}`, stage: c.stage, source: c.source, rating: c.rating, updated: c.updated_at })),
  },
  {
    id: "onboarding", group: "Hiring & onboarding", name: "Onboarding progress", modules: ["onboarding"], noDate: true,
    desc: "New starters with joining date, tasks done and buddy.",
    columns: [C("name", "Employee"), C("role", "Role"), C("department", "Department"), C("doj", "Joining", "date"), C("done", "Tasks done", "num"), C("tasks", "Tasks", "num"), C("pct", "Complete %", "num"), C("buddy", "Buddy")],
    build: ({ data, nameOf }) => (data.onboarding || []).map((o) => ({ _date: o.doj, name: o.name, role: o.role, department: o.dept, doj: o.doj, done: o.done.filter(Boolean).length, tasks: o.done.length, pct: Math.round((o.done.filter(Boolean).length / Math.max(1, o.done.length)) * 100), buddy: nameOf(o.buddy) })),
  },
  {
    id: "bgv", group: "Hiring & onboarding", name: "Background verification", modules: ["bgv"],
    desc: "BGV cases initiated in the period with package, status, due date and checks outstanding.",
    columns: [C("id", "Case"), C("name", "Name"), C("subject", "Subject"), C("department", "Department"), C("package", "Package"), C("initiated", "Initiated", "date"), C("due", "Due", "date"), C("status", "Status"), C("checks", "Checks", "num"), C("open_checks", "Open checks", "num")],
    build: ({ data, empBy, from, to }) => (data.bgv || []).filter((c) => !c.cancelled && (inRange(c.initiated_at, from, to) || !c.closed_status)).map((c) => ({ _emp: empBy[c.employee_code], _date: c.initiated_at, _status: bgvStatus(c), id: c.id, name: c.name, subject: c.subject_type, department: empBy[c.employee_code]?.department || "", package: c.package, initiated: c.initiated_at, due: c.due_date, status: bgvStatus(c).replace(/_/g, " "), checks: c.checks.length, open_checks: c.checks.filter((k) => !["verified", "discrepancy"].includes(k.status)).length })),
  },
  // ── Talent ──
  {
    id: "performance", group: "Talent", name: "Performance ratings", modules: ["performance"], noDate: true,
    desc: "Goals, competencies and values scores, weighted rating and potential per person.",
    columns: [...EMP_COLS, C("goals", "Goals", "num"), C("competencies", "Competencies", "num"), C("values", "Values", "num"), C("weighted", "Weighted", "num"), C("potential", "Potential", "num"), C("self_review", "Self review")],
    build: ({ data, emps }) => emps.filter((e) => data.perf?.[e.employee_code]).map((e) => { const p = data.perf[e.employee_code]; return { _emp: e, goals: p.g, competencies: p.c, values: p.v, weighted: r2(p.g * 0.5 + p.c * 0.3 + p.v * 0.2), potential: p.pot, self_review: data.reviews?.[e.employee_code]?.self ? "Submitted" : "Not yet" }; }),
  },
  {
    id: "goals", group: "Talent", name: "Goals & progress", modules: ["performance"],
    desc: "Goals due on or after the start date with weight, progress and status.",
    columns: [...EMP_COLS, C("title", "Goal"), C("weight", "Weight %", "num"), C("progress", "Progress %", "num"), C("due", "Due", "date"), C("status", "Status")],
    build: ({ data, empBy, from, to }) => (data.goals || []).filter((g) => empBy[g.employee_code] && g.due >= from).map((g) => ({ _emp: empBy[g.employee_code], _date: g.due, _status: g.status, title: g.title, weight: g.weight, progress: g.progress, due: g.due, status: g.status.replace(/_/g, " ") })),
  },
  // ── Contract workforce ──
  {
    id: "contracts", group: "Contract workforce", name: "Contract register", modules: ["contracts", "payroll"],
    desc: "Contracts live in the period with rate, term, payment route, budget and status.",
    columns: [...EMP_COLS, C("id", "Contract"), C("title", "Title"), C("rate", "Rate"), C("start", "Start", "date"), C("end", "End", "date"), C("route", "Paid via"), C("budget", "Budget", "money"), C("status", "Status")],
    build: ({ data, empBy, from, to }) => (data.contracts || []).filter((c) => empBy[c.employee_code] && c.start_date <= to && (!c.end_date || c.end_date >= from)).map((c) => { const st = contractState(c, data.contractSettings); return { _emp: empBy[c.employee_code], _date: c.start_date, _status: st, id: c.id, title: c.title, rate: rateText(c), start: c.start_date, end: c.end_date || "", route: c.payment_route, budget: Number(c.budget_amount) || 0, status: st.replace("_", " ") }; }),
  },
  {
    id: "timesheets", group: "Contract workforce", name: "Contractor timesheets", modules: ["contracts", "payroll", "attendance"],
    desc: "Weekly timesheets with hours, overtime, value and approval status.",
    columns: [...EMP_COLS, C("id", "Timesheet"), C("week", "Week of", "date"), C("hours", "Hours", "hours"), C("ot", "Overtime", "hours"), C("value", "Value", "money"), C("status", "Status"), C("approver", "Approver")],
    build: ({ data, empBy, nameOf, from, to }) => (data.timesheets || []).filter((t) => empBy[t.employee_code] && inRange(t.week_start, from, to)).map((t) => { const c = (data.contracts || []).find((x) => x.id === t.contract_id); const tt = timesheetTotals(t); return { _emp: empBy[t.employee_code], _date: t.week_start, _status: t.status, id: t.id, week: t.week_start, hours: tt.hours, ot: tt.ot, value: c ? timesheetValue(c, t).total : 0, status: t.status, approver: nameOf(t.approver) || "" }; }),
  },
  {
    id: "contractor-pay", group: "Contract workforce", name: "Contractor payments", modules: ["contracts", "payroll"],
    desc: "Contractor pay-run lines by month: units, base, overtime, milestones, markup, GST, TDS and net.",
    columns: [...EMP_COLS, C("run", "Run"), C("month", "Month"), C("route", "Paid via"), C("units", "Units", "num"), C("base", "Base", "money"), C("ot", "Overtime", "money"), C("milestones", "Milestones", "money"), C("markup", "Markup", "money"), C("gst", "GST", "money"), C("tds", "TDS", "money"), C("net", "Net / cost", "money")],
    build: ({ data, empBy, from, to }) => (data.contractRuns || []).filter((r) => r.status === "posted" && `${r.period}-15` >= from.slice(0, 8) + "01" && r.period <= to.slice(0, 7)).flatMap((r) => r.lines.filter((l) => empBy[l.employee_code]).map((l) => ({ _emp: empBy[l.employee_code], _date: `${r.period}-01`, run: r.id, month: periodLabel(r.period), route: l.route, units: l.units, base: l.base, ot: l.ot, milestones: l.milestones, markup: l.markup, gst: l.gst, tds: l.tds, net: l.net }))),
  },
  {
    id: "contract-invoices", group: "Contract workforce", name: "Contractor invoices & TDS", modules: ["payroll", "contracts"],
    desc: "Self-billed and vendor invoices: subtotal, GST, TDS (194J / 194C), net, due and payment reference.",
    columns: [C("id", "Invoice"), C("kind", "Kind"), C("party", "Party"), C("month", "Month"), C("subtotal", "Subtotal", "money"), C("gst", "GST", "money"), C("tds", "TDS", "money"), C("net", "Net payable", "money"), C("due", "Due", "date"), C("status", "Status"), C("utr", "UTR")],
    build: ({ data, nameOf, from, to }) => (data.contractInvoices || []).filter((i) => inRange(i.issued_at, from, to) || i.status === "approved").map((i) => ({ _date: i.issued_at, _status: i.status, id: i.id, kind: i.kind === "vendor" ? "Vendor" : "Self-billed", party: i.employee_code ? nameOf(i.employee_code) : (data.contractVendors || []).find((v) => v.id === i.vendor_id)?.name || i.vendor_id, month: periodLabel(i.period), subtotal: i.subtotal, gst: i.gst, tds: i.tds, net: i.net_payable, due: i.due_date, status: i.status, utr: i.utr || "" })),
  },
  // ── Payroll & payslips ──
  {
    id: "payslip-register", group: "Payroll & payslips", name: "Payslip register", modules: ["payroll", "payslips"],
    desc: "Every payslip in months within the period: days, gross, contributions, deductions, reimbursements and net, by run status.",
    columns: [...EMP_COLS, C("run", "Run"), C("month", "Month"), C("run_status", "Run status"), C("days", "Days payable", "num"), C("lop", "LOP days", "num"), C("gross", "Gross (A)", "money"), C("contrib", "Contributions (B)", "money"), C("deductions", "Taxes & deductions (C)", "money"), C("reimb", "Reimbursements", "money"), C("net", "Net payable", "money")],
    build: ({ data, empBy, from, to }) => (data.payslipBatches || []).filter((b) => b.period >= from.slice(0, 7) && b.period <= to.slice(0, 7)).flatMap((b) => b.slips.filter((s) => empBy[s.employee_code]).map((s) => { const t = payslipTotals(s.values, b.components); return { _emp: empBy[s.employee_code], _date: `${b.period}-01`, _status: b.status, run: b.id, month: periodLabel(b.period), run_status: b.status, days: s.days_payable, lop: s.lop_days, gross: t.A, contrib: t.B, deductions: t.C, reimb: t.R, net: t.payable }; })),
  },
  {
    id: "statutory", group: "Payroll & payslips", name: "Statutory deductions (PF, ESI, PT, TDS)", modules: ["payroll"],
    desc: "Employee PF, ESI, professional tax and TDS per payslip — for ECR, ESI, PT and 24Q returns.",
    columns: [...EMP_COLS, C("month", "Month"), C("uan", "UAN"), C("pan", "PAN"), C("basic", "Basic", "money"), C("pf", "PF employee", "money"), C("esi", "ESI employee", "money"), C("pt", "Professional tax", "money"), C("tds", "TDS", "money")],
    build: ({ data, empBy, from, to }) => (data.payslipBatches || []).filter((b) => b.status !== "Rejected" && b.period >= from.slice(0, 7) && b.period <= to.slice(0, 7)).flatMap((b) => b.slips.filter((s) => empBy[s.employee_code]).map((s) => ({ _emp: empBy[s.employee_code], _date: `${b.period}-01`, month: periodLabel(b.period), uan: s.emp?.uan || "", pan: s.emp?.pan || "", basic: Number(s.values.BASIC) || 0, pf: Number(s.values.PF_EE) || 0, esi: Number(s.values.ESI_EE) || 0, pt: Number(s.values.PT) || 0, tds: Number(s.values.TDS) || 0 }))),
  },
  {
    id: "bank-transfer", group: "Payroll & payslips", name: "Bank transfer advice", modules: ["payroll"],
    desc: "Net pay per person with bank, IFSC and masked account for approved and released runs.",
    columns: [...EMP_COLS, C("month", "Month"), C("bank", "Bank"), C("ifsc", "IFSC"), C("account", "Account"), C("net", "Net payable", "money"), C("run_status", "Run status")],
    build: ({ data, empBy, from, to }) => (data.payslipBatches || []).filter((b) => ["Approved", "Released"].includes(b.status) && b.period >= from.slice(0, 7) && b.period <= to.slice(0, 7)).flatMap((b) => b.slips.filter((s) => empBy[s.employee_code]).map((s) => ({ _emp: empBy[s.employee_code], _date: `${b.period}-01`, month: periodLabel(b.period), bank: s.emp?.bank_name || "", ifsc: s.emp?.bank_ifsc || "", account: s.emp?.bank_account ? `••••${String(s.emp.bank_account).slice(-4)}` : "", net: payslipTotals(s.values, b.components).payable, run_status: b.status }))),
  },
  {
    id: "salary-cost", group: "Payroll & payslips", name: "Salary cost (CTC)", modules: ["payroll"], noDate: true,
    desc: "Monthly gross and annual CTC per person in local currency, with grade and worker type.",
    columns: [...EMP_COLS, C("grade", "Grade"), C("currency", "Currency"), C("monthly", "Monthly gross", "money"), C("annual", "Annual CTC", "money")],
    build: ({ emps }) => emps.filter((e) => e.status === "active").map((e) => ({ _emp: e, grade: e.grade_code || "", currency: COUNTRIES.find((c) => c.code === (e.country_code || "IN"))?.currency || "INR", monthly: Number(e.monthly_gross) || 0, annual: (Number(e.monthly_gross) || 0) * 12 })),
  },
  {
    id: "revisions", group: "Payroll & payslips", name: "Salary revisions", modules: ["payroll"],
    desc: "Revisions effective in the period: old and new gross, increase %, reason, arrears and status.",
    columns: [...EMP_COLS, C("id", "Revision"), C("effective", "Effective", "date"), C("old", "Old gross", "money"), C("new", "New gross", "money"), C("pct", "Increase %", "num"), C("reason", "Reason"), C("arrears", "Arrears", "money"), C("status", "Status")],
    build: ({ data, empBy, from, to }) => (data.salaryRevisions || []).filter((r) => empBy[r.employee_code] && inRange(r.effective, from, to)).map((r) => ({ _emp: empBy[r.employee_code], _date: r.effective, _status: r.status, id: r.id, effective: r.effective, old: r.old_gross, new: r.new_gross, pct: r.pct, reason: r.reason, arrears: r.arrears || 0, status: r.status })),
  },
  // ── Expenses & loans ──
  {
    id: "expenses", group: "Expenses & loans", name: "Expense claims", modules: ["expense"],
    desc: "Claims raised in the period with title, amount, status, who it is waiting with and turnaround.",
    columns: [...EMP_COLS, C("id", "Claim"), C("title", "Title"), C("date", "Raised", "date"), C("amount", "Amount", "money"), C("status", "Status"), C("waiting_with", "Waiting with"), C("turnaround", "Turnaround (days)", "num")],
    build: ({ data, empBy, nameOf, from, to }) => data.requests.filter((r) => r.type === "expense" && empBy[r.employee_code] && inRange(r.created_at, from, to)).map((r) => ({ _emp: empBy[r.employee_code], _date: r.created_at, _status: r.status, id: r.request_id, title: r.title || "", date: r.created_at, amount: expenseTotal(r.items || []), status: r.status, waiting_with: approverNow(r, nameOf), turnaround: turnaround(r) })),
  },
  {
    id: "advances-loans", group: "Expenses & loans", name: "Advances & loans", modules: ["advance", "loan"],
    desc: "Salary advances and loans: amount, tenure, EMI, repaid and outstanding.",
    columns: [...EMP_COLS, C("id", "Request"), C("kind", "Kind"), C("date", "Raised", "date"), C("amount", "Amount", "money"), C("months", "Months", "num"), C("emi", "EMI", "money"), C("repaid", "Repaid", "money"), C("outstanding", "Outstanding", "money"), C("status", "Status")],
    build: ({ data, empBy, from, to }) => data.requests.filter((r) => ["advance", "loan"].includes(r.type) && empBy[r.employee_code] && (inRange(r.created_at, from, to) || r.status === "Disbursed")).map((r) => {
      const amount = Number(r.approved_amount || r.amount || r.request_amount) || 0;
      const months = Number(r.tenure_months || r.months) || 1;
      const ledger = data.loanLedger?.[r.request_id];
      const repaid = (ledger?.repayments || []).reduce((s, x) => s + (Number(x.amount) || 0), 0);
      return { _emp: empBy[r.employee_code], _date: r.created_at, _status: r.status, id: r.request_id, kind: r.type, date: r.created_at, amount, months, emi: Number(r.emi) || r2(amount / months), repaid, outstanding: r.status === "Disbursed" ? Math.max(0, amount - repaid) : 0, status: r.status };
    }),
  },
  {
    id: "fbp-claims", group: "Expenses & loans", name: "Flexible-benefit claims", modules: ["payroll", "benefits"],
    desc: "Component claims (fuel, telephone, meals …) with bill date, amount and status.",
    columns: [...EMP_COLS, C("id", "Claim"), C("component", "Component"), C("bill_date", "Bill date", "date"), C("amount", "Amount", "money"), C("status", "Status")],
    build: ({ data, empBy, from, to }) => (data.componentClaims || []).filter((c) => empBy[c.employee_code] && inRange(c.bill_date || c.submitted_at, from, to)).map((c) => ({ _emp: empBy[c.employee_code], _date: c.bill_date, _status: c.status, id: c.id, component: c.component, bill_date: c.bill_date, amount: Number(c.amount) || 0, status: c.status })),
  },
  // ── Benefits & assets ──
  {
    id: "benefits", group: "Benefits & assets", name: "Benefits enrolment", modules: ["benefits"], noDate: true,
    desc: "Health tier and NPS % per person.",
    columns: [...EMP_COLS, C("tier", "Health tier"), C("nps", "NPS %", "num")],
    build: ({ data, emps }) => emps.filter((e) => e.status === "active" && data.benefits?.[e.employee_code]).map((e) => { const b = data.benefits[e.employee_code]; return { _emp: e, tier: (data.healthTiers || {})[b.tier]?.l || b.tier, nps: b.nps, meal: b.meal ? "Yes" : "No" }; }),
  },
  {
    id: "assets", group: "Benefits & assets", name: "Asset register", modules: ["assets"], noDate: true,
    desc: "Every asset with category, model, cost, holder, assignment date, acknowledgement and warranty.",
    columns: [C("id", "Asset"), C("category", "Category"), C("model", "Model"), C("status", "Status"), C("holder", "Assigned to"), C("department", "Department"), C("assigned_on", "Assigned", "date"), C("acknowledged", "Acknowledged"), C("cost", "Cost", "money"), C("warranty_end", "Warranty ends", "date")],
    build: ({ data, empBy, nameOf }) => (data.assets || []).map((a) => ({ _emp: empBy[a.assigned_to], _status: a.status, id: a.asset_id, category: a.category, model: a.model, status: a.status, holder: a.assigned_to ? nameOf(a.assigned_to) : "", department: empBy[a.assigned_to]?.department || "", assigned_on: a.assigned_on || "", acknowledged: a.assigned_to ? (a.acknowledged ? "Yes" : "No") : "", cost: Number(a.cost) || 0, warranty_end: a.warranty_end || "" })),
  },
  // ── System & audit (Super Admin) ──
  {
    id: "approvals", group: "System & audit", name: "Approvals turnaround (all requests)", superOnly: true,
    desc: "Every request in the period across leave, expenses, advances, loans, corrections and assets with stage and turnaround.",
    columns: [...EMP_COLS, C("id", "Request"), C("type", "Type"), C("date", "Raised", "date"), C("status", "Status"), C("waiting_with", "Waiting with"), C("last", "Last action"), C("turnaround", "Turnaround (days)", "num")],
    build: ({ data, empBy, nameOf, from, to }) => data.requests.filter((r) => empBy[r.employee_code] && inRange(r.created_at, from, to)).map((r) => ({ _emp: empBy[r.employee_code], _date: r.created_at, _status: r.status, id: r.request_id, type: r.type, date: r.created_at, status: r.status, waiting_with: approverNow(r, nameOf), last: lastAction(r)?.status || "", turnaround: turnaround(r) })),
  },
  {
    id: "audit", group: "System & audit", name: "Audit log", superOnly: true,
    desc: "Every audited action in the period with user, role, action, IP and device.",
    columns: [C("when", "When", "datetime"), C("user", "User"), C("role", "Role"), C("action", "Action"), C("details", "Details"), C("ip", "IP"), C("device", "Device")],
    build: ({ data, nameOf, from, to }) => data.audit.filter((a) => inRange(a.timestamp, from, to)).map((a) => ({ _date: a.timestamp, _status: a.action, when: a.timestamp, user: `${nameOf(a.user_code)} (${a.user_code})`, role: a.role, action: a.action, details: a.details, ip: a.ip, device: a.device })),
  },
  {
    id: "logins", group: "System & audit", name: "Sign-in activity", superOnly: true,
    desc: "Successful and failed sign-ins, MFA and lockouts in the period.",
    columns: [C("when", "When", "datetime"), C("user", "User"), C("role", "Role"), C("event", "Event"), C("details", "Details"), C("ip", "IP"), C("device", "Device")],
    build: ({ data, nameOf, from, to }) => data.audit.filter((a) => /LOGIN|MFA|LOCK|PASSWORD|SESSION|PIN/.test(a.action) && inRange(a.timestamp, from, to)).map((a) => ({ _date: a.timestamp, _status: a.action, when: a.timestamp, user: `${nameOf(a.user_code)} (${a.user_code})`, role: a.role, event: a.action, details: a.details, ip: a.ip, device: a.device })),
  },
  {
    id: "access", group: "System & audit", name: "User access & modules", superOnly: true, noDate: true,
    desc: "Every login (employees, admins, Super Admins) with status, MFA, modules, permissions and last sign-in.",
    columns: [C("code", "Code"), C("name", "Name"), C("kind", "Account type"), C("status", "Status"), C("mfa", "MFA"), C("modules", "Modules"), C("permissions", "Permissions"), C("org_units", "Scope"), C("last_login", "Last sign-in", "datetime")],
    build: ({ data }) => [
      ...data.superAdmins.map((a) => ({ _status: a.status, code: a.superadmin_code, name: a.full_name, kind: "Super Admin", status: a.status, mfa: "PIN + OTP", modules: "All", permissions: "All", org_units: "All", last_login: a.last_login || "" })),
      ...data.admins.map((a) => ({ _status: a.status, code: a.admin_code, name: a.full_name, kind: "Admin", status: a.status, mfa: a.mfa_status, modules: (a.modules || []).join(", "), permissions: (a.permissions_scope || []).join(", "), org_units: (a.org_units || []).join(", "), last_login: a.last_login || "" })),
      ...data.employees.map((e) => ({ _emp: e, _status: e.status, code: e.employee_code, name: e.full_name, kind: "Employee", status: e.status, mfa: "—", modules: "Self-service", permissions: "", org_units: e.department, last_login: e.last_login || "" })),
    ],
  },
];

// ── v10.5 report gallery helpers ──
const SHIFT_GRACE = { general: "09:45", morning: "06:15", night: "21:15" };
const SHIFT_END = { general: "18:30", morning: "15:00", night: "06:00" };
const dayList = (from, to) => { const out = []; for (let d = new Date(`${from}T12:00:00`); isoDate(d) <= to && out.length < 400; d.setDate(d.getDate() + 1)) out.push(isoDate(d)); return out; };
const isWeekend = (d) => [0, 6].includes(new Date(`${d}T12:00:00`).getDay());
function punchIndex(data, from, to) {
  const by = {};
  (data.punches || []).forEach((p) => { const d = p.ts.slice(0, 10); if (d < from || d > to) return; (by[`${p.employee_code}|${d}`] = by[`${p.employee_code}|${d}`] || []).push(p); });
  return by;
}
function leaveIndex(data) {
  const by = {};
  data.requests.filter((r) => r.type === "leave" && r.status === "Approved").forEach((r) => dayList(r.from_date, r.to_date).forEach((d) => { by[`${r.employee_code}|${d}`] = r; }));
  return by;
}
const holidaySet = (data) => new Set((data.holidays || []).filter((h) => h.type !== "optional").map((h) => h.date));
const workedFrom = (e, d) => !e.date_of_joining || e.date_of_joining <= d;
/** One status per person per working day: Present, Late, Missing out-punch, On leave, Absent. */
function dailyStatus(data, emps, from, to) {
  const P = punchIndex(data, from, to), L = leaveIndex(data), H = holidaySet(data);
  const today = isoDate();
  const days = dayList(from, to > today ? today : to).filter((d) => !isWeekend(d) && !H.has(d));
  const out = [];
  emps.filter((e) => e.status === "active").forEach((e) => days.forEach((d) => {
    if (!workedFrom(e, d)) return;
    const ps = P[`${e.employee_code}|${d}`];
    const lv = L[`${e.employee_code}|${d}`];
    const a = ps ? dayAttendance(ps, { grace: SHIFT_GRACE[e.shift] || "09:45" }) : null;
    const status = a ? (a.open ? "Missing out-punch" : a.late ? "Late" : "Present") : lv ? "On leave" : d === today ? "Not in yet" : "Absent";
    out.push({ e, d, a, lv, status });
  }));
  return out;
}

export const GALLERY_REPORTS = [
  {
    id: "monthly-att-summary", group: "Time & attendance", name: "Monthly attendance summary", modules: ["attendance", "workforce", "payroll"], gallery: "calendar",
    desc: "Per person per month: working days, present, late, on leave, absent, missing punches, worked and overtime hours.",
    columns: [...EMP_COLS, C("month", "Month"), C("working", "Working days", "num"), C("present", "Present", "num"), C("late", "Late", "num"), C("leave", "On leave", "num"), C("absent", "Absent", "num"), C("missing", "Missing punch", "num"), C("hours", "Worked", "hours"), C("ot", "Overtime", "hours")],
    build: ({ data, emps, from, to }) => {
      const agg = {};
      dailyStatus(data, emps, from, to).forEach(({ e, d, a, status }) => {
        const k = `${e.employee_code}|${d.slice(0, 7)}`;
        const x = (agg[k] = agg[k] || { _emp: e, _date: `${d.slice(0, 7)}-01`, month: d.slice(0, 7), working: 0, present: 0, late: 0, leave: 0, absent: 0, missing: 0, hours: 0, ot: 0 });
        x.working++;
        if (["Present", "Late", "Missing out-punch"].includes(status)) x.present++;
        if (status === "Late") x.late++;
        if (status === "On leave") x.leave++;
        if (status === "Absent") x.absent++;
        if (status === "Missing out-punch") x.missing++;
        if (a) { x.hours = r2(x.hours + a.hours); x.ot = r2(x.ot + a.ot); }
      });
      return Object.values(agg);
    },
  },
  {
    id: "monthly-att-detail", group: "Time & attendance", name: "Monthly attendance detail", modules: ["attendance", "workforce"], gallery: "calendar",
    desc: "Every working day for every person — including absences and leave — with in / out, hours and status.",
    columns: [...EMP_COLS, C("date", "Date", "date"), C("shift", "Shift"), C("in", "In"), C("out", "Out"), C("hours", "Hours", "hours"), C("status", "Status"), C("leave", "Leave type")],
    build: ({ data, emps, from, to }) => dailyStatus(data, emps, from, to).map(({ e, d, a, lv, status }) => ({ _emp: e, _date: d, _status: status, date: d, shift: e.shift || "general", in: a?.inT || "", out: a?.outT || "", hours: r2(a?.hours || 0), status, leave: lv ? data.leaveTypes.find((t) => t.code === lv.leave_type)?.name || lv.leave_type : "" })),
  },
  {
    id: "assignment-detail", group: "Time & attendance", name: "Monthly assignment detail", modules: ["attendance", "workforce"], noDate: true, gallery: "calendar",
    desc: "Who is assigned to which shift, work schedule, attendance method, geofence and manager.",
    columns: [...EMP_COLS, C("shift", "Shift"), C("schedule", "Work schedule"), C("method", "Attendance method"), C("geofence", "Geofence"), C("biometric", "Biometric ID"), C("manager", "Manager")],
    build: ({ data, emps, nameOf }) => emps.filter((e) => e.status === "active").map((e) => ({ _emp: e, shift: e.shift || "", schedule: String(e.employment_type || "").replace("_", " "), method: String(e.attendance_mode || "").replace("_", " "), geofence: (data.geofences || []).find((g) => g.id === e.primary_geofence)?.name || "", biometric: e.biometric_id || "", manager: nameOf(e.reporting_manager) || "" })),
  },
  {
    id: "missing-clockings", group: "Time & attendance", name: "Missing clock-in / clock-out", modules: ["attendance", "workforce"], gallery: "calendar",
    desc: "Working days with no punch and no approved leave, or a clock-in without a clock-out.",
    columns: [...EMP_COLS, C("date", "Date", "date"), C("issue", "Issue"), C("in", "In"), C("manager", "Manager")],
    build: ({ data, emps, nameOf, from, to }) => dailyStatus(data, emps, from, to).filter((x) => ["Absent", "Missing out-punch"].includes(x.status)).map(({ e, d, a, status }) => ({ _emp: e, _date: d, _status: status, date: d, issue: status === "Absent" ? "No clock-in" : "No clock-out", in: a?.inT || "", manager: nameOf(e.reporting_manager) || "" })),
  },
  {
    id: "not-assigned", group: "Time & attendance", name: "Employees without a shift or geofence", modules: ["attendance", "workforce"], noDate: true, gallery: "calendar",
    desc: "Active people missing a shift, attendance method, work geofence or biometric enrolment.",
    columns: [...EMP_COLS, C("missing", "Missing"), C("method", "Attendance method")],
    build: ({ emps }) => emps.filter((e) => e.status === "active").map((e) => ({ e, miss: [!e.shift && "shift", !e.attendance_mode && "attendance method", !e.primary_geofence && "geofence", e.attendance_mode === "biometric" && !e.biometric_id && "biometric ID"].filter(Boolean) })).filter((x) => x.miss.length).map(({ e, miss }) => ({ _emp: e, missing: miss.join(", "), method: e.attendance_mode || "" })),
  },
  {
    id: "overtime", group: "Time & attendance", name: "Overtime hours", modules: ["attendance", "workforce", "payroll"], gallery: "calendar",
    desc: "Hours above the shift per person: overtime hours, days with overtime and whether the grade is overtime-eligible.",
    columns: [...EMP_COLS, C("grade", "Grade"), C("eligible", "OT eligible"), C("days", "Days with OT", "num"), C("ot", "Overtime", "hours"), C("worked", "Worked", "hours")],
    build: ({ data, emps, from, to }) => {
      const agg = {};
      dailyStatus(data, emps, from, to).forEach(({ e, a }) => { if (!a) return; const x = (agg[e.employee_code] = agg[e.employee_code] || { _emp: e, grade: e.grade_code || "", eligible: ["P1", "P2"].includes(e.grade_code) ? "Yes" : "No", days: 0, ot: 0, worked: 0 }); x.worked = r2(x.worked + a.hours); if (a.ot > 0.25) { x.days++; x.ot = r2(x.ot + a.ot); } });
      return Object.values(agg).filter((x) => x.ot > 0).sort((a, b) => b.ot - a.ot);
    },
  },
  {
    id: "late-early", group: "Time & attendance", name: "Late arrivals & early leavers", modules: ["attendance", "workforce"], gallery: "calendar",
    desc: "Days a person clocked in after the grace time or left before the shift end.",
    columns: [...EMP_COLS, C("date", "Date", "date"), C("shift", "Shift"), C("in", "In"), C("out", "Out"), C("issue", "Issue")],
    build: ({ data, emps, from, to }) => dailyStatus(data, emps, from, to).filter(({ e, a }) => a && (a.late || (a.outT && (e.shift || "general") !== "night" && a.outT < (SHIFT_END[e.shift] || "18:30")))).map(({ e, d, a }) => ({ _emp: e, _date: d, date: d, shift: e.shift || "general", in: a.inT, out: a.outT || "", issue: [a.late && "Late in", a.outT && a.outT < (SHIFT_END[e.shift] || "18:30") && "Early out"].filter(Boolean).join(" · ") })),
  },
  {
    id: "on-shift-today", group: "Time & attendance", name: "Who is working today", modules: ["attendance", "workforce"], noDate: true, gallery: "calendar",
    desc: "Today's roster: everyone expected at work with shift, clock-in time and status (present, late, on leave, not in yet).",
    columns: [...EMP_COLS, C("shift", "Shift"), C("in", "Clock-in"), C("status", "Status"), C("manager", "Manager")],
    build: ({ data, emps, nameOf }) => { const t = isoDate(); return dailyStatus(data, emps, t, t).map(({ e, a, status }) => ({ _emp: e, _status: status, shift: e.shift || "general", in: a?.inT || "", status, manager: nameOf(e.reporting_manager) || "" })); },
  },
  {
    id: "highest-leave", group: "Leave", name: "Highest leave takers", modules: ["leave"], gallery: "leave",
    desc: "People ranked by approved leave days in the period, with the number of spells and the Bradford factor (spells² × days) for unplanned absence.",
    columns: [...EMP_COLS, C("days", "Leave days", "num"), C("spells", "Spells", "num"), C("unplanned", "Unplanned days (SL / LOP)", "num"), C("bradford", "Bradford factor", "num")],
    build: ({ data, empBy, from, to }) => {
      const agg = {};
      data.requests.filter((r) => r.type === "leave" && r.status === "Approved" && empBy[r.employee_code] && (inRange(r.from_date, from, to) || inRange(r.to_date, from, to))).forEach((r) => {
        const x = (agg[r.employee_code] = agg[r.employee_code] || { _emp: empBy[r.employee_code], days: 0, spells: 0, unplanned: 0, uSpells: 0 });
        x.days += r.days; x.spells++;
        if (["SL", "LOP"].includes(r.leave_type)) { x.unplanned += r.days; x.uSpells++; }
      });
      return Object.values(agg).map((x) => ({ ...x, bradford: x.uSpells * x.uSpells * x.unplanned })).sort((a, b) => b.days - a.days);
    },
  },
  {
    id: "holiday-outlook", group: "Leave", name: "Holiday outlook", modules: ["leave"], gallery: "beach",
    desc: "Who is away when: approved and pending leave plus public holidays falling in the period.",
    columns: [C("date", "From", "date"), C("to", "To", "date"), C("employee", "Employee"), C("department", "Department"), C("what", "What"), C("days", "Days", "num"), C("status", "Status")],
    build: ({ data, empBy, from, to }) => [
      ...data.requests.filter((r) => r.type === "leave" && ["Approved", "Pending"].includes(r.status) && empBy[r.employee_code] && (inRange(r.from_date, from, to) || inRange(r.to_date, from, to))).map((r) => ({ _emp: empBy[r.employee_code], _date: r.from_date, _status: r.status, date: r.from_date, to: r.to_date, what: data.leaveTypes.find((t) => t.code === r.leave_type)?.name || r.leave_type, days: r.days, status: r.status })),
      ...(data.holidays || []).filter((h) => inRange(h.date, from, to)).map((h) => ({ _date: h.date, date: h.date, to: h.date, employee: "Everyone", department: "All", what: `${h.name}${h.type === "optional" ? " (optional)" : ""}`, days: 1, status: "Public holiday" })),
    ].sort((a, b) => String(a.date).localeCompare(String(b.date))),
  },
  {
    id: "staff-turnover", group: "Workforce", name: "Staff turnover", modules: HR_MODULES, gallery: "people",
    desc: "Month by month: headcount at the start, joiners, leavers and turnover rate.",
    columns: [C("month", "Month"), C("start", "Headcount at start", "num"), C("joiners", "Joiners", "num"), C("leavers", "Leavers", "num"), C("end", "Headcount at end", "num"), C("rate", "Turnover %", "num")],
    build: ({ data, emps, from, to }) => {
      const months = [...new Set(dayList(from, to).map((d) => d.slice(0, 7)))];
      return months.map((m) => {
        const start = `${m}-01`, end = `${m}-31`;
        const onRoll = (d) => emps.filter((e) => e.date_of_joining && e.date_of_joining < d && e.status !== "rejected").length;
        const joiners = emps.filter((e) => String(e.date_of_joining || "").startsWith(m)).length;
        const leavers = (data.exits || []).filter((x) => String(x.d || "").startsWith(m)).length;
        const s0 = onRoll(start);
        const e0 = Math.max(0, onRoll(end) + joiners * 0 - leavers);
        return { _date: start, month: m, start: s0, joiners, leavers, end: e0, rate: s0 ? r2((leavers / ((s0 + e0) / 2 || 1)) * 100) : 0 };
      });
    },
  },
  {
    id: "headcount-overview", group: "Workforce", name: "Headcount overview", modules: HR_MODULES, noDate: true, gallery: "people",
    desc: "Active headcount by department with worker-type mix, gender split and average tenure.",
    columns: [C("department", "Department"), C("total", "Headcount", "num"), C("permanent", "Permanent", "num"), C("contingent", "Contract / freelance / intern", "num"), C("female", "Female", "num"), C("male", "Male", "num"), C("tenure", "Avg tenure (yrs)", "num")],
    build: ({ emps }) => {
      const by = {};
      emps.filter((e) => e.status === "active").forEach((e) => { const x = (by[e.department] = by[e.department] || { department: e.department, total: 0, permanent: 0, contingent: 0, female: 0, male: 0, t: 0 }); x.total++; workerTypeOf(e) === "permanent" ? x.permanent++ : x.contingent++; if (e.gender === "F") x.female++; if (e.gender === "M") x.male++; x.t += e.date_of_joining ? tenure(e.date_of_joining) : 0; });
      return Object.values(by).map((x) => ({ ...x, tenure: r2(x.t / x.total) })).sort((a, b) => b.total - a.total);
    },
  },
  {
    id: "top-earners", group: "Payroll & payslips", name: "Top earners", modules: ["payroll"], noDate: true, gallery: "money",
    desc: "People ranked by monthly gross with annual CTC, grade and tenure.",
    columns: [...EMP_COLS, C("designation", "Job title"), C("grade", "Grade"), C("gross", "Monthly gross", "money"), C("annual", "Annual gross", "money"), C("tenure", "Tenure (yrs)", "num")],
    build: ({ emps }) => emps.filter((e) => e.status === "active" && Number(e.monthly_gross) > 0).sort((a, b) => b.monthly_gross - a.monthly_gross).map((e) => ({ _emp: e, designation: e.designation, grade: e.grade_code || "", gross: Number(e.monthly_gross), annual: Number(e.monthly_gross) * 12, tenure: e.date_of_joining ? tenure(e.date_of_joining) : 0 })),
  },
  {
    id: "gender-pay", group: "Payroll & payslips", name: "Gender pay gap", modules: ["payroll"], noDate: true, gallery: "money",
    desc: "Average monthly gross for women and men by department, and the gap.",
    columns: [C("department", "Department"), C("women", "Women", "num"), C("men", "Men", "num"), C("avg_f", "Avg gross (women)", "money"), C("avg_m", "Avg gross (men)", "money"), C("gap", "Gap %", "num")],
    build: ({ emps }) => {
      const by = {};
      emps.filter((e) => e.status === "active" && Number(e.monthly_gross) > 0).forEach((e) => { const x = (by[e.department] = by[e.department] || { department: e.department, women: 0, men: 0, sf: 0, sm: 0 }); if (e.gender === "F") { x.women++; x.sf += Number(e.monthly_gross); } if (e.gender === "M") { x.men++; x.sm += Number(e.monthly_gross); } });
      return Object.values(by).map((x) => { const f = x.women ? x.sf / x.women : 0, m = x.men ? x.sm / x.men : 0; return { department: x.department, women: x.women, men: x.men, avg_f: Math.round(f), avg_m: Math.round(m), gap: f && m ? r2(((m - f) / m) * 100) : 0 }; });
    },
  },
  {
    id: "absence-cost", group: "Payroll & payslips", name: "The hidden cost of absence", modules: ["payroll"], gallery: "money",
    desc: "Unplanned absence (sick leave, loss of pay and unexplained absent days) valued at each person's daily rate.",
    columns: [...EMP_COLS, C("sick", "Sick / LOP days", "num"), C("absent", "Absent days", "num"), C("rate", "Daily rate", "money"), C("cost", "Cost", "money")],
    build: ({ data, emps, empBy, from, to }) => {
      const agg = {};
      data.requests.filter((r) => r.type === "leave" && r.status === "Approved" && ["SL", "LOP"].includes(r.leave_type) && empBy[r.employee_code] && inRange(r.from_date, from, to)).forEach((r) => { const x = (agg[r.employee_code] = agg[r.employee_code] || { e: empBy[r.employee_code], sick: 0, absent: 0 }); x.sick += r.days; });
      dailyStatus(data, emps, from, to).filter((x) => x.status === "Absent").forEach(({ e }) => { const x = (agg[e.employee_code] = agg[e.employee_code] || { e, sick: 0, absent: 0 }); x.absent++; });
      return Object.values(agg).map(({ e, sick, absent }) => { const rate = Math.round((Number(e.monthly_gross) || 0) / 26); return { _emp: e, sick, absent, rate, cost: rate * (sick + absent) }; }).filter((x) => x.cost > 0).sort((a, b) => b.cost - a.cost);
    },
  },
];
REPORTS.push(...GALLERY_REPORTS);

// v10.6 review: merged and removed reports.
//  • "Headcount overview" is merged into the "Headcount register" (overview columns on every row, group by department).
//  • "Worked, screen-off & total hours" is merged into the "Daily attendance register" (worked / screen-off / total per day).
//  • "Screen-off time claims" and "Attendance corrections" are removed from the catalogue.
export const HIDDEN_REPORTS = new Set(["headcount-overview", "hours", "screenoff-claims", "regularize"]);
{
  const hc = REPORTS.find((r) => r.id === "headcount");
  if (hc) {
    hc.name = "Headcount overview & register";
    hc.desc = `${hc.desc || ""} Includes the overview: worker type (permanent / contingent), gender and tenure — group by department for the department-wise overview.`.trim();
    const prev = hc.build;
    hc.columns = [...hc.columns, C("worker_group", "Permanent / contingent"), C("tenure_yrs", "Tenure (yrs)", "num")];
    hc.build = (ctx) => prev(ctx).map((r) => ({ ...r, worker_group: r._emp ? (workerTypeOf(r._emp) === "permanent" ? "Permanent" : "Contingent") : "", tenure_yrs: r._emp?.date_of_joining ? r2((Date.now() - new Date(r._emp.date_of_joining)) / (365.25 * 86400000)) : "" }));
  }
  const ad = REPORTS.find((r) => r.id === "attendance-daily");
  if (ad) {
    ad.name = "Daily attendance register · worked, screen-off & total hours";
    ad.desc = "One row per person per day: first in, last out, worked, screen-off and total hours, overtime, late flag, punch source and geofence flags.";
    ad.modules = ["attendance", "workforce", "payroll"];
    const prev = ad.build;
    ad.columns = [...ad.columns.filter((c) => c.k !== "hours"), C("worked", "Worked", "hours"), C("screen_off", "Screen off", "hours"), C("total", "Total (in → out)", "hours")];
    ad.build = (ctx) => prev(ctx).map((r) => { const h = hoursInRange(ctx.data, r._emp?.employee_code, r.date, r.date); return { ...r, worked: h.worked ?? r.hours, screen_off: h.screenOff ?? 0, total: h.total ?? r.hours }; });
  }
}
if (!REPORT_GROUPS.includes("Time & attendance")) REPORT_GROUPS.push("Time & attendance");

/** Reports this user may run. role: "admin" | "superadmin". */
export function reportsFor(user) {
  if (user.role === "superadmin") return REPORTS.filter((r) => !HIDDEN_REPORTS.has(r.id));
  const mods = user.modules || [];
  return REPORTS.filter((r) => !HIDDEN_REPORTS.has(r.id) && !r.superOnly && (r.modules || []).some((m) => mods.includes(m)));
}
/** Which side an admin is on, for the page title. */
export function adminKind(user) {
  if (user.role === "superadmin") return "super";
  const m = user.modules || [];
  const hr = HR_MODULES.some((x) => m.includes(x) && x !== "contracts");
  const fin = FINANCE_MODULES.some((x) => m.includes(x) && !["contracts", "payslips"].includes(x));
  return hr && fin ? "both" : fin ? "finance" : "hr";
}

/** Run a report: attach employee dimensions so every row can be filtered and grouped. */
export function runReport(def, { data, emps, empBy, nameOf, from, to }) {
  const rows = def.build({ data, emps, empBy, nameOf, from, to }) || [];
  // v10.14: every row carries its legal entity, so any report can be filtered, grouped and exported by entity
  const co = Object.fromEntries((data.companies || []).map((c) => [c.company_id, c.short || c.name]));
  return rows.map((r) => {
    const e = r._emp;
    return {
      ...r,
      legal_entity: r.legal_entity ?? co[r.company_id ?? e?.company_id] ?? "",
      employee_code: r.employee_code ?? e?.employee_code ?? "",
      employee: r.employee ?? e?.full_name ?? "",
      department: r.department ?? e?.department ?? "",
      location: r.location ?? (e ? e.city || "" : ""),
      country: r.country ?? (e ? countryName(e.country_code) : ""),
      worker_type: r.worker_type ?? (e ? WORKER_TYPE_BY[workerTypeOf(e)]?.short : ""),
      _month: r._date ? String(r._date).slice(0, 7) : "",
    };
  });
}
export const todayIso = () => isoDate();
