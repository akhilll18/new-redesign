// Offer letters. HR admin (module "offers") manages custom fields and prepares offers manually or by CSV upload;
// issuing emails the candidate; recording acceptance starts onboarding. Super Admin can do everything.
import { nowIso, nextSeq, isoDate } from "../lib/utils.js";
import { offerFieldList, validateOffer, salaryBreakup } from "../data/offerFields.js";

const err = (error) => ({ ok: false, error });
const STAGE_COUNTER = { offer: "off", hired: "acc" };

export function makeOfferActions({ mutate, dataRef, sessionRef, pushAudit }) {
  const S = () => sessionRef.current;
  const D = () => dataRef.current;
  const can = () => S()?.role === "superadmin" || !!D().admins.find((a) => a.admin_code === S()?.code)?.modules.includes("offers");
  const audit = (x, a, d) => pushAudit(x, S().code, S().role, a, d);

  function upsertOfferField(f) {
    if (!can()) return err("Only HR (offers module) or a Super Admin can change offer fields.");
    const key = String(f.key || "").trim().toLowerCase();
    if (!/^[a-z][a-z0-9_]{1,29}$/.test(key)) return err("Key must start with a letter and use 2–30 lowercase letters, digits or _. It is the upload column and the {{placeholder}} name.");
    if (!String(f.label || "").trim()) return err("Give the field a label.");
    if (!["candidate", "offer", "salary_earning", "clause"].includes(f.group)) return err("Choose where the field goes in the letter.");
    if (f.group === "clause" && !String(f.default || "").trim()) return err("Write the clause text. You can use placeholders like {{candidate_name}}.");
    if (f.type === "select" && f.group !== "clause" && !(f.options || []).length) return err("Add at least one option, separated by commas.");
    return mutate((x) => {
      const std = offerFieldList([]).some((s) => s.key === key);
      if (std) return err(`“${key}” is a standard field already in the letter.`);
      const ex = x.offerFields.find((y) => y.key === key);
      if (ex && f.isNew) return err(`A field with key ${key} already exists.`);
      const type = f.group === "salary_earning" ? "amount" : f.group === "clause" ? "clause" : f.type;
      const rec = { key, label: f.label.trim(), group: f.group, type, required: f.group === "clause" ? false : !!f.required, default: f.default ?? "", options: type === "select" ? f.options : undefined, help: f.help || "", active: f.active !== false, updated_by: S().code, updated_at: nowIso() };
      if (ex) Object.assign(ex, rec);
      else x.offerFields.push(rec);
      audit(x, ex ? "OFFER_FIELD_UPDATE" : "OFFER_FIELD_ADD", `${key} · ${rec.label} · ${rec.group}`);
      return { ok: true };
    });
  }

  function setOfferFieldActive(key, active) {
    if (!can()) return err("Only HR or a Super Admin can change offer fields.");
    return mutate((x) => {
      const f = x.offerFields.find((y) => y.key === key);
      if (!f) return err("Field not found.");
      f.active = active;
      audit(x, "OFFER_FIELD_ACTIVE", `${key} → ${active ? "on" : "off"}`);
      return { ok: true };
    });
  }

  function saveOffer(values, { id, source = "manual", candidate_id = null } = {}) {
    if (!can()) return err("Only HR (offers module) or a Super Admin can prepare offers.");
    const d = D();
    const fields = offerFieldList(d.offerFields);
    const e = validateOffer(values, fields, d.offerFields);
    if (Object.keys(e).length) return { ok: false, error: Object.values(e)[0], fieldErrors: e };
    return mutate((x) => {
      const ex = id ? x.offers.find((o) => o.id === id) : null;
      if (ex && ex.status !== "Draft") return err("Only draft offers can be edited. Withdraw it and prepare a new one.");
      const s = salaryBreakup(values, x.offerFields);
      if (ex) {
        ex.values = { ...values };
        ex.ctc_annual = s.ctc * 12;
        ex.history.push({ at: nowIso(), by: S().code, action: "Edited" });
        audit(x, "OFFER_UPDATE", `${ex.id} · ${values.candidate_name}`);
        return { ok: true, id: ex.id };
      }
      const nid = nextSeq(x.offers, "OFR-", "id", 4);
      x.offers.unshift({ id: nid, status: "Draft", source, candidate_id, values: { ...values }, fields: JSON.parse(JSON.stringify(x.offerFields.filter((f) => f.active !== false))), ctc_annual: s.ctc * 12, created_by: S().code, created_at: nowIso(), history: [{ at: nowIso(), by: S().code, action: `Prepared (${source === "upload" ? "upload" : "manual"})` }] });
      audit(x, "OFFER_CREATE", `${nid} · ${values.candidate_name} · ${values.designation} · ₹${s.ctc}/mo`);
      return { ok: true, id: nid };
    });
  }

  function bulkCreateOffers(rows) {
    if (!can()) return err("Only HR or a Super Admin can upload offers.");
    if (!rows?.length) return err("No rows to import.");
    const ids = [];
    for (const v of rows) {
      const r = saveOffer(v, { source: "upload" });
      if (!r.ok) return { ok: false, error: `${v.candidate_name || "Row"}: ${r.error}`, created: ids };
      ids.push(r.id);
    }
    return { ok: true, ids };
  }

  function deleteOffer(id) {
    if (!can()) return err("Only HR can delete offers.");
    const o = D().offers.find((y) => y.id === id);
    if (!o || o.status !== "Draft") return err("Only draft offers can be deleted.");
    return mutate((x) => {
      x.offers = x.offers.filter((y) => y.id !== id);
      audit(x, "OFFER_DELETE", id);
      return { ok: true };
    });
  }

  function issueOffer(id, { email = true } = {}) {
    if (!can()) return err("Only HR or a Super Admin can issue offers.");
    const o = D().offers.find((y) => y.id === id);
    if (!o || o.status !== "Draft") return err("Only a draft offer can be issued.");
    return mutate((x) => {
      const of = x.offers.find((y) => y.id === id);
      const v = of.values;
      const st = x.settings;
      of.status = "Issued";
      of.issued_at = nowIso();
      of.issued_by = S().code;
      of.fields = JSON.parse(JSON.stringify(x.offerFields.filter((f) => f.active !== false)));
      of.company = JSON.parse(JSON.stringify(st.offer_company));
      if (email) {
        const fillT = (t) => t.replace(/\{name\}/g, v.candidate_name).replace(/\{designation\}/g, v.designation).replace(/\{joining_date\}/g, new Date(`${v.joining_date}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })).replace(/\{company\}/g, st.offer_company.brand);
        x.emails.unshift({ id: `EM-${Date.now().toString(36)}-${id}`, kind: "offer", to: v.email, to_name: `${v.salutation} ${v.candidate_name}`, subject: fillT(st.offer_email_subject), body: fillT(st.offer_email_body), batch_id: id, slip_id: null, attachment: `Offer_Letter_${v.candidate_name.replace(/\s+/g, "_")}.pdf`, at: nowIso(), status: "Queued" });
        of.emailed_at = nowIso();
      }
      if (of.candidate_id) {
        const c = x.candidates.find((y) => y.id === of.candidate_id);
        if (c && ["applied", "screen", "interview"].includes(c.stage)) {
          const q = x.reqs.find((y) => y.id === c.req_id);
          if (q) q.off += 1;
          c.stage = "offer";
          c.updated_at = nowIso();
        }
      }
      of.history.push({ at: nowIso(), by: S().code, action: `Issued${email ? ` and emailed to ${v.email}` : ""}` });
      audit(x, "OFFER_ISSUE", `${id} · ${v.candidate_name}${email ? " · emailed" : ""}`);
      return { ok: true };
    });
  }

  function respondOffer(id, response, note = "") {
    if (!can()) return err("Only HR or a Super Admin can record the candidate's response.");
    const o = D().offers.find((y) => y.id === id);
    if (!o) return err("Offer not found.");
    if (response === "withdraw" && !["Draft", "Issued"].includes(o.status)) return err("Only a draft or issued offer can be withdrawn.");
    if (["accept", "decline"].includes(response) && o.status !== "Issued") return err("Record a response only for an issued offer.");
    if (response === "withdraw" && !note.trim()) return err("Give a reason for withdrawing the offer.");
    return mutate((x) => {
      const of = x.offers.find((y) => y.id === id);
      const v = of.values;
      of.status = { accept: "Accepted", decline: "Declined", withdraw: "Withdrawn" }[response];
      of.responded_at = nowIso();
      if (response === "accept") {
        const dept = x.candidates.find((c) => c.id === of.candidate_id) ? x.reqs.find((q) => q.id === x.candidates.find((c) => c.id === of.candidate_id).req_id)?.dept : "";
        if (!x.onboarding.some((ob) => ob.offer_id === id)) x.onboarding.unshift({ id: nextSeq(x.onboarding, "ONB-", "id", 1), offer_id: id, employee_code: null, name: v.candidate_name, role: v.designation, dept: dept || v.department || "—", doj: v.joining_date || isoDate(), done: x.onbTasks.map((_, i) => i === 0), buddy: null });
        if (of.candidate_id) {
          const c = x.candidates.find((y) => y.id === of.candidate_id);
          const q = c && x.reqs.find((y) => y.id === c.req_id);
          if (c && c.stage !== "hired") { c.stage = "hired"; c.updated_at = nowIso(); if (q) { q.acc += 1; if (q.acc >= q.n && !q.closed) q.closed = isoDate(); } }
        }
      }
      of.history.push({ at: nowIso(), by: S().code, action: `${of.status}${note ? `: ${note}` : ""}${response === "accept" ? " · onboarding started" : ""}` });
      audit(x, `OFFER_${of.status.toUpperCase()}`, `${id} · ${v.candidate_name}${note ? ` · ${note}` : ""}`);
      return { ok: true };
    });
  }

  function updateOfferSettings(patch) {
    if (!can()) return err("Only HR or a Super Admin can change offer settings.");
    if (patch.offer_company && S()?.role !== "superadmin") return err("Only a Super Admin can change the company details and signatory.");
    return mutate((x) => {
      Object.assign(x.settings, patch);
      audit(x, "OFFER_SETTINGS", Object.keys(patch).join(", "));
      return { ok: true };
    });
  }

  return { upsertOfferField, setOfferFieldActive, saveOffer, bulkCreateOffers, deleteOffer, issueOffer, respondOffer, updateOfferSettings };
}
