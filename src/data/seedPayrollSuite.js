// Seed for the payroll suite (v8.6): pay groups, salary components, pay bands, city cost index,
// perquisite rules, salary revisions, the increment cycle, flexible-benefit plans, component claims,
// perquisites, the loan ledger and salary TDS certificate status.
import { COUNTRIES } from "../lib/payroll/index.js";
import { GRADE_MID } from "../lib/hrcalc.js";
import { isoDate, DAY } from "../lib/utils.js";

const dIso = (n) => isoDate(Date.now() + n * DAY);
const firstOfMonth = (offsetMonths) => {
  const d = new Date();
  const x = new Date(d.getFullYear(), d.getMonth() + offsetMonths, 1);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-01`;
};
const at = (n) => new Date(Date.now() - n * DAY).toISOString();

export function buildPayrollSuiteSeed(employees) {
  const countries = [...new Set(employees.map((e) => e.country_code || "IN"))];
  const payGroups = countries.map((c) => ({
    id: `PG-${c}`,
    name: c === "IN" ? "ONAS India pay group" : `${COUNTRIES[c]?.name || c} pay group`,
    country: c,
    currency: COUNTRIES[c]?.currency || "INR",
    frequency: "Monthly",
    cutoff_day: 25,
    pay_day: c === "IN" ? 1 : c === "US" ? 15 : 28,
    attendance_cycle: "1st – last day of month",
    approver: "ADM02",
    status: "active",
  }));

  const components = [
    ["BASIC", "Basic", "earning", "50% of gross", true, "fixed"],
    ["HRA", "House rent allowance", "earning", "40% of basic", true, "fixed"],
    ["SPL", "Special allowance", "earning", "Balancing figure", true, "fixed"],
    ["LTA", "Leave travel allowance", "fbp", "Claim against bills, twice in a block of 4 years", false, "claim"],
    ["FUEL", "Fuel & conveyance", "fbp", "Monthly claim against fuel bills", false, "claim"],
    ["TEL", "Telephone & internet", "fbp", "Monthly claim against bills", false, "claim"],
    ["BOOKS", "Books & periodicals", "fbp", "Claim against invoices", false, "claim"],
    ["MEAL", "Meal card", "fbp", "Loaded to the meal card monthly", false, "claim"],
    ["BONUS", "Performance bonus", "earning", "Variable, paid with the appraisal cycle", true, "variable"],
    ["OT", "Overtime", "earning", "2× ordinary rate for eligible grades", true, "variable"],
    ["ARR", "Arrears", "earning", "Back pay from a salary revision", true, "variable"],
    ["PF", "Provident fund (employee)", "deduction", "12% of PF wage, capped at ₹15,000", false, "statutory"],
    ["ESI", "ESI (employee)", "deduction", "0.75% when gross ≤ ₹21,000", false, "statutory"],
    ["PT", "Professional tax", "deduction", "By work state", false, "statutory"],
    ["TDS", "Income tax (TDS)", "deduction", "Projected annual tax ÷ 12", false, "statutory"],
    ["LOAN", "Salary loan EMI", "deduction", "From the loan ledger", false, "recovery"],
  ].map(([code, name, type, calc, taxable, kind]) => ({ code, name, type, calc, taxable, kind, on_payslip: true, active: true }));

  // India pay bands (monthly gross, INR) around the grade mid-points, with market percentiles.
  const bands = Object.fromEntries(
    Object.entries(GRADE_MID).map(([g, mid]) => [g, { min: Math.round(mid * 0.8), mid, max: Math.round(mid * 1.25), p25: Math.round(mid * 0.88), p50: Math.round(mid * 1.0), p75: Math.round(mid * 1.15) }]),
  );
  // Company cost-of-living index (Hyderabad = 100). Edit in Payroll admin.
  const cityIndex = [
    ["Hyderabad", "IN", 100], ["Bengaluru", "IN", 112], ["Mumbai", "IN", 124], ["Delhi NCR", "IN", 116], ["Pune", "IN", 104], ["Chennai", "IN", 99],
    ["London", "GB", 330], ["Austin", "US", 300], ["Dubai", "AE", 260], ["Singapore", "SG", 320], ["Windhoek", "NA", 130], ["Johannesburg", "ZA", 140],
    ["Nairobi", "KE", 125], ["Lagos", "NG", 135], ["Gaborone", "BW", 120], ["Toronto", "CA", 290], ["Mexico City", "MX", 150], ["São Paulo", "BR", 160],
    ["Berlin", "DE", 280], ["Paris", "FR", 300], ["Dublin", "IE", 310], ["Riyadh", "SA", 210], ["Kuala Lumpur", "MY", 150], ["Taguig", "PH", 120],
    ["Jakarta", "ID", 125], ["Accra", "GH", 130], ["Lusaka", "ZM", 115],
  ].map(([city, country, index]) => ({ city, country, index }));

  const paySettings = {
    payGroups,
    components,
    bands,
    cityIndex,
    perkRules: { car_small: 1800, car_large: 2400, driver: 900, accommodation_pct: 10, loan_exempt_upto: 200000, loan_benchmark_rate: 9, gift_exempt: 5000 },
    options: { arrears: true, lop_basis: "calendar", rounding: "nearest", lock_day: 28, fbp_carry_forward: false, claims_cutoff_day: 20, release_payslips_on_lock: true },
  };

  // Salary revisions. "applied" = already in the employee master; "approved" = waiting for the effective date
  // (upcoming) or past it and not yet processed (pending).
  const g = (code) => employees.find((e) => e.employee_code === code)?.monthly_gross || 0;
  const rev = (id, code, pct, effective, status, reason, extra = {}) => {
    const cur = g(code);
    const old_gross = status === "applied" ? Math.round(cur / (1 + pct / 100)) : cur;
    const new_gross = status === "applied" ? cur : Math.round(cur * (1 + pct / 100));
    return { id, employee_code: code, old_gross, new_gross, pct, effective, status, reason, created_at: at(40), by: "ADM02", ...extra };
  };
  const salaryRevisions = [
    rev("REV-001", "EMP004", 12, firstOfMonth(-7), "applied", "Annual appraisal", { applied_at: at(200) }),
    rev("REV-002", "EMP009", 10, firstOfMonth(-7), "applied", "Annual appraisal", { applied_at: at(200) }),
    rev("REV-003", "EMP003", 8, firstOfMonth(-7), "applied", "Annual appraisal", { applied_at: at(200) }),
    rev("REV-004", "EMP022", 15, firstOfMonth(-4), "applied", "Market correction", { applied_at: at(110) }),
    rev("REV-010", "EMP001", 14, firstOfMonth(-1), "approved", "Promotion to Software Engineer"),
    rev("REV-011", "EMP013", 9, firstOfMonth(-1), "approved", "Confirmation after probation"),
    rev("REV-012", "EMP023", 10, dIso(-3), "approved", "Market correction"),
    rev("REV-013", "EMP008", 7, dIso(-1), "approved", "Retention"),
    rev("REV-020", "EMP006", 8, firstOfMonth(1), "approved", "Annual appraisal"),
    rev("REV-021", "EMP015", 10, firstOfMonth(1), "approved", "Annual appraisal"),
    rev("REV-022", "EMP010", 12, firstOfMonth(2), "approved", "Confirmation after probation"),
    rev("REV-023", "EMP024", 9, firstOfMonth(2), "approved", "Annual appraisal"),
    rev("REV-024", "EMP032", 10, firstOfMonth(2), "approved", "Annual appraisal"),
    rev("REV-025", "EMP002", 7, firstOfMonth(3), "approved", "Annual appraisal"),
  ];

  const compCycle = {
    name: "Annual increment cycle · April",
    effective: (() => { const d = new Date(); const y = d.getMonth() >= 3 ? d.getFullYear() + 1 : d.getFullYear(); return `${y}-04-01`; })(),
    budget_pct: 8,
    guideline: { 5: 14, 4: 10, 3: 7, 2: 3, 1: 0 },
    min_tenure_months: 6,
    status: "Draft",
    proposals: {},
  };

  // Flexible benefit plan: annual entitlements declared by India staff.
  const fbp = {};
  employees.filter((e) => (e.country_code || "IN") === "IN").forEach((e, i) => {
    const big = (e.grade_code || "").startsWith("M") || e.grade_code === "P3";
    fbp[e.employee_code] = { LTA: big ? 60000 : 30000, FUEL: big ? 28800 : 19200, TEL: 12000, BOOKS: i % 3 === 0 ? 6000 : 0, MEAL: 26400 };
  });

  const claim = (id, code, component, amount, status, days, extra = {}) => ({ id, employee_code: code, component, amount, bill_date: dIso(-days - 2), bill: { name: `${component.toLowerCase()}-bill-${id.slice(-3)}.pdf` }, note: "", status, submitted_at: at(days), decided_by: status === "Pending" ? null : "ADM02", decided_at: status === "Pending" ? null : at(Math.max(0, days - 1)), ...extra });
  const curMonth = isoDate().slice(0, 7);
  const prevMonth = firstOfMonth(-1).slice(0, 7);
  const componentClaims = [
    claim("CLM-0101", "EMP001", "FUEL", 1600, "Pending", 2, { description: "Petrol bills, October" }),
    claim("CLM-0102", "EMP004", "TEL", 1180, "Pending", 3, { description: "ACT Fibernet, October" }),
    claim("CLM-0103", "EMP007", "LTA", 42000, "Pending", 5, { description: "Family trip to Kerala – flight tickets" }),
    claim("CLM-0104", "EMP009", "BOOKS", 2400, "Pending", 1, { description: "Snowflake and dbt books" }),
    claim("CLM-0095", "EMP002", "FUEL", 2400, "Approved", 9, { description: "Fuel, October", payroll_month: curMonth }),
    claim("CLM-0096", "EMP005", "TEL", 1500, "Approved", 8, { description: "Postpaid mobile", payroll_month: curMonth }),
    claim("CLM-0090", "EMP003", "FUEL", 2400, "Paid", 38, { description: "Fuel, September", payroll_month: prevMonth }),
    claim("CLM-0091", "EMP006", "TEL", 999, "Paid", 36, { description: "Broadband, September", payroll_month: prevMonth }),
    claim("CLM-0092", "EMP013", "LTA", 18000, "Rejected", 30, { description: "Weekend trip", note: "LTA covers travel on leave only; no leave was taken for these dates." }),
  ];

  const perks = [
    { id: "PRK-001", employee_code: "EMP005", type: "car", details: { engine: "above_1600", driver: true, usage: "mixed", vehicle: "Toyota Innova Crysta · TS09 EK 4412" }, from: dIso(-400), to: "", status: "active" },
    { id: "PRK-002", employee_code: "EMP007", type: "car", details: { engine: "upto_1600", driver: false, usage: "mixed", vehicle: "Honda City · TS08 HX 2210" }, from: dIso(-300), to: "", status: "active" },
    { id: "PRK-003", employee_code: "EMP024", type: "club", details: { monthly: 2500, name: "Hyderabad Golf Club" }, from: dIso(-200), to: "", status: "active" },
    { id: "PRK-004", employee_code: "EMP002", type: "gift", details: { annual: 12000, name: "Festive and long-service vouchers" }, from: dIso(-150), to: "", status: "active" },
    { id: "PRK-005", employee_code: "EMP009", type: "esop", details: { shares: 400, fmv: 310, exercise: 100, grant: "ESOP 2023 · tranche 2" }, from: dIso(-60), to: "", status: "active" },
  ];

  const loanLedger = {
    "LN-0008": { repayments: [{ month: firstOfMonth(-1).slice(0, 7), amount: 10000, mode: "manual", note: "Part-prepayment from bonus", at: at(25) }], paused_months: [] },
    "LN-0009": { repayments: [], paused_months: [firstOfMonth(-2).slice(0, 7)] },
  };

  // Salary TDS certificates. FY 2025-26 → Form 16 (already issued by 15 June 2026).
  const prevFy = (() => { const d = new Date(); const s = (d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1) - 1; return `${s}-${String((s + 1) % 100).padStart(2, "0")}`; })();
  const taxCerts = { [prevFy]: {} };
  employees.filter((e) => (e.country_code || "IN") === "IN" && e.status === "active").forEach((e, i) => {
    taxCerts[prevFy][e.employee_code] = i % 7 === 3 ? { status: "generated", generated_at: at(150) } : { status: "published", generated_at: at(150), published_at: at(148) };
  });

  return { paySettings, salaryRevisions, compCycle, fbp, componentClaims, perks, loanLedger, taxCerts };
}
