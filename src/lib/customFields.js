// v10.15 · Dropdowns the Super Admin creates. Each one is a new field on the employee form (in the section chosen),
// shown on the profile, the Field reference and the employee export. Its values form a list that grows with + like
// every other list. Stored in settings.custom_fields; the value sits on the employee record under the field key.
// Fields are never deleted (records keep their values) — they can be switched off and back on.
import { EMPLOYEE_SECTIONS } from "../data/employeeFields.js";

export const CF_PREFIX = "cf_";
const WHO = { super: "Super Admin", admin: "HR admin", self: "Employee" };

export const customFieldsAll = (data) => data?.settings?.custom_fields || [];
export const customFieldsActive = (data) => customFieldsAll(data).filter((c) => c.active !== false);

/** A custom dropdown as an employee-form field (same shape as ALL_FIELDS entries). */
export function toField(c) {
  return {
    key: c.key, label: c.label, type: "select", control: "Dropdown", custom: true, section: c.section,
    options: (c.options || []).map((v) => [v, v]),
    required: !!c.required, editableBy: c.editableBy?.length ? c.editableBy : ["super", "admin"],
    rule: c.help ? `${c.help} (custom dropdown)` : "Custom dropdown added by the Super Admin.",
  };
}

/** Employee-form sections with the active custom dropdowns added at the end of their section. */
export function sectionsWithCustom(data, sections = EMPLOYEE_SECTIONS) {
  const cf = customFieldsActive(data);
  if (!cf.length) return sections;
  return sections.map((s) => ({ ...s, fields: [...s.fields, ...cf.filter((c) => c.section === s.id).map(toField)] }));
}
export const customFieldList = (data) => customFieldsActive(data).map(toField);

/** List definition so a custom dropdown's values grow with + (see optionLists.listDef). */
export function customListDef(data, key) {
  const c = customFieldsAll(data).find((x) => x.key === key);
  if (!c) return null;
  const sec = EMPLOYEE_SECTIONS.find((s) => s.id === c.section);
  return { label: c.label, module: "accounts", used: `Employee form · ${sec?.title || "Personal details"} (custom dropdown)`, base: c.options || [], custom: true };
}

export const whoLabel = (list) => (list || []).map((w) => WHO[w] || w).join(", ");

/** Checks a new custom dropdown. Returns { field } or { error }. */
export function checkCustomField(data, d) {
  const label = String(d.label || "").replace(/\s+/g, " ").trim();
  if (label.length < 2 || label.length > 60) return { error: "Give the dropdown a name of 2–60 characters." };
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
  if (!slug) return { error: "Use letters or numbers in the name." };
  const key = CF_PREFIX + slug;
  const taken = new Set([...EMPLOYEE_SECTIONS.flatMap((s) => s.fields.map((f) => f.key)), ...customFieldsAll(data).map((c) => c.key)]);
  const sameLabel = [...EMPLOYEE_SECTIONS.flatMap((s) => s.fields), ...customFieldsAll(data)].some((f) => f.label.toLowerCase() === label.toLowerCase());
  if (taken.has(key) || sameLabel) return { error: "A field with this name already exists." };
  if (!EMPLOYEE_SECTIONS.some((s) => s.id === d.section)) return { error: "Choose the form section." };
  const seen = new Set();
  const options = String(Array.isArray(d.options) ? d.options.join("\n") : d.options || "")
    .split(/\n|,/).map((v) => v.replace(/\s+/g, " ").trim()).filter((v) => v && !seen.has(v.toLowerCase()) && seen.add(v.toLowerCase()));
  if (options.length < 2) return { error: "Add at least two values (one per line or separated by commas)." };
  if (options.some((v) => v.length > 60)) return { error: "Keep each value under 60 characters." };
  if (options.length > 100) return { error: "Use at most 100 values." };
  const editableBy = ["super", ...(d.editableBy || []).filter((w) => w === "admin" || w === "self")];
  return { field: { key, label, section: d.section, options, required: !!d.required, editableBy, help: String(d.help || "").trim().slice(0, 160), active: true } };
}
