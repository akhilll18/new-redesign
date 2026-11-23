// Shared, pure helpers for v8 modules: background verification (BGV), applicant tracking,
// compliance calendar, internal chat, meetings and the unified calendar.
// Nothing here touches React or storage, so it can be reused by the server later.
import { filingCalendar, COUNTRIES as PAY_COUNTRIES } from "./payroll/index.js";
import { holidaysFor } from "../country/countryPacks.js";
import { isoDate, DAY } from "./utils.js";

// ── Background verification ─────────────────────────────
// `inhouse` checks are run by HR itself (no vendor needed); `countries` limits a check to subjects in those countries.
export const BGV_CHECK_DEFS = [
  { type: "identity", label: "Identity (Aadhaar / PAN / passport)" },
  { type: "documents", label: "Document verification", inhouse: true },
  { type: "address", label: "Address verification (field / digital)" },
  { type: "education", label: "Highest education" },
  { type: "employment", label: "Previous employment" },
  { type: "pf", label: "PF / UAN service history (EPFO)", inhouse: true, countries: ["IN"] },
  { type: "company_email", label: "Previous employer · official email check", inhouse: true },
  { type: "criminal", label: "Criminal & court records" },
  { type: "reference", label: "Professional references" },
  { type: "database", label: "Global database & sanctions" },
  { type: "credit", label: "Credit history" },
  { type: "drug", label: "Drug test (5 panel)" },
];
export const BGV_CHECKS = BGV_CHECK_DEFS.map((d) => [d.type, d.label]);
export const BGV_CHECK_LABEL = Object.fromEntries(BGV_CHECKS);
export const BGV_CHECK_DEF = Object.fromEntries(BGV_CHECK_DEFS.map((d) => [d.type, d]));
/** Checks of a package that apply to a subject in `country` (PF is India-only). */
export const bgvChecksFor = (pkg, country = "IN") => (BGV_PACKAGES[pkg]?.checks || []).filter((t) => !BGV_CHECK_DEF[t]?.countries || BGV_CHECK_DEF[t].countries.includes(country || "IN"));
export const BGV_PACKAGES = {
  basic: { label: "Basic", checks: ["identity", "documents", "address", "criminal"], tat: 5 },
  standard: { label: "Standard", checks: ["identity", "documents", "address", "education", "employment", "pf", "company_email", "criminal", "reference"], tat: 10 },
  comprehensive: { label: "Comprehensive", checks: ["identity", "documents", "address", "education", "employment", "pf", "company_email", "criminal", "reference", "database", "credit"], tat: 15 },
  senior: { label: "Leadership / finance", checks: ["identity", "documents", "address", "education", "employment", "pf", "company_email", "criminal", "reference", "database", "credit", "drug"], tat: 21 },
};

