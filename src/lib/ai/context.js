// Builds the role-scoped data snapshot the AI copilot sees.
// Employees see only their own record (plus their direct reports' attendance if they manage a team);
// admins see their org units and modules; the Super Admin sees aggregates for the whole company.
import { navFor, navScreens } from "../../data/roleNav.js";
import { register, registerCounts } from "../workforce.js";
import { payslipTotals, periodLabel } from "../../data/payslipFields.js";
import { isRestrictedWorker } from "../statutory.js";
import { REQUEST_TYPES } from "../requests.js";
import { isoDate } from "../utils.js";
import { holidaysFor } from "../../country/countryPacks.js";
import { docChecklist } from "../empdocs.js";
import { identityCodes, bgvFor, bgvStatus, bgvAccessLevel, BGV_CHECK_LABEL, complianceCalendar, canManageCompliance, totalUnread } from "../collab.js";

const strip = (o) => JSON.parse(JSON.stringify(o, (k, v) => (v === null || v === undefined || v === "" ? undefined : v)));

function reqLine(r, nameOf) {
  const amt = r.request_amount ?? r.amount ?? (r.items ? r.items.reduce((s, i) => s + Number(i.amount || 0), 0) : null);
  return `${r.request_id} · ${REQUEST_TYPES[r.type]?.label || r.type} · ${nameOf(r.employee_code)}${r.days ? ` · ${r.days} day(s) ${r.from_date}→${r.to_date}` : ""}${amt ? ` · ₹${amt}` : ""} · submitted ${String(r.created_at || r.submitted_at || "").slice(0, 10)}`;
}

export function visiblePageText(limit = 6000) {
  const main = document.querySelector("[data-ai-page]") || document.querySelector("main") || document.body;
  const clone = main.cloneNode(true);
  clone.querySelectorAll("[data-ai-ui], script, style, svg, input[type=password]").forEach((n) => n.remove());
  const t = (clone.innerText || clone.textContent || "").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
  return t.length > limit ? `${t.slice(0, limit)}\n…(truncated)` : t;
}

