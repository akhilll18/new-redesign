// v8 demo data: background verification, applicant tracking profiles, interviews, job postings,
// compliance records, internal chat, clients, meetings and calendar events. All dates are relative to "today".
import { BGV_PACKAGES, complianceCalendar } from "../lib/collab.js";
import { requiredDocs } from "../lib/empdocs.js";
import { enrichBgvCase } from "./seedBgvTracking.js";
import { isoDate, DAY } from "../lib/utils.js";

function workday(n) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  let left = Math.abs(n);
  const step = n < 0 ? -1 : 1;
  while (left > 0) {
    d.setDate(d.getDate() + step);
    if (d.getDay() !== 0 && d.getDay() !== 6) left--;
  }
  if (n === 0) while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d;
}
const at = (n, h, m = 0) => {
  const d = workday(n);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};
const plus = (iso, min) => new Date(new Date(iso).getTime() + min * 60000).toISOString();
const ago = (days, h = 11) => {
  const d = new Date(Date.now() - days * DAY);
  d.setHours(h, (days * 13) % 60, 0, 0);
  return d.toISOString();
};

function bgvCase(id, e, { pkg = "standard", vendor = "VND-1", started, consent = true, statuses = {}, closed, remarks = "", candidate } = {}) {
  const p = BGV_PACKAGES[pkg];
  const init = started || ago(Math.max(1, Math.min(400, Math.round((Date.now() - new Date(`${e?.date_of_joining || isoDate()}T12:00:00`)) / DAY) + 10)));
  const checks = p.checks.map((type) => {
    const st = statuses[type] || (closed ? "verified" : "pending");
    return { type, status: st, remarks: st === "discrepancy" ? statuses[`${type}_note`] || "" : st === "insufficient" ? statuses[`${type}_note`] || "Document not received" : "", candidate_note: st === "insufficient" ? statuses[`${type}_ask`] || "Please upload a clear copy." : "", verified_at: st === "verified" ? plus(init, 60 * 24 * (3 + (type.length % 5))) : null, docs: [] };
  });
  return enrichBgvCase({
    id,
    subject_type: candidate ? "candidate" : "employee",
    employee_code: e?.employee_code || null,
    candidate_id: candidate?.id || null,
    name: e?.full_name || candidate?.name,
    package: pkg,
    vendor_id: vendor,
    initiated_at: init,
    initiated_by: "ADM01",
    consent: consent ? { status: "given", at: plus(init, 60 * 6), signed_name: e?.full_name || candidate?.name, ip: "10.0.4.21" } : { status: "pending", requested_at: init },
    due_date: isoDate(new Date(new Date(init).getTime() + p.tat * DAY)),
    checks,
    closed_status: closed || null,
    closed_at: closed ? plus(init, 60 * 24 * p.tat) : null,
    remarks,
    history: [
      { at: init, by: "ADM01", action: `Initiated · ${p.label} package` },
      ...(consent ? [{ at: plus(init, 360), by: e?.employee_code || "CANDIDATE", action: "Consent e-signed" }] : []),
      ...(closed ? [{ at: plus(init, 60 * 24 * p.tat), by: "ADM01", action: `Closed · ${closed === "clear" ? "Clear" : "Clear with remarks"}` }] : []),
    ],
  }, e);
}

