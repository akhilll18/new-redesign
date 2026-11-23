// v10.5 · My files and document requests.
//  • My files (data.empFiles): every document that belongs to an employee — whatever their worker type (permanent,
//    contract, freelance, intern…). HR (accounts / onboarding / BGV modules) and the Super Admin upload files to one
//    employee or to a group; the files show up in that employee's My profile → Documents → My files.
//  • Document requests (data.docRequests): anyone — employee, manager, HR, Super Admin — asks internal employees
//    (individuals or a group: department, location, worker type, everyone) for a document. Each person uploads their
//    reply; the reply is saved to their My files and the requester can open it.
import { nowIso, nextSeq } from "../lib/utils.js";
import { workerTypeOf } from "../data/employeeFields.js";

const err = (error) => ({ ok: false, error });
const MAX = 1.5 * 1024 * 1024;
export const FILE_CATEGORIES = ["Letters", "Contracts & agreements", "Payroll & tax", "Policies", "Certificates", "Identity & KYC", "Requested documents", "Other"];

/** Resolve a group / individual selection into active employee codes. */
export function resolveTargets(data, target) {
  const active = data.employees.filter((e) => !["exited", "rejected"].includes(e.status));
  if (!target) return [];
  if (target.kind === "individual") return [...new Set(target.codes || [])].filter((c) => active.some((e) => e.employee_code === c));
  if (target.kind === "all") return active.map((e) => e.employee_code);
  if (target.kind === "department") return active.filter((e) => e.department === target.value).map((e) => e.employee_code);
  if (target.kind === "location") return active.filter((e) => e.city === target.value).map((e) => e.employee_code);
  if (target.kind === "worker_type") return active.filter((e) => workerTypeOf(e) === target.value).map((e) => e.employee_code);
  if (target.kind === "team") return active.filter((e) => e.reporting_manager === target.value).map((e) => e.employee_code);
  return [];
}

function checkFile(file) {
  if (!file?.data_url) return "Choose a file.";
  if (file.size > MAX) return "Files must be under 1.5 MB in this browser demo.";
  return null;
}

