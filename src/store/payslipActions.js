// Payslip workflow. HR (admin with the "payslips" module) prepares; Finance (admin with "payroll") approves;
// Super Admin gives final approval; then HR or Super Admin releases, which publishes payslips under My pay and emails employees.
// The same rules apply to payslip fields (components): HR proposes → Finance → Super Admin → Active.
import { nowIso, nextSeq } from "../lib/utils.js";
import { PAYSLIP_EMPLOYEE_FIELDS, payslipTotals, periodLabel, PAYMENT_MODE_LABEL } from "../data/payslipFields.js";

const err = (error) => ({ ok: false, error });
const COMPONENT_KEYS = ["label", "section", "type", "required", "visible", "order"];

export function makePayslipActions({ mutate, dataRef, sessionRef, pushAudit, pushNote }) {
  const S = () => sessionRef.current;
  const D = () => dataRef.current;
  const adminRec = () => (S()?.role === "admin" ? D().admins.find((a) => a.admin_code === S().code) : null);
  const has = (m) => !!adminRec()?.modules.includes(m);
  const canPrepare = () => S()?.role === "superadmin" || has("payslips");
  const isFinance = () => has("payroll");
  const isSuper = () => S()?.role === "superadmin";
  const audit = (x, action, details) => pushAudit(x, S().code, S().role, action, details);
  const notifyRole = (x, module, text, link) => x.admins.filter((a) => a.status === "active" && a.modules.includes(module)).forEach((a) => pushNote(x, a.admin_code, text, link));
  const notifySupers = (x, text, link) => (x.superAdmins || []).forEach((s) => pushNote(x, s.superadmin_code, text, link));

  // ── Fields (components) ──
  function proposeComponent(input) {
    if (!canPrepare()) return err("Only HR (payslips module) or a Super Admin can propose payslip fields.");
    const code = String(input.code || "").trim().toUpperCase();
    const label = String(input.label || "").trim();
    if (!/^[A-Z][A-Z0-9_]{1,19}$/.test(code)) return err("Code must start with a letter and use 2–20 capital letters, digits or _. It becomes the upload column name.");
    if (!label || label.length > 60) return err("Give the field a label of up to 60 characters.");
    if (!["earning", "contribution", "deduction", "reimbursement", "detail"].includes(input.section)) return err("Choose where the field appears on the payslip.");
    if (["EMPLOYEE_CODE", "ACTUAL_PAYABLE_DAYS", "TOTAL_WORKING_DAYS", "LOP_DAYS"].includes(code)) return err("That code is reserved for a standard column.");
    const type = input.section === "detail" ? (input.type === "amount" ? "text" : input.type || "text") : "amount";
    const fields = { label, section: input.section, type, required: !!input.required, visible: input.visible !== false, order: Number(input.order) || 99 };
    return mutate((x) => {
      const ex = x.payslipComponents.find((k) => k.code === code);
      if (ex && ex.stage) return err(`${code} already has a change waiting for approval.`);
      if (ex && input.isNew) return err(`A field with code ${code} already exists.`);
      if (ex) {
        ex.draft = { ...fields, retire: !!input.retire };
        ex.stage = "finance";
        ex.proposed_by = S().code;
        ex.history.push({ at: nowIso(), by: S().code, action: input.retire ? "Proposed retiring this field" : `Proposed change: ${COMPONENT_KEYS.filter((k) => ex[k] !== fields[k]).join(", ") || "no visible change"}` });
      } else {
        x.payslipComponents.push({ code, ...fields, status: "Pending", stage: "finance", draft: { ...fields }, proposed_by: S().code, history: [{ at: nowIso(), by: S().code, action: "Proposed new field" }] });
      }
      audit(x, "PAYSLIP_FIELD_PROPOSE", `${code} · ${label} · ${input.section}${input.retire ? " · retire" : ""}`);
      notifyRole(x, "payroll", `Payslip field ${code} (${label}) needs Finance approval.`, "/payslips?tab=fields");
      return { ok: true };
    });
  }

  function decideComponent(code, decision, note = "") {
    const d = D();
    const k = d.payslipComponents.find((y) => y.code === code);
    if (!k || !k.stage) return err("Nothing waiting for approval on this field.");
    if (decision === "reject" && !note.trim()) return err("Give a reason for rejecting.");
    if (k.stage === "finance" && !isFinance()) return err("Finance (payroll module) approves this step.");
    if (k.stage === "super" && !isSuper()) return err("Super Admin gives the final approval.");
    if (k.proposed_by === S().code) return err("You proposed this change, so someone else must approve it.");
    return mutate((x) => {
      const c = x.payslipComponents.find((y) => y.code === code);
      const who = S().role === "superadmin" ? "Super Admin" : "Finance";
      if (decision === "reject") {
        c.history.push({ at: nowIso(), by: S().code, action: `${who} rejected: ${note}` });
        if (c.status === "Pending") c.status = "Rejected";
        c.stage = null;
        c.draft = null;
        pushNote(x, c.proposed_by, `Payslip field ${code} was rejected by ${who}: ${note}`, "/payslips?tab=fields");
        audit(x, "PAYSLIP_FIELD_REJECT", `${code} · ${note}`);
        return { ok: true };
      }
      if (c.stage === "finance") {
        c.stage = "super";
        c.history.push({ at: nowIso(), by: S().code, action: `Finance approved${note ? `: ${note}` : ""}` });
        notifySupers(x, `Payslip field ${code} is approved by Finance and needs your final approval.`, "/payslips?tab=fields");
      } else {
        const dr = c.draft || {};
        if (dr.retire) c.status = "Retired";
        else {
          COMPONENT_KEYS.forEach((key) => { if (dr[key] !== undefined) c[key] = dr[key]; });
          c.status = "Active";
        }
        c.stage = null;
        c.draft = null;
        c.history.push({ at: nowIso(), by: S().code, action: `Super Admin approved${note ? `: ${note}` : ""} → ${c.status}` });
        pushNote(x, c.proposed_by, `Payslip field ${code} is now ${c.status.toLowerCase()}.`, "/payslips?tab=fields");
      }
      audit(x, "PAYSLIP_FIELD_APPROVE", `${code} · ${who}`);
      return { ok: true };
    });
  }

  // ── Batches ──
  function snapshot(e) {
    const o = { full_name: e.full_name, email: e.email, company_id: e.company_id || "", location_id: e.location_id || "", worker_type: e.worker_type || "permanent", grade_code: e.grade_code || "", city: e.city || "", country_code: e.country_code || "IN", tax_regime: e.tax_regime || "", po_number: e.po_number || "", cost_centre: e.cost_centre || "", business_name: e.business_name || "", gstin: e.gstin || "" };
    PAYSLIP_EMPLOYEE_FIELDS.forEach(([k]) => { o[k] = k === "payment_mode" ? PAYMENT_MODE_LABEL[e.payment_mode] || e.payment_mode || "Bank Transfer" : e[k] || ""; });
    return o;
  }

  function createBatch({ period, source, rows, note = "" }) {
    if (!canPrepare()) return err("Only HR (payslips module) or a Super Admin can prepare payslips.");
    if (!/^\d{4}-\d{2}$/.test(period || "")) return err("Choose the pay month.");
    if (!rows?.length) return err("There are no payslips to create.");
    const d = D();
    const clash = rows.filter((r) => d.payslipBatches.some((b) => b.period === period && b.status !== "Rejected" && b.slips.some((s) => s.employee_code === r.employee_code)));
    if (clash.length) return err(`${clash.map((r) => r.employee_code).join(", ")} already ${clash.length > 1 ? "have" : "has"} a payslip for ${periodLabel(period)} in another batch. Remove ${clash.length > 1 ? "them" : "it"} or reject that batch first.`);
    return mutate((x) => {
      const id = nextSeq(x.payslipBatches, "PSB-", "id", 4);
      const slips = rows.map((r, i) => {
        const e = x.employees.find((y) => y.employee_code === r.employee_code);
        return { id: `${id}-${String(i + 1).padStart(3, "0")}`, employee_code: r.employee_code, actual_payable_days: r.actual_payable_days, total_working_days: r.total_working_days, lop_days: r.lop_days, days_payable: r.days_payable ?? r.total_working_days - r.lop_days, values: r.values, ...(r.local_lines ? { local_lines: r.local_lines, currency: r.currency } : {}), emp: snapshot(e), emailed_at: null };
      });
      x.payslipBatches.unshift({ id, period, source, note, status: "Draft", created_by: S().code, created_at: nowIso(), contract_run_id: null, components: JSON.parse(JSON.stringify(x.payslipComponents.filter((k) => k.status === "Active"))), slips, history: [{ at: nowIso(), by: S().code, action: `Created from ${source === "upload" ? "upload" : source === "contracts" ? "contractor pay run" : "payroll"} · ${slips.length} payslip(s)` }] });
      audit(x, "PAYSLIP_BATCH_CREATE", `${id} · ${period} · ${slips.length} slips · ${source}`);
      return { ok: true, id };
    });
  }

  const findBatch = (id) => D().payslipBatches.find((b) => b.id === id);

  function removeSlip(batchId, slipId) {
    const b = findBatch(batchId);
    if (!b || !["Draft", "Rejected"].includes(b.status)) return err("Only draft or rejected batches can be edited.");
    if (!canPrepare()) return err("Only HR can edit a batch.");
    return mutate((x) => {
      const bb = x.payslipBatches.find((y) => y.id === batchId);
      bb.slips = bb.slips.filter((s) => s.id !== slipId);
      bb.history.push({ at: nowIso(), by: S().code, action: `Removed ${slipId}` });
      return { ok: true };
    });
  }

  function deleteBatch(id) {
    const b = findBatch(id);
    if (!b || !["Draft", "Rejected"].includes(b.status)) return err("Only draft or rejected batches can be deleted.");
    if (!canPrepare()) return err("Only HR can delete a batch.");
    return mutate((x) => {
      x.payslipBatches = x.payslipBatches.filter((y) => y.id !== id);
      audit(x, "PAYSLIP_BATCH_DELETE", id);
      return { ok: true };
    });
  }

  function submitBatch(id) {
    const b = findBatch(id);
    if (!b || !["Draft", "Rejected"].includes(b.status)) return err("Only a draft or rejected batch can be sent for approval.");
    if (!canPrepare()) return err("Only HR can send a batch for approval.");
    if (!b.slips.length) return err("The batch has no payslips.");
    return mutate((x) => {
      const bb = x.payslipBatches.find((y) => y.id === id);
      bb.status = "Pending Finance";
      bb.rejection = null;
      bb.history.push({ at: nowIso(), by: S().code, action: "Sent to Finance for approval" });
      notifyRole(x, "payroll", `Payslips ${id} (${periodLabel(bb.period)}, ${bb.slips.length} people) need Finance approval.`, "/payslips");
      audit(x, "PAYSLIP_BATCH_SUBMIT", id);
      return { ok: true };
    });
  }

  function decideBatch(id, decision, note = "", { release = false } = {}) {
    const b = findBatch(id);
    if (!b) return err("Batch not found.");
    if (decision === "reject" && !note.trim()) return err("Give a reason for rejecting.");
    if (b.status === "Pending Finance" && !isFinance()) return err("Finance (payroll module) approves this step.");
    if (b.status === "Pending Super Admin" && !isSuper()) return err("Super Admin gives the final approval.");
    if (!["Pending Finance", "Pending Super Admin"].includes(b.status)) return err("This batch is not waiting for approval.");
    if (b.created_by === S().code) return err("You prepared this batch, so someone else must approve it.");
    const r = mutate((x) => {
      const bb = x.payslipBatches.find((y) => y.id === id);
      const who = S().role === "superadmin" ? "Super Admin" : "Finance";
      if (decision === "reject") {
        bb.status = "Rejected";
        bb.rejection = { by: S().code, who, note, at: nowIso() };
        bb.history.push({ at: nowIso(), by: S().code, action: `${who} rejected: ${note}` });
        pushNote(x, bb.created_by, `Payslips ${id} were rejected by ${who}: ${note}`, "/payslips");
        audit(x, "PAYSLIP_BATCH_REJECT", `${id} · ${note}`);
        return { ok: true };
      }
      if (bb.status === "Pending Finance") {
        bb.status = "Pending Super Admin";
        bb.finance_by = S().code;
        bb.history.push({ at: nowIso(), by: S().code, action: `Finance approved${note ? `: ${note}` : ""}` });
        notifySupers(x, `Payslips ${id} (${periodLabel(bb.period)}) are approved by Finance and need your final approval.`, "/payslips");
      } else {
        bb.status = "Approved";
        bb.super_by = S().code;
        bb.history.push({ at: nowIso(), by: S().code, action: `Super Admin approved${note ? `: ${note}` : ""}` });
        pushNote(x, bb.created_by, `Payslips ${id} are fully approved and ready to release.`, "/payslips");
      }
      audit(x, "PAYSLIP_BATCH_APPROVE", `${id} · ${who}`);
      return { ok: true };
    });
    if (r.ok && release && findBatch(id)?.status === "Approved") return releaseBatch(id);
    return r;
  }

  function emailFor(x, slip, batch) {
    const t = payslipTotals(slip.values, batch.components);
    const st = x.settings;
    const fill = (s) => s.replace(/\{name\}/g, slip.emp.full_name.split(" ")[0]).replace(/\{month\}/g, periodLabel(batch.period)).replace(/\{net\}/g, `₹${t.payable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`).replace(/\{company\}/g, st.payslip_company.name);
    return { id: `EM-${Date.now().toString(36)}-${slip.id}`, to: slip.emp.email, to_name: slip.emp.full_name, employee_code: slip.employee_code, subject: fill(st.payslip_email_subject), body: fill(st.payslip_email_body), batch_id: batch.id, slip_id: slip.id, at: nowIso(), status: "Queued" };
  }

  function releaseBatch(id) {
    const b = findBatch(id);
    if (!b || b.status !== "Approved") return err("Only a fully approved batch can be released.");
    if (!canPrepare()) return err("HR or a Super Admin releases payslips.");
    return mutate((x) => {
      const bb = x.payslipBatches.find((y) => y.id === id);
      bb.status = "Released";
      bb.released_at = nowIso();
      bb.released_by = S().code;
      bb.slips.forEach((s) => {
        if (x.settings.payslip_email_on_release && s.emp.email) {
          x.emails.unshift(emailFor(x, s, bb));
          s.emailed_at = nowIso();
        }
        pushNote(x, s.employee_code, `Your payslip for ${periodLabel(bb.period)} is ready under Pay & benefits → My payslips.`, `/finances?slip=${s.id}`);
      });
      bb.history.push({ at: nowIso(), by: S().code, action: `Released to ${bb.slips.length} employee(s)${x.settings.payslip_email_on_release ? " and emailed" : ""}` });
      audit(x, "PAYSLIP_BATCH_RELEASE", `${id} · ${bb.slips.length} payslips · email ${x.settings.payslip_email_on_release ? "on" : "off"}`);
      return { ok: true, count: bb.slips.length };
    });
  }

  function resendPayslipEmail(slipId) {
    if (!canPrepare()) return err("HR or a Super Admin can resend payslip emails.");
    const b = D().payslipBatches.find((y) => y.slips.some((s) => s.id === slipId));
    if (!b || b.status !== "Released") return err("Only released payslips can be emailed.");
    return mutate((x) => {
      const bb = x.payslipBatches.find((y) => y.id === b.id);
      const s = bb.slips.find((y) => y.id === slipId);
      x.emails.unshift(emailFor(x, s, bb));
      s.emailed_at = nowIso();
      audit(x, "PAYSLIP_EMAIL_RESEND", `${slipId} → ${s.emp.email}`);
      return { ok: true, to: s.emp.email };
    });
  }

  function updatePayslipSettings(patch) {
    if (!isSuper() && !has("payslips")) return err("Only HR or a Super Admin can change payslip settings.");
    if (patch.payslip_company && !isSuper()) return err("Only a Super Admin can change the company details on payslips.");
    return mutate((x) => {
      Object.assign(x.settings, patch);
      audit(x, "PAYSLIP_SETTINGS", Object.keys(patch).join(", "));
      return { ok: true };
    });
  }

  return { snapshotEmployee: snapshot, proposeComponent, decideComponent, createBatch, removeSlip, deleteBatch, submitBatch, decideBatch, releaseBatch, resendPayslipEmail, updatePayslipSettings };
}
