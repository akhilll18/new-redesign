// v10.13 · Builds src/data/dropdownInventory.json — every dropdown in the app, where it is, and where its choices come from.
// Run: node scripts/dropdown-inventory.mjs   (also runs before `npm run build`)
// Kinds of source:
//   list:<key>   a list the Super Admin / owning admin can grow with "+" (src/lib/optionLists.js)
//   master:<id>  master data kept on its own screen (departments, locations, leave types …) — add there
//   people       employees / admins / managers — come from the people records
//   fixed        values the rules engine depends on (status, worker type, tax section …) — read-only
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SRC = path.join(ROOT, "src");
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.jsx$/.test(f)) files.push(p); } })(SRC);

// Master data: [id, label, screen route, words that identify it in the options expression]
const MASTERS = [
  ["departments", "Departments / org units", "/organization", /orgUnits|depts\b|departments|org_unit/],
  ["companies", "Companies (legal entities)", "/companies", /companies\b|company_id/],
  ["locations", "Locations / branches", "/companies", /locations\b|location_id|cities\b/],
  ["geofences", "Geofences", "/geofences", /geofences/],
  ["leave_types", "Leave types", "/policies", /leaveTypes|leave_type/],
  ["expense_categories", "Expense categories", "/policies", /expenseCategories|categories\b/],
  ["holidays", "Holiday calendar", "/policies", /holidays/],
  ["shifts", "Shifts", "/shifts", /shifts\b/],
  ["vendors", "Staffing vendors", "/contracts", /vendors\b/],
  ["requisitions", "Job requisitions", "/recruitment", /reqs\b|requisitions|jobPostings|open\.map/],
  ["projects", "Projects", "/tasks", /projects\b/],
  ["currencies", "Currencies", "/settings", /currenc|CURRENC|\["INR", "USD"/],
  ["countries", "Countries", "/settings", /COUNTRIES|countries\b|country/],
  ["languages", "Languages", "/settings", /LANG|languages/],
  ["payslip_designs", "Payslip designs", "/payslips", /payslipDesigns|designs\b/],
  ["approval_chains", "Approval chains", "/policies", /chainOptions|opts\(m\)/],
];
const PEOPLE = /employees|admins\b|managers|emps\b|people|team\b|reports\b|directs|members|candidates|empOptions|peopleOptions/;

// A readable area name from the file path
const AREA = (rel) => {
  const map = [[/superadmin\/Policies/, "Policies & rules"], [/superadmin\/UsersAccess/, "Users & access"], [/superadmin/, "Super Admin"], [/AtsViews|hire\/|Ijp|recruit/i, "Recruitment"], [/offers?\//i, "Offer letters"], [/onboard/i, "Onboarding"], [/Exits/, "Exits & offboarding"], [/learning|SelfService|Lms/i, "Learning"], [/talent|Performance|PeopleXP/i, "Performance & talent"], [/pay\/|Payroll|Payslip|PayViews/i, "Payroll"], [/Benefit/i, "Benefits"], [/Expense|expenses/i, "Expenses"], [/attendance|Attendance|Shift|Roster|Timesheet/i, "Time & attendance"], [/[Ll]eave/, "Leave"], [/Asset|ItAdmin|ItSupport|itdesk|ItHelp/i, "IT & assets"], [/MyFiles|Documents|Letters/i, "Documents & letters"], [/Compliance/i, "Compliance"], [/contract/i, "Contracts & contingent"], [/Global|Relocation|visa/i, "Global teams & relocation"], [/workforce|Workforce/i, "Workforce planning"], [/Meeting|Calendar|Tasks|collab|Chat/i, "Collaboration"], [/Analytics|Report/i, "Reports & analytics"], [/ai\//i, "AI assistant"], [/Platform|Integrat/i, "Platform & integrations"], [/People|Employee|organization|Org/i, "People & organisation"], [/Welcome|Login/i, "Sign-up & sign-in"], [/PayPage|Statutory|CountryWorkspace/i, "Payroll"], [/TimeOffPage/i, "Leave"], [/HrToolkit|Extras/i, "HR toolkit"], [/Enterprise|BulkActions|ActivityCentre/i, "Enterprise & bulk actions"], [/PortalDialog/i, "Payroll"], [/requests\/|Requests|MyForms|Approvals|Inbox/i, "Requests & approvals"]];
  for (const [re, n] of map) if (re.test(rel)) return n;
  return "Other screens";
};

// Read the JSX tag that starts at i (brace-aware), plus a little of what follows (its options)
function tagAt(s, i) {
  let depth = 0, j = i;
  for (; j < s.length; j++) { const c = s[j]; if (c === "{") depth++; else if (c === "}") depth--; else if (c === ">" && depth === 0) break; }
  return { tag: s.slice(i, j + 1), after: s.slice(j + 1, j + 900) };
}
const labelOf = (tag, before) => {
  const m = tag.match(/\blabel=(?:"([^"]+)"|\{`([^`]+)`\}|\{"([^"]+)"\}|\{([^}]{1,60})\})/);
  if (m) return (m[1] || m[2] || m[3] || m[4] || "").replace(/\$\{[^}]+\}/g, "…").replace(/ \*$/, "").trim();
  const il = before.match(/<InputLabel[^>]*>([^<]{1,60})<\/InputLabel>\s*$/);
  if (il) return il[1].replace(/ \*$/, "").trim();
  const al = tag.match(/aria-label["']?\s*[:=]\s*["']([^"']+)/);
  if (al) return al[1];
  const ph = tag.match(/placeholder="([^"]+)"/);
  if (ph) return ph[1];
  const v = tag.match(/value=\{([\w.?]+)/);
  if (v) { const w = v[1].split(/[.?]+/).filter(Boolean).pop(); return `${w.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase())} (filter)`; }
  return "";
};
const sourceOf = (tag, after) => {
  const lk = tag.match(/listKey=(?:"([a-z_]+)"|\{"([a-z_]+)"\})/);
  if (lk) return `list:${lk[1] || lk[2]}`;
  if (/listKey=\{/.test(tag)) return "dynamic";
  const opts = (after.split(/<\/(Select|TextField)>/)[0] || "") + " " + (tag.match(/options=\{([^}]{0,200})/)?.[1] || "");
  for (const [id, , , re] of MASTERS) if (re.test(opts)) return `master:${id}`;
  if (PEOPLE.test(opts)) return "people";
  return "fixed";
};

const items = [];
for (const file of files) {
  const rel = path.relative(SRC, file);
  if (/ListSelect\.jsx$|FieldInput\.jsx$/.test(rel)) continue; // the building blocks themselves
  const s = fs.readFileSync(file, "utf8");
  const re = /<(TextField|Select|Autocomplete|ListSelect)\b/g;
  let m;
  while ((m = re.exec(s))) {
    const { tag, after } = tagAt(s, m.index);
    const kind = m[1];
    if (kind === "TextField" && !/\sselect(\s|=\{true\}|\b)/.test(tag)) continue;
    const line = s.slice(0, m.index).split("\n").length;
    const label = labelOf(tag, s.slice(Math.max(0, m.index - 200), m.index)) || "(no label)";
    const source = sourceOf(tag, after);
    if (source === "dynamic") continue; // listed from its definitions (forms) below
    items.push({ file: rel, line, area: AREA(rel), label, source, kind: kind === "Autocomplete" ? "search" : "dropdown" });
  }
}

// The employee form renders its selects from field definitions (src/data/employeeFields.js)
const ef = fs.readFileSync(path.join(SRC, "data/employeeFields.js"), "utf8");
const fre = /\{\s*key:\s*"([a-z_0-9]+)",\s*label:\s*"([^"]+)",[^}]*?type:\s*"select"(?:[^}]*?options:\s*"([a-z_]+)")?/g;
let fm;
const LISTS = fs.readFileSync(path.join(SRC, "lib/optionLists.js"), "utf8");
while ((fm = fre.exec(ef))) {
  const [, key, label, optKey] = fm;
  const src = new RegExp(`\\n\\s*${key}:\\s*\\{`).test(LISTS) ? `list:${key}` : optKey === "departments" ? "master:departments" : optKey === "companies" ? "master:companies" : optKey === "locations" ? "master:locations" : optKey === "geofences" ? "master:geofences" : optKey === "vendors" ? "master:vendors" : optKey === "managers" ? "people" : optKey === "regions" ? "master:countries" : "fixed";
  items.push({ file: "data/employeeFields.js", line: ef.slice(0, fm.index).split("\n").length, area: "Employee form", label, source: src, kind: "dropdown" });
}

