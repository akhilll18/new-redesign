// v10.13 · Employee request forms that run on the approval engine (same chains, inbox, notifications and audit as leave).
// Fields with `list` take their choices from a dropdown list the Super Admin / module admin can add to (+).
const today = () => new Date().toISOString().slice(0, 10);
const days = (a, b) => (a && b ? Math.round((new Date(b) - new Date(a)) / 86400000) + 1 : 0);

export const FORM_TYPES = {
  wfh: {
    label: "Work from home", prefix: "WFH-", module: "attendance", chain: "manager", icon: "HomeWork",
    blurb: "Ask to work from home for a day or a few days.",
    fields: [
      { key: "from_date", label: "From", type: "date", required: true },
      { key: "to_date", label: "To", type: "date", required: true },
      { key: "reason", label: "Reason", type: "list", list: "wfh_reason", required: true },
      { key: "note", label: "Anything your manager should know", type: "textarea" },
    ],
    validate: (f, errors, { emp, requests }) => {
      if (f.from_date && f.to_date && f.to_date < f.from_date) errors.to_date = "Must be on or after the start date.";
      if (days(f.from_date, f.to_date) > 30) errors.to_date = "Ask for up to 30 days at a time.";
      if (f.from_date && f.from_date < today()) errors.from_date = "Can't be in the past — use an attendance correction instead.";
      if (requests.some((r) => r.type === "wfh" && r.employee_code === emp?.employee_code && ["Pending", "Approved"].includes(r.status) && r.from_date <= f.to_date && r.to_date >= f.from_date)) errors.from_date = "You already have a work-from-home request for these days.";
    },
    summary: (r) => ({ title: `Work from home · ${r.from_date === r.to_date ? r.from_date : `${r.from_date} → ${r.to_date}`}`, detail: r.reason, amount: `${days(r.from_date, r.to_date)} day(s)` }),
  },
  travel: {
    label: "Travel request", prefix: "TRV-", module: "expense", chain: "manager_admin", icon: "FlightTakeoff",
    blurb: "Get a business trip approved before you book it.",
    fields: [
      { key: "from_city", label: "From (city)", type: "text", required: true },
      { key: "to_city", label: "To (city)", type: "text", required: true },
      { key: "depart_date", label: "Departure", type: "date", required: true },
      { key: "return_date", label: "Return", type: "date", required: true },
      { key: "mode", label: "Travel mode", type: "list", list: "travel_mode", required: true },
      { key: "purpose", label: "Purpose", type: "list", list: "travel_purpose", required: true },
      { key: "est_cost", label: "Estimated cost (₹)", type: "number", required: true },
      { key: "advance_needed", label: "Need a travel advance?", type: "select", options: [["no", "No"], ["yes", "Yes"]], required: true },
      { key: "details", label: "Trip details (who you'll meet, client, project)", type: "textarea", required: true, full: true },
    ],
    validate: (f, errors) => {
      if (f.depart_date && f.depart_date < today()) errors.depart_date = "Can't be in the past.";
      if (f.depart_date && f.return_date && f.return_date < f.depart_date) errors.return_date = "Must be on or after departure.";
      if (f.est_cost !== undefined && f.est_cost !== "" && !(Number(f.est_cost) > 0)) errors.est_cost = "Enter the estimated cost.";
      if (f.from_city && f.to_city && f.from_city.trim().toLowerCase() === f.to_city.trim().toLowerCase()) errors.to_city = "Destination is the same as the start.";
    },
    summary: (r, fmt) => ({ title: `${r.from_city} → ${r.to_city}`, detail: `${r.depart_date} → ${r.return_date} · ${r.mode} · ${r.purpose}`, amount: `₹${fmt(r.est_cost)}` }),
  },
  overtime: {
    label: "Overtime claim", prefix: "OT-", module: "attendance", chain: "manager_admin", icon: "MoreTime",
    blurb: "Claim extra hours you worked beyond your shift.",
    fields: [
      { key: "date", label: "Date worked", type: "date", required: true },
      { key: "hours", label: "Extra hours", type: "number", required: true },
      { key: "reason", label: "Reason", type: "list", list: "overtime_reason", required: true },
      { key: "work_done", label: "What you worked on", type: "textarea", required: true, full: true },
    ],
    validate: (f, errors, { emp, requests }) => {
      if (f.date && f.date > today()) errors.date = "Claim overtime after you've worked it.";
      if (f.date && days(f.date, today()) > 45) errors.date = "Claim within 45 days.";
      const h = Number(f.hours);
      if (f.hours !== undefined && f.hours !== "" && !(h >= 0.5 && h <= 12)) errors.hours = "Between 0.5 and 12 hours.";
      if (requests.some((r) => r.type === "overtime" && r.employee_code === emp?.employee_code && r.date === f.date && ["Pending", "Approved"].includes(r.status))) errors.date = "You already claimed overtime for this day.";
    },
    summary: (r) => ({ title: `Overtime on ${r.date}`, detail: `${r.reason} · ${r.work_done}`, amount: `${r.hours} h` }),
  },
  letter: {
    label: "Letter request", prefix: "LTR-", module: "accounts", chain: "admin", icon: "Description",
    blurb: "Ask HR for an employment, salary, address-proof or visa letter.",
    fields: [
      { key: "letter_type", label: "Letter", type: "list", list: "letter_type", required: true },
      { key: "addressed_to", label: "Addressed to (e.g. bank, embassy)", type: "text" },
      { key: "needed_by", label: "Needed by", type: "date", required: true },
      { key: "delivery", label: "How do you want it?", type: "select", options: [["email", "Signed PDF by email"], ["printed", "Printed & signed copy"]], required: true },
      { key: "purpose", label: "Purpose", type: "textarea", required: true, full: true },
    ],
    validate: (f, errors) => { if (f.needed_by && f.needed_by < today()) errors.needed_by = "Can't be in the past."; },
    summary: (r) => ({ title: r.letter_type, detail: `${r.addressed_to ? `To ${r.addressed_to} · ` : ""}needed by ${r.needed_by}`, amount: r.delivery === "printed" ? "Printed" : "PDF" }),
  },
  grievance: {
    label: "Grievance / speak-up", prefix: "GRV-", module: "accounts", chain: "admin", icon: "RecordVoiceOver",
    blurb: "Raise a concern in confidence. By default only HR sees it — not your manager.",
    fields: [
      { key: "category", label: "What is it about?", type: "list", list: "grievance_category", required: true },
      { key: "incident_date", label: "When did it happen?", type: "date" },
      { key: "subject", label: "Subject", type: "text", required: true, full: true },
      { key: "details", label: "What happened (facts, place, witnesses)", type: "textarea", required: true, full: true },
      { key: "outcome", label: "What would you like to happen?", type: "textarea", full: true },
    ],
    validate: (f, errors) => {
      if (f.incident_date && f.incident_date > today()) errors.incident_date = "Can't be in the future.";
      if ((f.details || "").trim() && (f.details || "").trim().length < 20) errors.details = "Add a little more detail (20+ characters).";
    },
    summary: (r) => ({ title: r.subject, detail: `${r.category}${r.incident_date ? ` · ${r.incident_date}` : ""}`, amount: "Confidential" }),
    confidential: true,
  },
};

/** Checks a form; returns { errors }. */
export function validateForm(type, form, ctx = {}) {
  const def = FORM_TYPES[type];
  const errors = {};
  if (!def) return { errors: { _: "Unknown form." } };
  def.fields.forEach((fl) => { const v = form[fl.key]; if (fl.required && (v === undefined || v === null || String(v).trim() === "")) errors[fl.key] = `${fl.label.replace(/ \(.*\)$/, "")} is required.`; });
  def.fields.forEach((fl) => { if (fl.type === "text" && String(form[fl.key] || "").length > 120) errors[fl.key] = "Keep it under 120 characters."; if (fl.type === "textarea" && String(form[fl.key] || "").length > 2000) errors[fl.key] = "Keep it under 2,000 characters."; });
  def.validate?.(form, errors, { requests: [], ...ctx });
  return { errors };
}

/** The saved payload: trimmed text, numbers as numbers, unknown keys dropped. */
export function formPayload(type, form) {
  const out = {};
  FORM_TYPES[type].fields.forEach((fl) => { const v = form[fl.key]; if (v === undefined || v === "") return; out[fl.key] = fl.type === "number" ? Number(v) : typeof v === "string" ? v.trim() : v; });
  return out;
}
