// v10.3 — Granular AI automation. Every repetitive HR, payroll, attendance and compliance step is a rule that the
// automation engine evaluates on its own (on sign-in and every few minutes). Each rule has its own mode and thresholds:
//   • auto   – the AI does it and writes the log (notifications, nudges, safe fixes, low-risk approvals within limits)
//   • review – the AI prepares it and puts it in the review queue; a person approves with one tap
//   • off    – the rule does not run
// Rules are grouped by module and owned by the admins who hold that module; the Super Admin owns all of them and HR
// sees every rule's activity. Every proposal has a stable id, so nothing is done twice.
import { expenseTotal } from "./requests.js";
import { payrollGroups, isRestrictedWorker, tenureDays } from "./statutory.js";
import { computeRun } from "./suitePayroll.js";
import { complianceCalendar } from "./collab.js";
import { isoDate } from "./utils.js";

const DAY = 86400000;
const daysUntil = (d, today) => Math.round((new Date(`${d}T12:00:00`) - new Date(`${today}T12:00:00`)) / DAY);
const nameOf = (data, code) => data.employees.find((e) => e.employee_code === code)?.full_name || data.admins.find((a) => a.admin_code === code)?.full_name || code;
const adminsWith = (data, mod) => data.admins.filter((a) => a.status === "active" && (a.modules || []).includes(mod)).map((a) => a.admin_code);
const supers = (data) => data.superAdmins.map((s) => s.superadmin_code);

export const AUTOMATION_GROUPS = [
  ["time", "Leave & attendance"],
  ["pay", "Payroll, payslips & tax"],
  ["finance", "Expenses & spend"],
  ["people", "People & contracts"],
  ["compliance", "Compliance & registrations"],
  ["service", "Service desk & onboarding"],
];