// Overall case status, in the order a case normally moves.
export const BGV_STATUS = {
  not_started: { label: "Not started", tone: "neutral" },
  consent_pending: { label: "Initiated · consent pending", tone: "warn" },
  started: { label: "Started", tone: "info" },
  in_progress: { label: "Verification in progress", tone: "info" },
  insufficient: { label: "Insufficient docs", tone: "warn" },
  on_hold: { label: "On hold", tone: "warn" },
  review: { label: "Under HR review", tone: "info" },
  discrepancy: { label: "Discrepancy", tone: "bad" },
  clear: { label: "Cleared", tone: "good" },
  cleared_with_remarks: { label: "Cleared with remarks", tone: "good" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};
export const CHECK_STATUS = {
  pending: { label: "Pending", tone: "neutral" },
  in_progress: { label: "In progress", tone: "info" },
  insufficient: { label: "Insufficient", tone: "warn" },
  verified: { label: "Verified", tone: "good" },
  discrepancy: { label: "Discrepancy", tone: "bad" },
  unable_to_verify: { label: "Unable to verify", tone: "warn" },
  na: { label: "Not applicable", tone: "neutral" },
};
/** Outcomes that finish a check (it no longer needs work, though it may need a decision). */
export const CHECK_DONE = ["verified", "na", "discrepancy", "unable_to_verify"];

// ── Tracking: the steps each check moves through ─────────
const DEFAULT_STAGES = [["initiated", "Initiated"], ["docs_collected", "Documents collected"], ["with_vendor", "Sent to vendor"], ["in_verification", "Verification in progress"], ["report_received", "Report received"], ["completed", "Completed"]];
export const CHECK_STAGES = {
  documents: [["awaiting_docs", "Awaiting documents"], ["docs_received", "Documents received"], ["originals_seen", "Originals sighted"], ["authenticity", "Authenticity check"], ["issuer_confirmed", "Confirmed with issuer"], ["completed", "Completed"]],
  pf: [["uan_requested", "UAN requested"], ["uan_received", "UAN received"], ["epfo_fetched", "EPFO passbook fetched"], ["history_matched", "Service history compared"], ["completed", "Completed"]],
  address: [["address_captured", "Address captured"], ["agent_assigned", "Field agent assigned"], ["visit_scheduled", "Visit scheduled"], ["visit_done", "Visit done"], ["report_submitted", "Report submitted"], ["completed", "Completed"]],
  company_email: [["hr_identified", "Employer HR contact found"], ["domain_checked", "Official domain checked"], ["email_sent", "Verification email sent"], ["reminder_sent", "Reminder sent"], ["response_received", "Response received"], ["completed", "Completed"]],
};
export const stagesOf = (type) => CHECK_STAGES[type] || DEFAULT_STAGES;
export const stageLabel = (type, stage) => stagesOf(type).find(([k]) => k === stage)?.[1] || stage;
/** Current stage of a check; older records without one get a stage from their status. */
export function checkStage(k) {
  const st = stagesOf(k.type);
  if (k.stage && st.some(([s]) => s === k.stage)) return k.stage;
  if (CHECK_DONE.includes(k.status)) return "completed";
  if (k.docs?.length) return st[1][0];
  return st[0][0];
}
export const stageIndex = (k) => stagesOf(k.type).findIndex(([s]) => s === checkStage(k));

// Check-specific details captured while tracking. kind: text | date | select | email
export const DOCUMENT_ITEMS = ["Aadhaar card", "PAN card", "Passport", "Highest degree certificate", "Mark sheets", "Relieving / experience letter", "Last 3 payslips", "Offer letter of last employer"];
export const DOC_ITEM_STATUS = { pending: { label: "Pending", tone: "neutral" }, received: { label: "Received", tone: "info" }, verified: { label: "Verified", tone: "good" }, mismatch: { label: "Mismatch / tampered", tone: "bad" }, na: { label: "Not applicable", tone: "neutral" } };
export const CHECK_FIELDS = {
  pf: [
    ["uan", "UAN (12 digits)", "text"],
    ["establishment", "Last establishment in EPFO", "text"],
    ["member_id", "PF member ID", "text"],
    ["epfo_from", "Contributions from", "date"],
    ["epfo_to", "Last contribution", "date"],
    ["result", "EPFO vs declared history", "select", [["match", "Matches declared history"], ["gap", "Gap in contributions"], ["mismatch", "Employer or dates differ"], ["dual", "Overlapping (dual) employment"], ["no_pf", "No PF record (exempt / small employer)"]]],
  ],
  address: [
    ["method", "Method", "select", [["physical", "Physical field visit"], ["digital", "Digital (geo-tagged, candidate app)"], ["postal", "Postal / courier"]]],
    ["address_type", "Address", "select", [["current", "Current address"], ["permanent", "Permanent address"], ["both", "Current and permanent"]]],
    ["agent", "Field agent", "text"],
    ["visit_date", "Visit date", "date"],
    ["outcome", "Visit outcome", "select", [["confirmed", "Stays at address – confirmed"], ["short_stay", "Confirmed – shorter stay than declared"], ["not_found", "Address not found"], ["moved", "Moved out"], ["locked", "House locked – revisit"], ["refused", "Respondent refused"]]],
    ["respondent", "Respondent (name · relation)", "text"],
    ["stay_since", "Staying since", "text"],
    ["geo", "Geo-tag (lat, lng)", "text"],
  ],
  company_email: [
    ["employer", "Previous employer", "text"],
    ["hr_name", "Employer HR contact", "text"],
    ["hr_email", "HR official email", "email"],
    ["sent_on", "Email sent on", "date"],
    ["response", "Employer response", "select", [["confirmed", "Confirmed – details match"], ["dates_differ", "Dates differ"], ["designation_differs", "Designation differs"], ["not_eligible_rehire", "Not eligible for rehire"], ["no_response", "No response after reminders"]]],
    ["response_on", "Response on", "date"],
  ],
};
const DEFAULT_FIELDS = [["vendor_ref", "Vendor reference", "text"], ["source", "Verified with / source", "text"]];
export const fieldsOf = (type) => (type === "documents" ? DEFAULT_FIELDS.slice(1) : CHECK_FIELDS[type] || DEFAULT_FIELDS);

const FREE_MAIL = /@(gmail|googlemail|yahoo|ymail|outlook|hotmail|live|msn|rediffmail|icloud|me|aol|proton|protonmail|zoho|gmx|yandex|mail)\.[a-z.]+$/i;
/** Is this email on a company's own domain (not a free mailbox)? */
export function officialEmailCheck(email) {
  const s = String(email || "").trim().toLowerCase();
  if (!s) return { ok: false, text: "No email yet" };
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(s)) return { ok: false, text: "Not a valid email address" };
  if (FREE_MAIL.test(s)) return { ok: false, text: "Free mailbox – not accepted; use the employer's own domain" };
  return { ok: true, text: `Official domain · ${s.split("@")[1]}` };
}

