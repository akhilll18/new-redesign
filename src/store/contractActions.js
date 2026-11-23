// Contract management actions (v8.7). HR (admins with the "contracts" module) prepare contracts, amendments, renewals and
// pay runs; Finance (admins with "payroll") or the Super Admin approve contracts and runs, post runs and pay invoices;
// workers e-sign, submit timesheets and milestones; the timesheet approver (or reporting manager) approves them.
// Every change is audited and the other side is notified.
import { nowIso, isoDate, nextSeq } from "../lib/utils.js";
import {
  DEFAULT_CONTRACT_SETTINGS, contractState, contractPayLine, validateTimesheet, approverOf, weekStart, addDays, monthBounds, rateText, money,
  contractFromEmployee, currencyOf, timesheetTotals,
} from "../lib/contracts.js";
import { invoiceLines } from "../data/seedContracts.js";
import { WORKER_TYPE_BY, isContingent, workerTypeOf, SELF_EMPLOYED, monthlyEquivalent } from "../data/employeeFields.js";
import { PAYSLIP_EMPLOYEE_FIELDS, PAYMENT_MODE_LABEL, periodLabel } from "../data/payslipFields.js";
import { contractPayslipRow } from "../lib/payslipGen.js";

const err = (error) => ({ ok: false, error });
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const CONTRACT_KEYS = ["title", "department", "pay_basis", "rate", "currency", "std_hours_week", "ot_multiplier", "payment_route", "vendor_id", "tds_section", "gst_registered", "gstin", "business_name", "start_date", "end_date", "notice_days", "renewal_option", "po_number", "cost_centre", "timesheet_approver", "nda_signed", "billing_cycle", "work_location", "budget_amount", "deliverables", "worker_type"];