// [id, group, owner modules, default mode, label, description, params {key: [label, default, unit]}, evaluate]
export const RULES = [
  {
    id: "leave_auto_approve", group: "time", modules: ["leave"], mode: "review",
    label: "Approve short leave within policy",
    text: "Pending leave of up to N days, with enough balance and the notice period met, is approved for the manager and HR. Anything longer, unpaid or flagged stays with people.",
    params: { max_days: ["Up to (days)", 1, "days"], min_notice: ["Minimum notice", 1, "days"] },
    evaluate(data, p, today) {
      return data.requests.filter((r) => r.type === "leave" && r.status === "Pending" && r.leave_type !== "LOP" && Number(r.days) <= p.max_days && daysUntil(r.from_date, today) >= p.min_notice && !(r.flags || []).length)
        .map((r) => ({ key: r.request_id, kind: "approve_request", ref: r.request_id, employee_code: r.employee_code, title: `Approve ${r.days} day(s) leave for ${nameOf(data, r.employee_code)}`, detail: `${r.request_id} · ${r.from_date}${r.to_date !== r.from_date ? ` → ${r.to_date}` : ""} · ${r.reason || ""}` }));
    },
  },
  {
    id: "expense_auto_approve", group: "finance", modules: ["expense"], mode: "review",
    label: "Approve small expenses with receipts",
    text: "Expense claims up to the limit, every line with a receipt, no duplicate or policy flags, are approved and queued for payment.",
    params: { max_amount: ["Up to (₹ or local)", 2000, "amount"] },
    evaluate(data, p) {
      return data.requests.filter((r) => r.type === "expense" && r.status === "Pending" && !(r.flags || []).length && expenseTotal(r.items || []) <= p.max_amount && (r.items || []).every((i) => i.receipt))
        .map((r) => ({ key: r.request_id, kind: "approve_request", ref: r.request_id, employee_code: r.employee_code, title: `Approve expense ${r.request_id} · ${expenseTotal(r.items)} for ${nameOf(data, r.employee_code)}`, detail: `${r.title || r.purpose || ""} · ${(r.items || []).length} line(s), receipts attached` }));
    },
  },
  {
    id: "missing_punch_nudge", group: "time", modules: ["attendance"], mode: "auto",
    label: "Nudge people who forgot to clock out",
    text: "Anyone who clocked in yesterday without clocking out gets a reminder to raise an attendance correction.",
    params: {},
    evaluate(data, p, today) {
      const y = isoDate(new Date(`${today}T12:00:00`).getTime() - DAY);
      const by = {};
      (data.punches || []).filter((x) => x.ts?.startsWith(y)).forEach((x) => { (by[x.employee_code] ||= []).push(x); });
      return Object.entries(by).filter(([, ps]) => ps.some((x) => x.type === "in") && !ps.some((x) => x.type === "out"))
        .map(([code]) => ({ key: `${code}:${y}`, kind: "notify", to: [code], link: "/attendance", title: `Clock-out missing for ${nameOf(data, code)} on ${y}`, text: `You clocked in on ${y} but did not clock out. Raise an attendance correction so your hours and pay are right.` }));
    },
  },
  {
    id: "late_pattern", group: "time", modules: ["attendance"], mode: "review",
    label: "Flag repeated late arrivals to the manager",
    text: "Three or more late arrivals in the last 7 days are summarised for the manager with a suggested, friendly check-in.",
    params: { late_after: ["Late after (hh:mm)", "09:45", "time"], times: ["Times in 7 days", 3, "count"] },
    evaluate(data, p, today) {
      const since = isoDate(new Date(`${today}T12:00:00`).getTime() - 7 * DAY);
      const firstIn = {};
      (data.punches || []).filter((x) => x.type === "in" && x.ts >= since).forEach((x) => { const d = x.ts.slice(0, 10); const k = `${x.employee_code}|${d}`; if (!firstIn[k] || x.ts < firstIn[k]) firstIn[k] = x.ts; });
      const late = {};
      Object.entries(firstIn).forEach(([k, ts]) => { const t = new Date(ts); const hm = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`; if (hm > p.late_after) { const c = k.split("|")[0]; late[c] = (late[c] || 0) + 1; } });
      return Object.entries(late).filter(([, n]) => n >= p.times).map(([code, n]) => {
        const e = data.employees.find((x) => x.employee_code === code);
        return { key: `${code}:${today.slice(0, 8)}${Math.ceil(Number(today.slice(8)) / 7)}`, kind: "notify", to: [e?.reporting_manager || adminsWith(data, "attendance")[0]].filter(Boolean), link: "/team", title: `${nameOf(data, code)} was late ${n} times this week`, text: `${nameOf(data, code)} arrived after ${p.late_after} on ${n} days in the last week. A short, supportive check-in usually helps — shift timing or commute may need a change.` };
      });
    },
  },
  {
    id: "payroll_precheck", group: "pay", modules: ["payroll"], mode: "auto",
    label: "Pre-check payroll before the run",
    text: "From the 20th, the AI runs this month's payroll in draft and tells Finance about blocking errors (no bank account, negative net, missing rules) and warnings (PAN / UAN missing).",
    params: { from_day: ["Start checking on day", 20, "day"] },
    evaluate(data, p, today) {
      if (Number(today.slice(8, 10)) < p.from_day) return [];
      let run;
      try { run = computeRun(data); } catch { return []; }
      if (!run.errors.length && !run.warns.length) return [];
      return [{ key: run.period, kind: "notify", to: [...adminsWith(data, "payroll"), ...supers(data)], link: "/payroll-agent", title: `Payroll ${run.period}: ${run.errors.length} error(s), ${run.warns.length} warning(s)`, text: `Payroll pre-check for ${run.period}: ${run.errors.length} blocking error(s) and ${run.warns.length} warning(s). First: ${[...run.errors, ...run.warns].slice(0, 3).map((f) => `${f.e.full_name} – ${f.text}`).join("; ")}.` }];
    },
  },
  {
    id: "payslip_release", group: "pay", modules: ["payslips", "payroll"], mode: "auto",
    label: "Remind HR to release approved payslips",
    text: "Payslip runs approved by Finance and the Super Admin but not yet released are flagged to HR every day until released.",
    params: {},
    evaluate(data, p, today) {
      return (data.payslipBatches || []).filter((b) => b.status === "Approved").map((b) => ({ key: `${b.id}:${today}`, kind: "notify", to: adminsWith(data, "payslips"), link: "/payslips", title: `Payslip run ${b.id} (${b.period}) is approved — release it`, text: `Payslip run ${b.id} for ${b.period} is fully approved. Release it so ${b.slips.length} employee(s) get their payslips and email.` }));
    },
  },
  {
    id: "registration_gap", group: "compliance", modules: ["payroll"], mode: "auto",
    label: "Watch payroll registrations by location",
    text: "Payroll groups with a missing TAN / PAYE / ESIC / state registration, or a cross-border location without local registration, are raised to Finance before taxes are paid under the wrong number.",
    params: {},
    evaluate(data) {
      return payrollGroups(data).filter((g) => g.warnings.length && g.employees.length).map((g) => ({ key: `${g.id}:${g.warnings.join("|").length}`, kind: "notify", to: [...adminsWith(data, "payroll"), ...supers(data)], link: "/payroll-entities", title: `Registration gap · ${g.label}`, text: `${g.label}: ${g.warnings.join(" ")}` }));
    },
  },
  {
    id: "country_alignment", group: "compliance", modules: ["accounts"], mode: "auto",
    label: "Keep country & currency in line with the location",
    text: "If someone's country no longer matches their registered work location, the AI corrects it so tax, TDS and payslips use the right country and currency.",
    params: {},
    evaluate(data) {
      if (data.settings.lock_country_to_location === false) return [];
      const by = Object.fromEntries((data.workLocations || []).map((l) => [l.location_id, l]));
      return data.employees.filter((e) => by[e.location_id] && e.country_code !== by[e.location_id].country).map((e) => ({ key: `${e.employee_code}:${by[e.location_id].country}`, kind: "fix_country", employee_code: e.employee_code, country: by[e.location_id].country, title: `Align ${e.full_name} to ${by[e.location_id].country}`, detail: `${e.country_code} → ${by[e.location_id].country} (location ${by[e.location_id].name})` }));
    },
  },
  {
    id: "compliance_due", group: "compliance", modules: ["compliance", "payroll"], mode: "auto",
    label: "Chase statutory filings before they are due",
    text: "Returns and challans due within N days and not yet filed (PF ECR, ESI, PT, TDS 24Q, PAYE, CPF…) are sent to their owner, and overdue ones to the Super Admin as well.",
    params: { days_before: ["Days before due", 5, "days"] },
    evaluate(data, p, today) {
      let items = [];
      try { items = complianceCalendar(data); } catch { return []; }
      return items.filter((c) => c.status === "overdue" || (c.status === "due_soon" && c.due && daysUntil(c.due, today) <= p.days_before)).slice(0, 25).map((c) => ({ key: `${c.key || c.title}:${c.due}`, kind: "notify", to: [c.owner || adminsWith(data, "compliance")[0], ...(c.status === "overdue" ? supers(data) : [])].filter(Boolean), link: "/compliance-calendar", title: `${c.status === "overdue" ? "Overdue" : "Due soon"}: ${c.title || c.name}`, text: `${c.title || c.name}${c.country ? ` (${c.country})` : ""} is ${c.status === "overdue" ? "overdue" : `due on ${c.due}`}. File it and record the acknowledgement number.` }));
    },
  },
  {
    id: "contract_end", group: "people", modules: ["contracts"], mode: "auto",
    label: "Warn before contracts end",
    text: "Contracts ending within N days are raised to HR and the manager with the renewal option, so nobody works past their end date without a contract.",
    params: { days_before: ["Days before end", 30, "days"] },
    evaluate(data, p, today) {
      return (data.contracts || []).filter((c) => ["active", "renewed", "suspended"].includes(c.status) && c.end_date && daysUntil(c.end_date, today) >= 0 && daysUntil(c.end_date, today) <= p.days_before).map((c) => {
        const e = data.employees.find((x) => x.employee_code === c.employee_code);
        return { key: `${c.id}:${c.end_date}`, kind: "notify", to: [...adminsWith(data, "contracts").slice(0, 1), e?.reporting_manager].filter(Boolean), link: "/contracts", title: `Contract ${c.id} for ${nameOf(data, c.employee_code)} ends ${c.end_date}`, text: `${nameOf(data, c.employee_code)}'s contract ends on ${c.end_date} (${daysUntil(c.end_date, today)} days). Renewal option: ${c.renewal_option || "review"}. Renew, amend or plan the exit.` };
      });
    },
  },
  {
    id: "benefits_eligibility", group: "people", modules: ["benefits", "accounts"], mode: "auto",
    label: "Open benefits when a contract passes one year",
    text: "Contract and freelance workers become eligible for benefits & wellness once their engagement is longer than a year; the AI tells them and HR the day it happens.",
    params: {},
    evaluate(data) {
      const limit = Number(data.settings.long_term_days) || 365;
      return data.employees.filter((e) => e.status === "active" && isRestrictedWorker(e, data.settings) && tenureDays(data, e) > limit).map((e) => ({ key: `${e.employee_code}:eligible`, kind: "notify", to: [e.employee_code, ...adminsWith(data, "benefits").slice(0, 1)], link: "/benefits-me", title: `${e.full_name} is now eligible for benefits & wellness`, text: `${e.full_name} has worked with us for more than ${Math.round(limit / 30)} months, so benefits & wellness are now open in self-service.` }));
    },
  },
  {
    id: "probation_due", group: "people", modules: ["accounts", "performance"], mode: "auto",
    label: "Prompt probation reviews",
    text: "Probation ending within N days without a decision goes to the manager with an AI-drafted review outline, and to HR.",
    params: { days_before: ["Days before end", 15, "days"] },
    evaluate(data, p, today) {
      return data.employees.filter((e) => e.status === "active" && e.probation_end_date && e.probation_status !== "confirmed" && daysUntil(e.probation_end_date, today) >= 0 && daysUntil(e.probation_end_date, today) <= p.days_before).map((e) => ({ key: `${e.employee_code}:${e.probation_end_date}`, kind: "notify", to: [e.reporting_manager, ...adminsWith(data, "accounts").slice(0, 1)].filter(Boolean), link: "/team", title: `Probation review due for ${e.full_name}`, text: `${e.full_name}'s probation ends on ${e.probation_end_date}. Confirm, extend or discuss — the AI can draft the review from goals and feedback.` }));
    },
  },
  {
    id: "bgv_overdue", group: "service", modules: ["bgv"], mode: "auto",
    label: "Escalate overdue background checks",
    text: "Background-verification cases past their due date and still open are escalated to the BGV owner.",
    params: {},
    evaluate(data, p, today) {
      return (data.bgv || []).filter((c) => !c.cancelled && !c.closed_status && c.due_date && c.due_date < today).map((c) => ({ key: `${c.id}:${c.due_date}`, kind: "notify", to: adminsWith(data, "bgv"), link: "/bgv", title: `BGV ${c.id} for ${c.name || nameOf(data, c.employee_code)} is overdue`, text: `Background check ${c.id} was due on ${c.due_date} and is still open. Chase the vendor or the pending documents.` }));
    },
  },
  {
    id: "doc_nudge", group: "service", modules: ["onboarding", "accounts"], mode: "auto",
    label: "Collect missing onboarding documents",
    text: "New joiners with onboarding steps still open after 7 days get a reminder listing exactly what is missing.",
    params: { after_days: ["Remind after (days)", 7, "days"] },
    evaluate(data, p, today) {
      return (data.onboarding || []).filter((o) => o.done?.some((d) => !d)).map((o) => {
        const e = data.employees.find((x) => x.employee_code === o.employee_code);
        if (!e || daysUntil(e.date_of_joining, today) > -p.after_days) return null;
        return { key: `${o.employee_code}:${today.slice(0, 7)}`, kind: "notify", to: [o.employee_code], link: "/onboarding-me", title: `Onboarding reminder for ${e.full_name}`, text: `You still have ${o.done.filter((d) => !d).length} onboarding step(s) open. Finish them so payroll, IT and compliance are complete.` };
      }).filter(Boolean);
    },
  },
  // ── v10.6: HR automation ideas (triage tickets, catch payroll issues, early attrition signs, IT purchase SLA,
  //    fairness checks on decisions, employee feedback themes) ──
  {
    id: "it_ticket_triage", group: "service", modules: ["it"], mode: "auto",
    label: "Triage new IT tickets",
    text: "Unassigned IT tickets are classified by category and priority and the IT admin is told — before anyone opens the queue.",
    params: { after_hours: ["Unassigned for (hours)", 1, "hours"] },
    evaluate(data, p) {
      const it = adminsWith(data, "it");
      return (data.itTickets || []).filter((t) => ["open"].includes(t.status) && !t.assigned_to && (Date.now() - new Date(t.created_at)) / 3600000 >= p.after_hours)
        .map((t) => ({ key: t.id, kind: "notify", to: it.length ? it : supers(data), link: "/it-helpdesk", title: `Triage ${t.id} · ${t.category} · ${t.priority}`, text: `${t.id} "${t.subject}" from ${nameOf(data, t.requester)} is unassigned — suggested: ${t.priority === "critical" || t.priority === "high" ? "pick up now" : "assign today"} (${t.category}).` }));
    },
  },
  {
    id: "payroll_anomaly", group: "pay", modules: ["payroll"], mode: "review",
    label: "Catch payroll issues before payday",
    text: "Flags people with unusual overtime or missing punches this month before the payroll run, so trust issues never reach payday.",
    params: { ot_hours: ["Overtime above (hours)", 20, "hours"], missing_days: ["Missing out-punches above", 3, "days"] },
    evaluate(data, p, today) {
      const m = today.slice(0, 7);
      const by = {};
      (data.punches || []).filter((x) => x.ts?.startsWith(m)).forEach((x) => { (by[x.employee_code] ||= {}); (by[x.employee_code][x.ts.slice(0, 10)] ||= []).push(x); });
      return Object.entries(by).map(([code, days]) => {
        let ot = 0; let missing = 0;
        Object.values(days).forEach((ps) => { const ins = ps.filter((x) => x.type === "in").map((x) => x.ts).sort(); const outs = ps.filter((x) => x.type === "out").map((x) => x.ts).sort(); if (ins.length && !outs.length) missing += 1; if (ins.length && outs.length) { const h = (new Date(outs[outs.length - 1]) - new Date(ins[0])) / 3600000 - 1; if (h > 8) ot += h - 8; } });
        if (ot < p.ot_hours && missing < p.missing_days) return null;
        return { key: `${code}:${m}`, kind: "notify", to: adminsWith(data, "payroll"), link: "/payroll-agent", title: `Check ${nameOf(data, code)} before payroll`, text: `${nameOf(data, code)}: ${Math.round(ot)} h overtime and ${missing} day(s) without a clock-out in ${m}. Confirm before the run.` };
      }).filter(Boolean);
    },
  },
  {
    id: "attrition_signal", group: "people", modules: ["accounts", "performance"], mode: "review",
    label: "Spot early signs of attrition",
    text: "People with a low daily pulse, no recognition in 90 days and a long time since their last review are flagged to HR so support can start early.",
    params: { pulse_below: ["Average pulse below (1–5)", 2.6, "score"] },
    evaluate(data, p, today) {
      const recent = (code) => (data.suite?.posts || []).some((x) => x.kind === "recognition" && (x.to || []).includes(code) && daysUntil(String(x.at).slice(0, 10), today) > -90);
      const pulses = data.suite?.pulses || [];
      return data.employees.filter((e) => e.status === "active").map((e) => {
        const mine = pulses.filter((x) => x.emp === e.employee_code);
        const avg = mine.length ? mine.reduce((s, x) => s + x.mood, 0) / mine.length : null;
        if (avg == null || avg >= p.pulse_below || recent(e.employee_code)) return null;
        return { key: `${e.employee_code}:${today.slice(0, 7)}`, kind: "notify", to: adminsWith(data, "accounts"), link: "/talent", title: `Attrition risk: ${e.full_name}`, text: `${e.full_name} (${e.department}) — average pulse ${avg.toFixed(1)}/5 and no recognition in 90 days. Consider a check-in with ${nameOf(data, e.reporting_manager)}.` };
      }).filter(Boolean);
    },
  },
  {
    id: "it_purchase_sla", group: "service", modules: ["it", "accounts", "payroll"], mode: "auto",
    label: "Chase IT purchases stuck at a stage",
    text: "IT purchase requests waiting at IT, HR or Finance longer than the limit are nudged to the approvers of that stage.",
    params: { after_days: ["Waiting more than (days)", 2, "days"] },
    evaluate(data, p, today) {
      const who = { it: adminsWith(data, "it"), hr: adminsWith(data, "accounts"), finance: adminsWith(data, "payroll") };
      return (data.suite?.itPurchases || []).filter((x) => who[x.status] && daysUntil(String((x.steps || []).slice(-1)[0]?.at || x.created_at).slice(0, 10), today) <= -p.after_days)
        .map((x) => ({ key: `${x.id}:${x.status}`, kind: "notify", to: who[x.status].length ? who[x.status] : supers(data), link: "/it-purchase", title: `IT purchase ${x.id} waiting with ${x.status.toUpperCase()}`, text: `${x.id} (${x.item}) for ${nameOf(data, x.employee_code)} has waited more than ${p.after_days} day(s) at the ${x.status.toUpperCase()} stage.` }));
    },
  },
  {
    id: "fairness_check", group: "compliance", modules: ["accounts", "compliance"], mode: "review",
    label: "Fairness check on approvals",
    text: "Compares rejection rates of leave and expense requests across departments and genders each month; a gap above the limit is sent to the Super Admin to review (bias checks & audits).",
    params: { gap_pct: ["Gap above (%)", 25, "pct"] },
    evaluate(data, p, today) {
      const decided = data.requests.filter((r) => ["leave", "expense"].includes(r.type) && ["Approved", "Rejected", "Paid"].includes(r.status));
      const emp = Object.fromEntries(data.employees.map((e) => [e.employee_code, e]));
      const rate = (key) => { const g = {}; decided.forEach((r) => { const k = emp[r.employee_code]?.[key] || "—"; (g[k] ||= { n: 0, rej: 0 }); g[k].n += 1; if (r.status === "Rejected") g[k].rej += 1; }); return Object.entries(g).filter(([, v]) => v.n >= 3).map(([k, v]) => [k, Math.round((v.rej / v.n) * 100)]); };
      return ["department", "gender"].map((key) => {
        const r = rate(key);
        if (r.length < 2) return null;
        const hi = r.reduce((a, b) => (b[1] > a[1] ? b : a)); const lo = r.reduce((a, b) => (b[1] < a[1] ? b : a));
        if (hi[1] - lo[1] < p.gap_pct) return null;
        return { key: `${key}:${today.slice(0, 7)}`, kind: "notify", to: supers(data), link: "/reports", title: `Fairness check · ${key}`, text: `Rejection rate ${hi[1]}% for ${hi[0]} vs ${lo[1]}% for ${lo[0]} (${key}). Review the decisions in Reports.` };
      }).filter(Boolean);
    },
  },
  {
    id: "feedback_themes", group: "people", modules: ["accounts", "wellness"], mode: "auto",
    label: "Make sense of employee feedback",
    text: "Each Monday the week's pulse answers and feedback comments are summarised into themes and sentiment for HR — no need to read every comment.",
    params: {},
    evaluate(data, p, today) {
      if (new Date(`${today}T12:00:00`).getDay() !== 1) return [];
      const week = (data.suite?.pulses || []).filter((x) => daysUntil(x.date, today) > -7);
      if (!week.length) return [];
      const avg = week.reduce((s, x) => s + x.mood, 0) / week.length;
      const low = week.filter((x) => x.mood <= 2).length;
      return [{ key: today, kind: "notify", to: adminsWith(data, "accounts"), link: "/people-xp", title: "Weekly employee feedback themes", text: `${week.length} pulse answers this week · average ${avg.toFixed(1)}/5 · ${low} low (${Math.round((low / week.length) * 100)}%). ${avg < 3 ? "Sentiment is down — check workload and recognition." : "Sentiment is steady."}` }];
    },
  },
];
export const RULE_BY = Object.fromEntries(RULES.map((r) => [r.id, r]));