// Requests & forms (src/lib/forms.js): each list / select field is a dropdown on that form
const fs2 = fs.readFileSync(path.join(SRC, "lib/forms.js"), "utf8");
let cur = "";
fs2.split("\n").forEach((ln, i) => {
  const t = ln.match(/^\s{4}label: "([^"]+)", prefix:/); if (t) cur = t[1];
  const f = ln.match(/\{ key: "([a-z_]+)", label: "([^"]+)", type: "(list|select)"(?:, list: "([a-z_]+)")?/);
  if (f && cur) items.push({ file: "lib/forms.js", line: i + 1, area: "Requests & forms", label: `${cur} · ${f[2]}`, source: f[4] ? `list:${f[4]}` : "fixed", kind: "dropdown" });
});

items.sort((a, b) => a.area.localeCompare(b.area) || a.label.localeCompare(b.label));
const masters = Object.fromEntries(MASTERS.map(([id, label, route]) => [id, { label, route }]));
const out = { generated: new Date().toISOString().slice(0, 10), total: items.length, masters, items };
fs.writeFileSync(path.join(SRC, "data/dropdownInventory.json"), JSON.stringify(out));
const by = items.reduce((a, x) => { const k = x.source.split(":")[0]; a[k] = (a[k] || 0) + 1; return a; }, {});
console.log(`dropdown inventory: ${items.length} dropdowns`, by);