export function makeContractActions({ mutate, dataRef, sessionRef, pushAudit, pushNote }) {
  const S = () => sessionRef.current;
  const D = () => dataRef.current;
  const adminRec = () => (S()?.role === "admin" ? D().admins.find((a) => a.admin_code === S().code) : null);
  const has = (m) => !!adminRec()?.modules.includes(m);
  const isSuper = () => S()?.role === "superadmin";
  const canManage = () => isSuper() || has("contracts") || has("payroll");
  const canApprove = () => isSuper() || ((D().contractSettings?.approval_by || "finance") === "finance" && has("payroll"));
  const settings = () => ({ ...DEFAULT_CONTRACT_SETTINGS, ...(D().contractSettings || {}) });
  const audit = (x, a, d) => pushAudit(x, S().code, S().role, a, d);
  const nameOf = (x, c) => x.employees.find((e) => e.employee_code === c)?.full_name || c;
  const notifyApprovers = (x, text, link) => {
    if ((x.contractSettings?.approval_by || "finance") === "finance") x.admins.filter((a) => a.status === "active" && a.modules.includes("payroll")).forEach((a) => pushNote(x, a.admin_code, text, link));
    (x.superAdmins || []).forEach((s) => pushNote(x, s.superadmin_code, text, link));
  };
  const notifyHr = (x, text, link) => x.admins.filter((a) => a.status === "active" && a.modules.includes("contracts")).forEach((a) => pushNote(x, a.admin_code, text, link));
  const find = (x, id) => (x.contracts || []).find((c) => c.id === id);
  const hist = (c, action) => { c.history = [...(c.history || []), { at: nowIso(), by: S().code, action }]; };
  const ensure = (x) => {
    x.contracts = x.contracts || [];
    x.timesheets = x.timesheets || [];
    x.contractRuns = x.contractRuns || [];
    x.contractInvoices = x.contractInvoices || [];
    x.contractVendors = x.contractVendors || [];
    x.contractSettings = { ...DEFAULT_CONTRACT_SETTINGS, ...(x.contractSettings || {}) };
  };
  /** Keep the employee master in step with the contract that is in force. */
  const syncEmployee = (x, c) => {
    const e = x.employees.find((y) => y.employee_code === c.employee_code);
    if (!e) return;
    Object.assign(e, { pay_basis: c.pay_basis, pay_rate: c.rate_history?.length ? c.rate_history[c.rate_history.length - 1].rate : c.rate, std_hours_week: c.std_hours_week, ot_multiplier: String(c.ot_multiplier), payment_route: c.payment_route, vendor_id: c.vendor_id, tds_section: c.tds_section, fixed_term_end_date: c.end_date, po_number: c.po_number, timesheet_approver: c.timesheet_approver, nda_signed: c.nda_signed, renewal_option: c.renewal_option });
    e.monthly_gross = monthlyEquivalent(e);
  };

  function validateContract(c) {
    const d = D();
    const e = d.employees.find((y) => y.employee_code === c.employee_code);
    const errors = {};
    if (!e) errors.employee_code = "Choose the worker.";
    else if (!isContingent({ ...e, worker_type: c.worker_type || e.worker_type })) errors.employee_code = `${e.full_name} is a permanent employee. Change the worker type on their employee record first.`;
    if (!String(c.title || "").trim()) errors.title = "Give the contract a title (role or statement of work).";
    if (!c.start_date) errors.start_date = "Choose the start date.";
    const wt = c.worker_type || workerTypeOf(e);
    if (!c.end_date && wt !== "agency") errors.end_date = "Contingent engagements need an end date.";
    if (c.end_date && c.start_date && c.end_date <= c.start_date) errors.end_date = "The end date must be after the start date.";
    if (!(Number(c.rate) > 0)) errors.rate = "Enter the contract rate.";
    if (!["hourly", "daily", "monthly", "milestone"].includes(c.pay_basis)) errors.pay_basis = "Choose the pay basis.";
    if (c.pay_basis !== "milestone" && !(Number(c.std_hours_week) > 0 && Number(c.std_hours_week) <= 60)) errors.std_hours_week = "Standard hours must be 1–60 a week.";
    if (c.payment_route === "vendor" && !c.vendor_id) errors.vendor_id = "Choose the staffing vendor.";
    if (c.payment_route === "payroll" && SELF_EMPLOYED.includes(wt)) errors.payment_route = "Freelancers and consultants are paid by invoice, not payroll.";
    if (c.pay_basis === "milestone" && c.payment_route === "payroll") errors.pay_basis = "Milestone contracts are paid by invoice.";
    if (c.gst_registered === "yes" && !String(c.gstin || e?.gstin || "").trim()) errors.gstin = "Enter the GSTIN.";
    if (c.budget_amount !== "" && c.budget_amount != null && Number(c.budget_amount) < 0) errors.budget_amount = "Budget cannot be negative.";
    const overlap = (d.contracts || []).find((o) => o.id !== c.id && o.employee_code === c.employee_code && !["terminated", "renewed", "rejected", "draft"].includes(o.status) && o.id !== c.parent_id && (!o.end_date || o.end_date >= c.start_date) && (!c.end_date || o.start_date <= c.end_date));
    if (overlap) errors.start_date = `Overlaps ${overlap.id} (${overlap.start_date} to ${overlap.end_date || "open"}). Renew or end it instead.`;
    if (c.milestones?.length && c.pay_basis === "milestone") {
      const sum = c.milestones.reduce((s, m) => s + (Number(m.amount) || 0), 0);
      if (Math.round(sum) !== Math.round(Number(c.rate))) errors.milestones = `Milestones add up to ${money(sum, c.currency)}; the fee is ${money(c.rate, c.currency)}.`;
    }
    return errors;
  }

  // ── Contracts ─────────────────────────────────────
  function saveContract(input, { submit = false } = {}) {
    if (!canManage()) return err("Only HR (contracts module), payroll admins or a Super Admin can edit contracts.");
    const d = D();
    const existing = input.id ? (d.contracts || []).find((c) => c.id === input.id) : null;
    if (existing && !["draft", "rejected"].includes(existing.status)) return err("Only draft or rejected contracts can be edited. Use Amend, Renew or Terminate for a live contract.");
    const e = d.employees.find((y) => y.employee_code === input.employee_code);
    const c = { ...(existing || {}), ...input, worker_type: input.worker_type || workerTypeOf(e), currency: input.currency || currencyOf(e), rate: Number(input.rate) || 0, std_hours_week: Number(input.std_hours_week) || 40, ot_multiplier: Number(input.ot_multiplier) || 1, notice_days: Number(input.notice_days) || 15 };
    const errors = validateContract(c);
    if (Object.keys(errors).length) return { ok: false, errors, error: Object.values(errors)[0] };
    return mutate((x) => {
      ensure(x);
      let rec = existing ? find(x, existing.id) : null;
      if (!rec) {
        rec = { ...c, id: nextSeq(x.contracts, "CTR-", "id", 4), status: "draft", milestones: c.milestones || [], amendments: [], signed: {}, history: [], created_by: S().code, created_at: nowIso() };
        x.contracts.unshift(rec);
        hist(rec, rec.kind === "renewal" ? `Renewal of ${rec.parent_id} created` : "Created");
      } else {
        CONTRACT_KEYS.forEach((k) => { if (k in c) rec[k] = c[k]; });
        rec.milestones = c.milestones || rec.milestones || [];
        if (rec.status === "rejected") rec.status = "draft";
        hist(rec, "Edited");
      }
      rec.rate_history = [{ from: rec.start_date, rate: rec.rate }];
      if (submit) {
        rec.status = "pending_approval";
        hist(rec, "Sent for approval");
        notifyApprovers(x, `Contract ${rec.id} for ${nameOf(x, rec.employee_code)} (${rateText(rec)}) is waiting for your approval.`, "/contracts?tab=contracts");
      }
      audit(x, existing ? "CONTRACT_UPDATE" : "CONTRACT_CREATE", `${rec.id} · ${rec.employee_code} · ${rateText(rec)} · ${rec.start_date}→${rec.end_date || "open"}${submit ? " · submitted" : ""}`);
      return { ok: true, id: rec.id };
    });
  }

  /** Draft contract straight from the employee record (called by the employee form). */
  function createContractFromEmployee(code, { submit = false } = {}) {
    const e = D().employees.find((y) => y.employee_code === code);
    if (!e || !isContingent(e)) return err("Only contingent workers get a contract.");
    const open = (D().contracts || []).find((c) => c.employee_code === code && !["terminated", "renewed", "rejected"].includes(c.status));
    if (open) return { ok: true, id: open.id, existing: true };
    const base = contractFromEmployee(e);
    return saveContract({ ...base, title: `${e.designation} – ${WORKER_TYPE_BY[workerTypeOf(e)]?.short} contract` }, { submit });
  }

  function submitContract(id) {
    if (!canManage()) return err("You cannot submit contracts.");
    const c = find(D(), id);
    if (!c) return err("Contract not found.");
    if (!["draft", "rejected"].includes(c.status)) return err("Only a draft can be sent for approval.");
    const errors = validateContract(c);
    if (Object.keys(errors).length) return err(Object.values(errors)[0]);
    return mutate((x) => {
      const r = find(x, id);
      r.status = "pending_approval";
      hist(r, "Sent for approval");
      notifyApprovers(x, `Contract ${r.id} for ${nameOf(x, r.employee_code)} is waiting for your approval.`, "/contracts?tab=contracts");
      audit(x, "CONTRACT_SUBMIT", r.id);
      return { ok: true };
    });
  }

  function decideContract(id, approve, note = "") {
    if (!canApprove()) return err(D().contractSettings?.approval_by === "super" ? "Only a Super Admin approves contracts." : "Only a payroll (Finance) admin or the Super Admin approves contracts.");
    const c = find(D(), id);
    if (!c || c.status !== "pending_approval") return err("This contract is not waiting for approval.");
    if (c.created_by === S().code && !isSuper()) return err("You prepared this contract; another approver must approve it.");
    if (!approve && !String(note).trim()) return err("Give a reason so HR knows what to fix.");
    const s = settings();
    if (approve && s.require_nda && ["freelance", "consultant", "agency"].includes(c.worker_type) && c.nda_signed !== "yes" && !String(note).includes("NDA")) {
      // Allowed, but the flag stays until it is signed.
    }
    return mutate((x) => {
      const r = find(x, id);
      if (approve) {
        r.status = "active";
        r.signed = { ...(r.signed || {}), company: { at: nowIso(), by: S().code } };
        hist(r, `Approved${note ? `: ${note}` : ""} · company signature applied`);
        if (r.parent_id) {
          const p = find(x, r.parent_id);
          if (p && !["terminated"].includes(p.status)) { p.status = "renewed"; hist(p, `Renewed as ${r.id}`); }
        }
        syncEmployee(x, r);
        pushNote(x, r.employee_code, `Your contract ${r.id} (${r.title}) is approved. Please review and e-sign it under My contract.`, "/my-contract");
        notifyHr(x, `Contract ${r.id} for ${nameOf(x, r.employee_code)} was approved.`, "/contracts?tab=contracts");
      } else {
        r.status = "rejected";
        r.rejection = note.trim();
        hist(r, `Rejected: ${note.trim()}`);
        notifyHr(x, `Contract ${r.id} for ${nameOf(x, r.employee_code)} was rejected: ${note.trim()}`, "/contracts?tab=contracts");
      }
      audit(x, approve ? "CONTRACT_APPROVE" : "CONTRACT_REJECT", `${id}${note ? ` · ${note}` : ""}`);
      return { ok: true };
    });
  }

  function signContract(id, { typedName, acceptNda }) {
    const c = find(D(), id);
    const me = D().employees.find((e) => e.employee_code === S()?.code);
    if (!c || !me || c.employee_code !== me.employee_code) return err("You can only sign your own contract.");
    if (!["active", "pending_approval"].includes(c.status)) return err("This contract cannot be signed now.");
    if (c.signed?.worker) return err("You have already signed this contract.");
    if (String(typedName || "").trim().toLowerCase() !== me.full_name.toLowerCase()) return err(`Type your full name exactly as “${me.full_name}” to sign.`);
    if (["freelance", "consultant", "agency"].includes(c.worker_type) && c.nda_signed !== "yes" && !acceptNda) return err("Accept the NDA / IP assignment to sign.");
    return mutate((x) => {
      const r = find(x, id);
      r.signed = { ...(r.signed || {}), worker: { at: nowIso(), name: me.full_name, ip: "recorded" } };
      if (acceptNda) r.nda_signed = "yes";
      hist(r, `E-signed by the worker${acceptNda ? " (NDA / IP assignment accepted)" : ""}`);
      syncEmployee(x, r);
      notifyHr(x, `${me.full_name} e-signed contract ${r.id}.`, "/contracts?tab=contracts");
      audit(x, "CONTRACT_SIGN", `${id} · ${me.employee_code}`);
      return { ok: true };
    });
  }

  function amendContract(id, a) {
    if (!canManage()) return err("Only HR or payroll admins can amend contracts.");
    const c = find(D(), id);
    if (!c || !["active", "suspended"].includes(c.status)) return err("Only live contracts can be amended.");
    if (!String(a.note || "").trim()) return err("Say why the contract is being amended.");
    const today = isoDate();
    if (a.type === "rate") {
      if (!(Number(a.rate) > 0)) return err("Enter the new rate.");
      if (!a.effective || a.effective < c.start_date) return err("Choose an effective date on or after the contract start.");
      if (c.end_date && a.effective > c.end_date) return err("The effective date is after the contract ends.");
    }
    if (a.type === "extension") {
      if (!a.end_date || (c.end_date && a.end_date <= c.end_date)) return err("Choose a new end date after the current one.");
      const chainLen = (D().contracts || []).filter((x) => x.employee_code === c.employee_code).length;
      if (chainLen > settings().max_renewals + 1 && !a.override) return err(`This worker already has ${chainLen} contracts. Repeated extensions are a co-employment risk; tick “I have reviewed the risk” to continue.`);
    }
    if (a.type === "hours" && !(Number(a.std_hours_week) > 0 && Number(a.std_hours_week) <= 60)) return err("Hours must be 1–60 a week.");
    if (a.type === "budget" && !(Number(a.budget_amount) >= 0)) return err("Enter the new budget.");
    return mutate((x) => {
      const r = find(x, id);
      const am = { id: `AMD-${(r.amendments || []).length + 1}`, type: a.type, at: nowIso(), by: S().code, note: a.note.trim(), effective: a.effective || today };
      if (a.type === "rate") {
        am.from = rateText(r);
        r.rate_history = [...(r.rate_history || [{ from: r.start_date, rate: r.rate }]).filter((h) => h.from < a.effective), { from: a.effective, rate: Number(a.rate) }];
        r.rate = Number(a.rate);
        am.to = rateText(r);
      } else if (a.type === "extension") {
        am.from = r.end_date || "open";
        r.end_date = a.end_date;
        am.to = a.end_date;
      } else if (a.type === "hours") {
        am.from = `${r.std_hours_week} h/week`;
        r.std_hours_week = Number(a.std_hours_week);
        am.to = `${r.std_hours_week} h/week`;
      } else if (a.type === "budget") {
        am.from = r.budget_amount ? money(r.budget_amount, r.currency) : "none";
        r.budget_amount = Number(a.budget_amount);
        am.to = money(r.budget_amount, r.currency);
      } else if (a.type === "scope") {
        am.from = (r.deliverables || "").slice(0, 80);
        r.deliverables = a.deliverables || r.deliverables;
        am.to = (r.deliverables || "").slice(0, 80);
      }
      r.amendments = [...(r.amendments || []), am];
      r.signed = { ...(r.signed || {}), worker_amendment_pending: am.id };
      hist(r, `Amended (${am.type}): ${am.from} → ${am.to}`);
      syncEmployee(x, r);
      pushNote(x, r.employee_code, `Your contract ${r.id} was amended (${am.type}): ${am.from} → ${am.to}, effective ${am.effective}.`, "/my-contract");
      audit(x, "CONTRACT_AMEND", `${id} · ${am.type} · ${am.from} → ${am.to}`);
      return { ok: true };
    });
  }

  function renewContract(id, { start_date, end_date, rate, title, note, submit = true }) {
    if (!canManage()) return err("Only HR or payroll admins can renew contracts.");
    const c = find(D(), id);
    if (!c || ["terminated", "renewed", "rejected", "draft"].includes(c.status)) return err("Only an active or expired contract can be renewed.");
    if ((D().contracts || []).some((o) => o.parent_id === id && !["rejected"].includes(o.status))) return err("A renewal for this contract already exists.");
    const start = start_date || addDays(c.end_date || isoDate(), 1);
    const copy = { ...c };
    ["id", "status", "signed", "history", "amendments", "created_at", "created_by", "rejection"].forEach((k) => delete copy[k]);
    return saveContract({ ...copy, kind: "renewal", parent_id: id, start_date: start, end_date, rate: Number(rate) || c.rate, title: title || c.title, milestones: c.pay_basis === "milestone" ? [] : [], renewal_note: note || "" }, { submit });
  }

  function terminateContract(id, { reason, last_day, note }) {
    if (!canManage()) return err("Only HR or payroll admins can end contracts.");
    const c = find(D(), id);
    if (!c || !["active", "suspended", "pending_approval"].includes(c.status)) return err("This contract is not live.");
    if (!reason) return err("Choose a reason.");
    if (!last_day) return err("Choose the last working day.");
    if (last_day < c.start_date) return err("The last day is before the contract started.");
    return mutate((x) => {
      const r = find(x, id);
      r.status = "terminated";
      r.termination = { reason, last_day, note: String(note || "").trim(), at: nowIso(), by: S().code };
      r.end_date = last_day < (r.end_date || "9999") ? last_day : r.end_date;
      hist(r, `Terminated (${reason}) · last day ${last_day}${note ? ` · ${note}` : ""}`);
      const e = x.employees.find((y) => y.employee_code === r.employee_code);
      if (e) e.fixed_term_end_date = r.end_date;
      // Open timesheets after the last day are withdrawn.
      x.timesheets.filter((t) => t.contract_id === id && ["draft", "submitted"].includes(t.status) && t.week_start > last_day).forEach((t) => { t.status = "rejected"; t.note = "Contract ended"; });
      pushNote(x, r.employee_code, `Your contract ${r.id} ends on ${last_day}. Submit your remaining timesheets; final payment follows in the next contractor pay run.`, "/my-contract");
      audit(x, "CONTRACT_TERMINATE", `${id} · ${reason} · ${last_day}`);
      return { ok: true };
    });
  }

  function setContractHold(id, hold, note = "") {
    if (!canManage()) return err("Only HR or payroll admins can do this.");
    const c = find(D(), id);
    if (!c || (hold ? c.status !== "active" : c.status !== "suspended")) return err(hold ? "Only an active contract can be put on hold." : "This contract is not on hold.");
    if (hold && !String(note).trim()) return err("Say why the contract is on hold.");
    return mutate((x) => {
      const r = find(x, id);
      r.status = hold ? "suspended" : "active";
      hist(r, hold ? `Put on hold: ${note}` : "Resumed");
      pushNote(x, r.employee_code, hold ? `Your contract ${r.id} is on hold: ${note}. Do not log time until it resumes.` : `Your contract ${r.id} has resumed.`, "/my-contract");
      audit(x, hold ? "CONTRACT_HOLD" : "CONTRACT_RESUME", `${id}${note ? ` · ${note}` : ""}`);
      return { ok: true };
    });
  }

  function deleteContractDraft(id) {
    if (!canManage()) return err("Not allowed.");
    const c = find(D(), id);
    if (!c || !["draft", "rejected"].includes(c.status)) return err("Only drafts can be deleted.");
    return mutate((x) => {
      x.contracts = x.contracts.filter((r) => r.id !== id);
      audit(x, "CONTRACT_DELETE", id);
      return { ok: true };
    });
  }

  function requestRenewal(id, note) {
    const c = find(D(), id);
    if (!c || c.employee_code !== S()?.code) return err("You can only ask about your own contract.");
    if (!String(note || "").trim()) return err("Add a short message for HR.");
    return mutate((x) => {
      const r = find(x, id);
      r.renewal_request = { at: nowIso(), note: note.trim() };
      hist(r, `Worker asked about renewal: ${note.trim()}`);
      notifyHr(x, `${nameOf(x, r.employee_code)} asked about renewing ${r.id} (ends ${r.end_date}): ${note.trim()}`, "/contracts?tab=contracts");
      const ap = approverOf(r, x.employees.find((e) => e.employee_code === r.employee_code));
      if (ap) pushNote(x, ap, `${nameOf(x, r.employee_code)} asked about renewing their contract (ends ${r.end_date}).`, "/team-timesheets");
      audit(x, "CONTRACT_RENEWAL_REQUEST", id);
      return { ok: true };
    });
  }

  function saveMilestones(id, list) {
    if (!canManage()) return err("Only HR or payroll admins can plan milestones.");
    const c = find(D(), id);
    if (!c) return err("Contract not found.");
    const bad = list.find((m) => !String(m.title || "").trim() || !(Number(m.amount) > 0) || !m.due);
    if (bad) return err("Each milestone needs a title, due date and amount.");
    const sum = list.reduce((s, m) => s + Number(m.amount), 0);
    if (c.pay_basis === "milestone" && Math.round(sum) > Math.round(Number(c.rate))) return err(`Milestones add up to ${money(sum, c.currency)}, more than the fee of ${money(c.rate, c.currency)}.`);
    return mutate((x) => {
      const r = find(x, id);
      const keep = (r.milestones || []).filter((m) => !["planned", "rejected"].includes(m.status));
      const planned = list.filter((m) => !keep.some((k) => k.id === m.id)).map((m, i) => ({ id: m.id || `MS-${Date.now().toString(36)}${i}`, title: m.title.trim(), due: m.due, amount: Number(m.amount), status: m.status === "rejected" ? "rejected" : "planned" }));
      r.milestones = [...keep, ...planned].sort((a, b) => a.due.localeCompare(b.due));
      hist(r, `Milestones updated (${r.milestones.length})`);
      audit(x, "CONTRACT_MILESTONES", `${id} · ${r.milestones.length}`);
      return { ok: true };
    });
  }

  function submitMilestone(id, msId, note) {
    const c = find(D(), id);
    if (!c || (c.employee_code !== S()?.code && !canManage())) return err("Not allowed.");
    const m = c.milestones?.find((y) => y.id === msId);
    if (!m || !["planned", "rejected"].includes(m.status)) return err("This milestone cannot be submitted.");
    if (!String(note || "").trim()) return err("Describe what you delivered.");
    return mutate((x) => {
      const r = find(x, id);
      const mm = r.milestones.find((y) => y.id === msId);
      Object.assign(mm, { status: "submitted", submitted_at: nowIso(), note: note.trim() });
      hist(r, `Milestone “${mm.title}” submitted`);
      const ap = approverOf(r, x.employees.find((e) => e.employee_code === r.employee_code));
      if (ap) pushNote(x, ap, `${nameOf(x, r.employee_code)} submitted milestone “${mm.title}” (${money(mm.amount, r.currency)}) for acceptance.`, "/team-timesheets");
      notifyHr(x, `${nameOf(x, r.employee_code)} submitted milestone “${mm.title}”.`, "/contracts?tab=timesheets");
      audit(x, "MILESTONE_SUBMIT", `${id} · ${msId}`);
      return { ok: true };
    });
  }

  function decideMilestone(id, msId, approve, note = "") {
    const c = find(D(), id);
    if (!c) return err("Contract not found.");
    const emp = D().employees.find((e) => e.employee_code === c.employee_code);
    if (!(canManage() || S()?.code === approverOf(c, emp))) return err("Only the approver or HR can accept milestones.");
    const m = c.milestones?.find((y) => y.id === msId);
    if (!m || m.status !== "submitted") return err("This milestone is not waiting for acceptance.");
    if (!approve && !String(note).trim()) return err("Say what needs to change.");
    return mutate((x) => {
      const r = find(x, id);
      const mm = r.milestones.find((y) => y.id === msId);
      Object.assign(mm, { status: approve ? "approved" : "rejected", decided_by: S().code, decided_at: nowIso(), decision_note: note.trim() });
      hist(r, `Milestone “${mm.title}” ${approve ? "accepted" : `sent back: ${note.trim()}`}`);
      pushNote(x, r.employee_code, approve ? `Milestone “${mm.title}” was accepted. It will be paid in the next contractor pay run.` : `Milestone “${mm.title}” was sent back: ${note.trim()}`, "/my-contract?tab=milestones");
      audit(x, approve ? "MILESTONE_APPROVE" : "MILESTONE_REJECT", `${id} · ${msId}`);
      return { ok: true };
    });
  }

  // ── Timesheets ────────────────────────────────────
  function saveTimesheet(input, { submit = false } = {}) {
    const d = D();
    const c = (d.contracts || []).find((y) => y.id === input.contract_id);
    if (!c) return err("There is no contract for this timesheet.");
    const self = S()?.code === c.employee_code;
    if (!self && !canManage()) return err("You can only fill in your own timesheet.");
    const st = contractState(c, settings());
    if (!["active", "expiring", "expired", "terminated"].includes(st)) return err(st === "suspended" ? "Your contract is on hold — time cannot be logged." : "The contract is not active yet.");
    const ws = weekStart(input.week_start);
    const existing = (d.timesheets || []).find((t) => t.id === input.id) || (d.timesheets || []).find((t) => t.contract_id === c.id && t.week_start === ws);
    if (existing && !["draft", "rejected"].includes(existing.status)) return err("This week has already been submitted.");
    const ts = { ...(existing || {}), ...input, week_start: ws, entries: (input.entries || []).map((e) => ({ date: e.date, hours: Number(e.hours) || 0, ot_hours: Number(e.ot_hours) || 0, task: String(e.task || "").trim() })) };
    if (submit) {
      const errors = validateTimesheet(c, ts, settings());
      if (errors.length) return { ok: false, error: errors[0], errors };
    }
    return mutate((x) => {
      ensure(x);
      let rec = existing ? x.timesheets.find((t) => t.id === existing.id) : null;
      if (!rec) {
        rec = { id: nextSeq(x.timesheets, "TS-", "id", 4), contract_id: c.id, employee_code: c.employee_code, week_start: ws, status: "draft", comments: [] };
        x.timesheets.unshift(rec);
      }
      rec.entries = ts.entries;
      // v10.7: one line per project, and an optional client approval attachment
      if (input.lines) rec.lines = input.lines;
      if (input.client_approval !== undefined) rec.client_approval = input.client_approval;
      rec.approver = approverOf(c, x.employees.find((e) => e.employee_code === c.employee_code));
      if (submit) {
        rec.status = "submitted";
        rec.submitted_at = nowIso();
        rec.note = "";
        const tot = timesheetTotals(rec);
        if (rec.approver) pushNote(x, rec.approver, `${nameOf(x, c.employee_code)} submitted a timesheet for the week of ${ws}: ${tot.hours} h${tot.ot ? ` + ${tot.ot} h overtime` : ""}.`, "/team-timesheets");
        else notifyHr(x, `${nameOf(x, c.employee_code)} submitted a timesheet (no approver set).`, "/contracts?tab=timesheets");
        if (!self) rec.entered_by = S().code;
      }
      audit(x, submit ? "TIMESHEET_SUBMIT" : "TIMESHEET_SAVE", `${rec.id} · ${c.employee_code} · week ${ws} · ${timesheetTotals(rec).total} h`);
      return { ok: true, id: rec.id };
    });
  }

  function decideTimesheets(ids, approve, note = "") {
    const d = D();
    const list = (d.timesheets || []).filter((t) => ids.includes(t.id) && t.status === "submitted");
    if (!list.length) return err("Nothing is waiting for approval.");
    const mine = list.filter((t) => canManage() || t.approver === S()?.code);
    if (mine.length !== list.length) return err("You can only approve timesheets assigned to you.");
    if (list.some((t) => t.employee_code === S()?.code)) return err("You cannot approve your own timesheet.");
    if (!approve && !String(note).trim()) return err("Say what needs to change.");
    return mutate((x) => {
      list.forEach((l) => {
        const t = x.timesheets.find((y) => y.id === l.id);
        Object.assign(t, { status: approve ? "approved" : "rejected", decided_by: S().code, decided_at: nowIso(), note: note.trim() });
        t.comments = [...(t.comments || []), ...(note.trim() ? [{ at: nowIso(), by: S().code, text: note.trim() }] : [])];
        pushNote(x, t.employee_code, approve ? `Your timesheet for the week of ${t.week_start} was approved.` : `Your timesheet for the week of ${t.week_start} was sent back: ${note.trim()}`, "/my-contract?tab=timesheets");
      });
      audit(x, approve ? "TIMESHEET_APPROVE" : "TIMESHEET_REJECT", `${list.map((t) => t.id).join(", ")}${note ? ` · ${note}` : ""}`);
      return { ok: true, count: list.length };
    });
  }

  function remindTimesheet(contractId) {
    if (!canManage()) return err("Not allowed.");
    const c = find(D(), contractId);
    if (!c) return err("Contract not found.");
    return mutate((x) => {
      pushNote(x, c.employee_code, `Reminder: please submit your timesheet for the week of ${addDays(weekStart(), -7)}.`, "/my-contract?tab=timesheets");
      audit(x, "TIMESHEET_REMIND", `${c.employee_code}`);
      return { ok: true };
    });
  }

  // ── Contractor pay run ────────────────────────────
  function lopFor(d, code, period) {
    return d.requests.filter((r) => r.type === "leave" && r.leave_type === "LOP" && r.status === "Approved" && r.employee_code === code && r.from_date.startsWith(period)).reduce((s, r) => s + r.days, 0);
  }
  function previewRun(period) {
    const d = D();
    const { start, end } = monthBounds(period);
    const taken = new Set((d.contractRuns || []).filter((r) => r.period === period && r.status !== "rejected").flatMap((r) => r.lines.filter((l) => l.basis === "monthly").map((l) => l.contract_id)));
    return (d.contracts || [])
      .filter((c) => ["active", "suspended", "terminated", "renewed"].includes(c.status) && c.start_date <= end && (!c.end_date || c.end_date >= start || (d.timesheets || []).some((t) => t.contract_id === c.id && t.status === "approved")))
      .map((c) => contractPayLine({ ...d, contractSettings: settings() }, c.pay_basis === "monthly" && taken.has(c.id) ? { ...c, pay_basis: "monthly_done" } : c, period, { lopDays: lopFor(d, c.employee_code, period) }))
      .filter((l) => l.has_work);
  }
  function createContractRun(period, contractIds) {
    if (!canManage()) return err("Only HR or payroll admins can prepare contractor pay runs.");
    if (!/^\d{4}-\d{2}$/.test(period || "")) return err("Choose the pay month.");
    if ((D().contractRuns || []).some((r) => r.period === period && ["draft", "pending_approval", "approved"].includes(r.status))) return err(`There is already an open run for ${periodLabel(period)}. Finish or reject it first.`);
    const lines = previewRun(period).filter((l) => !contractIds || contractIds.includes(l.contract_id));
    if (!lines.length) return err("Nothing to pay: no approved timesheets, accepted milestones or monthly contracts for this month.");
    return mutate((x) => {
      ensure(x);
      const id = nextSeq(x.contractRuns, "CPR-", "id", 4);
      x.contractRuns.unshift({ id, period, status: "draft", lines, created_by: S().code, created_at: nowIso(), history: [{ at: nowIso(), by: S().code, action: `Run created · ${lines.length} contract(s)` }] });
      audit(x, "CONTRACT_RUN_CREATE", `${id} · ${period} · ${lines.length} lines`);
      return { ok: true, id };
    });
  }
  function submitContractRun(id) {
    if (!canManage()) return err("Not allowed.");
    const run = (D().contractRuns || []).find((r) => r.id === id);
    if (!run || run.status !== "draft") return err("Only a draft run can be sent.");
    return mutate((x) => {
      const r = x.contractRuns.find((y) => y.id === id);
      r.status = "pending_approval";
      r.history.push({ at: nowIso(), by: S().code, action: "Sent to Finance" });
      notifyApprovers(x, `Contractor pay run ${id} for ${periodLabel(r.period)} (${r.lines.length} contracts) is waiting for approval.`, "/contracts?tab=pay");
      audit(x, "CONTRACT_RUN_SUBMIT", id);
      return { ok: true };
    });
  }
  function decideContractRun(id, approve, note = "") {
    if (!canApprove()) return err("Only Finance (payroll admins) or the Super Admin approve contractor pay runs.");
    const run = (D().contractRuns || []).find((r) => r.id === id);
    if (!run || run.status !== "pending_approval") return err("This run is not waiting for approval.");
    if (run.created_by === S().code && !isSuper()) return err("You prepared this run; someone else must approve it.");
    if (!approve && !String(note).trim()) return err("Give a reason.");
    return mutate((x) => {
      const r = x.contractRuns.find((y) => y.id === id);
      r.status = approve ? "approved" : "rejected";
      Object.assign(r, approve ? { approved_by: S().code, approved_at: nowIso() } : { rejected_by: S().code, rejection: note.trim() });
      r.history.push({ at: nowIso(), by: S().code, action: approve ? `Approved${note ? `: ${note}` : ""}` : `Rejected: ${note.trim()}` });
      notifyHr(x, `Contractor pay run ${id} was ${approve ? "approved — post it to create payslips and invoices" : `rejected: ${note.trim()}`}.`, "/contracts?tab=pay");
      audit(x, approve ? "CONTRACT_RUN_APPROVE" : "CONTRACT_RUN_REJECT", id);
      return { ok: true };
    });
  }
  function snapshot(e) {
    const o = { full_name: e.full_name, email: e.email, worker_type: e.worker_type, grade_code: e.grade_code || "", city: e.city || "", country_code: e.country_code || "IN", po_number: e.po_number || "", cost_centre: e.cost_centre || "", business_name: e.business_name || "", gstin: e.gstin || "" };
    PAYSLIP_EMPLOYEE_FIELDS.forEach(([k]) => { o[k] = k === "payment_mode" ? PAYMENT_MODE_LABEL[e.payment_mode] || e.payment_mode || "Bank Transfer" : e[k] || ""; });
    return o;
  }
  /** Post an approved run: payroll lines → draft payslip run (normal Finance → Super Admin → release flow); invoice and vendor lines → invoices. */
  function postContractRun(id) {
    if (!(canApprove() || canManage())) return err("Not allowed.");
    const run = (D().contractRuns || []).find((r) => r.id === id);
    if (!run || run.status !== "approved") return err("Only an approved run can be posted.");
    const s = settings();
    return mutate((x) => {
      ensure(x);
      const r = x.contractRuns.find((y) => y.id === id);
      const warnings = [];
      // Payroll route → payslip batch
      const payroll = r.lines.filter((l) => l.route === "payroll");
      let batchId = null;
      if (payroll.length) {
        const rows = [];
        payroll.forEach((l) => {
          const e = x.employees.find((y) => y.employee_code === l.employee_code);
          const clash = x.payslipBatches.some((b) => b.period === r.period && b.status !== "Rejected" && b.slips.some((sl) => sl.employee_code === l.employee_code));
          if (clash) { warnings.push(`${l.name} already has a payslip for ${periodLabel(r.period)}; add this pay as an adjustment.`); return; }
          rows.push({ row: contractPayslipRow(e, l, r.period), e });
        });
        if (rows.length) {
          batchId = nextSeq(x.payslipBatches, "PSB-", "id", 4);
          // Make sure the contract payslip lines exist and are active.
          const active = x.payslipComponents.filter((k) => k.status === "Active");
          x.payslipBatches.unshift({
            id: batchId, period: r.period, source: "contracts", contract_run_id: r.id, note: `Contract workers · ${r.id}`, status: "Draft", created_by: S().code, created_at: nowIso(),
            components: JSON.parse(JSON.stringify(active)),
            slips: rows.map(({ row, e }, i) => ({ id: `${batchId}-${String(i + 1).padStart(3, "0")}`, employee_code: row.employee_code, actual_payable_days: row.actual_payable_days, total_working_days: row.total_working_days, lop_days: row.lop_days, days_payable: row.days_payable, values: row.values, emp: snapshot(e), emailed_at: null })),
            history: [{ at: nowIso(), by: S().code, action: `Created from contractor pay run ${r.id} · ${rows.length} payslip(s)` }],
          });
          x.admins.filter((a) => a.status === "active" && a.modules.includes("payslips")).forEach((a) => pushNote(x, a.admin_code, `Draft payslip run ${batchId} for contract workers (${periodLabel(r.period)}) is ready to review and send to Finance.`, "/payslips"));
        }
      }
      // Invoice route → self-billed invoices
      const invIds = [];
      const seq = () => x.contractInvoices.filter((i) => i.period === r.period).length + 1;
      r.lines.filter((l) => l.route === "invoice").forEach((l) => {
        const invId = `${s.invoice_prefix}${r.period.replace("-", "")}/${String(seq()).padStart(3, "0")}`;
        x.contractInvoices.unshift({ id: invId, kind: "self_billed", run_id: r.id, period: r.period, employee_code: l.employee_code, contract_id: l.contract_id, currency: l.currency, lines: invoiceLines(l), subtotal: l.gross, gst: l.gst, tds: l.tds, total: r2(l.gross + l.gst), net_payable: l.net, status: "approved", issued_at: nowIso(), due_date: addDays(isoDate(), Number(s.payment_terms_days) || 15) });
        invIds.push(invId);
        pushNote(x, l.employee_code, `Self-billed invoice ${invId} for ${periodLabel(r.period)} was raised: ${money(l.net, l.currency)} net after TDS. Payment within ${s.payment_terms_days} days.`, "/my-contract?tab=payments");
      });
      // Vendor route → one invoice per vendor
      const byVendor = {};
      r.lines.filter((l) => l.route === "vendor").forEach((l) => { (byVendor[l.vendor_id || "?"] = byVendor[l.vendor_id || "?"] || []).push(l); });
      Object.entries(byVendor).forEach(([vid, ls]) => {
        const v = x.contractVendors.find((y) => y.id === vid);
        const invId = `${s.vendor_invoice_prefix}${r.period.replace("-", "")}/${String(seq()).padStart(3, "0")}`;
        const sub = r2(ls.reduce((a, l) => a + l.invoice_base, 0));
        const gst = r2(ls.reduce((a, l) => a + l.gst, 0));
        const tds = r2(ls.reduce((a, l) => a + l.tds, 0));
        x.contractInvoices.unshift({ id: invId, kind: "vendor", run_id: r.id, period: r.period, vendor_id: vid, currency: "INR", lines: ls.flatMap(invoiceLines), subtotal: sub, gst, tds, total: r2(sub + gst), net_payable: r2(sub + gst - tds), status: "approved", issued_at: nowIso(), due_date: addDays(isoDate(), Number(v?.payment_terms_days) || 30) });
        invIds.push(invId);
      });
      // Mark timesheets and milestones as paid in this run
      const tsIds = new Set(r.lines.flatMap((l) => l.timesheet_ids));
      x.timesheets.forEach((t) => { if (tsIds.has(t.id)) { t.status = "processed"; t.run_id = r.id; } });
      r.lines.forEach((l) => {
        const c = find(x, l.contract_id);
        (c?.milestones || []).forEach((m) => { if (l.milestone_ids.includes(m.id)) { m.status = "processed"; m.run_id = r.id; } });
      });
      Object.assign(r, { status: "posted", posted_at: nowIso(), posted_by: S().code, payslip_batch_id: batchId, invoice_ids: invIds, warnings });
      r.history.push({ at: nowIso(), by: S().code, action: `Posted: ${batchId ? `payslip run ${batchId}` : "no payroll lines"}, ${invIds.length} invoice(s)${warnings.length ? ` · ${warnings.length} warning(s)` : ""}` });
      audit(x, "CONTRACT_RUN_POST", `${id} · payslips ${batchId || "—"} · invoices ${invIds.join(", ") || "—"}`);
      return { ok: true, batchId, invoices: invIds.length, warnings };
    });
  }
  function deleteContractRun(id) {
    if (!canManage()) return err("Not allowed.");
    const run = (D().contractRuns || []).find((r) => r.id === id);
    if (!run || !["draft", "rejected"].includes(run.status)) return err("Only draft or rejected runs can be deleted.");
    return mutate((x) => {
      x.contractRuns = x.contractRuns.filter((r) => r.id !== id);
      audit(x, "CONTRACT_RUN_DELETE", id);
      return { ok: true };
    });
  }
  function payInvoice(id, { utr, date }) {
    if (!(isSuper() || has("payroll"))) return err("Only Finance or the Super Admin record payments.");
    const inv = (D().contractInvoices || []).find((i) => i.id === id);
    if (!inv || inv.status !== "approved") return err("This invoice is not waiting for payment.");
    if (!/^[A-Z0-9]{8,22}$/i.test(String(utr || "").trim())) return err("Enter the bank reference (UTR), 8–22 letters or digits.");
    return mutate((x) => {
      const i = x.contractInvoices.find((y) => y.id === id);
      Object.assign(i, { status: "paid", paid_at: date ? `${date}T12:00:00.000Z` : nowIso(), utr: utr.trim().toUpperCase(), paid_by: S().code });
      if (i.employee_code) pushNote(x, i.employee_code, `Invoice ${i.id} was paid: ${money(i.net_payable, i.currency)} (UTR ${i.utr}). Your payment advice is under My contract → Payments.`, "/my-contract?tab=payments");
      audit(x, "CONTRACT_INVOICE_PAID", `${id} · ${i.utr}`);
      return { ok: true };
    });
  }
  function cancelInvoice(id, note) {
    if (!(isSuper() || has("payroll"))) return err("Only Finance or the Super Admin can cancel invoices.");
    if (!String(note || "").trim()) return err("Give a reason.");
    return mutate((x) => {
      const i = x.contractInvoices.find((y) => y.id === id);
      if (!i || i.status !== "approved") return err("Only unpaid invoices can be cancelled.");
      Object.assign(i, { status: "cancelled", cancel_note: note.trim() });
      audit(x, "CONTRACT_INVOICE_CANCEL", `${id} · ${note}`);
      return { ok: true };
    });
  }

  // ── Vendors & settings ────────────────────────────
  function upsertVendor(v) {
    if (!canManage()) return err("Not allowed.");
    if (!String(v.name || "").trim()) return err("Enter the vendor name.");
    if (v.gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(String(v.gstin).toUpperCase())) return err("GSTIN must be 15 characters, like 36AACCT7781M1ZQ.");
    if (!(Number(v.markup_pct) >= 0 && Number(v.markup_pct) <= 100)) return err("Markup must be 0–100%.");
    return mutate((x) => {
      ensure(x);
      const clean = { ...v, name: v.name.trim(), gstin: String(v.gstin || "").toUpperCase(), markup_pct: Number(v.markup_pct), payment_terms_days: Number(v.payment_terms_days) || 30, status: v.status || "active" };
      const ex = x.contractVendors.find((y) => y.id === v.id);
      if (ex) Object.assign(ex, clean);
      else x.contractVendors.push({ ...clean, id: nextSeq(x.contractVendors, "VEN-", "id", 2) });
      audit(x, "VENDOR_SAVE", `${clean.name} · markup ${clean.markup_pct}%`);
      return { ok: true };
    });
  }
  function updateContractSettings(patch) {
    if (!(isSuper() || has("payroll") || has("contracts"))) return err("Not allowed.");
    if (patch.approval_by && !isSuper()) return err("Only the Super Admin changes who approves contracts.");
    return mutate((x) => {
      ensure(x);
      x.contractSettings = { ...x.contractSettings, ...patch };
      audit(x, "CONTRACT_SETTINGS", Object.keys(patch).join(", "));
      return { ok: true };
    });
  }

  return {
    contractPreviewRun: previewRun,
    saveContract, createContractFromEmployee, submitContract, decideContract, signContract, amendContract, renewContract, terminateContract, setContractHold, deleteContractDraft, requestRenewal,
    saveMilestones, submitMilestone, decideMilestone,
    saveTimesheet, decideTimesheets, remindTimesheet,
    createContractRun, submitContractRun, decideContractRun, postContractRun, deleteContractRun, payInvoice, cancelInvoice,
    upsertVendor, updateContractSettings,
  };
}
