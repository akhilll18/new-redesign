// Payslip layout and fields, taken from the company payslip template (ONASTech_Payslip_Aug2026.docx).
// Fixed blocks (company, employee details, salary days) come from the employee master and the batch.
// Amount lines (earnings, contributions, taxes & deductions, reimbursements) and extra detail fields are
// configurable "components": HR proposes them, Finance then Super Admin approve, and only Active ones are used.
import { COMPANY_LOGO } from "./companyLogo.js";

export const DEFAULT_COMPANY = {
  name: "ONASTECH GLOBAL SERVICES PRIVATE LIMITED",
  address: ["Vasavi Sky City, 8th Floor, Tower 1, Quick Start-CoWorking", "Gachibowli Circle, Telecom Nagar, Gachibowli", "Hyderabad, Telangana 500032"],
  logo: COMPANY_LOGO,
  footer: "This is a system-generated payslip and does not require a physical signature.",
};

// Employee details block — source is the employee master field shown in brackets.
export const PAYSLIP_EMPLOYEE_FIELDS = [
  ["employee_code", "Employee number"],
  ["date_of_joining", "Date joined"],
  ["department", "Department"],
  ["designation", "Designation"],
  ["payment_mode", "Payment mode"],
  ["bank_name", "Bank"],
  ["bank_ifsc", "Bank IFSC"],
  ["bank_account", "Bank account"],
  ["uan", "UAN"],
  ["pf_number", "PF number"],
  ["pan", "PAN number"],
];

// Salary details block — supplied per payslip (from attendance or the upload).
export const PAYSLIP_DAY_FIELDS = [
  ["actual_payable_days", "Actual payable days", true],
  ["total_working_days", "Total working days", true],
  ["lop_days", "Loss of pay days", true],
  ["days_payable", "Days payable", false], // calculated: total working days − LOP days
];

export const SECTIONS = {
  earning: { label: "Earnings", total: "Total earnings (A)" },
  contribution: { label: "Contributions", total: "Total contributions (B)" },
  deduction: { label: "Taxes & deductions", total: "Total taxes & deductions (C)" },
  reimbursement: { label: "Reimbursements", total: "Total reimbursements (R)" },
  detail: { label: "Additional details", total: null },
};

export const FIELD_TYPES = [["amount", "Amount (local currency)"], ["text", "Text"], ["number", "Number"], ["date", "Date"]];

const c = (code, label, section, required, order, extra = {}) => ({
  code, label, section, type: section === "detail" ? "text" : "amount", required, visible: true, order,
  status: "Active", stage: null, proposed_by: "SYSTEM", history: [{ at: "2026-04-01T09:00:00.000Z", by: "SYSTEM", action: "Imported from payslip template" }], ...extra,
});

// The template's lines. Codes are the column names in the upload file.
export const DEFAULT_COMPONENTS = [
  c("BASIC", "Basic Salary", "earning", true, 1),
  c("HRA", "HRA", "earning", true, 2),
  c("SPECIAL", "Special Allowance", "earning", true, 3),
  c("OTHER_ALW", "Any Other Allowances", "earning", false, 4),
  c("PF_EE", "PF Employee", "contribution", true, 1),
  c("PT", "Professional Tax", "deduction", true, 1),
  c("TDS", "TDS", "deduction", true, 2),
  c("REIMB", "Reimbursements", "reimbursement", false, 1),
  // Contract workers on payroll (v8.7): pay from approved timesheets, hours and the contract rate.
  c("CONTRACT_PAY", "Contract pay (timesheets)", "earning", false, 5),
  c("CW_HOURS", "Hours / days worked", "detail", false, 2),
  c("CW_RATE", "Contract rate", "detail", false, 3),
  // v10.3: staff outside India — gross, social security and income tax from their own country engine, in local currency.
  // Each payslip also carries the engine's local line names (PAYE, NIC, CPF, Lohnsteuer…), shown instead of these totals.
  c("GROSS_PAY", "Gross salary (local country engine)", "earning", false, 6),
  c("SOCIAL_EE", "Social security & pension (employee)", "contribution", false, 2),
  c("LOCAL_TAX", "Income tax (PAYE / withholding)", "deduction", false, 3),
  c("OTHER_DED", "Other statutory deductions", "deduction", false, 4),
];
export const CONTRACT_COMPONENT_CODES = ["CONTRACT_PAY", "CW_HOURS", "CW_RATE"];
export const LOCAL_COMPONENT_CODES = ["GROSS_PAY", "SOCIAL_EE", "LOCAL_TAX", "OTHER_DED"];

export const DAY_COLUMNS = ["actual_payable_days", "total_working_days", "lop_days"];

export function activeComponents(list) {
  return (list || []).filter((x) => x.status === "Active").sort((a, b) => a.order - b.order);
}

// Upload / template columns: employee code, the three day columns, then every active component code.
export function templateColumns(components) {
  return ["employee_code", ...DAY_COLUMNS, ...activeComponents(components).map((x) => x.code)];
}

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Totals exactly as on the template: Net salary = A − B − C; total net payable adds reimbursements.
export function payslipTotals(values, components) {
  const act = activeComponents(components);
  const sum = (sec) => r2(act.filter((x) => x.section === sec && x.type === "amount").reduce((s, x) => s + (Number(values[x.code]) || 0), 0));
  const A = sum("earning");
  const B = sum("contribution");
  const C = sum("deduction");
  const R = sum("reimbursement");
  const net = r2(A - B - C);
  return { A, B, C, R, gross: A, deductions: r2(B + C), net, payable: r2(net + R) };
}