// ── Overall tracker for a case ───────────────────────────
export const CASE_STEPS = [["initiated", "Initiated"], ["consent", "Consent signed"], ["started", "Started"], ["verification", "Verification"], ["review", "HR review"], ["closed", "Cleared / closed"]];
/** Index into CASE_STEPS for where a case is now. */
export function bgvStep(c) {
  if (!c) return -1;
  if (c.closed_status) return 5;
  if (c.consent?.status !== "given") return 0;
  const done = c.checks.filter((k) => CHECK_DONE.includes(k.status)).length;
  if (done === c.checks.length) return 4;
  if (!done && c.checks.every((k) => stageIndex(k) <= 0)) return 2;
  return 3;
}

/** Overall case status from its checks (a closed decision wins). */
export function bgvStatus(c) {
  if (!c) return "not_started";
  if (c.closed_status) return c.closed_status;
  if (c.cancelled) return "cancelled";
  if (c.consent?.status !== "given") return c.initiated_at ? "consent_pending" : "not_started";
  if (c.on_hold) return "on_hold";
  const st = c.checks.map((k) => k.status);
  if (st.includes("discrepancy")) return "discrepancy";
  if (st.includes("insufficient")) return "insufficient";
  if (st.every((s) => CHECK_DONE.includes(s))) return "review";
  if (bgvStep(c) === 2) return "started";
  return "in_progress";
}
export function bgvProgress(c) {
  if (!c?.checks?.length) return 0;
  // Each check counts by how far along its own steps it is, so the bar moves before checks finish.
  const part = c.checks.map((k) => (CHECK_DONE.includes(k.status) ? 1 : Math.max(0, stageIndex(k)) / (stagesOf(k.type).length - 1)));
  return Math.round((part.reduce((a, b) => a + b, 0) / c.checks.length) * 100);
}
export const bgvFor = (data, empCode) => (data.bgv || []).filter((c) => c.employee_code === empCode && !c.cancelled).sort((a, b) => String(b.initiated_at).localeCompare(String(a.initiated_at)))[0] || null;
export const bgvForCandidate = (data, cid) => (data.bgv || []).filter((c) => c.candidate_id === cid && !c.cancelled).sort((a, b) => String(b.initiated_at).localeCompare(String(a.initiated_at)))[0] || null;

/**
 * What a signed-in user may see of a BGV case.
 * "full"   – every check, remarks and documents (Super Admin, admins with the bgv module, explicit grants)
 * "summary"– overall status and each check's status, no remarks or documents (granted managers / recruiters)
 * "status" – overall status only (managers for their direct reports, the recruitment team for candidates)
 * "self"   – the employee's own case (no internal remarks)
 * null     – nothing
 */
