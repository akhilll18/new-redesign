// v10.6 · HR Management Toolkit — ready-to-use templates. Every item from the toolkit reference (policies, templates,
// forms, SOPs, checklists, letters, reports, HR Excel tools and the bonus pack) is defined here. Excel tools are built
// with exceljs (styled header, frozen first row, working formulas, totals); documents with docx. Items marked `live`
// can be filled with this company's data.

const pad = (n) => String(n).padStart(2, "0");
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
const age = (dob) => (dob ? Math.floor((Date.now() - new Date(dob)) / (365.25 * 86400000)) : "");
const tenure = (doj) => (doj ? Math.round(((Date.now() - new Date(doj)) / (365.25 * 86400000)) * 10) / 10 : "");
const active = (d) => d.employees.filter((e) => e.status === "active");
const mgr = (d, c) => d.employees.find((e) => e.employee_code === c)?.full_name || "";

export const TOOLKIT_CATEGORIES = [
  ["policies", "Policies", "blue"],
  ["templates", "Templates", "red"],
  ["forms", "Forms", "green"],
  ["sops", "SOPs", "purple"],
  ["checklists", "Checklists", "orange"],
  ["letters", "Letters", "brown"],
  ["reports", "Reports", "pink"],
  ["excel", "HR Excel tools", "green"],
  ["bonus", "Premium bonuses", "yellow"],
];

// Column spec: [header, width, type] — type: text | num | money | date | pct | formula:<excel with {r} for the row>
const X = (id, name, cat, desc, cols, opts = {}) => ({ id, name, cat, kind: "xlsx", desc, cols, ...opts });
const W = (id, name, cat, desc, sections, opts = {}) => ({ id, name, cat, kind: "docx", desc, sections, ...opts });

