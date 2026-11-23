// Offer letter fields and content, taken from Offer_Letter-_Updated_New_v2.0.docx.
// Standard fields cover every variable part of the template; HR can add custom fields (extra details,
// extra monthly earnings in Annexure I, or whole extra clauses that may use {{field_key}} placeholders).
import { COMPANY_LOGO } from "./companyLogo.js";
import { parseCsv, toCsv, amountInWords } from "./payslipFields.js";

export { toCsv };

export const DEFAULT_OFFER_COMPANY = {
  brand: "ONAS",
  legal_name: "ONAS Consulting Services Pvt Ltd",
  cin: "U74909TS2024PTC189741",
  office: ["Vasavi Sky City, 8th Floor, Tower 1", "Quick Start – Co-Working, Gachibowli Circle", "Telecom Nagar, Gachibowli", "Hyderabad, Telangana – 500081, India"],
  phone: "+91 98480 04777 / 5777",
  website: "www.onasit.com, www.onasglobal.com",
  signatory_name: "M. Praveen Kumar Reddy",
  signatory_title: "Director, Founder – ONAS",
  jurisdiction: "Hyderabad",
  intranet: "the company intranet",
  logo: COMPANY_LOGO,
  confidential: "Company Confidential - This communication is confidential between you and ONAS",
};

export const OFFER_GROUPS = {
  candidate: "Candidate",
  offer: "Offer terms",
  salary: "Compensation (Annexure I)",
  salary_earning: "Extra monthly earning (Annexure I)",
  clause: "Extra clause",
};

const YESNO = [["yes", "Yes"], ["no", "No"]];

// key, label, group, type, required, default, extra
export const STANDARD_OFFER_FIELDS = [
  ["salutation", "Salutation", "candidate", "select", true, "Mr.", { options: [["Mr.", "Mr."], ["Ms.", "Ms."], ["Mrs.", "Mrs."], ["Dr.", "Dr."]] }],
  ["candidate_name", "Candidate full name", "candidate", "text", true, ""],
  ["address", "Postal address", "candidate", "multiline", true, "", { help: "One line per row, including city and PIN." }],
  ["country", "Country", "candidate", "text", true, "India"],
  ["phone", "Phone", "candidate", "text", true, "", { pattern: "^\\+?[0-9 ()-]{8,20}$", help: "e.g. +91 98765 43210" }],
  ["email", "Email (offer is sent here)", "candidate", "email", true, ""],
  ["offer_date", "Offer date", "offer", "date", true, "__today"],
  ["designation", "Designation", "offer", "text", true, ""],
  ["role", "Role", "offer", "text", true, ""],
  ["joining_date", "Joining date", "offer", "date", true, ""],
  ["work_city", "Work location (city)", "offer", "text", true, "HYDERABAD"],
  ["work_address", "Work location address", "offer", "multiline", true, "__office"],
  ["remote_work", "Include remote-work clause", "offer", "select", true, "yes", { options: YESNO }],
  ["probation_months", "Probation (months)", "offer", "number", true, 6, { min: 0, max: 12 }],
  ["leave_probation_days", "Earned leave during probation (days / year)", "offer", "number", true, 15, { min: 0, max: 40 }],
  ["leave_confirmed_days", "Earned leave after confirmation (days / year)", "offer", "number", true, 20, { min: 0, max: 40 }],
  ["notice_months", "Notice period (months)", "offer", "number", true, 3, { min: 0, max: 6 }],
  ["non_compete_months", "Non-compete period (months)", "offer", "number", true, 6, { min: 0, max: 24 }],
  ["passport_required", "Passport copy required at joining", "offer", "select", true, "yes", { options: YESNO }],
  ["shifts_clause", "Include rotational-shift clause", "offer", "select", true, "yes", { options: YESNO }],
  ["monthly_ctc", "Monthly CTC (₹)", "salary", "amount", true, "", { min: 1000, max: 10000000 }],
  ["basic_pct", "Basic (% of CTC)", "salary", "number", true, 50, { min: 30, max: 80 }],
  ["hra_pct", "HRA (% of basic)", "salary", "number", true, 40, { min: 0, max: 50 }],
  ["lta_pct", "LTA (% of basic)", "salary", "number", true, 10, { min: 0, max: 20 }],
  ["pf_mode", "Provident fund", "salary", "select", true, "capped", { options: [["capped", "12% of basic, capped at ₹1,800 (₹15,000 wage ceiling)"], ["new_cap", "New PF policy — 12% of PF wage (basic + allowances except HRA, at least 50% of CTC), capped at ₹15,000 wage"], ["full", "12% of full basic"], ["none", "No PF"]] }],
  // v10.6: PF for senior citizens (58+): no pension (EPS) — the employer's full 12% goes to the PF account.
  ["pf_senior", "PF · senior citizen (58 years or above)", "salary", "select", true, "no", { options: [["no", "No"], ["yes", "Yes — no EPS; employer 12% fully to EPF"], ["exempt", "Yes — opted out of PF"]] }],
  // v10.6: ESI (gross up to ₹21,000 a month): employer 3.25% (part of CTC), employee 0.75% (deduction).
  ["esi_mode", "ESI", "salary", "select", true, "auto", { options: [["auto", "Automatic — applies when gross ≤ ₹21,000 / month"], ["yes", "Applicable"], ["no", "Not applicable"]] }],
  ["tds_monthly", "TDS — estimated income tax (₹ / month)", "salary", "amount", false, 0, { min: 0, max: 10000000 }],
  ["professional_tax", "Professional tax (₹ / month)", "salary", "amount", true, 200, { min: 0, max: 2500 }],
  ["performance_bonus_annual", "Performance bonus (₹ / year, at 100%)", "salary", "amount", false, 0, { min: 0, max: 100000000 }],
].map(([key, label, group, type, required, def, extra = {}]) => ({ key, label, group, type, required, default: def, standard: true, ...extra }));