export function bgvAccessLevel(data, user, c) {
  if (!user || !c) return null;
  if (user.role === "superadmin") return "full";
  const today = isoDate();
  const grants = (data.bgvAccess || []).filter((g) => g.code === user.code && !g.revoked && (!g.expires_on || g.expires_on >= today));
  if (user.role === "admin") {
    if (user.modules?.includes("bgv")) return "full";
    const g = grants.find((x) => x.scope === "all" || x.scope === c.id);
    if (g) return g.level;
    if (c.candidate_id && user.modules?.includes("recruitment")) return "status";
    if (c.employee_code && user.modules?.includes("onboarding") && data.onboarding?.some((o) => o.employee_code === c.employee_code)) return "status";
    return null;
  }
  if (c.employee_code && c.employee_code === user.employee_code) return "self";
  const emp = data.employees.find((e) => e.employee_code === c.employee_code);
  const g = grants.find((x) => x.scope === "all" || x.scope === c.id || (x.scope === "team" && emp?.reporting_manager === user.employee_code));
  if (g) return g.level;
  if (emp && emp.reporting_manager === user.employee_code) return "status";
  const cand = c.candidate_id && data.candidates.find((k) => k.id === c.candidate_id);
  const req = cand && data.reqs.find((r) => r.id === cand.req_id);
  if (req && req.hiring_manager === user.employee_code) return "status";
  return null;
}
/** Can this user see BGV status in the people directory / employee screens at all? */
export function canSeeBgvColumn(data, user) {
  if (!user) return false;
  if (user.role === "superadmin") return true;
  if (user.role === "admin") return !!user.modules?.includes("bgv") || (data.bgvAccess || []).some((g) => g.code === user.code && !g.revoked);
  return false;
}
export function canManageBgv(user) {
  return user?.role === "superadmin" || (user?.role === "admin" && !!user.modules?.includes("bgv"));
}

// ── Applicant tracking ──────────────────────────────────
export const ATS_STAGES = [["applied", "Applied"], ["screen", "Screened"], ["interview", "Interview"], ["offer", "Offer"], ["hired", "Hired"]];
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9+#.]/g, "");
/** Explainable match score (0–100) of an applicant against a job posting. */
export function matchScore(profile = {}, posting = {}, req = {}) {
  const want = (posting.skills || []).map(norm).filter(Boolean);
  const have = new Set((profile.skills || []).map(norm));
  const hit = want.filter((s) => have.has(s));
  const skillPct = want.length ? hit.length / want.length : 0.5;
  const [minY, maxY] = posting.exp || [0, 30];
  const y = Number(profile.experience_yrs) || 0;
  const expFit = y >= minY && y <= maxY + 2 ? 1 : y < minY ? Math.max(0, 1 - (minY - y) / Math.max(1, minY)) : 0.7;
  const budget = Number(posting.budget_max) || 0;
  const ask = Number(profile.expected_ctc) || 0;
  const payFit = !budget || !ask ? 0.8 : ask <= budget ? 1 : Math.max(0, 1 - (ask - budget) / budget);
  const notice = Number(profile.notice_days ?? 30);
  const noticeFit = notice <= 30 ? 1 : notice <= 60 ? 0.75 : 0.45;
  const score = Math.round(skillPct * 50 + expFit * 20 + payFit * 15 + noticeFit * 15);
  const missing = (posting.skills || []).filter((s) => !have.has(norm(s)));
  const facts = [
    `Skills: ${hit.length} of ${want.length || "?"} required (${(posting.skills || []).filter((s) => have.has(norm(s))).join(", ") || "none"})${missing.length ? `; missing ${missing.join(", ")}` : ""}`,
    `Experience: ${y} yrs vs ${minY}–${maxY} yrs wanted`,
    budget && ask ? `Expected CTC ₹${(ask / 100000).toFixed(1)} L vs budget up to ₹${(budget / 100000).toFixed(1)} L` : "Pay expectation not recorded",
    `Notice period: ${notice} days`,
    profile.current_company ? `Currently at ${profile.current_company}${profile.location ? `, ${profile.location}` : ""}` : "",
  ].filter(Boolean);
  return { score, skillPct: Math.round(skillPct * 100), hit, missing, facts, band: score >= 75 ? "Strong" : score >= 55 ? "Possible" : "Weak", role: req.role };
}