export const TOOLKIT = [
  // ── Employee data & analysis (HR Excel tools) ──
  X("emp-demographics", "Employee Demographics", "excel", "Age band, gender, location, department and tenure for every employee, with a summary block.",
    [["Employee code", 14], ["Name", 24], ["Gender", 10], ["Age", 8, "num"], ["Age band", 12, "formula:IF(D{r}=\"\",\"\",IF(D{r}<25,\"<25\",IF(D{r}<35,\"25–34\",IF(D{r}<45,\"35–44\",\"45+\"))))"], ["Department", 16], ["City", 14], ["Tenure (yrs)", 12, "num"]],
    { live: (d) => active(d).map((e) => [e.employee_code, e.full_name, e.gender, age(e.date_of_birth), null, e.department, e.city, tenure(e.date_of_joining)]), summary: [["Headcount", "COUNTA(A2:A{last})"], ["Average age", "ROUND(AVERAGE(D2:D{last}),1)"], ["Average tenure", "ROUND(AVERAGE(H2:H{last}),1)"]] }),
  X("emp-master", "Employee Master Data", "excel", "One row per employee: identity, job, manager, dates, statutory IDs and bank — the master record HR keeps.",
    [["Employee code", 14], ["Full name", 24], ["Department", 16], ["Designation", 26], ["Reporting manager", 22], ["Grade", 8], ["Employment type", 14], ["Date of joining", 13, "date"], ["Date of birth", 13, "date"], ["Gender", 9], ["Official email", 28], ["Mobile", 14], ["City", 14], ["PAN", 12], ["UAN", 14], ["Bank", 16], ["IFSC", 13], ["Monthly gross", 14, "money"], ["Status", 10]],
    { live: (d) => d.employees.filter((e) => e.status !== "rejected").map((e) => [e.employee_code, e.full_name, e.department, e.designation, mgr(d, e.reporting_manager), e.grade_code, e.employment_type, e.date_of_joining, e.date_of_birth, e.gender, e.email, e.phone, e.city, e.pan, e.uan, e.bank_name, e.bank_ifsc, e.monthly_gross, e.status]), totals: true }),
  X("emp-profile", "Employee Profile", "templates", "A one-employee profile sheet: personal, job, contact, emergency and statutory details.",
    [["Field", 28], ["Value", 40], ["Verified by HR (Y/N)", 18]], { rows: [["Employee code"], ["Full name"], ["Designation"], ["Department"], ["Reporting manager"], ["Date of joining"], ["Date of birth"], ["Gender"], ["Blood group"], ["Official email"], ["Personal mobile"], ["Current address"], ["Permanent address"], ["Emergency contact name"], ["Emergency contact phone"], ["PAN"], ["Aadhaar (masked)"], ["UAN"], ["ESIC IP number"], ["Bank name"], ["Account number"], ["IFSC"]] }),
  X("hr-updates", "HR Updates", "reports", "Monthly HR update log — joiners, exits, promotions, transfers and policy changes with owner and status.",
    [["Date", 12, "date"], ["Type (joiner / exit / promotion / transfer / policy)", 34], ["Employee / policy", 26], ["Details", 40], ["Owner", 16], ["Status", 12]],
    { live: (d) => [...d.employees.filter((e) => (Date.now() - new Date(e.date_of_joining)) / 86400000 <= 60).map((e) => [e.date_of_joining, "Joiner", e.full_name, `${e.designation}, ${e.department}`, "HR", "Done"]), ...d.employees.filter((e) => e.status === "exited").map((e) => [e.last_working_day || "", "Exit", e.full_name, e.designation, "HR", "Done"])] }),
  X("recruitment-analysis", "Recruitment Analysis", "reports", "Funnel by requisition: applicants, screened, interviewed, offered, joined and conversion %.",
    [["Requisition", 18], ["Role", 24], ["Department", 16], ["Applicants", 11, "num"], ["Screened", 10, "num"], ["Interviewed", 11, "num"], ["Offered", 9, "num"], ["Joined", 8, "num"], ["Offer → join %", 13, "formula:IF(G{r}=0,\"\",H{r}/G{r})"], ["Applicant → join %", 15, "formula:IF(D{r}=0,\"\",H{r}/D{r})"], ["Days to fill", 11, "num"]],
    { totals: true, pct: ["I", "J"], example: [["REQ-001", "Software Engineer", "Engineering", 120, 48, 14, 3, 2, null, null, 38], ["REQ-002", "Sales Executive", "Sales", 80, 30, 10, 4, 3, null, null, 26]] }),
  X("emp-operations", "Employee Operations Data", "excel", "Attendance, overtime, leave and productivity per employee per month.",
    [["Month", 10], ["Employee code", 14], ["Name", 24], ["Working days", 12, "num"], ["Present days", 12, "num"], ["Leave days", 11, "num"], ["LOP days", 9, "num"], ["Overtime hrs", 12, "num"], ["Attendance %", 12, "formula:IF(D{r}=0,\"\",E{r}/D{r})"]],
    { pct: ["I"], live: (d) => active(d).map((e) => [new Date().toLocaleDateString("en-IN", { month: "short", year: "numeric" }), e.employee_code, e.full_name, 22, "", "", "", "", null]) }),
  X("emp-recruitment-data", "Employee Recruitment Data", "excel", "Source, recruiter, cost and time to hire for every hire.",
    [["Employee code", 14], ["Name", 24], ["Department", 16], ["Date of joining", 13, "date"], ["Source / method", 18], ["Recruiter", 16], ["Recruitment cost", 15, "money"], ["Days to hire", 12, "num"]],
    { totals: true, live: (d) => active(d).map((e) => [e.employee_code, e.full_name, e.department, e.date_of_joining, e.method_of_recruitment || "", "", Number(e.recruitment_cost) || 0, ""]) }),
  X("operations-analysis", "Operations Analysis", "reports", "Department KPIs month by month: headcount, attrition, absenteeism, overtime and cost.",
    [["Department", 18], ["Headcount", 11, "num"], ["Exits (month)", 12, "num"], ["Attrition %", 11, "formula:IF(B{r}=0,\"\",C{r}/B{r})"], ["Absent days", 11, "num"], ["Overtime hrs", 12, "num"], ["Payroll cost", 14, "money"], ["Cost / head", 13, "formula:IF(B{r}=0,\"\",G{r}/B{r})"]],
    { pct: ["D"], totals: true, live: (d) => Object.entries(active(d).reduce((m, e) => ({ ...m, [e.department]: [...(m[e.department] || []), e] }), {})).map(([k, l]) => [k, l.length, 0, null, 0, 0, l.reduce((s, e) => s + (Number(e.monthly_gross) || 0), 0), null]) }),
  X("payroll-analysis", "Payroll Analysis", "reports", "Gross, deductions and net by employee with department totals and the cost-to-company.",
    [["Employee code", 14], ["Name", 24], ["Department", 16], ["Monthly gross", 14, "money"], ["PF (12% of basic)", 15, "formula:ROUND(D{r}*0.5*0.12,0)"], ["PT", 8, "money"], ["TDS", 10, "money"], ["Net pay", 13, "formula:D{r}-E{r}-F{r}-G{r}"], ["Employer PF", 13, "formula:ROUND(D{r}*0.5*0.12,0)"], ["CTC / month", 13, "formula:D{r}+I{r}"]],
    { totals: true, live: (d) => active(d).map((e) => [e.employee_code, e.full_name, e.department, Number(e.monthly_gross) || 0, null, 200, 0, null, null, null]) }),
  X("headcount-analysis", "Headcount Analysis", "reports", "Headcount by department and worker type with opening, joiners, exits and closing.",
    [["Department", 18], ["Opening", 10, "num"], ["Joiners", 9, "num"], ["Exits", 8, "num"], ["Closing", 10, "formula:B{r}+C{r}-D{r}"], ["Permanent", 11, "num"], ["Contingent", 11, "num"], ["Attrition %", 11, "formula:IF((B{r}+E{r})=0,\"\",D{r}/((B{r}+E{r})/2))"]],
    { pct: ["H"], totals: true, live: (d) => Object.entries(d.employees.filter((e) => e.status !== "rejected").reduce((m, e) => ({ ...m, [e.department]: [...(m[e.department] || []), e] }), {})).map(([k, l]) => { const a = l.filter((e) => e.status === "active"); return [k, a.length, 0, l.filter((e) => e.status === "exited").length, null, a.filter((e) => !["contract", "freelance", "consultant", "agency", "intern", "temporary"].includes(e.worker_type)).length, a.filter((e) => ["contract", "freelance", "consultant", "agency", "intern", "temporary"].includes(e.worker_type)).length, null]; }) }),
  X("recruiting-plan", "Recruiting Plan", "templates", "Positions to hire this year: quarter, priority, budget, recruiter and status.",
    [["Role", 24], ["Department", 16], ["Positions", 10, "num"], ["Quarter", 9], ["Priority", 9], ["Budgeted CTC (per role)", 20, "money"], ["Total budget", 14, "formula:C{r}*F{r}"], ["Recruiter", 16], ["Hiring manager", 18], ["Status", 12]],
    { totals: true, example: [["Software Engineer", "Engineering", 4, "Q1", "High", 1200000, null, "", "", "Open"], ["Payroll Executive", "Finance", 1, "Q2", "Medium", 600000, null, "", "", "Planned"]] }),
  X("cost-per-hire", "Cost Per Hire Calculator", "excel", "SHRM-style cost per hire: internal + external recruiting costs ÷ hires, with a per-source breakdown.",
    [["Cost item", 34], ["Internal / external", 18], ["Amount (₹)", 14, "money"]],
    { rows: [["Recruiter salaries (share)", "Internal"], ["Employee referral bonuses", "Internal"], ["Interviewer time", "Internal"], ["Job board / portal fees", "External"], ["Agency fees", "External"], ["Background verification", "External"], ["Assessment tools", "External"], ["Travel & relocation for candidates", "External"], ["Employer branding / events", "External"]], totals: true, summary: [["Number of hires", "0"], ["Cost per hire (₹)", "IF(B{sumrow+1}=0,\"\",C{sumrow}/B{sumrow+1})"]] }),
  X("screening-tracker", "Candidate Screening Tracker", "templates", "Every candidate with source, screening score, interview rounds, decision and next step.",
    [["Candidate", 22], ["Role", 22], ["Source", 14], ["Applied on", 12, "date"], ["Experience (yrs)", 14, "num"], ["Screening score (/10)", 18, "num"], ["Round 1", 12], ["Round 2", 12], ["HR round", 12], ["Decision", 12], ["Next step", 24]],
    { live: (d) => (d.candidates || []).map((c) => [c.name || c.full_name, c.role || c.position || "", c.source || "", (c.applied_at || "").slice(0, 10), c.experience || "", c.score || "", "", "", "", c.stage || "", ""]) }),
  X("salary-template", "Salary Template", "excel", "Salary structure from CTC: basic, HRA, special allowance, employer PF and gratuity, monthly and annual.",
    [["Component", 26], ["Rule", 30], ["Monthly (₹)", 14, "money"], ["Annual (₹)", 14, "formula:C{r}*12"]],
    { rows: [["Monthly CTC (enter)", "Input — type your monthly CTC", 100000], ["Basic", "50% of CTC", "formula:ROUND(C2*0.5,0)"], ["HRA", "40% of basic (50% metro)", "formula:ROUND(C3*0.4,0)"], ["Employer PF", "12% of basic (cap ₹15,000)", "formula:ROUND(MIN(C3,15000)*0.12,0)"], ["Gratuity", "4.81% of basic", "formula:ROUND(C3*0.0481,0)"], ["Special allowance", "Balance", "formula:C2-C3-C4-C5-C6"], ["Gross salary", "Basic + HRA + Special", "formula:C3+C4+C7"], ["Employee PF", "12% of basic (cap ₹15,000)", "formula:ROUND(MIN(C3,15000)*0.12,0)"], ["Professional tax", "State slab", 200], ["Net take-home (before TDS)", "Gross − PF − PT", "formula:C8-C9-C10"]] }),
  // ── Budgets ──
  ...[["hr-budget", "Human Resource Budget", ["Salaries & wages", "Statutory contributions", "Benefits & insurance", "Recruitment", "Training", "Engagement & rewards", "HR technology", "Consultants & legal", "Travel", "Miscellaneous"]],
    ["training-budget", "HR Training Budget Template", ["Technical training", "Leadership programmes", "Compliance (POSH, safety)", "Certifications", "E-learning licences", "Trainer fees", "Venue & travel", "Materials"]],
    ["annual-budget", "HR Annual Budget Template", ["Headcount cost", "New hires", "Increments", "Bonus pool", "Benefits", "Training", "Engagement", "HR tools", "Contingency"]],
    ["dept-budget", "HR Department Budget Template", ["HR team salaries", "HR tools & subscriptions", "Recruitment campaigns", "Employer branding", "Employee events", "Audit & compliance", "Office & admin"]]].map(([id, name, items]) =>
    X(id, name, "excel", "Monthly budget vs actual by line item with full-year totals and variance.", [["Line item", 30], ...MONTHS.map((m) => [m, 10, "money"]), ["FY total", 14, "formula:SUM(B{r}:M{r})"], ["Actual to date", 14, "money"], ["Variance", 12, "formula:N{r}-O{r}"]], { rows: items.map((i) => [i]), totals: true })),
  X("balance-sheet", "Balance Sheet Template", "excel", "Simple balance sheet: assets, liabilities and equity with a check that both sides match.",
    [["Item", 34], ["Group", 18], ["Amount (₹)", 16, "money"]],
    { rows: [["Cash & bank", "Current assets"], ["Accounts receivable", "Current assets"], ["Prepaid expenses", "Current assets"], ["Fixed assets (net)", "Non-current assets"], ["Accounts payable", "Current liabilities"], ["Salaries payable", "Current liabilities"], ["Statutory dues (PF, ESI, TDS)", "Current liabilities"], ["Gratuity provision", "Non-current liabilities"], ["Share capital", "Equity"], ["Retained earnings", "Equity"]], summary: [["Total assets", "SUMIF(B2:B{last},\"*assets\",C2:C{last})"], ["Total liabilities + equity", "SUMIF(B2:B{last},\"*liabilities\",C2:C{last})+SUMIF(B2:B{last},\"Equity\",C2:C{last})"], ["Balanced?", "IF(B{s1}=B{s2},\"Yes\",\"Check\")"]] }),
  X("gantt", "HR Implementation Plan Gantt Chart", "excel", "Plan an HR rollout week by week: the ■ cells fill in automatically from the start and end dates.",
    [["Task", 30], ["Owner", 14], ["Start", 12, "date"], ["End", 12, "date"], ["Days", 7, "formula:IF(OR(C{r}=\"\",D{r}=\"\"),\"\",D{r}-C{r}+1)"], ...Array.from({ length: 12 }, (_, i) => [`W${i + 1}`, 5, `formula:IF(AND(C{r}<>"",C{r}<=$C$2+${i * 7 + 6},D{r}>=$C$2+${i * 7}),"■","")`])],
    { rows: [["Requirement sign-off", "HR head", today(), today()], ["Policy drafting"], ["System configuration"], ["Data migration"], ["Pilot with one team"], ["Training managers"], ["Go-live"], ["Hypercare & feedback"]] }),
  X("emp-database", "Employee Database", "excel", "A filterable employee directory with status, manager, contact and location.",
    [["Employee code", 14], ["Name", 24], ["Department", 16], ["Designation", 26], ["Manager", 20], ["Email", 28], ["Phone", 14], ["City", 14], ["Joined", 12, "date"], ["Status", 10]],
    { live: (d) => d.employees.filter((e) => e.status !== "rejected").map((e) => [e.employee_code, e.full_name, e.department, e.designation, mgr(d, e.reporting_manager), e.email, e.phone, e.city, e.date_of_joining, e.status]) }),
  X("training-plan", "Employee Training Plan", "templates", "Training need, programme, dates, hours, cost, status and effectiveness score per employee.",
    [["Employee", 22], ["Department", 16], ["Training need", 24], ["Programme", 24], ["Mode", 12], ["Start", 12, "date"], ["End", 12, "date"], ["Hours", 8, "num"], ["Cost (₹)", 12, "money"], ["Status", 12], ["Effectiveness (/5)", 15, "num"]],
    { totals: true, live: (d) => active(d).slice(0, 25).map((e) => [e.full_name, e.department, "", "", "", "", "", "", "", "Planned", ""]) }),
  X("skills-matrix", "Skills Matrix Template", "excel", "People × skills grid rated 0–4 with a gap count and team average per skill.",
    [["Employee", 22], ["Department", 16], ["Communication", 13, "num"], ["Domain knowledge", 15, "num"], ["Tools / tech", 12, "num"], ["Problem solving", 14, "num"], ["Leadership", 11, "num"], ["Compliance", 11, "num"], ["Average", 9, "formula:ROUND(AVERAGE(C{r}:H{r}),1)"], ["Skills below 2", 13, "formula:COUNTIF(C{r}:H{r},\"<2\")"]],
    { live: (d) => active(d).map((e) => [e.full_name, e.department, "", "", "", "", "", "", null, null]) }),
  X("pay-stub", "Pay Stub", "excel", "A printable pay stub with earnings, deductions, net pay and year-to-date columns.",
    [["Earnings / deductions", 30], ["Type", 12], ["This month (₹)", 16, "money"], ["Year to date (₹)", 16, "money"]],
    { rows: [["Basic", "Earning"], ["HRA", "Earning"], ["Special allowance", "Earning"], ["Overtime", "Earning"], ["Bonus / incentive", "Earning"], ["Employee PF", "Deduction"], ["Employee ESI", "Deduction"], ["Professional tax", "Deduction"], ["Income tax (TDS)", "Deduction"], ["Loan / advance recovery", "Deduction"]], summary: [["Gross earnings", "SUMIF(B2:B{last},\"Earning\",C2:C{last})"], ["Total deductions", "SUMIF(B2:B{last},\"Deduction\",C2:C{last})"], ["Net pay", "B{s1}-B{s2}"]] }),
  X("leave-tracker", "Employee Leave Tracker", "excel", "Opening balance, accrued, taken and closing balance per leave type for every employee.",
    [["Employee code", 14], ["Name", 24], ["Leave type", 14], ["Opening", 10, "num"], ["Accrued", 10, "num"], ["Taken", 9, "num"], ["Closing", 10, "formula:D{r}+E{r}-F{r}"], ["LOP days", 10, "num"]],
    { live: (d) => active(d).flatMap((e) => (d.leaveTypes || []).slice(0, 3).map((t) => [e.employee_code, e.full_name, t.code, t.annual || t.quota || 0, 0, d.requests.filter((r) => r.type === "leave" && r.status === "Approved" && r.employee_code === e.employee_code && r.leave_type === t.code).reduce((s, r) => s + (r.days || 0), 0), null, 0])) }),
  X("schedule", "Employee Schedule Template", "templates", "Weekly roster: shift per person per day with hours and a weekly total.",
    [["Employee", 22], ["Mon", 12], ["Tue", 12], ["Wed", 12], ["Thu", 12], ["Fri", 12], ["Sat", 12], ["Sun", 12], ["Hours / week", 13, "num"]],
    { live: (d) => active(d).map((e) => [e.full_name, e.shift || "General 9–6", e.shift || "General 9–6", e.shift || "General 9–6", e.shift || "General 9–6", e.shift || "General 9–6", "Off", "Off", 45]) }),
  X("payroll-check", "Payroll Check", "excel", "Pre-payroll checks: this month vs last month gross, variance % and a flag for anything above 10%.",
    [["Employee code", 14], ["Name", 24], ["Last month gross", 16, "money"], ["This month gross", 16, "money"], ["Variance", 12, "formula:D{r}-C{r}"], ["Variance %", 11, "formula:IF(C{r}=0,\"\",E{r}/C{r})"], ["Flag", 10, "formula:IF(F{r}=\"\",\"New\",IF(ABS(F{r})>0.1,\"Check\",\"OK\"))"], ["Reason / note", 30]],
    { pct: ["F"], totals: true, live: (d) => active(d).map((e) => [e.employee_code, e.full_name, Number(e.monthly_gross) || 0, Number(e.monthly_gross) || 0, null, null, null, ""]) }),
  X("recruitment-tracker", "Recruitment Tracker", "templates", "Every open position with candidates in each stage, target date and owner.",
    [["Position", 24], ["Department", 16], ["Openings", 10, "num"], ["Sourced", 9, "num"], ["Screened", 9, "num"], ["Interview", 10, "num"], ["Offer", 8, "num"], ["Joined", 8, "num"], ["Target date", 12, "date"], ["Recruiter", 16], ["Status", 12]], { totals: true }),
  X("hr-kpis", "HR KPIs Dashboard", "bonus", "The 15 core HR KPIs with formula, target, actual and RAG status.",
    [["KPI", 32], ["Formula", 40], ["Target", 10, "num"], ["Actual", 10, "num"], ["Status", 10, "formula:IF(D{r}=\"\",\"\",IF(D{r}>=C{r},\"On track\",\"Below\"))"]],
    { rows: [["Headcount growth %", "(Closing − Opening) ÷ Opening"], ["Attrition % (annualised)", "Exits ÷ average headcount × 12"], ["Voluntary attrition %", "Resignations ÷ average headcount"], ["Time to fill (days)", "Offer accepted − requisition approved"], ["Cost per hire (₹)", "Recruiting cost ÷ hires"], ["Offer acceptance %", "Accepted ÷ offers made"], ["Absenteeism %", "Unplanned absent days ÷ working days"], ["Overtime hours / head", "Overtime ÷ headcount"], ["Training hours / head", "Training hours ÷ headcount"], ["Revenue per employee", "Revenue ÷ headcount"], ["Payroll cost % of revenue", "Payroll ÷ revenue"], ["eNPS", "% promoters − % detractors"], ["Internal mobility %", "Internal moves ÷ headcount"], ["Statutory filings on time %", "On-time filings ÷ filings due"], ["Payroll accuracy %", "Error-free payslips ÷ payslips"]] }),
  X("hr-audit-checklist", "HR Audit Checklist", "bonus", "120-point style HR audit grouped by area, with owner, evidence and status.",
    [["Area", 18], ["Check", 50], ["Owner", 14], ["Evidence", 22], ["Status (Yes / No / NA)", 18]],
    { rows: [["Records", "Personnel file exists for every employee"], ["Records", "Appointment letters signed and filed"], ["Records", "KYC (PAN, Aadhaar, bank) verified"], ["Statutory", "PF registration and monthly ECR filed"], ["Statutory", "ESI contributions paid by the 15th"], ["Statutory", "PT and LWF deposited (state-wise)"], ["Statutory", "TDS deposited and Form 24Q filed quarterly"], ["Statutory", "Form 16 issued by 15 June"], ["Statutory", "Gratuity provision and register maintained"], ["Statutory", "Bonus paid and register maintained"], ["Policies", "Leave policy published and acknowledged"], ["Policies", "POSH policy, Internal Committee and annual report"], ["Policies", "Code of conduct acknowledged by all"], ["Payroll", "Payroll reconciled with bank file"], ["Payroll", "Full & final settled within 2 working days of exit (Code on Wages)"], ["Attendance", "Attendance, overtime and leave registers maintained"], ["Safety", "Fire safety, first aid and emergency contacts displayed"], ["Data", "Access to HR data is role-based and audited"]] }),
  X("training-plan-templates", "Training Plan Templates", "bonus", "Annual training calendar by programme with audience, month, mode, owner and budget.",
    [["Programme", 28], ["Audience", 20], ...MONTHS.map((m) => [m, 6]), ["Mode", 12], ["Owner", 14], ["Budget (₹)", 13, "money"]],
    { rows: [["Induction & culture"], ["POSH awareness"], ["Fire & safety drill"], ["Manager essentials"], ["Technical upskilling"], ["Customer service"], ["Data privacy & security"]], totals: true }),
  X("perf-review-toolkit-sheet", "Performance Review Toolkit (scoring sheet)", "bonus", "Weighted goal + competency scoring with final rating and band.",
    [["Employee", 22], ["Goal score (/5)", 14, "num"], ["Goal weight", 11, "pct"], ["Competency score (/5)", 18, "num"], ["Competency weight", 16, "pct"], ["Final score", 11, "formula:ROUND(B{r}*C{r}+D{r}*E{r},2)"], ["Band", 18, "formula:IF(F{r}=\"\",\"\",IF(F{r}>=4.5,\"Outstanding\",IF(F{r}>=3.5,\"Exceeds\",IF(F{r}>=2.5,\"Meets\",\"Needs improvement\"))))"]],
    { live: (d) => active(d).map((e) => [e.full_name, "", 0.7, "", 0.3, null, null]) }),

  // ── Policies, SOPs, forms, checklists, letters, bonus documents (Word) ──
  W("policy-manual", "Employee Policy Manual", "policies", "Company policies in one handbook: conduct, attendance, leave, pay, benefits, IT, POSH, grievance and exit.", [
    ["1. About this manual", ["This manual applies to every employee, contract and fixed-term worker of {Company}. Where a law gives a better benefit, the law applies.", "Policies are reviewed every year by HR and approved by management. The latest version is in EZY HR → Documents."]],
    ["2. Code of conduct", ["Act with honesty, respect and fairness. Avoid conflicts of interest and declare gifts above ₹2,000.", "Protect company and customer information; follow the IT acceptable-use policy."]],
    ["3. Working hours & attendance", ["Standard week: 5 days, 9 hours a day including a 1-hour break. Shifts follow the published roster.", "Mark attendance by biometric, GPS + selfie or web punch. Late arrival after the grace time is counted; 3 lates in a month = half-day leave.", "Missed punches must be regularised within 3 working days."]],
    ["4. Leave", ["Earned leave 18 days, casual leave 8 days, sick leave 8 days a year, credited monthly. Maternity 26 weeks, paternity 5 days.", "When the balance is exhausted, further absence is loss of pay (LOP).", "If your reporting manager is away, the request goes to the next manager up (or HR) automatically."]],
    ["5. Pay & benefits", ["Salary is paid by the last working day of the month by bank transfer. Payslips are in EZY HR.", "Statutory benefits: PF, ESI (where applicable), gratuity after 5 years, bonus as per the Payment of Bonus Act.", "Salary advance and loans follow the loan policy; EMIs are recovered through payroll."]],
    ["6. Prevention of sexual harassment (POSH)", ["{Company} has zero tolerance for sexual harassment. Complaints go to the Internal Committee within 3 months of the incident.", "The committee completes the inquiry within 90 days; confidentiality is protected."]],
    ["7. Grievances", ["Raise grievances with your manager or HR support in EZY HR. HR responds within 1 working hour and resolves within the published TAT."]],
    ["8. Resignation & exit", ["Notice period is as per the appointment letter. Exit follows: clearance → notice → exit interview → full & final settlement within 2 working days of the last day."]],
  ]),
  W("hr-policy-guide", "HR Policy Guide", "bonus", "How to write, approve, roll out and review HR policies — with a ready list of the policies every company needs.", [
    ["Policy lifecycle", ["Draft → legal / compliance review → management approval → publish → employee acknowledgement → yearly review."]],
    ["Policies every company needs", ["Code of conduct · Attendance & working hours · Leave · Holidays · Pay & payroll · Travel & expenses · IT acceptable use · Data privacy · POSH · Grievance · Disciplinary · Performance · Learning · Remote work · Exit & F&F · Whistle-blower."]],
    ["Writing tips", ["Use plain language and examples. State who it applies to, the rule, exceptions, who approves, and what happens on breach."]],
  ]),
  W("leave-form", "Leave Application Form", "forms", "Printable leave application with balance check and manager / HR approval blocks.", [
    ["Employee details", ["Name: ____________________   Employee code: __________   Department: ______________"]],
    ["Leave requested", ["Leave type: ☐ Earned  ☐ Casual  ☐ Sick  ☐ Maternity / Paternity  ☐ Loss of pay", "From: ___/___/______   To: ___/___/______   Number of days: ____", "Reason: _____________________________________________", "Contact during leave: ______________"]],
    ["Balance check (HR)", ["Balance before: ____   Days applied: ____   Balance after: ____   LOP days (if balance exhausted): ____"]],
    ["Approvals", ["Reporting manager (or next-level manager if absent): __________  Date: ______", "HR: __________  Date: ______"]],
  ]),
  W("perf-review-form", "Performance Review Form", "forms", "Self, manager and calibrated ratings on goals and competencies with development plan.", [
    ["Review period & details", ["Employee: __________  Manager: __________  Period: __________"]],
    ["Goals (Management by objectives)", ["Goal 1: __________  Weight: ___%  Self rating (1–5): ___  Manager rating: ___", "Goal 2: __________  Weight: ___%  Self rating: ___  Manager rating: ___", "Goal 3: __________  Weight: ___%  Self rating: ___  Manager rating: ___"]],
    ["Competencies (behaviourally anchored)", ["Communication · Ownership · Collaboration · Customer focus · Problem solving — rate 1 (needs improvement) to 5 (role model) with an example for each."]],
    ["360° feedback summary", ["Peers: __________  Direct reports: __________  Internal customers: __________"]],
    ["Development plan", ["Strengths: __________  Areas to improve: __________  Training / support: __________  Review date: ______"]],
    ["Sign-off", ["Employee: ______  Manager: ______  HR: ______"]],
  ]),
  W("interview-bank", "Interview Question Bank", "bonus", "Structured questions by competency with what a good answer looks like.", [
    ["Problem solving", ["Tell me about a difficult problem you solved. What options did you consider? — Look for: structured thinking, data, trade-offs."]],
    ["Ownership", ["Describe a time you took responsibility for a mistake. — Look for: accountability, learning, fix."]],
    ["Teamwork", ["Give an example of disagreeing with a teammate. — Look for: respect, listening, outcome."]],
    ["Customer focus", ["How did you handle an unhappy customer? — Look for: empathy, resolution, follow-up."]],
    ["Leadership (managers)", ["How do you set goals for your team and review progress? — Look for: clarity, cadence, coaching."]],
    ["HR interview tips", ["Ask the same core questions to every candidate, score each answer 1–5 right after the interview, and avoid questions on age, marital status, religion or pregnancy."]],
  ]),
  W("engagement-toolkit", "Employee Engagement Toolkit", "bonus", "Pulse survey, recognition, 1:1s, celebrations and action planning — a 90-day engagement plan.", [
    ["Measure", ["Daily pulse in EZY HR (anonymous), quarterly eNPS and a yearly engagement survey."]],
    ["Recognise", ["Recognition against company values with points that turn into rewards; managers get a nudge when someone hasn't been recognised for 60 days."]],
    ["Connect", ["Monthly 1:1s with a simple agenda: wins, blockers, growth, wellbeing."]],
    ["Celebrate", ["Birthdays and work anniversaries on the home page; quarterly town halls."]],
    ["Act", ["Share survey results within 2 weeks, pick 3 actions, review progress every month."]],
  ]),
  W("compliance-guide", "HR Compliance Guide", "bonus", "Indian HR statutory compliance at a glance — registrations, due dates, registers and returns.", [
    ["Monthly", ["PF ECR and payment by the 15th · ESI by the 15th · PT as per state · TDS deposit by the 7th."]],
    ["Quarterly", ["TDS return Form 24Q (31 Jul, 31 Oct, 31 Jan, 31 May)."]],
    ["Half-yearly / annual", ["LWF (state-wise) · Form 16 by 15 June · Bonus by 8 months of year-end · POSH annual report · Shops & Establishment renewal · Factory annual return."]],
    ["Registers", ["Attendance, wages, leave, overtime, muster roll, Form 11, accident register, inspection book."]],
  ]),
  W("onboarding-exit", "Onboarding & Exit Process", "bonus", "Step-by-step onboarding (6 steps) and exit (4 steps) with owners.", [
    ["Onboarding — 1. Pre-joining", ["Collect documents · send joining instructions · prepare email ID, ID card and system access."]],
    ["2. Joining formalities", ["Verify documents · complete joining forms · collect employee details · issue appointment letter."]],
    ["3. HR orientation", ["Company policies · attendance & leave rules · salary structure & benefits · code of conduct."]],
    ["4. Department introduction", ["Introduce the team · explain job responsibilities · set expectations · meet the reporting manager."]],
    ["5. Training & support", ["Role-specific training · systems and processes · assign a buddy or mentor."]],
    ["6. Follow-up", ["Check progress at 30/60/90 days · take feedback · identify difficulties · support early adjustment."]],
    ["Exit — 1. Clearance", ["IT, admin, finance and manager clearance; asset return."]],
    ["2. Notice", ["Notice period served or bought out; handover plan."]],
    ["3. Exit interview", ["Structured interview; each reviewer's comments recorded individually."]],
    ["4. Full & final", ["Salary, leave encashment, gratuity, deductions; paid within 2 working days of the last day; relieving and experience letters issued."]],
  ]),
  W("perf-review-toolkit", "Performance Review Toolkit (guide)", "bonus", "Methods (rating scale, 360°, MBO, self-appraisal, BARS) and the 6-step appraisal process.", [
    ["Methods", ["Rating scale · 360° feedback · Management by objectives (MBO) · Self-appraisal · Behaviourally anchored rating scale (BARS)."]],
    ["Process", ["1. Set goals & expectations · 2. Collect performance data · 3. Evaluate performance · 4. Give feedback · 5. Create a development plan · 6. Follow-up & review."]],
    ["Role of HR", ["Design the policy and process · ensure fair and transparent evaluation · provide tools and forms · train managers · monitor the process · use results for promotions, rewards, training and succession."]],
  ]),
  ...[["sop-recruitment", "Recruitment SOP", ["Requisition approved by department head and finance", "Job description drafted (AI draft, HR edits for bias)", "Post internally (IJP) for 7 days, then externally", "Screen, interview with a scorecard, reference and background checks", "Offer approved and issued; candidate accepts", "Hand over to onboarding"]],
    ["sop-onboarding", "Onboarding SOP", ["Pre-joining checklist T-7 days", "Day-1 joining formalities and orientation", "IT access and assets issued", "Buddy assigned", "30/60/90-day check-ins", "Probation review"]],
    ["sop-payroll", "Payroll Processing SOP", ["Attendance and LOP freeze on the 25th", "Variable pay, reimbursements and recoveries uploaded", "Payroll pre-check (variance > 10% reviewed)", "Run 1 (regular) and Run 2 (off-cycle / arrears) approved by Finance", "Bank file, payslips released, statutory challans paid", "Journal posted to accounts"]],
    ["sop-exit", "Exit & F&F SOP", ["Resignation accepted, last working day agreed", "Clearance from IT, admin, finance, manager", "Notice period / buy-out", "Exit interview", "Full & final computed and paid within 2 working days", "Relieving and experience letters issued"]],
    ["sop-grievance", "Grievance Handling SOP", ["Employee raises a ticket in HR support", "HR acknowledges within 1 working hour", "Investigation and resolution within 7 days", "Escalation to HR head if unresolved", "Closure with employee feedback"]],
    ["sop-posh", "POSH Complaint SOP", ["Written complaint to the Internal Committee within 3 months", "Notice to the respondent within 7 days", "Inquiry completed within 90 days", "Report and recommendations within 10 days", "Action by employer within 60 days", "Annual report filed with the District Officer"]]].map(([id, name, steps]) => W(id, name, "sops", `${name.replace(" SOP", "")} — step-by-step standard operating procedure with owners.`, [["Purpose", [`Standard way to handle ${name.replace(" SOP", "").toLowerCase()} at {Company}.`]], ["Steps", steps.map((s2, i) => `${i + 1}. ${s2}`)], ["Owner & review", ["Owner: HR. Reviewed yearly."]]])),
  ...[["chk-onboarding", "Onboarding Checklist", ["Offer accepted and BGV started", "Email ID, laptop and access requested", "Appointment letter issued", "PF / ESI enrolment done", "Bank and PAN verified", "Policies acknowledged", "Buddy assigned", "30-day check-in booked"]],
    ["chk-exit", "Exit Clearance Checklist", ["Resignation accepted", "Handover plan agreed", "IT assets returned & access revoked", "Admin: ID card, keys", "Finance: advances / loans settled", "Exit interview done", "F&F paid", "Relieving & experience letters issued"]],
    ["chk-statutory", "Statutory Compliance Checklist", ["PF challan & ECR", "ESI challan", "Professional tax", "Labour welfare fund", "TDS deposit & 24Q", "Minimum wages revision", "Bonus register", "Gratuity register", "Maternity benefit", "Shops & Establishment renewal", "CLRA licence", "Factory licence & annual return", "POSH annual report", "Statutory registers up to date"]]].map(([id, name, items]) => W(id, name, "checklists", `${name} — tick-box list with owner and date.`, [["Checklist", items.map((i) => `☐  ${i}   Owner: ______  Date: ______`)]])),
  ...[["ltr-appointment", "Appointment Letter", "We are pleased to appoint you as {Designation} in {Department} with effect from {Date of joining}. Your annual CTC is {CTC}. You will be on probation for 6 months. The terms in the annexure and company policies apply."],
    ["ltr-designation", "Designation Change Letter", "With effect from {Effective date}, your designation changes from {Old designation} to {New designation}. All other terms of employment remain unchanged."],
    ["ltr-relieving", "Relieving Letter", "This is to confirm that {Employee name} ({Employee code}) has been relieved from the services of {Company} at the close of business on {Last working day}, after completing the exit formalities."],
    ["ltr-experience", "Experience Letter", "This is to certify that {Employee name} worked with {Company} as {Designation} from {Date of joining} to {Last working day}. We found them sincere and hard-working and wish them success."],
    ["ltr-resignation", "Resignation Acceptance Letter", "We acknowledge your resignation dated {Resignation date}. Your last working day will be {Last working day}. Please complete the clearance, notice and exit-interview steps; your full & final settlement will follow."],
    ["ltr-warning", "Warning Letter", "This letter is a formal warning regarding {Issue}. Please note that repetition may lead to further disciplinary action as per the company policy."]].map(([id, name, body]) => W(id, name, "letters", `${name} — ready to fill (placeholders in braces).`, [["", ["Date: {Date}", "To: {Employee name}, {Employee code}", `Subject: ${name}`, "Dear {Employee name},", body, "Regards,", "HR, {Company}"]]])),
];

