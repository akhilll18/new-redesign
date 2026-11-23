// v8 store actions: background verification, applicant tracking, compliance calendar, chat, meetings and calendar events.
// Each action mirrors one REST endpoint (README → API contract) and writes to the audit log.
import { normalizeLink, jitsiLink, detectProvider } from "../lib/conferencing.js";
import { nowIso, nextSeq, isoDate } from "../lib/utils.js";
import { BGV_PACKAGES, BGV_CHECK_LABEL, BGV_CHECK_DEF, CHECK_DONE, bgvChecksFor, stagesOf, stageLabel, checkStage, officialEmailCheck, bgvAccessLevel, bgvStatus, channelMembers } from "../lib/collab.js";

const err = (error) => ({ ok: false, error });

export function makeCollabActions({ mutate, dataRef, sessionRef, pushAudit, pushNote }) {
  const S = () => sessionRef.current;
  const D = () => dataRef.current;
  const audit = (x, action, details) => pushAudit(x, S().code, S().role, action, details);
  const userRec = () => {
    const s = S();
    const d = D();
    if (!s) return null;
    const rec = s.role === "emp" ? d.employees.find((e) => e.employee_code === s.code) : s.role === "admin" ? d.admins.find((a) => a.admin_code === s.code) : d.superAdmins.find((a) => a.superadmin_code === s.code);
    return rec ? { ...rec, role: s.role, code: s.code } : null;
  };
  const isAdminFor = (m) => S()?.role === "superadmin" || (S()?.role === "admin" && !!D().admins.find((a) => a.admin_code === S().code)?.modules.includes(m));
  const nameIn = (x, code) => x.employees.find((e) => e.employee_code === code)?.full_name || x.admins.find((a) => a.admin_code === code)?.full_name || x.superAdmins.find((a) => a.superadmin_code === code)?.full_name || code;
  const notifyBgvTeam = (x, text, link = "/bgv") => x.admins.filter((a) => a.status === "active" && a.modules.includes("bgv")).forEach((a) => pushNote(x, a.admin_code, text, link));

  // ── Background verification ──────────────────────────
  function initiateBgv({ employee_code, candidate_id, package: pkg = "standard", vendor_id = "VND-1", due_date, note }) {
    if (!isAdminFor("bgv") && !(candidate_id && isAdminFor("recruitment"))) return err("You need the Background verification module to start a check.");
    if (!BGV_PACKAGES[pkg]) return err("Choose a package.");
    const d = D();
    if (!employee_code && !candidate_id) return err("Choose an employee or candidate.");
    const open = d.bgv.find((c) => !c.cancelled && !c.closed_status && ((employee_code && c.employee_code === employee_code) || (candidate_id && c.candidate_id === candidate_id)));
    if (open) return err(`${open.name} already has an open check (${open.id}).`);
    const vendor = d.bgvVendors.find((v) => v.id === vendor_id);
    if (!vendor) return err("Choose a vendor.");
    const country = employee_code ? d.employees.find((i) => i.employee_code === employee_code)?.country_code || "IN" : "IN";
    const unsupported = bgvChecksFor(pkg, country).filter((c) => !BGV_CHECK_DEF[c]?.inhouse && !vendor.checks.includes(c));
    if (unsupported.length) return err(`${vendor.name} does not run: ${unsupported.map((c) => BGV_CHECK_LABEL[c]).join(", ")}. Pick another vendor or package.`);
    return mutate((x) => {
      const e = employee_code ? x.employees.find((i) => i.employee_code === employee_code) : null;
      const cand = candidate_id ? x.candidates.find((i) => i.id === candidate_id) : null;
      const id = nextSeq(x.bgv, "BGV-", "id", 4);
      const now = nowIso();
      const p = BGV_PACKAGES[pkg];
      x.bgv.unshift({
        id, subject_type: e ? "employee" : "candidate", employee_code: e?.employee_code || null, candidate_id: cand?.id || null, name: e?.full_name || cand?.name,
        package: pkg, vendor_id, initiated_at: now, initiated_by: S().code, consent: { status: "pending", requested_at: now },
        due_date: due_date || isoDate(Date.now() + p.tat * 86400000), checks: bgvChecksFor(pkg, e?.country_code || "IN").map((type) => ({ type, status: "pending", stage: stagesOf(type)[0][0], tracking: [{ stage: stagesOf(type)[0][0], at: now, by: S().code, note: "" }], details: {}, items: type === "documents" ? null : undefined, remarks: "", candidate_note: "", verified_at: null, docs: [] })),
        closed_status: null, closed_at: null, remarks: note || "", history: [{ at: now, by: S().code, action: `Initiated · ${p.label} package · ${vendor.name}` }],
      });
      if (e) {
        e.background_check = "pending";
        pushNote(x, e.employee_code, "HR has started your background verification. Please review and e-sign your consent.", "/bgv-me");
      }
      audit(x, "BGV_INITIATE", `${id} · ${e?.full_name || cand?.name} · ${p.label} · ${vendor.name}`);
      return { ok: true, id };
    });
  }

  function giveBgvConsent(id, signedName) {
    const d = D();
    const c = d.bgv.find((i) => i.id === id);
    if (!c) return err("Case not found.");
    const self = c.employee_code && c.employee_code === S().code;
    if (!self && !isAdminFor("bgv")) return err("Only the employee (or HR on paper consent) can record consent.");
    if (self && String(signedName || "").trim().toLowerCase() !== String(c.name).toLowerCase()) return err(`Type your full name exactly as "${c.name}" to e-sign.`);
    return mutate((x) => {
      const k = x.bgv.find((i) => i.id === id);
      k.consent = { status: "given", at: nowIso(), signed_name: signedName || k.name, method: self ? "e-sign" : "paper form recorded by HR", ip: "client" };
      k.checks.forEach((ch) => { if (ch.status === "pending") ch.status = "in_progress"; });
      k.history.push({ at: nowIso(), by: S().code, action: self ? "Consent e-signed" : "Paper consent recorded" });
      notifyBgvTeam(x, `${k.name} gave consent for background verification (${k.id}).`);
      audit(x, "BGV_CONSENT", `${k.id} · ${k.name} · ${self ? "e-sign" : "paper"}`);
      return { ok: true };
    });
  }

  /**
   * Update one check: outcome status, tracking stage, check-specific details (PF, address visit, employer email),
   * the document checklist, remarks and what to ask the person for. Every stage move is kept in the check's tracking log.
   */
  function updateBgvCheck(id, type, patch) {
    if (!isAdminFor("bgv")) return err("You need the Background verification module.");
    const cur = D().bgv.find((i) => i.id === id)?.checks.find((c) => c.type === type);
    if (!cur) return err("Check not found.");
    const status = patch.status ?? cur.status;
    const details = { ...(cur.details || {}), ...(patch.details || {}) };
    if (["discrepancy", "unable_to_verify"].includes(status) && !String(patch.remarks ?? cur.remarks ?? "").trim()) return err(status === "discrepancy" ? "Describe the discrepancy (what was declared vs what was verified)." : "Say why it could not be verified.");
    if (status === "insufficient" && !String(patch.candidate_note ?? cur.candidate_note ?? "").trim()) return err("Tell the employee what to upload.");
    const stages = stagesOf(type).map(([k]) => k);
    let stage = patch.stage || checkStage(cur);
    if (!stages.includes(stage)) return err("Unknown stage.");
    if (CHECK_DONE.includes(status) && !patch.stage) stage = "completed";
    if (stage === "completed" && !CHECK_DONE.includes(status)) return err("Set the outcome (Verified, Discrepancy, Unable to verify or Not applicable) to complete the check.");
    const at = (s) => stages.indexOf(stage) >= stages.indexOf(s);
    if (type === "pf") {
      if (details.uan && !/^\d{12}$/.test(String(details.uan).replace(/\s/g, ""))) return err("UAN must be 12 digits.");
      if (at("uan_received") && !details.uan) return err("Enter the UAN to move past “UAN requested”.");
      if (status === "verified" && details.result && details.result !== "match" && details.result !== "no_pf") return err("EPFO history does not match – record it as a Discrepancy (or Unable to verify), not Verified.");
    }
    if (type === "address") {
      if (at("agent_assigned") && details.method === "physical" && !details.agent) return err("Name the field agent.");
      if (at("visit_scheduled") && details.method !== "postal" && !details.visit_date) return err("Enter the visit date.");
      if (at("report_submitted") && !details.outcome) return err("Record the visit outcome.");
      if (status === "verified" && details.outcome && !["confirmed", "short_stay"].includes(details.outcome)) return err("The visit did not confirm the address – it cannot be Verified.");
    }
    if (type === "company_email") {
      if (at("domain_checked") && !officialEmailCheck(details.hr_email).ok) return err(`HR email: ${officialEmailCheck(details.hr_email).text}.`);
      if (at("email_sent") && !details.sent_on) return err("Enter the date the email was sent.");
      if (at("response_received") && !details.response) return err("Record the employer's response.");
      if (status === "verified" && details.response && details.response !== "confirmed") return err("The employer did not confirm the details – it cannot be Verified.");
    }
    const items = patch.items ?? cur.items;
    if (type === "documents" && status === "verified" && (items || []).some((i) => i.status === "mismatch")) return err("A document is marked Mismatch – record a Discrepancy instead.");
    if (type === "documents" && status === "verified" && (items || []).some((i) => ["pending", "received"].includes(i.status))) return err("Verify (or mark not applicable) every document in the checklist first.");
    return mutate((x) => {
      const k = x.bgv.find((i) => i.id === id);
      if (!k) return err("Case not found.");
      if (k.closed_status) return err("This case is closed. Reopen it first.");
      const ch = k.checks.find((c) => c.type === type);
      const prev = ch.status;
      const prevStage = checkStage(ch);
      Object.assign(ch, { status, stage, details, remarks: patch.remarks ?? ch.remarks, candidate_note: patch.candidate_note ?? ch.candidate_note, verified_at: status === "verified" && prev !== "verified" ? nowIso() : ch.verified_at });
      if (items) ch.items = items;
      if (ch.status === "pending" && stages.indexOf(stage) > 0) ch.status = "in_progress";
      ch.tracking ||= [];
      const moved = prevStage !== stage;
      if (moved || patch.track_note) ch.tracking.push({ stage, at: nowIso(), by: S().code, note: patch.track_note || "" });
      const bits = [moved ? `${stageLabel(type, prevStage)} → ${stageLabel(type, stage)}` : "", prev !== status ? `${prev} → ${status}` : ""].filter(Boolean).join(" · ");
      k.history.push({ at: nowIso(), by: S().code, action: `${BGV_CHECK_LABEL[type]}: ${bits || "details updated"}${patch.track_note ? ` · ${patch.track_note}` : ""}` });
      if (ch.status === "insufficient" && prev !== "insufficient" && k.employee_code) pushNote(x, k.employee_code, `Background check: more documents needed for ${BGV_CHECK_LABEL[type]}. ${ch.candidate_note}`, "/bgv-me");
      if (type === "address" && stage === "visit_scheduled" && moved && k.employee_code && details.visit_date) pushNote(x, k.employee_code, `Address verification: a ${details.method === "digital" ? "digital (geo-tagged) check" : "field visit"} is scheduled for ${details.visit_date}. Please make sure someone is at home.`, "/bgv-me");
      if (type === "pf" && stage === "uan_requested" && patch.track_note && k.employee_code) pushNote(x, k.employee_code, "Background check: please share your UAN (Universal Account Number) for PF verification.", "/bgv-me");
      audit(x, "BGV_CHECK_UPDATE", `${k.id} · ${type} · ${bits || "details"}`);
      return { ok: true };
    });
  }

  function holdBgv(id, on, reason) {
    if (!isAdminFor("bgv")) return err("You need the Background verification module.");
    if (on && !String(reason || "").trim()) return err("Give a reason for putting the case on hold.");
    return mutate((x) => {
      const k = x.bgv.find((i) => i.id === id);
      if (!k || k.closed_status) return err("Only open cases can be put on hold.");
      k.on_hold = on ? { reason, at: nowIso(), by: S().code } : null;
      k.history.push({ at: nowIso(), by: S().code, action: on ? `Put on hold · ${reason}` : "Resumed from hold" });
      audit(x, "BGV_HOLD", `${k.id} · ${on ? `hold · ${reason}` : "resumed"}`);
      return { ok: true };
    });
  }

  function uploadBgvDoc(id, type, file) {
    const d = D();
    const c = d.bgv.find((i) => i.id === id);
    if (!c) return err("Case not found.");
    const self = c.employee_code === S().code;
    if (!self && !isAdminFor("bgv")) return err("You cannot upload to this case.");
    if (!file?.data_url) return err("Choose a file.");
    if (file.size > 1.5 * 1024 * 1024) return err("Files must be under 1.5 MB in this browser demo.");
    if (!/pdf|image/.test(file.type || "")) return err("Upload a PDF or an image.");
    return mutate((x) => {
      const k = x.bgv.find((i) => i.id === id);
      const ch = k.checks.find((y) => y.type === type);
      ch.docs = [...(ch.docs || []), { name: file.name, size: file.size, type: file.type, data_url: file.data_url, at: nowIso(), by: S().code }];
      if (ch.status === "insufficient" || ch.status === "pending") ch.status = "in_progress";
      const st = stagesOf(type);
      if (checkStage(ch) === st[0][0]) {
        ch.stage = st[1][0];
        (ch.tracking ||= []).push({ stage: ch.stage, at: nowIso(), by: S().code, note: `Uploaded ${file.name}` });
      }
      k.history.push({ at: nowIso(), by: S().code, action: `Document uploaded for ${BGV_CHECK_LABEL[type]}: ${file.name}` });
      if (self) notifyBgvTeam(x, `${k.name} uploaded ${file.name} for ${BGV_CHECK_LABEL[type]} (${k.id}).`);
      audit(x, "BGV_DOC_UPLOAD", `${k.id} · ${type} · ${file.name}`);
      return { ok: true };
    });
  }

  function closeBgv(id, decision, remarks) {
    if (!isAdminFor("bgv")) return err("You need the Background verification module.");
    if (!["clear", "cleared_with_remarks", "discrepancy"].includes(decision)) return err("Choose a decision.");
    const c = D().bgv.find((i) => i.id === id);
    if (!c) return err("Case not found.");
    if (c.consent?.status !== "given") return err("Consent has not been given yet.");
    if (c.on_hold) return err("The case is on hold. Resume it first.");
    const open = c.checks.filter((k) => !CHECK_DONE.includes(k.status));
    if (decision === "clear" && open.length) return err(`${open.length} check(s) are still open. Verify them or close as "Clear with remarks".`);
    if (decision === "clear" && c.checks.some((k) => ["discrepancy", "unable_to_verify"].includes(k.status))) return err("A check has a discrepancy or could not be verified. Close as \"Clear with remarks\" (accepted) or \"Discrepancy\".");
    if (decision !== "clear" && !String(remarks || "").trim()) return err("Add remarks for the decision.");
    return mutate((x) => {
      const k = x.bgv.find((i) => i.id === id);
      k.closed_status = decision;
      k.closed_at = nowIso();
      k.remarks = remarks || k.remarks;
      k.history.push({ at: nowIso(), by: S().code, action: `Closed · ${decision === "clear" ? "Clear" : decision === "cleared_with_remarks" ? "Clear with remarks" : "Discrepancy"}${remarks ? ` · ${remarks}` : ""}` });
      const e = k.employee_code && x.employees.find((i) => i.employee_code === k.employee_code);
      if (e) {
        e.background_check = decision === "discrepancy" ? "flagged" : "clear";
        pushNote(x, e.employee_code, `Your background verification is complete: ${decision === "discrepancy" ? "HR will contact you about one item." : "all clear."}`, "/bgv-me");
        if (e.reporting_manager) pushNote(x, e.reporting_manager, `Background verification for ${e.full_name}: ${decision === "discrepancy" ? "discrepancy – HR is reviewing" : "clear"}.`, "/team-bgv");
        const ob = x.onboarding.find((o) => o.employee_code === e.employee_code);
        if (ob && decision !== "discrepancy") ob.done[1] = true;
      }
      audit(x, "BGV_CLOSE", `${k.id} · ${k.name} · ${decision}`);
      return { ok: true };
    });
  }

  function reopenBgv(id) {
    if (!isAdminFor("bgv")) return err("You need the Background verification module.");
    return mutate((x) => {
      const k = x.bgv.find((i) => i.id === id);
      k.closed_status = null;
      k.closed_at = null;
      k.history.push({ at: nowIso(), by: S().code, action: "Reopened" });
      audit(x, "BGV_REOPEN", k.id);
      return { ok: true };
    });
  }

  function cancelBgv(id, reason) {
    if (!isAdminFor("bgv")) return err("You need the Background verification module.");
    if (!String(reason || "").trim()) return err("Give a reason.");
    return mutate((x) => {
      const k = x.bgv.find((i) => i.id === id);
      k.cancelled = true;
      k.history.push({ at: nowIso(), by: S().code, action: `Cancelled · ${reason}` });
      audit(x, "BGV_CANCEL", `${k.id} · ${reason}`);
      return { ok: true };
    });
  }

  function remindBgv(id) {
    const c = D().bgv.find((i) => i.id === id);
    if (!c || !isAdminFor("bgv")) return err("You cannot send reminders for this case.");
    if (!c.employee_code) return err("Candidate reminders are sent by email from the recruitment team.");
    return mutate((x) => {
      const k = x.bgv.find((i) => i.id === id);
      const need = k.consent?.status !== "given" ? "please e-sign your consent" : `please upload: ${k.checks.filter((ch) => ch.status === "insufficient").map((ch) => BGV_CHECK_LABEL[ch.type]).join(", ")}`;
      pushNote(x, k.employee_code, `Reminder – background verification: ${need}.`, "/bgv-me");
      k.history.push({ at: nowIso(), by: S().code, action: "Reminder sent" });
      audit(x, "BGV_REMIND", k.id);
      return { ok: true };
    });
  }

  function logBgvView(id) {
    const u = userRec();
    const c = D().bgv.find((i) => i.id === id);
    const lvl = bgvAccessLevel(D(), u, c);
    if (!lvl) return err("You do not have access to this case.");
    mutate((x) => audit(x, "BGV_VIEW", `${id} · ${c.name} · access ${lvl}`));
    return { ok: true, level: lvl };
  }

  function grantBgvAccess({ code, level, scope, expires_on, reason }) {
    if (S()?.role !== "superadmin" && !isAdminFor("bgv")) return err("Only the Super Admin or the BGV team can grant access.");
    if (!code) return err("Choose a person.");
    if (!["status", "summary", "full"].includes(level)) return err("Choose an access level.");
    if (!scope) return err("Choose what they can see.");
    if (!String(reason || "").trim()) return err("Record why access is needed (it is shown in the access register).");
    if (expires_on && expires_on < isoDate()) return err("The expiry date is in the past.");
    if (level === "full" && S()?.role !== "superadmin") return err("Only the Super Admin can grant full access.");
    return mutate((x) => {
      const role = code.startsWith("EMP") ? "emp" : code.startsWith("ADM") ? "admin" : "superadmin";
      const id = nextSeq(x.bgvAccess, "BGA-", "id", 1);
      x.bgvAccess.unshift({ id, code, role, level, scope, granted_by: S().code, granted_at: nowIso(), expires_on: expires_on || "", reason: reason.trim(), revoked: false });
      pushNote(x, code, `You were given ${level} access to background verification (${scope === "all" ? "all cases" : scope === "team" ? "your team" : scope}).`, role === "emp" ? "/team-bgv" : "/bgv");
      audit(x, "BGV_ACCESS_GRANT", `${id} · ${nameIn(x, code)} · ${level} · ${scope} · until ${expires_on || "no expiry"} · ${reason}`);
      return { ok: true };
    });
  }
  function revokeBgvAccess(id) {
    if (S()?.role !== "superadmin" && !isAdminFor("bgv")) return err("Only the Super Admin or the BGV team can revoke access.");
    return mutate((x) => {
      const g = x.bgvAccess.find((i) => i.id === id);
      g.revoked = true;
      g.revoked_at = nowIso();
      g.revoked_by = S().code;
      audit(x, "BGV_ACCESS_REVOKE", `${id} · ${nameIn(x, g.code)}`);
      return { ok: true };
    });
  }

  // ── Applicant tracking ───────────────────────────────
  function addApplicant(a) {
    if (!isAdminFor("recruitment")) return err("You do not manage recruitment.");
    if (!String(a.name || "").trim() || !a.req_id) return err("Name and job are required.");
    if (a.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email)) return err("Enter a valid email.");
    if (a.email && D().candidates.some((c) => c.email && c.email.toLowerCase() === a.email.toLowerCase() && c.req_id === a.req_id)) return err("This email has already applied for this job.");
    return mutate((x) => {
      const id = nextSeq(x.candidates, "CD-", "id", 1);
      x.candidates.unshift({ id, name: a.name.trim(), req_id: a.req_id, stage: "applied", source: a.source || "Careers page", rating: 0, email: a.email || "", updated_at: nowIso() });
      const q = x.reqs.find((y) => y.id === a.req_id);
      if (q) q.app += 1;
      x.atsProfiles[id] = { phone: a.phone || "", location: a.location || "", experience_yrs: Number(a.experience_yrs) || 0, current_company: a.current_company || "", current_ctc: Number(a.current_ctc) || 0, expected_ctc: Number(a.expected_ctc) || 0, notice_days: Number(a.notice_days) || 0, skills: (Array.isArray(a.skills) ? a.skills : String(a.skills || "").split(",")).map((s) => s.trim()).filter(Boolean), resume_text: a.resume_text || "", resume: a.resume || null, applied_at: nowIso(), tags: [] };
      audit(x, "CANDIDATE_ADD", `${a.name.trim()} → ${a.req_id}`);
      return { ok: true, id };
    });
  }
  function updateApplicant(id, patch) {
    if (!isAdminFor("recruitment")) return err("You do not manage recruitment.");
    return mutate((x) => {
      x.atsProfiles[id] = { ...(x.atsProfiles[id] || {}), ...patch };
      if (patch.ai) x.atsProfiles[id].ai = patch.ai;
      audit(x, "CANDIDATE_UPDATE", `${id} · ${Object.keys(patch).join(", ")}`);
      return { ok: true };
    });
  }
  function scheduleInterview(iv) {
    if (!isAdminFor("recruitment")) return err("You do not manage recruitment.");
    if (!iv.candidate_id || !iv.start || !iv.end) return err("Candidate, start and end are required.");
    if (iv.end <= iv.start) return err("The interview must end after it starts.");
    if (!(iv.interviewers || []).length) return err("Add at least one interviewer.");
    return mutate((x) => {
      const c = x.candidates.find((k) => k.id === iv.candidate_id);
      const ex = iv.id && x.interviews.find((k) => k.id === iv.id);
      const rec = { round: iv.round || "Interview", type: iv.type || "video", start: iv.start, end: iv.end, interviewers: iv.interviewers, link: iv.link || "", status: "scheduled" };
      let id = iv.id;
      if (ex) Object.assign(ex, rec);
      else {
        id = nextSeq(x.interviews, "INT-", "id", 4);
        x.interviews.unshift({ id, candidate_id: c.id, req_id: c.req_id, feedback: [], ...rec });
      }
      if (["applied", "screen"].includes(c.stage)) {
        const q = x.reqs.find((y) => y.id === c.req_id);
        if (q) q.int += 1;
        if (c.stage === "applied" && q) q.scr += 1;
        c.stage = "interview";
        c.updated_at = nowIso();
      }
      const when = new Date(iv.start).toLocaleString("en-IN", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
      iv.interviewers.forEach((code) => pushNote(x, code, `${ex ? "Rescheduled" : "New"} interview: ${c.name} · ${rec.round} · ${when}. Feedback form opens in your calendar.`, "/calendar"));
      audit(x, ex ? "INTERVIEW_RESCHEDULE" : "INTERVIEW_SCHEDULE", `${id} · ${c.name} · ${rec.round} · ${iv.start}`);
      return { ok: true, id };
    });
  }
  function setInterviewStatus(id, status) {
    if (!isAdminFor("recruitment")) return err("You do not manage recruitment.");
    return mutate((x) => {
      const iv = x.interviews.find((k) => k.id === id);
      iv.status = status;
      if (status === "cancelled") iv.interviewers.forEach((code) => pushNote(x, code, `Interview cancelled: ${x.candidates.find((c) => c.id === iv.candidate_id)?.name} · ${iv.round}.`, "/calendar"));
      audit(x, "INTERVIEW_STATUS", `${id} → ${status}`);
      return { ok: true };
    });
  }
  function submitInterviewFeedback(id, fb) {
    const iv = D().interviews.find((k) => k.id === id);
    if (!iv) return err("Interview not found.");
    const mine = iv.interviewers.includes(S().code) || iv.interviewers.includes(userRec()?.employee_code);
    if (!mine && !isAdminFor("recruitment")) return err("Only the interview panel can give feedback.");
    if (!fb.rating || !fb.recommendation) return err("Give a rating and a recommendation.");
    if (!String(fb.notes || "").trim()) return err("Add a few notes to back up your rating.");
    return mutate((x) => {
      const k = x.interviews.find((y) => y.id === id);
      k.feedback = [...(k.feedback || []).filter((f) => f.by !== S().code), { by: S().code, rating: fb.rating, recommendation: fb.recommendation, notes: fb.notes.trim(), at: nowIso() }];
      if (new Date(k.end) < new Date()) k.status = "completed";
      const c = x.candidates.find((y) => y.id === k.candidate_id);
      x.admins.filter((a) => a.status === "active" && a.modules.includes("recruitment")).forEach((a) => pushNote(x, a.admin_code, `Interview feedback for ${c?.name}: ${fb.recommendation.replace("_", " ")} (${fb.rating}/5) from ${nameIn(x, S().code)}.`, "/recruitment"));
      audit(x, "INTERVIEW_FEEDBACK", `${id} · ${c?.name} · ${fb.recommendation} · ${fb.rating}/5`);
      return { ok: true };
    });
  }
  function addAtsNote(candidate_id, text) {
    if (!isAdminFor("recruitment")) return err("You do not manage recruitment.");
    if (!String(text || "").trim()) return err("Write a note.");
    return mutate((x) => {
      x.atsNotes.unshift({ id: nextSeq(x.atsNotes, "AN-", "id", 1), candidate_id, by: S().code, at: nowIso(), text: text.trim() });
      audit(x, "CANDIDATE_NOTE", candidate_id);
      return { ok: true };
    });
  }
  function saveJobPosting(req_id, p) {
    if (!isAdminFor("recruitment")) return err("You do not manage recruitment.");
    if (!String(p.title || "").trim()) return err("Give the posting a title.");
    if (!String(p.jd || "").trim()) return err("Write the job description (or use AI to draft it).");
    return mutate((x) => {
      const prev = x.jobPostings[req_id];
      x.jobPostings[req_id] = { ...prev, ...p, skills: (Array.isArray(p.skills) ? p.skills : String(p.skills || "").split(",")).map((s) => s.trim()).filter(Boolean), exp: [Number(p.exp?.[0]) || 0, Number(p.exp?.[1]) || 30], budget_max: Number(p.budget_max) || 0, published_at: p.published && !prev?.published ? nowIso() : prev?.published_at || null };
      audit(x, prev ? "JOB_POSTING_UPDATE" : "JOB_POSTING_CREATE", `${req_id} · ${p.title}${p.published ? " · published" : ""}`);
      return { ok: true };
    });
  }

  // ── Compliance calendar ──────────────────────────────
  function setComplianceStatus(key, patch) {
    if (!isAdminFor("compliance") && !isAdminFor("payroll")) return err("You need the Compliance or Payroll module.");
    if (patch.status === "filed" && !String(patch.ref || "").trim()) return err("Enter the acknowledgement / challan / reference number.");
    return mutate((x) => {
      const prev = x.complianceStatus[key] || {};
      x.complianceStatus[key] = { ...prev, ...patch, ...(patch.status === "filed" ? { filed_at: nowIso(), filed_by: S().code } : {}), updated_at: nowIso(), updated_by: S().code };
      audit(x, "COMPLIANCE_STATUS", `${key} → ${patch.status || prev.status || "updated"}${patch.ref ? ` · ref ${patch.ref}` : ""}`);
      return { ok: true };
    });
  }
  function upsertComplianceItem(it) {
    if (!isAdminFor("compliance") && !isAdminFor("payroll")) return err("You need the Compliance or Payroll module.");
    if (!String(it.title || "").trim() || !it.due) return err("Title and due date are required.");
    return mutate((x) => {
      const ex = it.id && x.complianceItems.find((c) => c.id === it.id);
      if (ex) Object.assign(ex, it);
      else x.complianceItems.push({ ...it, id: nextSeq(x.complianceItems, "CMP-", "id", 1), category: it.category || "custom", country: it.country || "IN", created_by: S().code });
      if (it.owner) pushNote(x, it.owner, `Compliance item assigned to you: ${it.title} (due ${it.due}).`, "/compliance-calendar");
      audit(x, ex ? "COMPLIANCE_ITEM_UPDATE" : "COMPLIANCE_ITEM_ADD", `${it.title} · due ${it.due}`);
      return { ok: true };
    });
  }
  function deleteComplianceItem(id) {
    if (!isAdminFor("compliance") && !isAdminFor("payroll")) return err("You need the Compliance or Payroll module.");
    return mutate((x) => {
      x.complianceItems = x.complianceItems.filter((c) => c.id !== id);
      audit(x, "COMPLIANCE_ITEM_DELETE", id);
      return { ok: true };
    });
  }

  // ── Chat ─────────────────────────────────────────────
  function sendChatMessage(channel_id, text, attachment) {
    const d = D();
    const ch = d.chatChannels.find((c) => c.id === channel_id);
    if (!ch) return err("Conversation not found.");
    if (!channelMembers(d, ch).includes(S().code)) return err("You are not a member of this conversation.");
    if (ch.readonly && S().role === "emp") return err("Only admins can post in this channel.");
    const body = String(text || "").trim();
    if (!body && !attachment) return err("Type a message.");
    if (body.length > 4000) return err("Messages are limited to 4,000 characters.");
    if (attachment && attachment.size > 1024 * 1024) return err("Attachments are limited to 1 MB in this browser demo.");
    return mutate((x) => {
      const id = nextSeq(x.chatMessages, "MSG-", "id", 5);
      const at = nowIso();
      const members = channelMembers(x, ch);
      const mentions = [...body.matchAll(/@([A-Za-z]+)/g)].map((m) => m[1].toLowerCase());
      const mentioned = members.filter((code) => code !== S().code && mentions.includes(nameIn(x, code).split(" ")[0].toLowerCase()));
      x.chatMessages.push({ id, channel_id, from: S().code, text: body, at, reactions: {}, attachment: attachment || null, mentions: mentioned });
      x.chatReads[S().code] = { ...(x.chatReads[S().code] || {}), [channel_id]: at };
      const label = ch.kind === "dm" ? "sent you a message" : `mentioned you in ${ch.kind === "channel" ? `#${ch.name}` : ch.name}`;
      mentioned.forEach((code) => pushNote(x, code, `${nameIn(x, S().code)} ${label}: "${body.slice(0, 80)}"`, `/chat?c=${channel_id}`));
      return { ok: true, id };
    });
  }
  function markChannelRead(channel_id) {
    const last = D().chatReads?.[S()?.code]?.[channel_id] || "";
    const newest = D().chatMessages.filter((m) => m.channel_id === channel_id).reduce((a, m) => (m.at > a ? m.at : a), "");
    if (!newest || newest <= last) return { ok: true };
    return mutate((x) => {
      x.chatReads[S().code] = { ...(x.chatReads[S().code] || {}), [channel_id]: nowIso() };
      return { ok: true };
    });
  }
  function openDm(code) {
    if (!code || code === S().code) return err("Choose someone else.");
    const ex = D().chatChannels.find((c) => c.kind === "dm" && c.members.includes(code) && c.members.includes(S().code));
    if (ex) return { ok: true, id: ex.id };
    return mutate((x) => {
      const id = `CH-dm-${Date.now().toString(36)}`;
      x.chatChannels.push({ id, kind: "dm", name: "", members: [S().code, code], created_by: S().code, created_at: nowIso() });
      return { ok: true, id };
    });
  }
  function createChannel({ name, topic, members, kind = "channel" }) {
    const n = String(name || "").trim().toLowerCase().replace(/\s+/g, "-");
    if (kind === "channel" && !/^[a-z0-9][a-z0-9-]{1,30}$/.test(n)) return err("Channel names use 2–31 lowercase letters, digits or dashes.");
    if (kind === "group" && !String(name || "").trim()) return err("Name the group.");
    if (kind === "group" && (members || []).length < 2) return err("Add at least two people.");
    if (kind === "channel" && S().role === "emp" && members === "all") return err("Only admins can create company-wide channels.");
    if (D().chatChannels.some((c) => c.kind === "channel" && c.name === n && kind === "channel")) return err(`#${n} already exists.`);
    return mutate((x) => {
      const id = `CH-${Date.now().toString(36)}`;
      const mem = members === "all" || String(members).startsWith("dept:") ? members : [...new Set([S().code, ...(members || [])])];
      x.chatChannels.push({ id, kind, name: kind === "channel" ? n : String(name).trim(), topic: topic || "", members: mem, created_by: S().code, created_at: nowIso() });
      audit(x, "CHAT_CHANNEL_CREATE", `${kind} · ${name}`);
      return { ok: true, id };
    });
  }
  function reactChat(msgId, emoji) {
    return mutate((x) => {
      const m = x.chatMessages.find((i) => i.id === msgId);
      if (!m) return err("Message not found.");
      const list = new Set(m.reactions?.[emoji] || []);
      if (list.has(S().code)) list.delete(S().code);
      else list.add(S().code);
      m.reactions = { ...(m.reactions || {}), [emoji]: [...list] };
      if (!list.size) delete m.reactions[emoji];
      return { ok: true };
    });
  }
  function deleteChatMessage(msgId) {
    const m = D().chatMessages.find((i) => i.id === msgId);
    if (!m) return err("Message not found.");
    if (m.from !== S().code && S().role !== "superadmin") return err("You can delete only your own messages.");
    return mutate((x) => {
      const k = x.chatMessages.find((i) => i.id === msgId);
      k.deleted = true;
      k.text = "";
      k.attachment = null;
      audit(x, "CHAT_MESSAGE_DELETE", `${msgId} in ${k.channel_id}`);
      return { ok: true };
    });
  }

  // ── Meetings, clients and calendar events ────────────
  function saveMeeting(m) {
    if (!String(m.title || "").trim()) return err("Give the meeting a title.");
    if (!m.start || !m.end || m.end <= m.start) return err("Choose a start and an end after it.");
    if (m.kind === "client" && !m.client_id) return err("Choose the client (or add a new one).");
    if (m.mode === "in_person" && !String(m.location || "").trim()) return err("Add the meeting location.");
    const ex = m.id && D().meetings.find((k) => k.id === m.id);
    if (ex && ex.organizer !== S().code && S().role !== "superadmin" && !(ex.attendees || []).includes(S().code)) return err("Only the organiser or an attendee can change this meeting.");
    return mutate((x) => {
      const now = nowIso();
      const rec = { kind: m.kind || "meeting", title: m.title.trim(), client_id: m.kind === "client" ? m.client_id : null, start: m.start, end: m.end, mode: m.mode || "video", location: m.location || "", link: m.mode === "in_person" ? "" : normalizeLink(m.link) || (m.mode === "video" ? jitsiLink(m.title) : ""), provider: m.mode === "video" ? m.provider || detectProvider(m.link) || "jitsi" : null, guests: (m.guests || []).filter(Boolean), external: m.mode === "video" ? m.external || null : null, attendees: (m.attendees || []).filter((c) => c !== (ex?.organizer || S().code)), agenda: m.agenda || "", ai_scheduled: !!m.ai_scheduled };
      let id = m.id;
      if (ex) {
        const moved = ex.start !== rec.start;
        Object.assign(ex, rec, { updated_at: now });
        rec.attendees.forEach((c) => pushNote(x, c, `${moved ? "Meeting moved" : "Meeting updated"}: ${rec.title} · ${new Date(rec.start).toLocaleString("en-IN", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`, "/calendar"));
      } else {
        id = nextSeq(x.meetings, "MTG-", "id", 4);
        x.meetings.push({ id, ...rec, organizer: S().code, notes: "", minutes: "", action_items: [], status: "scheduled", created_at: now });
        rec.attendees.forEach((c) => pushNote(x, c, `${nameIn(x, S().code)} invited you: ${rec.title} · ${new Date(rec.start).toLocaleString("en-IN", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`, "/calendar"));
      }
      audit(x, ex ? "MEETING_UPDATE" : "MEETING_CREATE", `${id} · ${rec.title} · ${rec.start}${rec.ai_scheduled ? " · AI scheduled" : ""}`);
      return { ok: true, id };
    });
  }
  function cancelMeeting(id, reason) {
    const ex = D().meetings.find((k) => k.id === id);
    if (!ex) return err("Meeting not found.");
    if (ex.organizer !== S().code && S().role !== "superadmin") return err("Only the organiser can cancel.");
    return mutate((x) => {
      const k = x.meetings.find((i) => i.id === id);
      k.status = "cancelled";
      k.cancel_reason = reason || "";
      k.attendees.forEach((c) => pushNote(x, c, `Cancelled: ${k.title}${reason ? ` – ${reason}` : ""}`, "/calendar"));
      audit(x, "MEETING_CANCEL", `${id} · ${k.title}`);
      return { ok: true };
    });
  }
  function saveMinutes(id, { notes, minutes, action_items, outcome, complete }) {
    const ex = D().meetings.find((k) => k.id === id);
    if (!ex) return err("Meeting not found.");
    if (ex.organizer !== S().code && !ex.attendees.includes(S().code) && S().role !== "superadmin") return err("Only participants can write minutes.");
    return mutate((x) => {
      const k = x.meetings.find((i) => i.id === id);
      const before = new Set((k.action_items || []).map((a) => `${a.text}|${a.owner}`));
      Object.assign(k, { notes: notes ?? k.notes, minutes: minutes ?? k.minutes, action_items: action_items ?? k.action_items, outcome: outcome ?? k.outcome });
      if (complete) k.status = "completed";
      (action_items || []).filter((a) => a.owner && a.owner !== S().code && !before.has(`${a.text}|${a.owner}`)).forEach((a) => pushNote(x, a.owner, `Action item from "${k.title}": ${a.text}${a.due ? ` (due ${a.due})` : ""}`, "/meetings"));
      audit(x, "MEETING_MINUTES", `${id} · ${(action_items || k.action_items).length} action item(s)${complete ? " · completed" : ""}`);
      return { ok: true };
    });
  }
  function toggleActionItem(id, idx) {
    return mutate((x) => {
      const k = x.meetings.find((i) => i.id === id);
      const a = k?.action_items?.[idx];
      if (!a) return err("Action item not found.");
      a.done = !a.done;
      return { ok: true };
    });
  }
  function upsertClient(c) {
    if (!String(c.company || "").trim() || !String(c.contact || "").trim()) return err("Company and contact name are required.");
    if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) return err("Enter a valid email.");
    return mutate((x) => {
      const ex = c.id && x.clients.find((k) => k.id === c.id);
      let id = c.id;
      if (ex) Object.assign(ex, c);
      else {
        id = nextSeq(x.clients, "CL-", "id", 1);
        x.clients.push({ stage: "Discovery", owner: S().code, ...c, id });
      }
      audit(x, ex ? "CLIENT_UPDATE" : "CLIENT_CREATE", `${id} · ${c.company}`);
      return { ok: true, id };
    });
  }
  function saveEvent(ev) {
    if (!String(ev.title || "").trim() || !ev.start || !ev.end || ev.end <= ev.start) return err("Title, start and an end after the start are required.");
    return mutate((x) => {
      const ex = ev.id && x.events.find((k) => k.id === ev.id);
      if (ex) {
        if (ex.owner !== S().code && S().role !== "superadmin") return err("Only the owner can change this event.");
        Object.assign(ex, ev);
      } else x.events.push({ kind: "event", attendees: [], ...ev, id: nextSeq(x.events, "EV-", "id", 4), owner: S().code });
      return { ok: true };
    });
  }
  function deleteEvent(id) {
    return mutate((x) => {
      const ex = x.events.find((k) => k.id === id);
      if (!ex) return err("Event not found.");
      if (ex.owner !== S().code && S().role !== "superadmin") return err("Only the owner can delete this event.");
      x.events = x.events.filter((k) => k.id !== id);
      return { ok: true };
    });
  }

  // ── Learning: employees' own videos / documents / links, shared with colleagues for review ──
  function addLearningItem(it) {
    if (!String(it.title || "").trim()) return err("Give it a title.");
    if (it.kind === "link" && !/^https?:\/\/\S+\.\S+/i.test(String(it.url || "").trim())) return err("Paste a full link starting with https://");
    if (it.kind === "file" && !it.file_id) return err("Choose a video or document to upload.");
    return mutate((x) => {
      x.learningItems = x.learningItems || [];
      const id = nextSeq(x.learningItems, "LRN-", "id", 4);
      x.learningItems.unshift({ id, owner: S().code, title: it.title.trim(), description: (it.description || "").trim(), category: it.category || "Skill", kind: it.kind, url: it.kind === "link" ? it.url.trim() : "", file_id: it.file_id || null, file_name: it.file_name || "", size: it.size || 0, type: it.type || "", shares: [], reviews: [], created_at: nowIso() });
      audit(x, "LEARNING_ADD", `${id} · ${it.title.trim()}`);
      return { ok: true, id };
    });
  }
  function deleteLearningItem(id) {
    return mutate((x) => {
      const it = (x.learningItems || []).find((k) => k.id === id);
      if (!it) return err("Not found.");
      if (it.owner !== S().code && S().role !== "superadmin") return err("Only the owner can delete this.");
      x.learningItems = x.learningItems.filter((k) => k.id !== id);
      audit(x, "LEARNING_DELETE", id);
      return { ok: true, file_id: it.file_id };
    });
  }
  function shareLearningItem(id, codes, message) {
    const it = (D().learningItems || []).find((k) => k.id === id);
    if (!it) return err("Not found.");
    if (it.owner !== S().code) return err("Only the owner can share this.");
    const to = [...new Set(codes || [])].filter((c) => c && c !== S().code);
    if (!to.length) return err("Choose at least one colleague.");
    return mutate((x) => {
      const k = x.learningItems.find((y) => y.id === id);
      const now = nowIso();
      to.forEach((c) => {
        if (!k.shares.some((sh) => sh.to === c)) k.shares.push({ to: c, at: now, message: (message || "").trim() });
        pushNote(x, c, `${nameIn(x, S().code)} asked you to review "${k.title}"${message ? `: ${String(message).trim().slice(0, 80)}` : ""}`, `/learning?item=${id}`);
      });
      audit(x, "LEARNING_SHARE", `${id} → ${to.join(", ")}`);
      return { ok: true, count: to.length };
    });
  }
  function reviewLearningItem(id, { rating, comment }) {
    const it = (D().learningItems || []).find((k) => k.id === id);
    if (!it) return err("Not found.");
    if (!it.shares.some((sh) => sh.to === S().code)) return err("This wasn't shared with you.");
    if (!(Number(rating) >= 1 && Number(rating) <= 5)) return err("Give a rating from 1 to 5 stars.");
    if (String(comment || "").trim().length < 5) return err("Add a short comment for the owner.");
    return mutate((x) => {
      const k = x.learningItems.find((y) => y.id === id);
      k.reviews = (k.reviews || []).filter((r) => r.by !== S().code);
      k.reviews.push({ by: S().code, rating: Number(rating), comment: String(comment).trim(), at: nowIso() });
      pushNote(x, k.owner, `${nameIn(x, S().code)} reviewed "${k.title}" (${rating}/5)`, `/learning?item=${id}`);
      return { ok: true };
    });
  }

  return {
    initiateBgv, giveBgvConsent, updateBgvCheck, holdBgv, uploadBgvDoc, closeBgv, reopenBgv, cancelBgv, remindBgv, logBgvView, grantBgvAccess, revokeBgvAccess,
    addApplicant, updateApplicant, scheduleInterview, setInterviewStatus, submitInterviewFeedback, addAtsNote, saveJobPosting,
    setComplianceStatus, upsertComplianceItem, deleteComplianceItem,
    sendChatMessage, markChannelRead, openDm, createChannel, reactChat, deleteChatMessage,
    saveMeeting, cancelMeeting, saveMinutes, toggleActionItem, upsertClient, saveEvent, deleteEvent,
    addLearningItem, deleteLearningItem, shareLearningItem, reviewLearningItem,
    bgvStatusOf: (c) => bgvStatus(c),
  };
}