// ── Time zones (main office city per country) ───────────
export const COUNTRY_TZ = {
  IN: "Asia/Kolkata", GB: "Europe/London", US: "America/Chicago", AE: "Asia/Dubai", SG: "Asia/Singapore", NA: "Africa/Windhoek",
  ZA: "Africa/Johannesburg", KE: "Africa/Nairobi", NG: "Africa/Lagos", BW: "Africa/Gaborone", CA: "America/Toronto", MX: "America/Mexico_City",
  BR: "America/Sao_Paulo", DE: "Europe/Berlin", FR: "Europe/Paris", IE: "Europe/Dublin", SA: "Asia/Riyadh", MY: "Asia/Kuala_Lumpur",
  PH: "Asia/Manila", ID: "Asia/Jakarta", GH: "Africa/Accra", ZM: "Africa/Lusaka",
};
export function tzOf(person) {
  return COUNTRY_TZ[person?.country_code || "IN"] || "Asia/Kolkata";
}
/** Hour (decimal) and weekday of a Date in an IANA time zone. */
export function localParts(date, tz) {
  try {
    const f = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false, year: "numeric", month: "2-digit", day: "2-digit" });
    const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
    return { hour: (Number(p.hour) % 24) + Number(p.minute) / 60, weekday: p.weekday, date: `${p.year}-${p.month}-${p.day}`, label: `${p.hour}:${p.minute}` };
  } catch {
    return { hour: date.getHours() + date.getMinutes() / 60, weekday: date.toDateString().slice(0, 3), date: isoDate(date), label: date.toTimeString().slice(0, 5) };
  }
}
export function fmtTime(v) {
  return new Date(v).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}
export function fmtDay(v) {
  return new Date(v).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });
}

// ── People (any signed-in identity) ─────────────────────
export function directory(data) {
  const emps = data.employees.filter((e) => e.status === "active").map((e) => ({ code: e.employee_code, name: e.full_name, title: e.designation, dept: e.department, country: e.country_code || "IN", kind: "emp", rec: e }));
  const adm = data.admins.filter((a) => a.status === "active").map((a) => ({ code: a.admin_code, name: `${a.full_name} (Admin)`, title: `Admin · ${a.modules.slice(0, 3).join(", ")}`, dept: "Admin", country: "IN", kind: "admin", rec: a }));
  const sa = data.superAdmins.map((s) => ({ code: s.superadmin_code, name: `${s.full_name} (Super Admin)`, title: "Super Admin", dept: "Admin", country: "IN", kind: "super", rec: s }));
  return [...emps, ...adm, ...sa];
}
/** Admin logins are linked to an employee record: treat both codes as one person for calendars. */
export function identityCodes(data, user) {
  const codes = new Set([user.code]);
  if (user.employee_code) codes.add(user.employee_code);
  if (user.role === "emp") data.admins.filter((a) => a.employee_code === user.employee_code).forEach((a) => codes.add(a.admin_code));
  return codes;
}

// ── Unified calendar ────────────────────────────────────
export const EVENT_KIND = {
  meeting: { label: "Internal meeting", color: "#2E8C7A" },
  client: { label: "Client meeting", color: "#C77B1C" },
  interview: { label: "Interview", color: "#5b5fc7" },
  event: { label: "Event", color: "#3b7a63" },
  focus: { label: "Focus time", color: "#7c8a80" },
  leave: { label: "Leave", color: "#d32f2f" },
  holiday: { label: "Holiday", color: "#8a6d3b" },
  compliance: { label: "Compliance due", color: "#a54e45" },
  bgv: { label: "BGV due", color: "#6b4fa0" },
  joining: { label: "Joining", color: "#2f6fb0" },
};