/** Build and download a template. `fill` = use this company's data where the template supports it. */
export async function downloadTemplate(t, data, { fill = false, company = "Your company" } = {}) {
  if (t.kind === "xlsx") return downloadXlsx(t, data, fill);
  return downloadDocx(t, company);
}

function save(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 400);
}
const colL = (i) => { let s = ""; let n = i + 1; while (n) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

async function downloadXlsx(t, data, fill) {
  const m = await import("exceljs");
  const ExcelJS = m.default || m;
  const wb = new ExcelJS.Workbook();
  wb.creator = "EZY HR · HR toolkit";
  const ws = wb.addWorksheet(t.name.slice(0, 30));
  ws.columns = t.cols.map(([h, w]) => ({ header: h, width: w || 14 }));
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.alignment = { vertical: "middle", wrapText: true };
  head.height = 30;
  head.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF15414F" } }; });
  ws.views = [{ state: "frozen", ySplit: 1 }];
  let rows = (fill && t.live ? t.live(data) : t.example || t.rows || []).map((r) => [...r]);
  if (!rows.length) rows = Array.from({ length: 15 }, () => []);
  rows.forEach((r, ri) => {
    const rn = ri + 2;
    const vals = t.cols.map(([, , type], ci) => {
      const v = r[ci];
      if (typeof v === "string" && v.startsWith("formula:")) return { formula: v.slice(8).replace(/\{r\}/g, rn) };
      if (type && type.startsWith("formula:") && (v === null || v === undefined)) return { formula: type.slice(8).replace(/\{r\}/g, rn) };
      return v ?? null;
    });
    ws.addRow(vals);
  });
  const last = rows.length + 1;
  t.cols.forEach(([, , type], ci) => {
    const col = ws.getColumn(ci + 1);
    if (type === "money") col.numFmt = "#,##0";
    if (type === "date") col.numFmt = "dd-mmm-yyyy";
    if (type === "pct" || (t.pct || []).includes(colL(ci))) col.numFmt = "0%";
  });
  // date strings → dates
  t.cols.forEach(([, , type], ci) => { if (type === "date") for (let r = 2; r <= last; r += 1) { const c = ws.getCell(r, ci + 1); if (typeof c.value === "string" && /^\d{4}-\d{2}-\d{2}/.test(c.value)) { const [y, m, dd] = c.value.slice(0, 10).split("-").map(Number); c.value = new Date(Date.UTC(y, m - 1, dd)); } } });
  let sumrow = null;
  if (t.totals) {
    sumrow = last + 1;
    const vals = t.cols.map(([h, , type], ci) => (ci === 0 ? "Total" : ["money", "num"].includes(type) || (type && type.startsWith("formula:") && /[-+*]|SUM/.test(type) && !/IF\(/.test(type)) ? { formula: `SUM(${colL(ci)}2:${colL(ci)}${last})` } : null));
    const r = ws.addRow(vals);
    r.font = { bold: true };
    r.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6F6EE" } }; });
  }
  if (t.summary) {
    ws.addRow([]);
    const base = ws.rowCount + 1;
    t.summary.forEach(([label, f], i) => {
      const formula = f.replace(/\{last\}/g, last).replace(/\{sumrow\}/g, sumrow || last).replace(/\{sumrow\+1\}/g, (sumrow || last) + 2).replace(/\{s1\}/g, base).replace(/\{s2\}/g, base + 1);
      const r = ws.addRow([label, /^[A-Z(]/.test(f) ? { formula } : Number(f)]);
      r.getCell(1).font = { bold: true };
      r.getCell(2).numFmt = "#,##0.##";
      if (i === 0 && /Number of hires/.test(label)) r.getCell(2).value = 0;
    });
  }
  const guide = wb.addWorksheet("How to use");
  guide.getColumn(1).width = 110;
  [t.name, t.desc, "", "Navy header = column names. Grey formulas fill in automatically; type only in the empty cells.", fill && t.live ? "This copy is pre-filled with your company's data from EZY HR on " + today() + "." : "This copy is blank — fill it in or use 'Fill with my data' in EZY HR.", "Generated by EZY HR · HR toolkit."].forEach((l, i) => { const r = guide.addRow([l]); if (i === 0) r.font = { bold: true, size: 14 }; });
  const buf = await wb.xlsx.writeBuffer();
  save(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${t.name.replace(/[^\w]+/g, "_")}.xlsx`);
}

async function downloadDocx(t, company) {
  const d = await import("docx");
  const { Document, Packer, Paragraph, HeadingLevel, TextRun, AlignmentType } = d;
  const fix = (s) => s.replace(/\{Company\}/g, company);
  const children = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: t.name, bold: true })] }),
    new Paragraph({ children: [new TextRun({ text: `${company} · ${fix(t.desc)}`, italics: true, color: "5B6B70" })] }),
    new Paragraph({ text: "" }),
  ];
  t.sections.forEach(([h, paras]) => {
    if (h) children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 80 }, children: [new TextRun({ text: h, bold: true, color: "15414F" })] }));
    paras.forEach((p) => children.push(new Paragraph({ spacing: { after: 120 }, alignment: AlignmentType.LEFT, children: [new TextRun({ text: fix(p), size: 22 })] })));
  });
  children.push(new Paragraph({ text: "" }), new Paragraph({ children: [new TextRun({ text: `Generated by EZY HR · HR toolkit · ${today()}`, size: 16, color: "8A979C" })] }));
  const doc = new Document({ creator: "EZY HR", title: t.name, styles: { default: { document: { run: { font: "Calibri" } } } }, sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  save(blob, `${t.name.replace(/[^\w]+/g, "_")}.docx`);
}
