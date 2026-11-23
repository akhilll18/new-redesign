// Employee joining / statutory documents: employee uploads, HR (onboarding or bgv module) verifies or asks for a re-upload.
// When every required document is verified (and the BGV identity & address checks are not waiting on the employee)
// the onboarding task "Documents & KYC verified" is ticked automatically.
import { nowIso, nextSeq } from "../lib/utils.js";
import { requiredDocs } from "../lib/empdocs.js";

const err = (error) => ({ ok: false, error });

export function makeDocActions({ mutate, dataRef, sessionRef, pushAudit, pushNote }) {
  const S = () => sessionRef.current;
  const D = () => dataRef.current;
  const audit = (x, a, d) => pushAudit(x, S().code, S().role, a, d);
  const isReviewer = () => S()?.role === "superadmin" || (S()?.role === "admin" && D().admins.find((a) => a.admin_code === S().code)?.modules.some((m) => ["onboarding", "bgv", "accounts"].includes(m)));
  const reviewers = (x) => x.admins.filter((a) => a.status === "active" && a.modules.some((m) => ["onboarding", "bgv"].includes(m))).map((a) => a.admin_code);

  function syncOnboarding(x, code) {
    const emp = x.employees.find((e) => e.employee_code === code);
    const ob = x.onboarding.find((o) => o.employee_code === code);
    if (!emp || !ob) return;
    const req = requiredDocs(emp);
    const allVerified = req.every((r) => x.empDocs.some((d) => d.employee_code === code && d.doc_key === r.key && d.status === "verified"));
    const c = x.bgv.filter((b) => b.employee_code === code && !b.cancelled).sort((a, b) => String(b.initiated_at).localeCompare(String(a.initiated_at)))[0];
    const kycOk = !c || c.closed_status === "clear" || c.closed_status === "cleared_with_remarks" || ["identity", "address"].every((t) => { const k = c.checks.find((y) => y.type === t); return !k || ["verified", "na"].includes(k.status); });
    if (allVerified && kycOk && !ob.done[1]) {
      ob.done[1] = true;
      audit(x, "ONBOARDING_TASK", `${ob.name} · Documents & KYC verified · done (all documents verified)`);
      pushNote(x, code, "All your joining documents are verified. Thank you!", "/documents");
    }
  }

  function submitEmpDoc(docKey, docName, file) {
    const d = D();
    const emp = d.employees.find((e) => e.employee_code === S()?.code);
    if (!emp) return err("Only employees upload their own documents here.");
    if (!requiredDocs(emp).some((r) => r.key === docKey)) return err("This document is not on your checklist.");
    if (!file?.data_url) return err("Choose a file.");
    if (file.size > 1.5 * 1024 * 1024) return err("Files must be under 1.5 MB in this browser demo.");
    if (!/pdf|image/.test(file.type || "")) return err("Upload a PDF or an image (JPG / PNG).");
    const ex = d.empDocs.find((x) => x.employee_code === emp.employee_code && x.doc_key === docKey);
    if (ex?.status === "verified") return err("This document is already verified. Ask HR if it needs replacing.");
    return mutate((x) => {
      const at = nowIso();
      const f = { name: file.name, size: file.size, type: file.type, data_url: file.data_url, at };
      let rec = x.empDocs.find((y) => y.employee_code === emp.employee_code && y.doc_key === docKey);
      if (rec) { rec.files.push(f); rec.status = "submitted"; rec.updated_at = at; rec.history.push({ at, by: S().code, action: `Uploaded ${file.name}` }); }
      else { rec = { id: nextSeq(x.empDocs, "EDOC-", "id", 4), employee_code: emp.employee_code, doc_key: docKey, doc_name: docName, status: "submitted", files: [f], note: "", reviewed_by: null, reviewed_at: null, updated_at: at, history: [{ at, by: S().code, action: `Uploaded ${file.name}` }] }; x.empDocs.push(rec); }
      reviewers(x).forEach((c) => pushNote(x, c, `${emp.full_name} uploaded "${docName}" for verification.`, "/documents"));
      audit(x, "EMP_DOC_UPLOAD", `${emp.employee_code} · ${docName} · ${file.name}`);
      return { ok: true };
    });
  }

  function reviewEmpDoc(id, decision, note) {
    if (!isReviewer()) return err("Only HR (onboarding / BGV) can verify documents.");
    if (!["verified", "rejected"].includes(decision)) return err("Choose verify or re-upload.");
    if (decision === "rejected" && !String(note || "").trim()) return err("Tell the employee what is wrong so they can re-upload.");
    return mutate((x) => {
      const r = x.empDocs.find((y) => y.id === id);
      if (!r) return err("Document not found.");
      const at = nowIso();
      Object.assign(r, { status: decision, note: note || "", reviewed_by: S().code, reviewed_at: at, updated_at: at });
      r.history.push({ at, by: S().code, action: decision === "verified" ? "Verified" : `Re-upload requested: ${note}` });
      pushNote(x, r.employee_code, decision === "verified" ? `HR verified your "${r.doc_name}".` : `Please re-upload "${r.doc_name}": ${note}`, "/documents");
      audit(x, "EMP_DOC_REVIEW", `${r.employee_code} · ${r.doc_name} · ${decision}${note ? ` · ${note}` : ""}`);
      if (decision === "verified") syncOnboarding(x, r.employee_code);
      return { ok: true };
    });
  }

  function remindEmpDocs(code, missing) {
    if (!isReviewer()) return err("Only HR can send reminders.");
    return mutate((x) => {
      pushNote(x, code, `Reminder from HR – please upload: ${missing.join(", ")}.`, "/documents");
      audit(x, "EMP_DOC_REMIND", `${code} · ${missing.length} document(s)`);
      return { ok: true };
    });
  }

  return { submitEmpDoc, reviewEmpDoc, remindEmpDocs };
}