/** Every busy block for a person code (used by the scheduler and the calendar). */
export function busyBlocks(data, code, from, to) {
  const out = [];
  const inRange = (s, e) => s < to && e > from;
  const e = data.employees.find((x) => x.employee_code === code);
  const linked = new Set([code]);
  if (e) data.admins.filter((a) => a.employee_code === code).forEach((a) => linked.add(a.admin_code));
  const adm = data.admins.find((a) => a.admin_code === code);
  if (adm?.employee_code) linked.add(adm.employee_code);
  const has = (list) => (list || []).some((c) => linked.has(c));
  for (const m of data.meetings || []) {
    if (m.status === "cancelled") continue;
    if (!has([m.organizer, ...(m.attendees || [])])) continue;
    if (inRange(m.start, m.end)) out.push({ start: m.start, end: m.end, title: m.title, kind: m.kind === "client" ? "client" : "meeting", ref: m.id });
  }
  for (const iv of data.interviews || []) {
    if (iv.status === "cancelled") continue;
    if (!has(iv.interviewers)) continue;
    if (inRange(iv.start, iv.end)) out.push({ start: iv.start, end: iv.end, title: `Interview`, kind: "interview", ref: iv.id });
  }
  for (const ev of data.events || []) {
    if (!has([ev.owner, ...(ev.attendees || [])])) continue;
    if (inRange(ev.start, ev.end)) out.push({ start: ev.start, end: ev.end, title: ev.title, kind: ev.kind || "event", ref: ev.id });
  }
  const empCode = e?.employee_code || adm?.employee_code;
  if (empCode) {
    for (const r of data.requests || []) {
      if (r.type !== "leave" || r.employee_code !== empCode || !["Approved", "Pending"].includes(r.status)) continue;
      const s = `${r.from_date}T00:00:00`;
      const en = `${r.to_date}T23:59:59`;
      if (inRange(new Date(s).toISOString(), new Date(en).toISOString())) out.push({ start: new Date(s).toISOString(), end: new Date(en).toISOString(), title: `On leave${r.status === "Pending" ? " (pending)" : ""}`, kind: "leave", allDay: true, ref: r.request_id });
    }
    const emp = data.employees.find((x) => x.employee_code === empCode);
    for (const h of holidaysFor(data, emp) || []) {
      const s = new Date(`${h.date}T00:00:00`).toISOString();
      const en = new Date(`${h.date}T23:59:59`).toISOString();
      if (inRange(s, en)) out.push({ start: s, end: en, title: h.name, kind: "holiday", allDay: true });
    }
  }
  return out;
}

// ── Compliance calendar ─────────────────────────────────
// Company-level statutory items that are not part of a payroll engine (confirm dates with your advisers).
export const COMPANY_COMPLIANCE = [
  { title: "Labour Welfare Fund (Telangana) – annual", authority: "Telangana Labour Welfare Board", country: "IN", freq: "Annual", month: 1, day: 31, category: "labour" },
  { title: "POSH annual report to District Officer", authority: "District Officer (POSH Act 2013)", country: "IN", freq: "Annual", month: 1, day: 31, category: "policy" },
  { title: "Bonus Act annual return (Form D)", authority: "Labour Department", country: "IN", freq: "Annual", month: 2, day: 1, category: "labour" },
  { title: "Shops & Establishments registration renewal", authority: "Telangana Labour Department", country: "IN", freq: "Annual", month: 12, day: 31, category: "licence" },
  { title: "Contract Labour annual return (Form XXV)", authority: "Labour Department", country: "IN", freq: "Annual", month: 2, day: 15, category: "labour" },
  { title: "ESI half-yearly return review", authority: "ESIC", country: "IN", freq: "Half-yearly", month: [5, 11], day: 11, category: "statutory" },
  { title: "Gratuity policy & nomination review", authority: "Internal (Payment of Gratuity Act)", country: "IN", freq: "Annual", month: 4, day: 30, category: "policy" },
  { title: "Fire safety & building NOC renewal", authority: "Fire Services", country: "IN", freq: "Annual", month: 11, day: 30, category: "licence" },
  { title: "Internal audit – HR & payroll controls", authority: "Internal audit", country: "ALL", freq: "Quarterly", month: [3, 6, 9, 12], day: 25, category: "audit" },
  { title: "Data protection: access review of HR systems", authority: "DPDP Act 2023 / GDPR", country: "ALL", freq: "Quarterly", month: [1, 4, 7, 10], day: 20, category: "policy" },
];
export const COMPLIANCE_CATEGORY = { statutory: "Statutory filing", labour: "Labour law", licence: "Licence / registration", policy: "Policy & governance", audit: "Audit", custom: "Custom" };