export function offerFieldList(custom = []) {
  return [...STANDARD_OFFER_FIELDS, ...custom.filter((f) => f.active !== false).map((f) => ({ ...f, standard: false }))];
}

export function defaultsFor(fields, company) {
  const v = {};
  fields.forEach((f) => {
    if (f.default === "__today") v[f.key] = new Date().toISOString().slice(0, 10);
    else if (f.default === "__office") v[f.key] = company.office.join("\n");
    else v[f.key] = f.default ?? "";
  });
  return v;
}

const r0 = (n) => Math.round(Number(n) || 0);

// Annexure I. CTC = Gross (A) + employer PF (B). Special allowance is the balancing figure.
export function salaryBreakup(v, custom = []) {
  const ctc = r0(v.monthly_ctc);
  const basic = r0((ctc * Number(v.basic_pct || 0)) / 100);
  const hra = r0((basic * Number(v.hra_pct || 0)) / 100);
  const lta = r0((basic * Number(v.lta_pct || 0)) / 100);
  const pfWage = v.pf_mode === "new_cap" ? Math.max(basic, r0(ctc * 0.5)) : basic;
  const pf = v.pf_mode === "none" || v.pf_senior === "exempt" ? 0 : v.pf_mode === "full" ? r0(basic * 0.12) : Math.min(r0(pfWage * 0.12), 1800);
  const extras = custom.filter((f) => f.group === "salary_earning" && f.active !== false).map((f) => ({ label: f.label, m: r0(v[f.key]) })).filter((x) => x.m);
  // ESI: gross A = (CTC − PF) ÷ 1.0325 so that the employer's 3.25% of gross sits inside the CTC.
  const g0 = ctc - pf;
  const esiOn = v.esi_mode === "yes" || ((v.esi_mode || "auto") === "auto" && g0 / 1.0325 <= 21000);
  const A = esiOn ? r0(g0 / 1.0325) : g0;
  const esiEr = esiOn ? g0 - A : 0;
  const esiEe = esiOn ? Math.ceil(A * 0.0075) : 0;
  const special = A - basic - hra - lta - extras.reduce((s, x) => s + x.m, 0);
  const pt = r0(v.professional_tax);
  const tds = r0(v.tds_monthly);
  const ded = pf + esiEe + pt;
  const bonus = r0(v.performance_bonus_annual);
  return {
    ctc, basic, hra, lta, special, extras, pf, A, B: pf + esiEr, pfEmployee: pf, esiOn, esiEr, esiEe, tds, pfSenior: v.pf_senior || "no", pfMode: v.pf_mode, pt, ded, takeHome: A - ded, takeHomeAfterTax: A - ded - tds, bonus,
    annual: (m) => m * 12,
    totalWithBonus: ctc * 12 + bonus,
    rows: [
      ["Basic", `${v.basic_pct}% of CTC`, basic],
      ["House Rent Allowance (HRA)", `${v.hra_pct}% of basic`, hra],
      ["Leave Travel Allowance (LTA)", `${v.lta_pct}% of basic`, lta],
      ...extras.map((x) => [x.label, "", x.m]),
      ["Special Allowance", "balance", special],
    ],
  };
}

