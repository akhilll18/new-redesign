// Auto-validation for points claims. Runs live in the form and again in the store on submit,
// mirroring what the server must enforce. Hard errors block submission; flags go to the admin.
import { DAY, isoDate } from "./utils.js";

export const STATUS_FLOW = ["Draft", "Submitted", "Manager Approved", "Under Review", "Approved", "Credited"];

export const OPEN_STATUSES = ["Submitted", "Manager Approved", "Under Review", "On Hold", "Escalated"];

export function daysBetween(a, b) {
  return Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / DAY);
}

export function validateSubmission(form, ctx, { forDraft = false } = {}) {
  const { categories, rules, settings, employee, submissions } = ctx;
  const errors = {};
  const flags = [];
  const category = categories.find((c) => c.category_id === form.category_id);
  const rule = rules.find((r) => r.rule_id === form.rule_id);
  const today = isoDate();

  if (!category) errors.category_id = "Choose a category.";
  else if (!category.active) errors.category_id = "This category is no longer open for claims.";

  if (forDraft) return { errors, flags, rule, category };

  if (!rule) errors.rule_id = "Choose a sub-category.";
  else if (rule.category !== form.category_id) errors.rule_id = "This sub-category belongs to a different category.";
  else if (!rule.active) errors.rule_id = "This sub-category is no longer open for claims.";

  const desc = (form.description || "").trim();
  if (!desc) errors.description = "Describe what you did.";
  else if (desc.length < 20) errors.description = `Add a little more detail (at least 20 characters, ${desc.length} so far).`;
  else if (desc.length > 1000) errors.description = "Keep it under 1,000 characters.";

  const pts = Number(form.points_requested);
  if (form.points_requested === "" || form.points_requested == null) errors.points_requested = "Enter the points you are claiming.";
  else if (!Number.isInteger(pts) || pts < 1) errors.points_requested = "Enter a whole number of 1 or more.";
  else if (rule && pts > rule.points) errors.points_requested = `The most you can claim for this sub-category is ${rule.points}.`;
  else if (category && pts > category.max_points) errors.points_requested = `The category limit is ${category.max_points}.`;

  const doc = form.supporting_document;
  const maxBytes = settings.max_file_mb * 1024 * 1024;
  if (!doc) {
    if (!rule || rule.doc_required) errors.supporting_document = "Attach a supporting document (PDF, JPG or PNG).";
  } else {
    const ext = (doc.name.split(".").pop() || "").toLowerCase();
    const allowed = [...settings.allowed_file_types, "svg"];
    if (!allowed.includes(ext)) errors.supporting_document = `Only ${settings.allowed_file_types.join(", ").toUpperCase()} files are accepted.`;
    else if (doc.size > maxBytes) errors.supporting_document = `The file is larger than ${settings.max_file_mb} MB.`;
  }

  if (!form.activity_date) errors.activity_date = "Enter the date of the activity.";
  else if (form.activity_date > today) errors.activity_date = "The activity date cannot be in the future.";
  else if (employee && form.activity_date < employee.date_of_joining) errors.activity_date = "The activity date is before your date of joining.";
  else if (rule) {
    const age = daysBetween(form.activity_date, today);
    if (age > rule.validity_days) errors.activity_date = `Claims for this sub-category must be made within ${rule.validity_days} days of the activity (this one is ${age} days old).`;
    else if (rule.validity_days - age <= 3) flags.push({ code: "NEAR_WINDOW", level: "warn", text: `Submitted ${rule.validity_days - age} day(s) before the ${rule.validity_days}-day claim window closes.` });
  }

  if (!form.declaration) errors.declaration = "Confirm the declaration to submit.";

  if (rule && pts === rule.points) flags.push({ code: "AT_MAX", level: "info", text: `Requested points equal the rule maximum (${rule.points}).` });

  if (rule && form.activity_date && employee) {
    const dup = submissions.find(
      (s) =>
        s.submission_id !== form.submission_id &&
        s.employee_code === employee.employee_code &&
        s.rule_id === rule.rule_id &&
        !["Draft", "Rejected", "Withdrawn"].includes(s.status) &&
        Math.abs(daysBetween(s.activity_date, form.activity_date)) <= settings.duplicate_window_days,
    );
    if (dup) flags.push({ code: "DUPLICATE", level: "warn", text: `Another claim for the same sub-category within ${settings.duplicate_window_days} days (${dup.submission_id}).` });
  }

  if (category?.category_id === "CAT-SAH" && !(form.witness || "").trim())
    flags.push({ code: "NO_WITNESS", level: "info", text: "Peer-support claim without a witness or approver hint." });

  return { errors, flags, rule, category };
}

export function passwordProblems(pw, { minLength = 8, oldHashMatches = false } = {}) {
  const p = [];
  if ((pw || "").length < minLength) p.push(`At least ${minLength} characters`);
  if (!/[A-Z]/.test(pw)) p.push("An uppercase letter");
  if (!/[a-z]/.test(pw)) p.push("A lowercase letter");
  if (!/\d/.test(pw)) p.push("A number");
  if (!/[^A-Za-z0-9]/.test(pw)) p.push("A symbol");
  if (oldHashMatches) p.push("Different from your current password");
  return p;
}