const monthStart = (y, m) => isoDate(new Date(y, m, 1, 12));
/** Statutory filings (from the country payroll engines) + company items + custom items, with status. */
export function complianceCalendar(data, { from, to, countries } = {}) {
  const today = isoDate();
  const f = from || isoDate(Date.now() - 62 * DAY);
  const t = to || isoDate(Date.now() + 120 * DAY);
  // v10.10: filings belong to a company — a new company with no legal entity yet has none
  const cs = countries || (Array.isArray(data.companies) && !data.companies.length ? [] : [...new Set(data.employees.filter((e) => e.status === "active").map((e) => e.country_code || "IN"))].filter((c) => PAY_COUNTRIES[c]));
  const seen = new Map();
  const add = (it) => {
    if (it.due < f || it.due > t) return;
    const key = it.key || `${it.country}|${it.title}|${it.due}`;
    if (seen.has(key)) return;
    const st = data.complianceStatus?.[key] || {};
    const status = st.status === "filed" ? "filed" : st.status === "waived" ? "waived" : it.due < today ? "overdue" : st.status === "in_progress" ? "in_progress" : Math.round((new Date(it.due) - new Date(today)) / DAY) <= 7 ? "due_soon" : "upcoming";
    seen.set(key, { ...it, key, status, record: st, daysLeft: Math.round((new Date(`${it.due}T12:00:00`) - new Date(`${today}T12:00:00`)) / DAY), owner: st.owner || it.owner || defaultOwner(data, it) });
  };
  const start = new Date(`${f}T12:00:00`);
  const end = new Date(`${t}T12:00:00`);
  for (const cc of cs) {
    for (let d = new Date(start.getFullYear(), start.getMonth(), 1, 12); d <= end; d.setMonth(d.getMonth() + 1)) {
      try {
        for (const r of filingCalendar(cc, monthStart(d.getFullYear(), d.getMonth()))) add({ title: r.name, authority: r.authority, freq: r.freq, due: r.due, country: cc, category: "statutory", source: "engine" });
      } catch {
        /* engine without calendar */
      }
    }
  }
  for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
    for (const c of COMPANY_COMPLIANCE) {
      if (c.country !== "ALL" && !cs.includes(c.country)) continue;
      for (const m of [].concat(c.month)) add({ title: c.title, authority: c.authority, freq: c.freq, due: isoDate(new Date(y, m - 1, c.day, 12)), country: c.country, category: c.category, source: "company" });
    }
  }
  for (const c of data.complianceItems || []) {
    if (c.country && c.country !== "ALL" && countries && !countries.includes(c.country)) continue;
    add({ ...c, key: `custom|${c.id}`, source: "custom" });
  }
  return [...seen.values()].sort((a, b) => a.due.localeCompare(b.due));
}
function defaultOwner(data, it) {
  const mod = it.category === "statutory" ? "payroll" : "compliance";
  return data.admins.find((a) => a.status === "active" && a.modules.includes(mod))?.admin_code || data.admins.find((a) => a.modules.includes("compliance"))?.admin_code || null;
}
export const COMPLIANCE_STATUS = {
  overdue: { label: "Overdue", tone: "bad" },
  due_soon: { label: "Due ≤ 7 days", tone: "warn" },
  in_progress: { label: "In progress", tone: "info" },
  upcoming: { label: "Upcoming", tone: "neutral" },
  filed: { label: "Filed", tone: "good" },
  waived: { label: "Not applicable", tone: "neutral" },
};
export function canManageCompliance(user) {
  return user?.role === "superadmin" || (user?.role === "admin" && (user.modules || []).some((m) => ["compliance", "payroll"].includes(m)));
}

// ── Chat ────────────────────────────────────────────────
export function channelMembers(data, ch) {
  if (ch.members === "all") return directory(data).map((p) => p.code);
  if (ch.members?.startsWith?.("dept:")) {
    const d = ch.members.slice(5);
    // Department channels: people in that department only (admins join through their linked employee record, if any).
    const emps = data.employees.filter((e) => e.status === "active" && e.department === d).map((e) => e.employee_code);
    return [...emps, ...data.admins.filter((a) => a.status === "active" && emps.includes(a.employee_code)).map((a) => a.admin_code)];
  }
  return ch.members || [];
}
export function myChannels(data, user) {
  return (data.chatChannels || []).filter((ch) => !ch.archived && channelMembers(data, ch).includes(user.code));
}
export function unreadCount(data, user, chId) {
  const last = data.chatReads?.[user.code]?.[chId] || "";
  return (data.chatMessages || []).filter((m) => m.channel_id === chId && m.from !== user.code && !m.deleted && m.at > last).length;
}
export function totalUnread(data, user) {
  if (!user) return 0;
  return myChannels(data, user).reduce((s, ch) => s + unreadCount(data, user, ch.id), 0);
}