export function fill(text, v) {
  return String(text || "").replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, k) => (v[k] !== undefined && v[k] !== "" ? String(v[k]) : `[${k}]`));
}

export function validateOffer(v, fields, custom = []) {
  const e = {};
  fields.forEach((f) => {
    const val = v[f.key];
    const empty = val === undefined || val === null || String(val).trim() === "";
    if (f.group === "clause") return;
    if (f.required && empty) { e[f.key] = `${f.label} is required.`; return; }
    if (empty) return;
    if (["number", "amount"].includes(f.type)) {
      const n = Number(String(val).replace(/,/g, ""));
      if (!Number.isFinite(n)) e[f.key] = `${f.label} must be a number.`;
      else if (f.min != null && n < f.min) e[f.key] = `${f.label} must be at least ${f.min}.`;
      else if (f.max != null && n > f.max) e[f.key] = `${f.label} must be at most ${f.max}.`;
      else if (f.type === "amount" && n < 0) e[f.key] = `${f.label} cannot be negative.`;
    }
    if (f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val)) e[f.key] = "Enter a valid email address.";
    if (f.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(val)) e[f.key] = `${f.label} must be a date (YYYY-MM-DD).`;
    if (f.pattern && !new RegExp(f.pattern).test(val)) e[f.key] = `${f.label} is not in the expected format${f.help ? ` (${f.help})` : ""}.`;
    if (f.type === "select" && f.options && !f.options.some(([o]) => o === val)) e[f.key] = `${f.label} must be one of: ${f.options.map(([o]) => o).join(", ")}.`;
  });
  if (!e.joining_date && !e.offer_date && v.joining_date && v.offer_date && v.joining_date < v.offer_date) e.joining_date = "Joining date cannot be before the offer date.";
  if (!e.monthly_ctc && v.monthly_ctc) {
    const s = salaryBreakup(v, custom);
    if (s.special < 0) e.monthly_ctc = `CTC is too low for these percentages: special allowance would be ₹${s.special.toLocaleString("en-IN")}. Lower basic / HRA / LTA or raise the CTC.`;
  }
  return e;
}