export const MODES = [["auto", "Auto"], ["review", "Review"], ["off", "Off"]];

/** Effective settings for a rule: saved override over the defaults. */
export function ruleConfig(data, id) {
  const r = RULE_BY[id];
  const saved = data.automation?.rules?.[id] || {};
  const params = Object.fromEntries(Object.entries(r.params).map(([k, [, def]]) => [k, saved.params?.[k] ?? def]));
  return { mode: saved.mode || r.mode, params };
}

/** Everything the rules would do right now that has not been done or queued yet. */
export function scanAutomation(data, today = isoDate()) {
  if (data.automation?.paused) return [];
  const done = new Set([...(data.automation?.done || []), ...(data.automation?.queue || []).map((q) => q.id)]);
  const out = [];
  for (const r of RULES) {
    const cfg = ruleConfig(data, r.id);
    if (cfg.mode === "off") continue;
    let found = [];
    try { found = r.evaluate(data, cfg.params, today) || []; } catch { found = []; }
    found.forEach((f) => { const id = `${r.id}:${f.key}`; if (!done.has(id)) out.push({ ...f, id, rule: r.id, mode: cfg.mode }); });
  }
  return out;
}

/** Can this user see / decide this queued item or rule? */
export function automationVisible(item, user) {
  if (!user) return false;
  if (user.role === "superadmin") return true;
  if (user.role !== "admin") return false;
  const r = RULE_BY[item.rule || item.id];
  if (!r) return false;
  const mods = user.modules || [];
  return r.modules.some((m) => mods.includes(m)) || mods.includes("accounts"); // HR (accounts) sees every rule's activity
}
export function canManageRule(rule, user) {
  if (user?.role === "superadmin") return true;
  if (user?.role !== "admin") return false;
  return rule.modules.some((m) => (user.modules || []).includes(m));
}