// Indian numbering in words: 95633 → "Ninety-five thousand six hundred thirty-three".
const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
function two(n) {
  return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? `-${ONES[n % 10]}` : ""}`;
}
function three(n) {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return [h ? `${ONES[h]} hundred` : "", rest ? two(rest) : ""].filter(Boolean).join(" ");
}
export function amountInWords(amount) {
  let n = Math.floor(Math.abs(Number(amount) || 0));
  const paise = Math.round((Math.abs(Number(amount) || 0) - n) * 100);
  if (n === 0 && !paise) return "Zero";
  const parts = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) parts.push(`${three(crore)} crore`);
  if (lakh) parts.push(`${two(lakh)} lakh`);
  if (thousand) parts.push(`${two(thousand)} thousand`);
  if (n) parts.push(three(n));
  let s = parts.join(" ");
  if (paise) s += `${s ? " and " : ""}${two(paise)} paise`;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Minimal CSV: commas, quoted fields with "" escapes, CRLF or LF.
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let q = false;
  const t = String(text || "").replace(/^﻿/, "");
  for (let i = 0; i < t.length; i += 1) {
    const ch = t[i];
    if (q) {
      if (ch === '"' && t[i + 1] === '"') { cur += '"'; i += 1; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && t[i + 1] === "\n") i += 1;
      row.push(cur); cur = "";
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur);
  if (row.some((v) => v.trim() !== "")) rows.push(row);
  return rows.map((r) => r.map((v) => v.trim()));
}

export function toCsv(header, rows) {
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
}

// Validates an upload against the active components and the employee master.
// Returns { rows: [{employee_code, days..., values}], errors: [{line, message}], warnings }.
export function validateUpload(text, { components, employees, period }) {
  const errors = [];
  const warnings = [];
  const grid = parseCsv(text);
  if (grid.length < 2) return { rows: [], errors: [{ line: 1, message: "The file needs a header row and at least one employee row." }], warnings };
  const header = grid[0].map((h) => h.trim());
  const norm = header.map((h) => h.toLowerCase());
  const act = activeComponents(components);
  const need = ["employee_code", ...DAY_COLUMNS];
  need.forEach((col) => { if (!norm.includes(col)) errors.push({ line: 1, message: `Missing column “${col}”.` }); });
  act.filter((x) => x.required).forEach((x) => { if (!header.includes(x.code)) errors.push({ line: 1, message: `Missing required column “${x.code}” (${x.label}).` }); });
  const known = new Set([...need, ...act.map((x) => x.code)]);
  header.forEach((h, i) => { if (h && !known.has(h) && !known.has(norm[i])) warnings.push(`Column “${h}” is not an active payslip field and was ignored.`); });
  if (errors.length) return { rows: [], errors, warnings };
  const idx = (col) => (norm.includes(col.toLowerCase()) ? norm.indexOf(col.toLowerCase()) : header.indexOf(col));
  const seen = new Set();
  const rows = [];
  grid.slice(1).forEach((cells, k) => {
    const line = k + 2;
    const code = (cells[idx("employee_code")] || "").toUpperCase();
    const emp = employees.find((e) => e.employee_code === code);
    if (!emp) return errors.push({ line, message: `Employee code “${code || "(blank)"}” is not in the employee master.` });
    if (emp.status !== "active") warnings.push(`Line ${line}: ${code} is ${emp.status}.`);
    if (seen.has(code)) return errors.push({ line, message: `${code} appears more than once.` });
    seen.add(code);
    const num = (col, label) => {
      const raw = cells[idx(col)];
      if (raw === undefined || raw === "") return null;
      const v = Number(String(raw).replace(/,/g, ""));
      if (!Number.isFinite(v)) { errors.push({ line, message: `${code}: ${label} “${raw}” is not a number.` }); return null; }
      return v;
    };
    const apd = num("actual_payable_days", "actual payable days");
    const twd = num("total_working_days", "total working days");
    const lop = num("lop_days", "loss of pay days") ?? 0;
    if (apd == null || twd == null) return errors.push({ line, message: `${code}: actual payable days and total working days are required.` });
    if (twd <= 0 || twd > 31) errors.push({ line, message: `${code}: total working days must be 1–31.` });
    if (lop < 0 || lop > twd) errors.push({ line, message: `${code}: loss of pay days must be between 0 and total working days.` });
    if (apd > 31 || apd < 0) errors.push({ line, message: `${code}: actual payable days must be 0–31.` });
    const values = {};
    act.forEach((x) => {
      const col = idx(x.code);
      const raw = col >= 0 ? cells[col] : undefined;
      if (x.type === "amount" || x.type === "number") {
        const v = raw === undefined || raw === "" ? null : Number(String(raw).replace(/,/g, ""));
        if (v === null) {
          if (x.required) errors.push({ line, message: `${code}: ${x.label} (${x.code}) is required.` });
          values[x.code] = 0;
        } else if (!Number.isFinite(v)) errors.push({ line, message: `${code}: ${x.label} “${raw}” is not a number.` });
        else if (x.type === "amount" && v < 0) errors.push({ line, message: `${code}: ${x.label} cannot be negative.` });
        else values[x.code] = r2(v);
      } else {
        if (x.required && !raw) errors.push({ line, message: `${code}: ${x.label} (${x.code}) is required.` });
        values[x.code] = raw || "";
      }
    });
    const t = payslipTotals(values, components);
    if (t.net < 0) errors.push({ line, message: `${code}: deductions are more than earnings (net ${t.net}).` });
    rows.push({ employee_code: code, actual_payable_days: apd, total_working_days: twd, lop_days: lop, days_payable: r2(twd - lop), values, period });
  });
  return { rows, errors, warnings };
}

export const PAYMENT_MODE_LABEL = { bank_transfer: "Bank Transfer", cheque: "Cheque", cash: "Cash" };

export function periodLabel(period) {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 15).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}