// Upload: one row per candidate. Missing optional columns take the default.
export function validateOfferUpload(text, { fields, custom, company }) {
  const grid = parseCsv(text);
  const errors = [];
  const warnings = [];
  if (grid.length < 2) return { rows: [], errors: [{ line: 1, message: "The file needs a header row and at least one candidate row." }], warnings };
  const header = grid[0].map((h) => h.trim().toLowerCase());
  const keys = new Set(fields.map((f) => f.key));
  fields.filter((f) => f.required && f.default === "" && f.group !== "clause").forEach((f) => { if (!header.includes(f.key)) errors.push({ line: 1, message: `Missing required column “${f.key}” (${f.label}).` }); });
  header.forEach((h) => { if (h && !keys.has(h)) warnings.push(`Column “${h}” is not an offer field and was ignored.`); });
  if (errors.length) return { rows: [], errors, warnings };
  const defaults = defaultsFor(fields, company);
  const rows = [];
  const seen = new Set();
  grid.slice(1).forEach((cells, k) => {
    const line = k + 2;
    const v = { ...defaults };
    header.forEach((h, i) => {
      if (!keys.has(h)) return;
      const raw = (cells[i] ?? "").trim();
      const fld = fields.find((f) => f.key === h);
      if (fld?.group === "clause" && raw === "-") v[h] = "";
      else if (raw !== "") v[h] = h === "address" || h === "work_address" ? raw.replace(/\s*\|\s*/g, "\n") : raw;
    });
    fields.filter((f) => ["number", "amount"].includes(f.type)).forEach((f) => { if (v[f.key] !== "" && v[f.key] != null) v[f.key] = Number(String(v[f.key]).replace(/,/g, "")); });
    const errs = validateOffer(v, fields, custom);
    Object.values(errs).forEach((m) => errors.push({ line, message: `${v.candidate_name || "(no name)"}: ${m}` }));
    const dup = (v.email || "").toLowerCase();
    if (dup && seen.has(dup)) errors.push({ line, message: `${v.email} appears more than once.` });
    seen.add(dup);
    rows.push(v);
  });
  return { rows, errors, warnings };
}

const fmtLong = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "");
const inr = (n) => Number(n || 0).toLocaleString("en-IN");
const inr2 = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const months = (n) => {
  const w = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"][Number(n)] || String(n);
  return `${w} month${Number(n) === 1 ? "" : "s"}`;
};