export function buildCollabSeed({ employees, candidates }) {
  const E = (c) => employees.find((e) => e.employee_code === c);

  // ── Background verification ──
  const bgvVendors = [
    { id: "VND-1", name: "VeriTrust Screening (demo)", checks: ["identity", "address", "education", "employment", "criminal", "reference", "database", "credit", "drug"], tat_days: 10, contact: "ops@veritrust.demo", sla_pct: 94, cost: { basic: 900, standard: 2400, comprehensive: 3900, senior: 6500 } },
    { id: "VND-2", name: "ClearPath Global (demo)", checks: ["identity", "address", "education", "employment", "criminal", "database", "credit"], tat_days: 12, contact: "support@clearpath.demo", sla_pct: 89, cost: { basic: 1100, standard: 2700, comprehensive: 4200, senior: 7200 } },
    { id: "VND-0", name: "In-house HR team", checks: ["identity", "address", "reference"], tat_days: 5, contact: "hr@peoplehub.demo", sla_pct: 98, cost: { basic: 0, standard: 0, comprehensive: 0, senior: 0 } },
  ];
  const special = {
    EMP010: { pkg: "standard", started: ago(24), statuses: { identity: "verified", documents: "verified", pf: "in_progress", company_email: "in_progress", address: "verified", education: "verified", employment: "in_progress", criminal: "in_progress", reference: "pending" } },
    EMP012: { pkg: "standard", started: ago(9), statuses: { identity: "verified", documents: "in_progress", pf: "in_progress", address: "insufficient", address_note: "Address proof is older than 3 months", address_ask: "Upload a utility bill or rental agreement dated in the last 3 months.", education: "insufficient", education_note: "Degree certificate missing", education_ask: "Upload your B.Tech degree certificate (or provisional certificate) and final mark sheet.", employment: "in_progress", criminal: "verified", reference: "pending" } },
    EMP016: { pkg: "standard", started: ago(2), consent: false },
    EMP017: { pkg: "standard", started: ago(1), consent: false },
    EMP022: { pkg: "standard", started: ago(290), statuses: { identity: "verified", documents: "verified", pf: "verified", company_email: "verified", address: "verified", education: "verified", employment: "discrepancy", employment_note: "Previous employer confirms exit date 31-Mar-2024; candidate declared 30-Jun-2024 (3-month gap).", criminal: "verified", reference: "verified" } },
    EMP003: { pkg: "senior", closed: "clear" },
    EMP005: { pkg: "senior", closed: "clear" },
    EMP007: { pkg: "comprehensive", closed: "clear" },
    EMP002: { pkg: "comprehensive", closed: "clear" },
    EMP024: { pkg: "comprehensive", closed: "cleared_with_remarks", remarks: "One reference unreachable; two others positive. Accepted by HR." },
  };
  const bgv = [];
  let n = 1;
  for (const e of employees) {
    if (e.status === "rejected") continue;
    const sp = special[e.employee_code] || { pkg: e.country_code && e.country_code !== "IN" ? "basic" : "standard", vendor: e.country_code && e.country_code !== "IN" ? "VND-2" : "VND-1", closed: "clear" };
    bgv.push(bgvCase(`BGV-${String(n++).padStart(4, "0")}`, e, sp));
  }
  const cand = (name) => candidates.find((c) => c.name === name);
  if (cand("Rohan Gupta")) bgv.push(bgvCase(`BGV-${String(n++).padStart(4, "0")}`, null, { candidate: cand("Rohan Gupta"), pkg: "basic", started: ago(3), statuses: { identity: "verified", documents: "in_progress", address: "in_progress", criminal: "in_progress" } }));
  if (cand("Ishita Bose")) bgv.push(bgvCase(`BGV-${String(n++).padStart(4, "0")}`, null, { candidate: cand("Ishita Bose"), pkg: "standard", started: ago(1), consent: false }));
  if (cand("Nikhil Joshi")) bgv.push(bgvCase(`BGV-${String(n++).padStart(4, "0")}`, null, { candidate: cand("Nikhil Joshi"), pkg: "standard", started: ago(12), statuses: { identity: "verified", documents: "verified", address: "verified", education: "verified", employment: "verified", pf: "verified", company_email: "in_progress", criminal: "verified", reference: "in_progress" } }));
  // Cases that show the remaining overall statuses: started, on hold and under HR review.
  if (cand("Kavya Menon")) bgv.push(bgvCase(`BGV-${String(n++).padStart(4, "0")}`, null, { candidate: cand("Kavya Menon"), pkg: "standard", started: ago(1) }));
  if (cand("Arjun Nair")) {
    const c = bgvCase(`BGV-${String(n++).padStart(4, "0")}`, null, { candidate: cand("Arjun Nair"), pkg: "standard", started: ago(8), statuses: { identity: "verified", documents: "verified", address: "in_progress", education: "verified", employment: "in_progress", pf: "in_progress", company_email: "in_progress", criminal: "verified", reference: "pending" } });
    c.on_hold = { reason: "Candidate relocating from Pune – address visit to be rescheduled after the move", at: ago(2), by: "ADM01" };
    c.history.push({ at: ago(2), by: "ADM01", action: `Put on hold · ${c.on_hold.reason}` });
    bgv.push(c);
  }
  if (cand("Sameer Ali")) {
    const c = bgvCase(`BGV-${String(n++).padStart(4, "0")}`, null, { candidate: cand("Sameer Ali"), pkg: "standard", started: ago(11), statuses: { identity: "verified", documents: "verified", address: "verified", education: "verified", employment: "verified", pf: "na", company_email: "verified", criminal: "verified", reference: "unable_to_verify" } });
    const ref = c.checks.find((k) => k.type === "reference");
    ref.remarks = "Both referees unreachable after three calls and an email; the candidate has been asked for an alternate.";
    ref.tracking.at(-1).note = ref.remarks;
    const pf = c.checks.find((k) => k.type === "pf");
    pf.remarks = "First job was with a firm below 20 staff – not covered by EPF.";
    pf.tracking.at(-1).note = pf.remarks;
    bgv.push(c);
  }
  const bgvAccess = [
    { id: "BGA-1", code: "EMP007", role: "emp", level: "summary", scope: "team", granted_by: "SA001", granted_at: ago(30), expires_on: isoDate(Date.now() + 60 * DAY), reason: "Engineering manager – onboarding sign-off for new joiners", revoked: false },
    { id: "BGA-2", code: "ADM02", role: "admin", level: "status", scope: "all", granted_by: "SA001", granted_at: ago(90), expires_on: "", reason: "Finance – payroll activation only after BGV clear", revoked: true, revoked_at: ago(1), revoked_by: "SA001" },
  ];

  // ── Applicant tracking ──
  const P = (o) => o;
  const atsProfiles = {
    "CD-1": P({ phone: "+91 98480 11201", location: "Hyderabad", experience_yrs: 2, current_company: "BrightDesk Services", current_ctc: 420000, expected_ctc: 520000, notice_days: 30, skills: ["Customer support", "Zendesk", "English", "Telugu", "Ticketing"], resume_text: "Customer support associate with 2 years of chat and email support for a SaaS helpdesk. CSAT 4.7/5. Handles 60+ tickets a day; trained 4 new hires.", applied_at: ago(18), tags: ["Referral"] }),
    "CD-2": P({ phone: "+91 98480 11202", location: "Hyderabad", experience_yrs: 3, current_company: "CallNova BPO", current_ctc: 380000, expected_ctc: 480000, notice_days: 15, skills: ["Customer support", "Freshdesk", "English", "Hindi", "Escalations", "Ticketing"], resume_text: "3 years in voice and non-voice support. Team lead backup. Escalation desk for enterprise customers.", applied_at: ago(20), tags: [] }),
    "CD-3": P({ phone: "+91 98480 11203", location: "Vijayawada", experience_yrs: 1, current_company: "Freelance", current_ctc: 0, expected_ctc: 360000, notice_days: 0, skills: ["English", "MS Excel", "Customer support"], resume_text: "Graduate (B.Com 2025). Internship in customer operations; strong written English.", applied_at: ago(9), tags: ["Fresher"] }),
    "CD-4": P({ phone: "+91 98480 11204", location: "Hyderabad", experience_yrs: 0, current_company: "", current_ctc: 0, expected_ctc: 300000, notice_days: 0, skills: ["English", "Telugu"], resume_text: "Final-year BBA student, campus drive.", applied_at: ago(4), tags: ["Campus"] }),
    "CD-5": P({ phone: "+91 98480 11205", location: "Bengaluru", experience_yrs: 4, current_company: "SalesGrid", current_ctc: 900000, expected_ctc: 1150000, notice_days: 60, skills: ["B2B sales", "CRM", "Salesforce", "Negotiation", "SaaS"], resume_text: "Account executive closing mid-market SaaS deals; 118% of quota FY25. Salesforce power user.", applied_at: ago(26), tags: [] }),
    "CD-6": P({ phone: "+91 98480 11206", location: "Hyderabad", experience_yrs: 5, current_company: "Zentrix Software", current_ctc: 1000000, expected_ctc: 1200000, notice_days: 30, skills: ["B2B sales", "CRM", "HubSpot", "Negotiation", "SaaS", "Telugu"], resume_text: "5 years in enterprise software sales; built Hyderabad territory from zero to ₹3 Cr ARR. HubSpot certified.", applied_at: ago(28), tags: ["Referral"] }),
    "CD-7": P({ phone: "+91 98480 11207", location: "Chennai", experience_yrs: 2, current_company: "QuickReach", current_ctc: 600000, expected_ctc: 900000, notice_days: 90, skills: ["Inside sales", "Cold calling", "CRM"], resume_text: "Inside sales rep; strong top-of-funnel, limited closing experience.", applied_at: ago(15), tags: [] }),
    "CD-8": P({ phone: "+91 98480 11208", location: "Hyderabad", experience_yrs: 3, current_company: "DataForge", current_ctc: 800000, expected_ctc: 1000000, notice_days: 30, skills: ["SQL", "Python", "Power BI", "Excel", "Data modelling"], resume_text: "Data analyst building finance dashboards in Power BI; Python automation of ETL checks.", applied_at: ago(25), tags: ["Referral"] }),
    "CD-9": P({ phone: "+91 98480 11209", location: "Pune", experience_yrs: 2, current_company: "InsightWorks", current_ctc: 650000, expected_ctc: 850000, notice_days: 60, skills: ["SQL", "Tableau", "Excel"], resume_text: "Reporting analyst; Tableau dashboards for retail clients.", applied_at: ago(11), tags: [] }),
    "CD-10": P({ phone: "+91 98480 11210", location: "Hyderabad", experience_yrs: 1, current_company: "Campus hire 2025", current_ctc: 450000, expected_ctc: 600000, notice_days: 30, skills: ["Python", "SQL", "Pandas"], resume_text: "Junior analyst; Python and SQL coursework, Kaggle bronze.", applied_at: ago(6), tags: [] }),
  };
  const jobPostings = {
    "R-2603": { title: "Support Associate", location: "Hyderabad (on-site)", mode: "On-site", exp: [1, 4], budget_max: 500000, skills: ["Customer support", "Ticketing", "English", "Zendesk", "Escalations"], jd: "Own first-line support for our HR platform customers over chat, email and phone. Resolve tickets within SLA, escalate product issues with clear reproduction steps and keep our help centre up to date.", published: true, channels: ["Careers page", "Job portal", "Referral"], published_at: ago(95) },
    "R-2604": { title: "Account Executive", location: "Hyderabad / Bengaluru (hybrid)", mode: "Hybrid", exp: [3, 7], budget_max: 1200000, skills: ["B2B sales", "SaaS", "CRM", "Negotiation", "HubSpot"], jd: "Close mid-market HR-tech deals end to end: discovery, demo, proposal and negotiation. Work with pre-sales and customer success to hit a quarterly ARR quota.", published: true, channels: ["Careers page", "Job portal", "Agency"], published_at: ago(57) },
    "R-2605": { title: "Data Analyst", location: "Hyderabad (hybrid)", mode: "Hybrid", exp: [2, 5], budget_max: 1000000, skills: ["SQL", "Python", "Power BI", "Excel", "Data modelling"], jd: "Build the people-analytics layer: data models, dashboards and data-quality checks for HR, payroll and attendance data across 22 countries.", published: true, channels: ["Careers page", "Referral"], published_at: ago(27) },
  };
  const interviews = [
    { id: "INT-0001", candidate_id: "CD-1", req_id: "R-2603", round: "HR + functional", type: "video", start: at(1, 11, 0), end: at(1, 11, 45), interviewers: ["EMP005", "EMP013"], link: "https://meet.jit.si/EZYHR-int-0001", status: "scheduled", feedback: [] },
    { id: "INT-0002", candidate_id: "CD-5", req_id: "R-2604", round: "Hiring manager", type: "video", start: at(1, 15, 0), end: at(1, 16, 0), interviewers: ["EMP024"], link: "https://meet.jit.si/EZYHR-int-0002", status: "scheduled", feedback: [] },
    { id: "INT-0003", candidate_id: "CD-6", req_id: "R-2604", round: "Final – culture & offer", type: "onsite", start: at(-2, 12, 0), end: at(-2, 13, 0), interviewers: ["EMP024", "EMP005"], link: "Hyderabad office, Room Godavari", status: "completed", feedback: [{ by: "EMP024", rating: 5, recommendation: "strong_yes", notes: "Excellent territory knowledge; realistic pipeline math. Hire.", at: at(-2, 14, 0) }, { by: "EMP005", rating: 4, recommendation: "yes", notes: "Good culture fit; check notice buy-out.", at: at(-2, 15, 0) }] },
    { id: "INT-0004", candidate_id: "CD-8", req_id: "R-2605", round: "Technical – SQL & Power BI", type: "video", start: at(-5, 16, 0), end: at(-5, 17, 0), interviewers: ["EMP009", "EMP008"], link: "https://meet.jit.si/EZYHR-int-0004", status: "completed", feedback: [{ by: "EMP009", rating: 5, recommendation: "strong_yes", notes: "Window functions, star schema, DAX – all solid.", at: at(-5, 18, 0) }] },
    { id: "INT-0005", candidate_id: "CD-2", req_id: "R-2603", round: "Ops manager", type: "phone", start: at(2, 10, 0), end: at(2, 10, 30), interviewers: ["EMP005"], link: "+91 98480 11202", status: "scheduled", feedback: [] },
  ];
  const atsNotes = [
    { id: "AN-1", candidate_id: "CD-6", by: "ADM01", at: ago(1, 16), text: "Offer approved by Sanjay. Candidate asked about notice buy-out (30 days)." },
    { id: "AN-2", candidate_id: "CD-2", by: "ADM01", at: ago(3, 12), text: "Offer drafted at ₹4.8 L. Waiting for BGV identity & address before release." },
  ];

  // ── Compliance ──
  const complianceItems = [
    { id: "CMP-1", title: "Annual leave encashment provision review", authority: "Finance & HR", country: "IN", freq: "Annual", due: isoDate(new Date(new Date().getFullYear(), 11, 15, 12)), category: "custom", owner: "ADM02", notes: "Align with year-end audit." },
    { id: "CMP-2", title: "Renew group health insurance policy", authority: "Insurer", country: "IN", freq: "Annual", due: isoDate(Date.now() + 18 * DAY), category: "custom", owner: "ADM02", notes: "Get 3 quotes; include parents' cover option." },
    { id: "CMP-3", title: "POSH committee (ICC) training", authority: "POSH Act 2013", country: "IN", freq: "Annual", due: isoDate(Date.now() + 9 * DAY), category: "policy", owner: "ADM01", notes: "External member to attend." },
  ];
  // Every past filing is marked filed (with an acknowledgement number) except two, so the overdue state is visible.
  const complianceStatus = {};
  const today = isoDate();
  const past = complianceCalendar({ employees, admins: [], complianceItems: [], complianceStatus: {} }).filter((c) => c.due < today);
  const lastOf = (cc, title) => past.filter((c) => c.country === cc && c.title.startsWith(title)).pop()?.key;
  const keepOpen = new Set([lastOf("IN", "Professional tax"), lastOf("KE", "NITA")].filter(Boolean));
  past.forEach((c, i) => {
    if (keepOpen.has(c.key)) return;
    const filedOn = new Date(new Date(`${c.due}T12:00:00`).getTime() - (1 + (i % 4)) * DAY);
    complianceStatus[c.key] = { status: "filed", ref: `${c.country}-${c.due.replace(/-/g, "")}-${String(1000 + i * 37).slice(-4)}`, filed_at: filedOn.toISOString(), filed_by: c.category === "statutory" ? "ADM02" : "ADM01" };
  });

  // ── Clients, meetings, events ──
  const clients = [
    { id: "CL-1", company: "Acme Logistics", contact: "Ravi Shankar", email: "ravi@acme-logistics.demo", phone: "+91 90000 10001", city: "Hyderabad", owner: "EMP024", industry: "Logistics", stage: "Proposal" },
    { id: "CL-2", company: "Nimbus Health", contact: "Dr. Priya Rao", email: "priya@nimbushealth.demo", phone: "+91 90000 10002", city: "Bengaluru", owner: "EMP022", industry: "Healthcare", stage: "Demo" },
    { id: "CL-3", company: "Orbit Retail", contact: "Mark Fernandes", email: "mark@orbitretail.demo", phone: "+91 90000 10003", city: "Mumbai", owner: "EMP023", industry: "Retail", stage: "Negotiation" },
    { id: "CL-4", company: "Kalahari Mining", contact: "Johan van Wyk", email: "johan@kalahari.demo", phone: "+264 61 000 100", city: "Windhoek", owner: "EMP030", industry: "Mining", stage: "Onboarding" },
    { id: "CL-5", company: "Thames Fintech", contact: "Sarah Clarke", email: "sarah@thamesfintech.demo", phone: "+44 20 0000 1000", city: "London", owner: "EMP018", industry: "Financial services", stage: "Discovery" },
  ];
  const meetings = [
    { id: "MTG-0001", kind: "client", title: "Acme Logistics – payroll proposal walkthrough", client_id: "CL-1", start: at(1, 14, 30), end: at(1, 15, 30), mode: "in_person", location: "Acme HQ, HITEC City, Hyderabad", link: "", organizer: "EMP024", attendees: ["EMP022"], agenda: "1. Recap of requirements (850 staff, 3 states)\n2. Payroll & compliance demo\n3. Pricing and implementation timeline\n4. Next steps", notes: "", minutes: "", action_items: [], status: "scheduled", created_at: ago(4) },
    { id: "MTG-0002", kind: "client", title: "Nimbus Health – product demo", client_id: "CL-2", start: at(2, 11, 0), end: at(2, 12, 0), mode: "video", location: "", link: "https://meet.jit.si/EZYHR-nimbus", organizer: "EMP022", attendees: ["EMP024", "EMP006"], agenda: "Attendance with geofencing for 12 hospitals; shift rosters; BGV for clinical staff.", notes: "", minutes: "", action_items: [], status: "scheduled", created_at: ago(3) },
    { id: "MTG-0003", kind: "client", title: "Orbit Retail – commercial negotiation", client_id: "CL-3", start: at(-3, 16, 0), end: at(-3, 17, 0), mode: "video", location: "", link: "https://meet.jit.si/EZYHR-orbit", organizer: "EMP023", attendees: ["EMP024"], agenda: "Discount request; multi-year term; go-live date.", notes: "Mark wants 12% discount for 3-year term. Sanjay to get approval for 8% by Friday. Aditya will send revised proposal. Go-live target 1st of next quarter. Mark to share store headcount file.", minutes: "**Summary:** Orbit Retail is ready to sign a 3-year term if pricing lands near 10%.\n\n**Decisions:** Go-live targeted for the first day of next quarter.", action_items: [{ text: "Get approval for 8% discount", owner: "EMP024", due: isoDate(workday(-1)), done: true }, { text: "Send revised proposal", owner: "EMP023", due: isoDate(workday(1)), done: false }, { text: "Collect store headcount file from Mark", owner: "EMP023", due: isoDate(workday(2)), done: false }], status: "completed", outcome: "positive", created_at: ago(8) },
    { id: "MTG-0004", kind: "meeting", title: "Engineering weekly sync", client_id: null, start: at(0, 10, 0), end: at(0, 10, 30), mode: "video", location: "", link: "https://meet.jit.si/EZYHR-eng-weekly", organizer: "EMP007", attendees: ["EMP001", "EMP004", "EMP011", "EMP009"], agenda: "Sprint status, blockers, release plan.", notes: "", minutes: "", action_items: [], status: "scheduled", created_at: ago(20), recurring: "weekly" },
    { id: "MTG-0005", kind: "meeting", title: "1:1 Bindu / Akhil", client_id: null, start: at(1, 16, 30), end: at(1, 17, 0), mode: "video", location: "", link: "https://meet.jit.si/EZYHR-1on1-ba", organizer: "EMP007", attendees: ["EMP001"], agenda: "Goals check-in, learning plan.", notes: "", minutes: "", action_items: [], status: "scheduled", created_at: ago(14) },
    { id: "MTG-0006", kind: "client", title: "Kalahari Mining – go-live readiness", client_id: "CL-4", start: at(3, 11, 0), end: at(3, 12, 0), mode: "video", location: "", link: "https://meet.jit.si/EZYHR-kalahari", organizer: "EMP030", attendees: ["EMP005"], agenda: "Namibia payroll parallel run results; SSC & PAYE filing set-up.", notes: "", minutes: "", action_items: [], status: "scheduled", created_at: ago(5) },
    { id: "MTG-0007", kind: "meeting", title: "Q4 hiring plan review", client_id: null, start: at(2, 15, 0), end: at(2, 16, 0), mode: "in_person", location: "Hyderabad – Board room", link: "", organizer: "ADM01", attendees: ["EMP005", "EMP007", "EMP024"], agenda: "Open requisitions, aging roles, agency spend.", notes: "", minutes: "", action_items: [], status: "scheduled", created_at: ago(6) },
  ];
  const events = [
    { id: "EV-0001", kind: "focus", title: "Focus: release notes", start: at(0, 14, 0), end: at(0, 16, 0), owner: "EMP001", attendees: [] },
    { id: "EV-0002", kind: "event", title: "Town hall – Q3 results", start: at(4, 17, 0), end: at(4, 18, 0), owner: "SA001", attendees: [], all_staff: true },
  ];

  // ── Chat ──
  const chatChannels = [
    { id: "CH-general", kind: "channel", name: "general", topic: "Company-wide conversation", members: "all", created_by: "SA001", created_at: ago(400) },
    { id: "CH-announce", kind: "channel", name: "announcements", topic: "Official updates · only admins post", members: "all", readonly: true, created_by: "SA001", created_at: ago(400) },
    { id: "CH-hr", kind: "channel", name: "hr-help", topic: "Ask HR anything: leave, payroll, policies, BGV", members: "all", created_by: "ADM01", created_at: ago(300) },
    { id: "CH-it", kind: "channel", name: "it-help", topic: "IT service desk: quick questions. For anything that blocks you, raise a ticket under IT support.", members: "all", created_by: "ADM02", created_at: ago(300) },
    { id: "CH-eng", kind: "channel", name: "engineering", topic: "Engineering team", members: "dept:Engineering", created_by: "EMP007", created_at: ago(300) },
    { id: "CH-sales", kind: "channel", name: "sales", topic: "Deals, demos and client meetings", members: "dept:Sales", created_by: "EMP024", created_at: ago(250) },
    { id: "CH-dm-1", kind: "dm", name: "", members: ["EMP007", "EMP001"], created_by: "EMP007", created_at: ago(60) },
    { id: "CH-dm-2", kind: "dm", name: "", members: ["ADM01", "EMP012"], created_by: "ADM01", created_at: ago(5) },
    { id: "CH-grp-1", kind: "group", name: "Acme deal room", topic: "Acme Logistics proposal", members: ["EMP024", "EMP022", "EMP023", "EMP005"], created_by: "EMP024", created_at: ago(10) },
  ];
  const msg = (i, ch, from, text, daysAgo, h, m = 0) => ({ id: `MSG-${String(i).padStart(5, "0")}`, channel_id: ch, from, text, at: (() => { const d = new Date(Date.now() - daysAgo * DAY); d.setHours(h, m, 0, 0); return d.toISOString(); })(), reactions: {} });
  const chatMessages = [
    msg(1, "CH-announce", "ADM01", "Welcome to EZY HR chat 🎉 Use #hr-help for HR questions and direct messages for anything personal.", 6, 10),
    msg(2, "CH-announce", "SA001", "Town hall for Q3 results is on the calendar – please accept the invite.", 2, 9, 30),
    msg(3, "CH-general", "EMP005", "Good morning all! Reminder: office will be closed for the upcoming public holiday.", 1, 9, 5),
    msg(4, "CH-general", "EMP006", "New brand templates are in the Documents folder 🙌", 1, 11, 20),
    msg(5, "CH-general", "EMP013", "Thanks Vikram, the slide template looks great.", 1, 11, 40),
    msg(6, "CH-hr", "EMP001", "How do I apply for comp-off for working last Saturday?", 2, 15, 10),
    msg(7, "CH-hr", "ADM01", "@Akhil raise an attendance correction for Saturday, then a leave request of type Comp-off – Bindu approves both.", 2, 15, 32),
    msg(8, "CH-hr", "EMP012", "My background verification shows 'insufficient documents' – what do I need to upload?", 0, 9, 50),
    msg(19, "CH-it", "ADM02", "Planned maintenance: VPN gateway upgrade on Saturday 22:00–23:00. Save your work before then.", 1, 17, 0),
    msg(20, "CH-it", "EMP013", "Is the 2nd-floor printer working again?", 0, 9, 30),
    msg(21, "CH-it", "ADM02", "@Divya yes – toner replaced. If it still fails, raise a ticket under IT support with the error code.", 0, 9, 41),
    msg(9, "CH-eng", "EMP007", "Release 7.4 is cut. @Kartik please run the regression suite before 4 pm.", 0, 9, 15),
    msg(10, "CH-eng", "EMP004", "On it 👍", 0, 9, 18),
    msg(11, "CH-eng", "EMP011", "Two flaky tests in payroll-engine – I'll quarantine and raise tickets.", 0, 9, 40),
    msg(12, "CH-sales", "EMP024", "Great call with Orbit yesterday – revised proposal goes out tomorrow.", 1, 18, 0),
    msg(13, "CH-sales", "EMP022", "Nimbus demo confirmed. Can someone from design join to show the mobile app?", 0, 10, 5),
    msg(14, "CH-dm-1", "EMP007", "Hi Akhil, can we move our 1:1 to 4:30 tomorrow?", 0, 11, 0),
    msg(15, "CH-dm-2", "ADM01", "Hi Meera, your BGV needs a recent address proof and your degree certificate. You can upload them from 'My background check'.", 0, 10, 15),
    msg(16, "CH-grp-1", "EMP024", "Acme wants pricing for 850 employees across 3 states. Neha – can you prep the comparison?", 1, 16, 0),
    msg(17, "CH-grp-1", "EMP022", "Yes, I'll have it ready before the walkthrough.", 1, 16, 20),
    msg(18, "CH-grp-1", "EMP005", "Make sure we include statutory compliance for AP & Karnataka PT.", 0, 10, 45),
  ];
  const chatReads = { EMP001: { "CH-general": ago(1, 12), "CH-announce": ago(3, 10) }, ADM01: { "CH-hr": ago(1, 9) } };

  // ── IT service desk ──
  const tk = (id, requester, category, priority, subject, description, hoursAgo, status, extra = {}) => {
    const created = new Date(Date.now() - hoursAgo * 3600000).toISOString();
    const sla = new Date(new Date(created).getTime() + ({ critical: 4, high: 8, normal: 24, low: 72 }[priority]) * 3600000).toISOString();
    return { id, requester, category, priority, subject, description, asset_id: null, contact: "", location: "", status, assigned_to: null, created_at: created, updated_at: created, sla_due: sla, resolved_at: null, resolution: "", rating: null, attachments: [], comments: [], history: [{ at: created, by: requester, action: "Raised" }], ...extra };
  };
  const hrs = (h) => new Date(Date.now() - h * 3600000).toISOString();
  const itTickets = [
    tk("IT-1006", "EMP012", "access", "high", "Need GitLab and Jira access for Payroll Engine project", "Joined last week; my manager Bindu approved. I need developer access to the payroll-engine repo and the PAYE Jira board.", 5, "open"),
    tk("IT-1005", "EMP004", "software", "low", "IntelliJ IDEA Ultimate licence", "Community edition lacks the database tools I need for the migration work. Please assign an Ultimate licence.", 30, "open"),
    tk("IT-1004", "EMP001", "hardware", "normal", "Laptop battery drains in 1 hour", "LT-0101 goes from 100% to 10% in about an hour even with only VS Code and Chrome open. Battery health shows 61%.", 26, "in_progress", { asset_id: "LT-0101", assigned_to: "SA001", comments: [{ by: "ADM02", at: hrs(20), text: "Battery is under warranty until next year. Dell engineer visit booked; we will swap the battery at your desk.", internal: false }, { by: "ADM02", at: hrs(19), text: "Dell case #8842210, parts ETA 2 days.", internal: true }], history: [{ at: hrs(26), by: "EMP001", action: "Raised" }, { at: hrs(21), by: "ADM02", action: "assigned to Ashok Kumar, status in progress" }] }),
    tk("IT-1003", "EMP022", "email", "normal", "Outlook on phone stopped syncing", "Since yesterday my work email does not sync on the company phone (PH-0301). Laptop is fine.", 50, "waiting_user", { assigned_to: "SA001", comments: [{ by: "ADM02", at: hrs(44), text: "Please remove and re-add the work account in the Outlook app, then tell us if it syncs. If not, send a screenshot of the error.", internal: false }], history: [{ at: hrs(50), by: "EMP022", action: "Raised" }, { at: hrs(44), by: "ADM02", action: "status In progress → Waiting on you" }] }),
    tk("IT-1002", "EMP008", "security", "critical", "Suspicious email asking to re-verify payroll login", "Got an email that looks like EZY Hub asking me to re-verify my bank details. I did not click the link.", 120, "closed", { assigned_to: "SA001", resolved_at: hrs(118), resolution: "Confirmed phishing. Sender blocked company-wide, 14 copies purged from mailboxes, awareness note sent in #announcements.", rating: 5, feedback: "Very quick, thank you!" }),
    tk("IT-1001", "EMP001", "network", "high", "VPN disconnects every 10 minutes", "Working from home, VPN drops every 10 min and I lose my SSH sessions.", 200, "closed", { assigned_to: "SA001", resolved_at: hrs(195), resolution: "Updated the VPN client to 5.2 and switched to the TCP profile; stable since.", rating: 4 }),
  ];

  // ── Employee joining / statutory documents ──
  const empDocs = [];
  const special2 = {
    EMP010: { submitted: [5, 6], missing: [7] },
    EMP012: { submitted: [0, 1], rejected: { 3: "The cheque image is cut off – the IFSC and account number must be visible." }, missing: [2, 4, 5, 6, 7] },
    EMP022: { missing: [7] },
  };
  let dn = 1;
  for (const e of employees) {
    if (!["active", "pending_approval", "locked", "suspended"].includes(e.status)) continue;
    const sp = special2[e.employee_code] || {};
    requiredDocs(e).forEach((r, i) => {
      if ((sp.missing || []).includes(i)) return;
      const status = (sp.submitted || []).includes(i) ? "submitted" : sp.rejected?.[i] ? "rejected" : "verified";
      const at = ago(status === "verified" ? Math.max(3, Math.min(400, Math.round((Date.now() - new Date(`${e.date_of_joining}T12:00:00`)) / DAY))) : 1);
      empDocs.push({ id: `EDOC-${String(dn++).padStart(4, "0")}`, employee_code: e.employee_code, doc_key: r.key, doc_name: r.name, status, files: [{ name: `${r.key}.pdf`, size: 180000, type: "application/pdf", data_url: null, at }], note: sp.rejected?.[i] || "", reviewed_by: status === "submitted" ? null : "ADM01", reviewed_at: status === "submitted" ? null : at, updated_at: at, history: [{ at, by: e.employee_code, action: `Uploaded ${r.key}.pdf` }] });
    });
  }

  return { empDocs, itTickets, bgv, bgvVendors, bgvAccess, atsProfiles, jobPostings, interviews, atsNotes, complianceItems, complianceStatus, clients, meetings, events, chatChannels, chatMessages, chatReads, v8: true };
}