export function buildAiContext(store, route) {
  const { user, data, nameOf, reportsOf, leaveBalanceOf, balanceOf, pendingForManager, pendingForAdmin, scopeUnits } = store;
  const today = isoDate();
  const isManager = user.role === "emp" && reportsOf(user.employee_code).length > 0;
  const groups = navFor(user.role, isManager, { user, data });
  const items = navScreens(groups);
  const page = route.split(/[/?]/)[1] || "";
  const pageTitle = items.find((i) => i.id === page)?.label || "Home";
  const routes = items.map((i) => `/${i.id}`);
  const snap = { page: pageTitle, me: { name: user.full_name, first: user.full_name.split(" ")[0], role: user.role, code: user.code } };
  const highlights = [];

  if (user.role === "emp") {
    const e = data.employees.find((x) => x.employee_code === user.employee_code) || {};
    Object.assign(snap.me, { designation: e.designation, department: e.department, manager: e.reporting_manager ? nameOf(e.reporting_manager) : undefined, joined: e.date_of_joining, location: e.work_location || e.location, grade: e.grade_code, employment_type: e.employment_type });
    snap.leaveBalances = leaveBalanceOf(e.employee_code).map((b) => ({ name: b.name, code: b.code, entitled: b.entitled, taken: b.taken, pending: b.pending, available: b.available }));
    snap.country = e.country_code || "IN";
    snap.nextHoliday = holidaysFor(data, e).find((h) => h.date >= today);
    snap.holidays = holidaysFor(data, e).filter((h) => h.date >= today).slice(0, 6);
    const bal = balanceOf(e.employee_code);
    snap.myRequests = data.requests.filter((r) => r.employee_code === e.employee_code).slice(-10).map((r) => ({ id: r.request_id, type: r.type, status: r.status, waiting_on: r.status === "Pending" ? (r.stage === "manager" ? nameOf(r.steps[0]?.approver) : "Admin") : undefined, days: r.days, from: r.from_date, to: r.to_date, amount: r.request_amount ?? r.amount }));
    snap.goals = data.goals.filter((g) => g.employee_code === e.employee_code).map((g) => ({ title: g.title, progress: g.progress, weight: g.weight, status: g.status, due: g.due }));
    snap.assets = data.assets.filter((a) => a.assigned_to === e.employee_code).map((a) => ({ id: a.asset_id, category: a.category, model: a.model, acknowledged: !!a.acknowledged }));
    snap.leaveTypes = data.leaveTypes.filter((t) => t.active).map((t) => ({ name: t.name, annual: t.annual, carry_forward: t.carry_forward, min_notice_days: t.min_notice_days, certificate_after_days: t.doc_after_days }));
    snap.expensePolicy = { categories: data.expenseCategories.map((c) => ({ name: c.name, limit: c.limit, receipt_always: c.receipt_always })), receipt_required_above: data.settings.receipt_required_above, claim_window_days: data.settings.expense_claim_window_days, max_advance: data.settings.max_advance_inr };
    snap.shift = { start: data.settings.shift_start, late_after: data.settings.late_after, hours: data.settings.shift_hours };
    const slips = data.payslipBatches.filter((b) => b.status === "Released").flatMap((b) => b.slips.filter((s) => s.employee_code === e.employee_code).map((s) => ({ s, b }))).sort((a, z) => z.b.period.localeCompare(a.b.period));
    // v10.3: contract / freelance workers — the AI does not reveal leave balances, pay or payslips in self-service.
    const restricted = isRestrictedWorker(e, data.settings);
    if (restricted) { delete snap.leaveBalances; snap.leaveBalances = []; snap.selfServiceNote = "Contract/freelance worker: request leave only; balances, pay and payslips are handled under the contract — point them to HR or My contract."; }
    if (slips[0] && !restricted) {
      const { s, b } = slips[0];
      const t = payslipTotals(s.values, b.components);
      snap.payslip = { period: periodLabel(b.period), gross: t.gross, deductions: t.deductions, net: t.payable, lines: b.components.filter((c) => c.type === "amount" && Number(s.values[c.code])).map((c) => `${c.label} (${c.section}): ₹${s.values[c.code]}`) };
    }
    const openMine = data.requests.filter((r) => r.employee_code === e.employee_code && r.status === "Pending");
    if (openMine.length) highlights.push(`${openMine.length} of your request(s) are waiting for approval`);
    const risk = snap.goals.filter((g) => g.status === "at_risk");
    if (risk.length) highlights.push(`${risk.length} goal(s) are at risk: ${risk.map((g) => g.title).join(", ")}`);
    const el = snap.leaveBalances.find((b) => b.code === "EL");
    if (el) highlights.push(`Earned leave available: ${el.available} day(s)`);
    if (isManager) {
      const team = reportsOf(e.employee_code).filter((x) => x.status === "active");
      const rows = register(data, team);
      const c = registerCounts(rows);
      snap.team = { size: team.length, present: c.present, late: c.late, leave: c.leave, notIn: c.absent + c.not_in, people: rows.map((r) => ({ name: r.e.full_name, designation: r.e.designation, status: r.status })) };
      const p = pendingForManager(e.employee_code);
      const lines = [...p.requests.map((r) => reqLine(r, nameOf))];
      snap.pending = { total: lines.length, items: lines, route: "/inbox" };
      if (lines.length) highlights.push(`${lines.length} team approval(s) waiting for you`);
      if (c.late) highlights.push(`${c.late} team member(s) late today`);
    }
  } else {
    const isSuper = user.role === "superadmin";
    const units = isSuper ? null : scopeUnits(user);
    const emps = data.employees.filter((e) => isSuper || units.has(e.department));
    const active = emps.filter((e) => e.status === "active");
    const c = registerCounts(register(data, active));
    const byDept = {};
    active.forEach((e) => (byDept[e.department] = (byDept[e.department] || 0) + 1));
    const exits12 = data.exits.filter((x) => x.d >= isoDate(Date.now() - 365 * 86400000)).length;
    snap.me.modules = user.modules;
    snap.org = { active: active.length, departments: Object.keys(byDept).length, byDepartment: byDept, attrition: isSuper ? Math.round((exits12 / Math.max(1, active.length)) * 1000) / 10 : undefined, pendingAccounts: emps.filter((e) => e.status === "pending_approval").length, locked: emps.filter((e) => e.status === "locked").length };
    snap.attendanceToday = { present: c.present, late: c.late, clockedOut: c.out, leave: c.leave, notIn: c.absent + c.not_in };
    const p = isSuper
      ? { requests: data.requests.filter((r) => r.status === "Pending"), points: [], accounts: data.employees.filter((e) => e.status === "pending_approval"), payouts: data.requests.filter((r) => r.status === "Approved" && ["expense", "advance", "loan", "asset"].includes(r.type)) }
      : pendingForAdmin(user);
    const lines = [...p.requests.map((r) => `${reqLine(r, nameOf)} · stage ${r.stage}`), ...p.accounts.map((e) => `New account · ${e.full_name} · ${e.department}`), ...(p.payouts || []).map((r) => `To pay · ${reqLine(r, nameOf)}`)];
    snap.pending = { total: lines.length, items: lines.slice(0, 40), route: isSuper ? "/requests" : "/approvals" };
    snap.leaveTypes = data.leaveTypes.filter((t) => t.active).map((t) => ({ name: t.name, annual: t.annual, carry_forward: t.carry_forward, min_notice_days: t.min_notice_days }));
    snap.policy = { approval_sla_days: data.settings.approval_sla_days, receipt_required_above: data.settings.receipt_required_above, max_advance: data.settings.max_advance_inr, loan_max_multiple: data.settings.loan_max_multiple, session_timeout_min: data.settings.session_timeout_min };
    snap.hiring = data.reqs.filter((r) => !r.closed).map((r) => ({ role: r.role, dept: r.dept, openings: r.n, applied: r.app, interviewed: r.int, offered: r.off }));
    snap.candidates = data.candidates.slice(0, 12).map((x) => ({ name: x.name, stage: x.stage, rating: x.rating, source: x.source }));
    snap.goalsAtRisk = data.goals.filter((g) => g.status === "at_risk" && emps.some((e) => e.employee_code === g.employee_code)).map((g) => `${nameOf(g.employee_code)}: ${g.title} (${g.progress}%)`).slice(0, 15);
    snap.assets = { total: data.assets.length, inStock: data.assets.filter((a) => a.status === "in_stock").length, repairOrLost: data.assets.filter((a) => ["repair", "lost"].includes(a.status)).length };
    snap.employees = active.slice(0, 60).map((e) => strip({ code: e.employee_code, name: e.full_name, designation: e.designation, department: e.department, manager: e.reporting_manager ? nameOf(e.reporting_manager) : undefined, joined: e.date_of_joining, status: e.status, monthly_gross: user.modules?.includes("payroll") || isSuper ? e.monthly_gross : undefined }));
    if (isSuper) snap.recentAudit = data.audit.slice(-10).map((a) => `${a.timestamp.slice(0, 16)} ${a.action} by ${nameOf(a.user_code)}: ${a.details}`);
    if (lines.length) highlights.push(`${lines.length} item(s) waiting in your approval queue`);
    if (c.late) highlights.push(`${c.late} employee(s) late today, ${c.absent + c.not_in} not in yet`);
    if (snap.org.locked) highlights.push(`${snap.org.locked} account(s) locked`);
    if (snap.goalsAtRisk.length) highlights.push(`${snap.goalsAtRisk.length} goal(s) at risk in your scope`);
  }
  // v8: schedule, meetings, chat, BGV and compliance (all scoped to what this user may see)
  const ids = identityCodes(data, user);
  const nowIso = new Date().toISOString();
  const weekIso = new Date(Date.now() + 7 * 86400000).toISOString();
  snap.mySchedule = [
    ...(data.meetings || []).filter((m) => m.status === "scheduled" && m.end >= nowIso && m.start <= weekIso && [m.organizer, ...(m.attendees || [])].some((c) => ids.has(c))).map((m) => `${m.start.slice(0, 16)} ${m.kind === "client" ? "Client" : "Meeting"}: ${m.title} (${m.mode})`),
    ...(data.interviews || []).filter((i) => i.status === "scheduled" && i.end >= nowIso && i.start <= weekIso && i.interviewers.some((c) => ids.has(c))).map((i) => `${i.start.slice(0, 16)} Interview: ${data.candidates.find((c) => c.id === i.candidate_id)?.name} · ${i.round}`),
  ].sort().slice(0, 15);
  const openActions = (data.meetings || []).flatMap((m) => (m.action_items || []).filter((a) => !a.done && ids.has(a.owner)).map((a) => `${a.text} (from "${m.title}", due ${a.due || "n/a"})`));
  if (openActions.length) snap.myActionItems = openActions.slice(0, 10);
  snap.unreadChat = totalUnread(data, user);
  if (user.role === "emp") {
    const ck = docChecklist(data, data.employees.find((e) => e.employee_code === user.employee_code));
    snap.myDocuments = { verified: `${ck.done}/${ck.total}`, missing: [...ck.statutory.filter((s) => ["missing", "rejected"].includes(s.status)).map((s) => `${s.name}${s.status === "rejected" ? ` (re-upload: ${s.rec?.note})` : ""}`), ...ck.bgv.filter((b) => b.status === "needed").map((b) => `BGV ${b.name}: ${b.ask}`)], route: "/documents" };
    if (ck.missing) highlights.push(`${ck.missing} document(s) missing – upload them under Documents`);
  }
  const myIt = (data.itTickets || []).filter((t) => t.requester === user.code && ["open", "in_progress", "waiting_user", "resolved"].includes(t.status));
  if (myIt.length) snap.myItTickets = myIt.map((t) => `${t.id} ${t.subject} · ${t.status} · ${t.priority}`).concat(["route: /it-support"]);
  if (myIt.some((t) => t.status === "waiting_user")) highlights.push("IT is waiting for your reply on a ticket");
  if (user.role === "superadmin" || user.modules?.includes("it")) {
    const q = (data.itTickets || []).filter((t) => ["open", "in_progress", "waiting_user"].includes(t.status));
    snap.itDesk = { open: q.length, unassigned: q.filter((t) => !t.assigned_to).length, breached: q.filter((t) => new Date(t.sla_due) < new Date()).map((t) => `${t.id} ${t.subject}`), route: "/it-helpdesk" };
  }
  if (snap.mySchedule.length) highlights.push(`${snap.mySchedule.length} meeting(s)/interview(s) in the next 7 days`);
  if (openActions.length) highlights.push(`${openActions.length} open meeting action item(s) assigned to you`);
  if (user.role === "emp") {
    const b = bgvFor(data, user.employee_code);
    if (b) {
      snap.myBackgroundCheck = { status: bgvStatus(b), due: b.due_date, consent: b.consent?.status, toUpload: b.checks.filter((k) => k.status === "insufficient").map((k) => `${BGV_CHECK_LABEL[k.type]}: ${k.candidate_note}`), route: "/bgv-me" };
      if (b.consent?.status !== "given" || snap.myBackgroundCheck.toUpload.length) highlights.push("Your background check needs action");
    }
  } else {
    const cases = (data.bgv || []).filter((c) => !c.cancelled && bgvAccessLevel(data, user, c));
    if (cases.length) snap.bgv = { visibleCases: cases.length, byStatus: cases.reduce((a, c) => { const st = bgvStatus(c); a[st] = (a[st] || 0) + 1; return a; }, {}), needsAction: cases.filter((c) => ["insufficient", "discrepancy", "consent_pending"].includes(bgvStatus(c))).map((c) => `${c.name}: ${bgvStatus(c)}`).slice(0, 10) };
    if (canManageCompliance(user)) {
      const cal = complianceCalendar(data);
      snap.compliance = { overdue: cal.filter((c) => c.status === "overdue").map((c) => `${c.title} (${c.country}, due ${c.due})`), dueIn7Days: cal.filter((c) => c.status === "due_soon").map((c) => `${c.title} (${c.country}, due ${c.due})`).slice(0, 12), route: "/compliance-calendar" };
      if (snap.compliance.overdue.length) highlights.push(`${snap.compliance.overdue.length} compliance filing(s) overdue`);
    }
    if (user.role === "superadmin" || user.modules?.includes("recruitment")) snap.interviewsAwaitingFeedback = (data.interviews || []).filter((i) => i.end < nowIso && i.status !== "cancelled" && (i.feedback || []).length < i.interviewers.length).length;
  }
  snap.highlights = highlights;
  const who = `${user.full_name} (${user.role === "emp" ? `Employee${isManager ? ", people manager" : ""}${snap.me.designation ? `, ${snap.me.designation}` : ""}` : user.role === "admin" ? `Admin · modules ${user.modules.join(", ")}` : "Super Admin"})`;
  let json = JSON.stringify(strip(snap));
  if (json.length > 24000) json = `${json.slice(0, 24000)}…`;
  return { snap, json, who, route, pageTitle, routes, pageText: visiblePageText() };
}