export function makeFileActions({ mutate, dataRef, sessionRef, pushAudit, pushNote }) {
  const S = () => sessionRef.current;
  const D = () => dataRef.current;
  const audit = (x, a, d) => pushAudit(x, S().code, S().role, a, d);
  const canUploadForOthers = () => {
    const s = S();
    if (!s) return false;
    if (s.role === "superadmin") return true;
    if (s.role !== "admin") return false;
    return (D().admins.find((a) => a.admin_code === s.code)?.modules || []).some((m) => ["accounts", "onboarding", "bgv", "offers"].includes(m));
  };

  /** HR / Super Admin: put a file in one or many employees' My files. */
  function hrUploadFiles({ target, title, category, file, note }) {
    if (!canUploadForOthers()) return err("Only HR (accounts / onboarding / BGV) or the Super Admin can upload files for employees.");
    if (String(title || "").trim().length < 3) return err("Give the document a title.");
    const fe = checkFile(file);
    if (fe) return err(fe);
    const codes = resolveTargets(D(), target);
    if (!codes.length) return err("Choose at least one employee.");
    return mutate((x) => {
      x.empFiles = x.empFiles || [];
      const at = nowIso();
      codes.forEach((code) => {
        x.empFiles.unshift({ id: nextSeq(x.empFiles, "EF-", "id", 5), employee_code: code, title: title.trim(), category: category || "Other", note: note || "", file: { name: file.name, size: file.size, type: file.type, data_url: file.data_url }, source: "hr", uploaded_by: S().code, at });
        pushNote(x, code, `HR added "${title.trim()}" to your files.`, "/documents");
      });
      audit(x, "EMP_FILE_UPLOAD", `${title.trim()} · ${codes.length} employee(s)`);
      return { ok: true, count: codes.length };
    });
  }

  /** HR / Super Admin remove a file they uploaded by mistake. Employees cannot delete HR files. */
  function removeEmpFile(id) {
    if (!canUploadForOthers()) return err("Only HR or the Super Admin can remove employee files.");
    return mutate((x) => {
      const i = (x.empFiles || []).findIndex((f) => f.id === id);
      if (i < 0) return err("File not found.");
      const [f] = x.empFiles.splice(i, 1);
      audit(x, "EMP_FILE_REMOVE", `${f.employee_code} · ${f.title}`);
      return { ok: true };
    });
  }

  /** Anyone asks internal employees (individuals or a group) for a document. */
  function createDocRequest({ title, note, due, target }) {
    const s = S();
    if (!s) return err("Sign in first.");
    if (String(title || "").trim().length < 3) return err("Say which document you need.");
    if (!due) return err("Choose a due date.");
    const me = s.role === "emp" ? s.code : null;
    const codes = resolveTargets(D(), target).filter((c) => c !== me);
    if (!codes.length) return err("Choose at least one person (other than you).");
    return mutate((x) => {
      x.docRequests = x.docRequests || [];
      const id = nextSeq(x.docRequests, "DR-", "id", 4);
      const at = nowIso();
      x.docRequests.unshift({ id, title: title.trim(), note: note || "", due, target, by: s.code, by_role: s.role, at, status: "open", recipients: codes.map((c) => ({ code: c, status: "pending", file_id: null, at: null, note: "" })) });
      codes.forEach((c) => pushNote(x, c, `Document request ${id}: please upload "${title.trim()}" by ${due}.`, "/doc-requests"));
      audit(x, "DOC_REQUEST", `${id} · ${title.trim()} · ${codes.length} recipient(s)`);
      return { ok: true, id, count: codes.length };
    });
  }

  /** Recipient uploads (or declines). The file lands in their My files and the requester is told. */
  function respondDocRequest(id, { file, decline, note }) {
    const s = S();
    if (s?.role !== "emp") return err("Only the employee who was asked can reply.");
    if (!decline) { const fe = checkFile(file); if (fe) return err(fe); }
    if (decline && String(note || "").trim().length < 5) return err("Say why you can't provide it.");
    return mutate((x) => {
      const r = (x.docRequests || []).find((q) => q.id === id);
      const me = r?.recipients.find((p) => p.code === s.code);
      if (!r || !me) return err("Request not found.");
      if (r.status === "closed") return err("This request is closed.");
      const at = nowIso();
      if (decline) Object.assign(me, { status: "declined", at, note: note.trim() });
      else {
        x.empFiles = x.empFiles || [];
        const fid = nextSeq(x.empFiles, "EF-", "id", 5);
        x.empFiles.unshift({ id: fid, employee_code: s.code, title: r.title, category: "Requested documents", note: `Sent for request ${r.id}`, file: { name: file.name, size: file.size, type: file.type, data_url: file.data_url }, source: "request", request_id: r.id, uploaded_by: s.code, at });
        Object.assign(me, { status: "submitted", at, file_id: fid, note: note || "" });
      }
      const name = x.employees.find((e) => e.employee_code === s.code)?.full_name || s.code;
      pushNote(x, r.by, `${name} ${decline ? "can't provide" : "uploaded"} "${r.title}" (${r.id}).`, "/doc-requests");
      if (r.recipients.every((p) => p.status !== "pending")) r.status = "complete";
      audit(x, "DOC_REQUEST_REPLY", `${r.id} · ${s.code} · ${decline ? "declined" : "uploaded"}`);
      return { ok: true };
    });
  }

  function remindDocRequest(id) {
    return mutate((x) => {
      const r = (x.docRequests || []).find((q) => q.id === id);
      if (!r || r.by !== S()?.code) return err("Only the person who asked can send reminders.");
      const pending = r.recipients.filter((p) => p.status === "pending");
      pending.forEach((p) => pushNote(x, p.code, `Reminder: please upload "${r.title}" (${r.id}) by ${r.due}.`, "/doc-requests"));
      audit(x, "DOC_REQUEST_REMIND", `${r.id} · ${pending.length}`);
      return { ok: true, count: pending.length };
    });
  }

  function closeDocRequest(id) {
    return mutate((x) => {
      const r = (x.docRequests || []).find((q) => q.id === id);
      if (!r || (r.by !== S()?.code && S()?.role !== "superadmin")) return err("Only the person who asked can close it.");
      r.status = "closed";
      audit(x, "DOC_REQUEST_CLOSE", r.id);
      return { ok: true };
    });
  }

  return { hrUploadFiles, removeEmpFile, createDocRequest, respondDocRequest, remindDocRequest, closeDocRequest, canUploadEmpFiles: canUploadForOthers };
}
