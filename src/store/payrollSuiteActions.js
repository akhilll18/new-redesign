// Payroll suite actions (v8.6): payroll admin settings, salary revisions & the increment cycle,
// component (flexible benefit) claims, perquisites, the loan ledger and Form 16 / Form 130.
// Admins with the "payroll" module and Super Admins can act; every change is audited.
import { nowIso, isoDate, nextSeq } from "../lib/utils.js";
import { revisionBuckets, certName, addMonths, monthOf } from "../lib/payrollSuite.js";

const err = (error) => ({ ok: false, error });

export function makePayrollSuiteActions({ mutate, dataRef, sessionRef, pushAudit, pushNote }) {
  const S = () => sessionRef.current;
  const D = () => dataRef.current;
  const can = () => S()?.role === "superadmin" || (S()?.role === "admin" && !!D().admins.find((a) => a.admin_code === S().code)?.modules.includes("payroll"));
  const audit = (x, a, d) => pushAudit(x, S().code, S().role, a, d);
  const nameOf = (x, c) => x.employees.find((e) => e.employee_code === c)?.full_name || c;
  const guard = () => (can() ? null : err("Only payroll admins and Super Admins can do this."));

  // ── Payroll admin ────────────────────────────────
  function updatePaySettings(patch, label = "settings") {
    const g = guard();
    if (g) return g;
    return mutate((x) => {
      x.paySettings = { ...x.paySettings, ...patch };
      audit(x, "PAYROLL_SETTINGS", `${label} updated`);
      return { ok: true };
    });
  }

  // ── Salary revisions ─────────────────────────────
  function proposeRevision({ employee_code, new_gross, effective, reason }) {
    const g = guard();
    if (g) return g;
    const e = D().employees.find((y) => y.employee_code === employee_code);
    if (!e) return err("Choose an employee.");
    const ng = Math.round(Number(new_gross));
    if (!ng || ng <= 0) return err("Enter the new monthly gross.");
    if (!effective) return err("Choose the effective date.");
    if (!String(reason || "").trim()) return err("Give a reason (appraisal, promotion, market correction…).");
    return mutate((x) => {
      const id = nextSeq(x.salaryRevisions, "REV-", "id", 3);
      const old = Number(e.monthly_gross) || 0;
      x.salaryRevisions.push({ id, employee_code, old_gross: old, new_gross: ng, pct: Math.round(((ng - old) / Math.max(1, old)) * 1000) / 10, effective, status: "approved", reason: reason.trim(), created_at: nowIso(), by: S().code });
      audit(x, "SALARY_REVISION", `${id} · ${employee_code} · ${old} → ${ng} from ${effective}`);
      return { ok: true, id };
    });
  }

  /** Apply due revisions to the employee master and record arrears for months already processed. */
  function applyRevisions(ids) {
    const g = guard();
    if (g) return g;
    const today = isoDate();
    const due = revisionBuckets(D().salaryRevisions, today).pending.filter((r) => !ids || ids.includes(r.id));
    if (!due.length) return err("No revisions are due.");
    return mutate((x) => {
      let arrearsTotal = 0;
      due.forEach((d) => {
        const r = x.salaryRevisions.find((y) => y.id === d.id);
        const e = x.employees.find((y) => y.employee_code === r.employee_code);
        if (!e) return;
        // Months between the effective month and last month were paid at the old rate.
        let months = 0;
        for (let m = monthOf(r.effective); m < monthOf(today); m = addMonths(m, 1)) months += 1;
        const arrears = x.paySettings.options.arrears ? Math.max(0, (r.new_gross - r.old_gross) * months) : 0;
        r.old_gross = Number(e.monthly_gross) || r.old_gross;
        e.monthly_gross = r.new_gross;
        r.status = "applied";
        r.applied_at = nowIso();
        r.arrears = arrears;
        arrearsTotal += arrears;
        pushNote(x, e.employee_code, `Your salary revision (${r.reason}) is effective from ${r.effective}. New monthly gross: ${r.new_gross.toLocaleString("en-IN")}${arrears ? `; arrears of ${arrears.toLocaleString("en-IN")} will be paid with this month's salary` : ""}.`, "/finances");
      });
      audit(x, "SALARY_REVISION_APPLY", `${due.length} revision(s) applied · arrears ${arrearsTotal}`);
      return { ok: true, count: due.length, arrears: arrearsTotal };
    });
  }

  function cancelRevision(id, note) {
    const g = guard();
    if (g) return g;
    if (!String(note || "").trim()) return err("Say why the revision is being withdrawn.");
    return mutate((x) => {
      const r = x.salaryRevisions.find((y) => y.id === id);
      if (!r || r.status === "applied") return err("Applied revisions cannot be withdrawn; propose a new one instead.");
      r.status = "withdrawn";
      r.note = note.trim();
      audit(x, "SALARY_REVISION_WITHDRAW", `${id} · ${note.trim()}`);
      return { ok: true };
    });
  }

  // ── Increment cycle ──────────────────────────────
  function saveCompCycle(patch) {
    const g = guard();
    if (g) return g;
    return mutate((x) => {
      x.compCycle = { ...x.compCycle, ...patch };
      audit(x, "COMP_CYCLE_SAVE", `${x.compCycle.name} · budget ${x.compCycle.budget_pct}%`);
      return { ok: true };
    });
  }
  function finaliseCompCycle(rows) {
    const g = guard();
    if (g) return g;
    const c = D().compCycle;
    if (c.status === "Finalised") return err("This cycle is already finalised.");
    const list = rows.filter((r) => r.pct > 0);
    if (!list.length) return err("No increments proposed.");
    return mutate((x) => {
      list.forEach((r) => {
        const e = x.employees.find((y) => y.employee_code === r.code);
        const id = nextSeq(x.salaryRevisions, "REV-", "id", 3);
        x.salaryRevisions.push({ id, employee_code: r.code, old_gross: e.monthly_gross, new_gross: Math.round(e.monthly_gross * (1 + r.pct / 100)), pct: r.pct, effective: c.effective, status: "approved", reason: x.compCycle.name, created_at: nowIso(), by: S().code });
      });
      x.compCycle.status = "Finalised";
      x.compCycle.finalised_at = nowIso();
      x.compCycle.finalised_by = S().code;
      audit(x, "COMP_CYCLE_FINALISE", `${list.length} revision(s) effective ${c.effective}`);
      return { ok: true, count: list.length };
    });
  }

  // ── Component claims ─────────────────────────────
  function createComponentClaim(c) {
    const self = c.employee_code === S()?.code;
    if (!self && !can()) return err("You cannot raise claims for other people.");
    const d = D();
    const comp = d.paySettings.components.find((k) => k.code === c.component && k.type === "fbp" && k.active);
    if (!comp) return err("Choose a claimable component.");
    const amt = Number(c.amount);
    if (!amt || amt <= 0) return err("Enter the bill amount.");
    if (!c.bill_date) return err("Enter the bill date.");
    if (c.bill_date > isoDate()) return err("The bill date cannot be in the future.");
    if (!c.bill?.name) return err("Attach the bill.");
    const ent = d.fbp[c.employee_code]?.[c.component] || 0;
    const used = d.componentClaims.filter((x) => x.employee_code === c.employee_code && x.component === c.component && ["Pending", "Approved", "Paid"].includes(x.status)).reduce((s, x) => s + x.amount, 0);
    if (amt > ent - used) return err(`Only ${Math.max(0, ent - used).toLocaleString("en-IN")} of the ${comp.name} entitlement is left this year.`);
    return mutate((x) => {
      const id = nextSeq(x.componentClaims, "CLM-", "id", 4);
      x.componentClaims.unshift({ id, employee_code: c.employee_code, component: c.component, amount: amt, bill_date: c.bill_date, bill: c.bill, description: (c.description || "").trim(), note: "", status: "Pending", submitted_at: nowIso(), decided_by: null, decided_at: null, raised_by: S().code });
      if (!self) pushNote(x, c.employee_code, `Payroll raised a ${comp.name} claim (${id}) of ${amt.toLocaleString("en-IN")} for you.`, "/finances");
      audit(x, "COMPONENT_CLAIM", `${id} · ${c.employee_code} · ${c.component} · ${amt}`);
      return { ok: true, id };
    });
  }
  function decideComponentClaims(ids, decision, note = "") {
    const g = guard();
    if (g) return g;
    if (decision === "Rejected" && !note.trim()) return err("Give the reason for rejecting.");
    return mutate((x) => {
      const month = monthOf();
      let n = 0;
      ids.forEach((id) => {
        const c = x.componentClaims.find((y) => y.id === id);
        if (!c || c.status !== "Pending") return;
        c.status = decision;
        c.note = note.trim();
        c.decided_by = S().code;
        c.decided_at = nowIso();
        if (decision === "Approved") c.payroll_month = month;
        n += 1;
        const comp = x.paySettings.components.find((k) => k.code === c.component)?.name || c.component;
        pushNote(x, c.employee_code, decision === "Approved" ? `Your ${comp} claim ${c.id} was approved and will be paid with the ${month} salary.` : `Your ${comp} claim ${c.id} was rejected: ${note.trim()}`, "/finances");
      });
      audit(x, "COMPONENT_CLAIM_DECIDE", `${n} claim(s) ${decision.toLowerCase()}`);
      return { ok: true, count: n };
    });
  }
  function markClaimsPaid(month) {
    const g = guard();
    if (g) return g;
    return mutate((x) => {
      const list = x.componentClaims.filter((c) => c.status === "Approved" && c.payroll_month <= month);
      list.forEach((c) => { c.status = "Paid"; c.paid_at = nowIso(); });
      audit(x, "COMPONENT_CLAIM_PAID", `${list.length} claim(s) paid with ${month} payroll`);
      return { ok: true, count: list.length };
    });
  }
  function setFbp(code, patch) {
    const g = guard();
    if (g) return g;
    return mutate((x) => {
      x.fbp[code] = { ...(x.fbp[code] || {}), ...patch };
      audit(x, "FBP_UPDATE", `${code} · ${JSON.stringify(patch)}`);
      return { ok: true };
    });
  }

  // ── Perquisites ──────────────────────────────────
  function upsertPerk(p) {
    const g = guard();
    if (g) return g;
    if (!p.employee_code) return err("Choose an employee.");
    if (!p.type) return err("Choose the perquisite.");
    if (!p.from) return err("Enter the start date.");
    return mutate((x) => {
      if (p.id) {
        const cur = x.perks.find((y) => y.id === p.id);
        Object.assign(cur, p);
        audit(x, "PERK_UPDATE", `${p.id}`);
        return { ok: true, id: p.id };
      }
      const id = nextSeq(x.perks, "PRK-", "id", 3);
      x.perks.unshift({ ...p, id, status: "active", to: "" });
      pushNote(x, p.employee_code, `A taxable perquisite was added to your pay from ${p.from}. It is shown on your payslip and tax certificate.`, "/finances");
      audit(x, "PERK_ADD", `${id} · ${p.employee_code} · ${p.type}`);
      return { ok: true, id };
    });
  }
  function endPerk(id, to) {
    const g = guard();
    if (g) return g;
    return mutate((x) => {
      const p = x.perks.find((y) => y.id === id);
      p.status = "ended";
      p.to = to || isoDate();
      audit(x, "PERK_END", `${id} · ${p.to}`);
      return { ok: true };
    });
  }

  // ── Loans ────────────────────────────────────────
  function recordLoanRepayment(loanId, { amount, note, foreclose }) {
    const g = guard();
    if (g) return g;
    const amt = Number(amount);
    if (!amt || amt <= 0) return err("Enter the amount received.");
    return mutate((x) => {
      const l = (x.loanLedger[loanId] = x.loanLedger[loanId] || { repayments: [], paused_months: [] });
      l.repayments.push({ month: monthOf(), amount: amt, mode: foreclose ? "foreclosure" : "manual", note: (note || "").trim(), at: nowIso(), by: S().code });
      if (foreclose) l.closed_at = isoDate();
      const r = x.requests.find((y) => y.request_id === loanId);
      if (foreclose && r) { r.closed = true; r.history.push({ status: "Closed", at: nowIso(), by: S().code, note: "Foreclosed" }); }
      if (r) pushNote(x, r.employee_code, foreclose ? `Loan ${loanId} is closed. Thank you.` : `We received ${amt.toLocaleString("en-IN")} towards loan ${loanId}.`, "/finances");
      audit(x, foreclose ? "LOAN_FORECLOSE" : "LOAN_REPAYMENT", `${loanId} · ${amt}`);
      return { ok: true };
    });
  }
  function toggleLoanPause(loanId, month) {
    const g = guard();
    if (g) return g;
    return mutate((x) => {
      const l = (x.loanLedger[loanId] = x.loanLedger[loanId] || { repayments: [], paused_months: [] });
      const set = new Set(l.paused_months || []);
      const on = !set.has(month);
      if (on) set.add(month);
      else set.delete(month);
      l.paused_months = [...set];
      const r = x.requests.find((y) => y.request_id === loanId);
      if (r) pushNote(x, r.employee_code, on ? `The ${month} EMI for loan ${loanId} is skipped; the tenure moves out by a month.` : `The ${month} EMI for loan ${loanId} will be deducted as scheduled.`, "/finances");
      audit(x, "LOAN_PAUSE", `${loanId} · ${month} · ${on ? "skipped" : "resumed"}`);
      return { ok: true, paused: on };
    });
  }

  // ── Form 16 / Form 130 ───────────────────────────
  function setTaxCertStatus(fy, codes, status) {
    const g = guard();
    if (g) return g;
    return mutate((x) => {
      x.taxCerts[fy] = x.taxCerts[fy] || {};
      codes.forEach((c) => {
        const cur = x.taxCerts[fy][c] || {};
        x.taxCerts[fy][c] = { ...cur, status, [`${status}_at`]: nowIso(), generated_at: cur.generated_at || nowIso() };
        if (status === "published") pushNote(x, c, `Your ${certName(fy)} for ${fy} is ready to download.`, "/finances");
      });
      audit(x, "TAX_CERT", `${certName(fy)} ${fy} · ${codes.length} · ${status}`);
      return { ok: true, count: codes.length };
    });
  }

  return {
    updatePaySettings, proposeRevision, applyRevisions, cancelRevision, saveCompCycle, finaliseCompCycle,
    createComponentClaim, decideComponentClaims, markClaimsPaid, setFbp, upsertPerk, endPerk,
    recordLoanRepayment, toggleLoanPause, setTaxCertStatus,
  };
}