// The letter as a list of pages of blocks. Rendered both as HTML (preview / print) and as a Word file.
// Block kinds: p (runs), h (heading), addr (lines), sign, table, gap, center.
export function buildOfferLetter(v, company, custom = []) {
  const name = v.candidate_name;
  const full = `${v.salutation} ${name}`;
  const addr = { kind: "addr", lines: [`${full},`, ...String(v.address || "").split("\n").map((l) => l.trim()).filter(Boolean).map((l, i, a) => (i < a.length - 1 ? `${l},` : l)), v.country, `Ph: ${v.phone}`] };
  const P = (...runs) => ({ kind: "p", runs: runs.map((r) => (typeof r === "string" ? { t: r } : r)) });
  const B = (t) => ({ t, b: true });
  const I = (t) => ({ t, i: true });
  const brand = company.brand;
  const s = salaryBreakup(v, custom);
  const clauses = custom.filter((f) => f.group === "clause" && f.active !== false && String(v[f.key] ?? f.default ?? "").trim());
  const detailFields = custom.filter((f) => ["candidate", "offer"].includes(f.group) && f.active !== false && String(v[f.key] ?? "").trim());
  const sign = { kind: "sign", name: company.signatory_name, title: company.signatory_title };

  const welcome = [
    addr,
    { kind: "gap" },
    P(`Dear ${name},`),
    P(B(`Welcome to ${brand}!`)),
    P(`Today, the corporate landscape is dynamic and the world ahead is full of possibilities! None of the amazing things we do at ${brand} would be possible without an equally amazing culture, the environment where ideas can flourish and where you are empowered to move forward as far as your ideas will take you.`),
    P(`At ${brand}, we assure that your career will never stand still, we will inspire you to build what's next and we will navigate further, together. Our journey of learnability, values and trusted relationships with our clients continue to be the cornerstones of our organization and these values are upheld only because of our people.`),
    P("We look forward to working with you and wish you success in your career with us."),
    P("Warm regards,"),
    sign,
  ];

  const terms = [
    { kind: "right", text: fmtLong(v.offer_date) },
    addr,
    { kind: "gap" },
    P(`Dear ${name},`),
    P("Congratulations! We are delighted to make you an offer as ", B(v.designation), " and your role is ", B(v.role), ". Here are the terms and conditions of our offer:"),
    ...(detailFields.length ? [{ kind: "kv", items: detailFields.map((f) => [f.label, f.type === "date" ? fmtLong(v[f.key]) : String(v[f.key])]) }] : []),
    { kind: "h", text: "Joining Date" },
    P("Your scheduled date of employment with us will be ", B(fmtLong(v.joining_date)), "."),
    { kind: "h", text: "Location" },
    P(`Your location for employment is ${v.work_city}, ${String(v.work_address || "").split("\n").join(", ")}.`),
    P(`You may be asked to relocate to any of our units, departments or the offices of our affiliates* and/or the offices of our customers, depending on business requirements. In such an event, your remuneration and other benefits shall be determined in accordance with the relevant Policies of the Company in that work location.`),
    ...(v.remote_work === "yes" ? [P(I("The Company at its sole discretion permits you to work remotely from within the territory of India till further notice. The Company does not expect you to work from office for the foreseeable future. You may continue to work remotely unless there are business requirements, including changes in the applicable law, in which case, you will be provided 60 calendar days' notice to return to office. The cost of your travel and stay will be determined in accordance with applicable Company policies. As such, should you be asked to return to work, you agree that it will not be considered a modification to your working conditions. You and the Company agree that your performance will be under constant review to assess the opportunity to continue rendering your services remotely."))] : []),
    P("Please be advised that you, by accepting this offer, hereby give your irrevocable consent to the above."),
    P(I(`* For the purpose of this agreement, "affiliate" means any entity that controls, is controlled by, or is under common control with the First Party. For purposes of this Agreement, "control" means possessing, directly or indirectly, the power to direct or cause the direction of the management, policies or operations of an entity, whether through ownership of voting securities, by contract or otherwise.`)),
    { kind: "h", text: "Probation and Confirmation" },
    P(`You will be on probation for a period of ${months(v.probation_months)} from the date of joining us. On successful completion of your probation, you will be confirmed as a permanent employee of ${brand}.`),
    { kind: "h", text: "Leave" },
    P(`You are entitled to Earned Leave, right from your date of joining. You will be eligible for ${v.leave_probation_days} working days of leave annually, during probation. On confirmation, you will be eligible for ${v.leave_confirmed_days} working days of leave annually.`),
    P("Leave is credited on a quarterly basis. The leave eligibility shall begin in the quarter of your joining the Company, on a pro-rata basis."),
    P("An illustration with other relevant information has been given in the Information Sheet. The Company's Policies also provide for Maternity, Paternity and Bereavement Leave. Further details will be provided to you at the time of joining."),
    { kind: "h", text: "Compensation and Benefits" },
    P("Your Cost to Company will be ", B(`INR ${inr(s.ctc)} per month`), ` (INR ${inr(s.ctc * 12)} per annum), with a Fixed Gross Salary of INR ${inr(s.A)} per month.${s.bonus ? ` In addition, you are eligible for a Performance Bonus of up to INR ${inr(s.bonus)} per annum (at an indicative payout of 100%).` : ""} The break-up of your salary has been provided in the Compensation Details sheet at Annexure – I.`),
    ...(s.bonus ? [{ kind: "h", text: "Performance Bonus" }, P("You will be eligible to participate in the Company discretionary Bonus Plan. Your maximum Performance Bonus (at a payment of 100%) is INR ", B(inr(s.bonus)), " per annum. This payment of your Bonus can vary from 0% to 100% depending on individual, group and Company performance.")] : []),
    { kind: "h", text: "Notice period" },
    P(`You will be required to give ${months(v.notice_months)}' notice or salary thereof in case you decide to leave our services, subject to the Company's discretion. Where circumstances make it necessary, the Company will have the discretion to relieve you only at the end of the ${months(v.notice_months)}' notice period. Similarly, the Company can terminate your services by giving ${months(v.notice_months)}' notice or salary thereof.`),
    { kind: "h", text: "Background checks" },
    P(`The Company may, at its discretion conduct background checks prior to or after your expected joining date to validate your identity, the address provided by you, your education details and details of your prior work experience if any, and to conduct any criminal checks. You expressly consent to the Company conducting such background checks. In this connection, you are required to furnish the documents listed in "Offer Annexure for India".`),
    P("If you fail to submit the necessary documents as required by the Company within the specified time period or if the Company is not satisfied, with the outcome of the background checks, the Company, in its sole discretion, reserves the right to withdraw this Offer without notice and Compensation or to take any appropriate action against you, including, but not limited to termination of your employment."),
    P("When a background check raises any concerns regarding any of the details furnished by you and the Company feels the need to further validate such facts, the Company may at its sole discretion, ask you for further information, to substantiate the details that you have earlier provided to the Company, before initiating appropriate action."),
    ...(v.passport_required === "yes" ? [P(`Please note that ${brand} requires you to furnish a copy of your passport at the time of joining. If you are unable to do so, the Company will initiate a criminal background check.`)] : []),
    ...clauses.flatMap((f) => [{ kind: "h", text: f.label }, P(fill(v[f.key] ?? f.default, v))]),
    { kind: "h", text: "Other terms and conditions" },
    P(`You agree not to undertake employment, whether full-time or part-time, as the Director / Partner / Member / Employee of any other organization / entity engaged in any form of business activity without the consent of ${brand}. The consent may be given subject to any terms and conditions that the Company may think fit and may be withdrawn at any time at the discretion of the Company.`),
    P(`You hereby acknowledge and agree to abide by all internal Policies of the Company, which you will be able to access, upon joining, on ${company.intranet}. These Policies cover various human resources and administrative topics and procedures. The Company reserves the right to change these Policies at any time in its absolute discretion.`),
    ...(v.shifts_clause === "yes" ? [P("Based on the nature of your work and business requirements, you may be required to work on rotational shifts. If you are required to work on rotational shifts, you will be duly intimated of the change in your shift timings. During rotational shifts, you will continue to be bound by the provisions of the working hour policy of the Company. If the rotational shifts require you to work night shifts, the policy on night shift allowance of the Company (if in force) will be made applicable to you.")] : []),
    P("You shall be required to sign certain mandatory agreements, including but not limited to the Confidentiality, Intellectual Property Rights, the Code of Business Conduct and Ethics and your employment shall be governed by all the rules and regulations, as amended from time to time, of the Company as applicable to your employment with us. This offer is also conditional upon your acceptance and execution of the Non-Compete Agreement (Annexure II)."),
    P("This offer of employment constitutes the entire agreement between you and the Company regarding the terms of your employment and it is the complete, final, and exclusive embodiment of your agreement with regard to this subject matter and supersedes any other promises, warranties, representations or agreements, whether written or oral. It is entered into without reliance on any promise or representation other than those expressly contained herein, and it cannot be modified or amended except in writing signed by an authorized officer of the Company."),
    P("If any of the terms or conditions of this offer are found to be illegal or unenforceable, such terms shall be treated as severable from the rest of the terms and conditions of this offer and the remaining terms and conditions shall continue in force."),
    P(`This agreement shall be governed by the laws of India, and you hereby agree to the exclusive jurisdiction of the courts in ${company.jurisdiction}, India.`),
    P("As a token of your acceptance of this offer, please bring duly signed duplicate copies of the letter and all the accompanying annexures, on the date of joining."),
    P(`We welcome you to the ${brand} family and wish you a rewarding career over the years to come.`),
    P("Yours sincerely,"),
    sign,
    { kind: "gap" },
    P(B("I have read, understood and agree to the terms and conditions as set forth in this offer letter.")),
    { kind: "lines", items: ["Date", "Sign your name", "Print your name"] },
    P("Enclosures: Salary Breakup (Annexure I), Non-Compete Agreement (Annexure II), Information Sheet (Annexure III)"),
  ];

  const A = (m) => [inr2(m), inr2(m * 12)];
  const annex1 = [
    { kind: "center", text: "ANNEXURE – I" },
    { kind: "center", text: "SALARY BREAKUP SHEET" },
    P(B(`Employee Name : ${full}`)),
    P(B(`Designation : ${v.designation}`)),
    {
      kind: "table",
      head: ["Salary details", "%", "Per month (₹)", "Per annum (₹)"],
      rows: [
        { cells: ["CTC", "", ...A(s.ctc)], b: true },
        { cells: ["A) GROSS SALARY", "", "", ""], b: true, section: true },
        ...s.rows.map(([l, pct, m]) => ({ cells: [l, pct, ...A(m)] })),
        { cells: ["TOTAL (A)", "", ...A(s.A)], b: true },
        { cells: ["B) PROVIDENT FUND (PF)", "", "", ""], b: true, section: true },
        { cells: [`PF – Company contribution${s.pfSenior === "yes" ? " (senior citizen: all to EPF, no EPS)" : s.pfMode === "new_cap" ? " (new PF wage rule, ₹15,000 cap)" : ""}`, "", ...A(s.pf)] },
        ...(s.esiOn ? [{ cells: ["ESI – Employer contribution", "3.25% of gross", ...A(s.esiEr)] }] : []),
        { cells: ["TOTAL (B)", "", ...A(s.B)], b: true },
        { cells: ["TOTAL (A + B) Cost To Company", "", ...A(s.ctc)], b: true },
        { cells: ["C) DEDUCTIONS before income tax", "", "", ""], b: true, section: true },
        { cells: ["PF – Employee contribution", "", ...A(s.pfEmployee)] },
        ...(s.esiOn ? [{ cells: ["ESI – Employee contribution", "0.75% of gross", ...A(s.esiEe)] }] : []),
        { cells: ["Professional tax", "", ...A(s.pt)] },
        { cells: ["DEDUCTIONS TOTAL (before income tax)", "", ...A(s.ded)], b: true },
        { cells: ["TAKE HOME BEFORE INCOME TAX (A − C)", "", ...A(s.takeHome)], b: true },
        ...(s.tds ? [
          { cells: ["Income tax – TDS (estimate)", "", ...A(s.tds)] },
          { cells: ["TAKE HOME AFTER TDS", "", ...A(s.takeHomeAfterTax)], b: true },
        ] : []),
        ...(s.bonus ? [
          { cells: ["PERFORMANCE BONUS (at indicative payout of 100%)", "", "", inr2(s.bonus)] },
          { cells: ["TOTAL COMPENSATION (CTC + performance bonus)", "", "", inr2(s.totalWithBonus)], b: true },
        ] : []),
      ],
    },
    P(I(`Annual CTC in words: Rupees ${amountInWords(s.ctc * 12)} only. Income tax is deducted monthly as per the regime you choose.`)),
  ];

  const annex2 = [
    { kind: "center", text: "ANNEXURE – II" },
    { kind: "center", text: "Non-Compete Agreement" },
    P(`I, ${full}, hereby acknowledge and confirm the following:`),
    { kind: "ol", items: [
      `I am accepting employment with ${company.legal_name} ("${brand}"). Now, as per the presents below, I agree to the following terms herein, and acknowledge that this is a material condition of my employment with ${brand}.`,
      `I am required, on behalf of ${brand}, to provide services to, or solicit business from, various clients of ${brand} for whom I performed services as a Company employee (each such client hereinafter referred to as a "Customer").`,
      `In consideration of the above, I agree that for a period of ${months(v.non_compete_months)} following the termination of my employment with ${brand} for any reason, I will not: (a) accept any offer of employment from any Customer, where I had worked in a professional capacity with that Customer in the twelve (12) months immediately preceding the termination of my employment with ${brand}; (b) accept any offer of employment from a Named Competitor of ${brand}, if my employment with such Named Competitor would involve me having to work with a customer with whom I had worked in the twelve (12) months immediately preceding the termination of my employment with ${brand}.`,
    ] },
    { kind: "lines", items: ["Place", "Date", "Employee signature", `Employee name: ${full}`] },
    P(B(`Acknowledged by ${brand}:`)),
    { kind: "lines", items: ["Name and signature"] },
  ];

  return [welcome, terms, annex1, annex2];
}
