// Payroll suite helpers (v8.6): pay groups, salary at a point in time (with revisions), FY cost roll-ups,
// compa-ratio / market position, cost-of-living differentials, loans, perquisites and the India salary
// TDS certificate (Form 16 up to FY 2025-26, Form 130 from tax year 2026-27 under the Income-tax Act 2025).
import { COUNTRIES, computePay, periodContext, toEngineEmp } from "./payroll/index.js";
import { incomeTax } from "./payroll/in.js";
import { isoDate } from "./utils.js";

export const r0 = (n) => Math.round(Number(n) || 0);
export const curOf = (cc) => COUNTRIES[cc || "IN"]?.currency || "INR";
export const ctryOf = (e) => e.country_code || "IN";

// ── Money ────────────────────────────────────────────
export const fmtMoney = (n, cur = "INR") =>
  Number.isFinite(Number(n)) ? new Intl.NumberFormat("en-IN", { style: "currency", currency: cur, maximumFractionDigits: cur === "INR" ? 0 : 0 }).format(Number(n)) : "—";
export const toInr = (n, cur, fx) => (Number(n) || 0) * ((fx && fx[cur]) || 1);
// Compact Indian figure: ₹15.2 L, ₹1.4 Cr
export function compactInr(n) {
  const v = Math.abs(n);
  if (v >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (v >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

// ── Periods ──────────────────────────────────────────
export const monthOf = (d = isoDate()) => d.slice(0, 7);
export function addMonths(month, n) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
export const monthName = (month, style = "short") => new Date(`${month}-01T12:00:00`).toLocaleDateString("en-IN", { month: style, year: style === "short" ? "2-digit" : "numeric" });
/** India financial / tax year label for a date: "2026-27". */
export function fyOf(d = isoDate()) {
  const [y, m] = d.split("-").map(Number);
  const s = m >= 4 ? y : y - 1;
  return `${s}-${String((s + 1) % 100).padStart(2, "0")}`;
}
export const fyStart = (fy) => Number(fy.slice(0, 4));
export const fyMonths = (fy) => Array.from({ length: 12 }, (_, i) => addMonths(`${fyStart(fy)}-04`, i));
export const fyLabel = (fy) => `Financial Year ${fyStart(fy)} - ${fyStart(fy) + 1}`;
export function fyOptions(today = isoDate()) {
  const cur = fyOf(today);
  const s = fyStart(cur);
  return [s - 1, s, s + 1].map((y) => `${y}-${String((y + 1) % 100).padStart(2, "0")}`);
}

// ── Pay groups ───────────────────────────────────────
export const ALL_GROUPS = "ALL";
export function groupEmployees(employees, group) {
  const active = employees.filter((e) => e.status === "active");
  if (!group || group === ALL_GROUPS) return active;
  return active.filter((e) => ctryOf(e) === group.country);
}

// ── Salary at a point in time ────────────────────────
// The employee master holds today's gross. Applied revisions let us roll back to the gross before them;
// approved revisions not yet applied roll forward from their effective month.
export function grossAt(e, month, revisions = []) {
  const mine = revisions.filter((r) => r.employee_code === e.employee_code);
  let g = Number(e.monthly_gross) || 0;
  mine.filter((r) => r.status === "applied").sort((a, b) => (a.effective < b.effective ? 1 : -1)).forEach((r) => {
    if (r.effective.slice(0, 7) > month) g = r.old_gross;
  });
  mine.filter((r) => r.status === "approved").sort((a, b) => (a.effective < b.effective ? -1 : 1)).forEach((r) => {
    if (r.effective.slice(0, 7) <= month) g = r.new_gross;
  });
  return g;
}
export const onPayrollIn = (e, month) => (e.date_of_joining || "0000").slice(0, 7) <= month;

const payCache = new Map();
/** Engine pay for one employee in one month (local currency). */
export function payFor(e, month, revisions = []) {
  const gross = grossAt(e, month, revisions);
  const key = `${e.employee_code}|${ctryOf(e)}|${e.region}|${gross}|${month}`;
  if (payCache.has(key)) return payCache.get(key);
  let out;
  try {
    const p = computePay(toEngineEmp({ ...e, monthly_gross: gross }), periodContext(`${month}-15`));
    const find = (re, not) => r0((p.deductions.find(([k]) => re.test(k) && !(not && not.test(k))) || [, 0])[1]);
    out = { gross, earned: p.earned, net: p.net, deductions: p.totalDeductions, employer: p.employerTotal, cost: p.cost, tds: find(/income tax|TDS|PAYE|withholding|tax/i, /professional/i), pf: find(/Provident/i), esi: find(/^ESI/i), pt: find(/Professional/i), detail: p };
  } catch {
    out = { gross, earned: gross, net: gross, deductions: 0, employer: 0, cost: gross, tds: 0, pf: 0, esi: 0, pt: 0, detail: null };
  }
  if (payCache.size > 5000) payCache.clear();
  payCache.set(key, out);
  return out;
}

/** Totals for a set of employees in one month, in INR (or local currency when all share one). */
export function monthTotals(emps, month, revisions, fx, inInr = true) {
  return emps.filter((e) => onPayrollIn(e, month)).reduce(
    (t, e) => {
      const p = payFor(e, month, revisions);
      const c = (v) => (inInr ? toInr(v, curOf(ctryOf(e)), fx) : v);
      t.headcount += 1; t.gross += c(p.earned); t.net += c(p.net); t.employer += c(p.employer); t.cost += c(p.cost); t.deductions += c(p.deductions);
      return t;
    },
    { headcount: 0, gross: 0, net: 0, employer: 0, cost: 0, deductions: 0 },
  );
}

/** Annual cost per employee across a FY (INR), counting only months on payroll. */
export function fyCostByEmployee(emps, fy, revisions, fx) {
  const months = fyMonths(fy);
  return emps.map((e) => {
    let cost = 0, gross = 0, net = 0, n = 0;
    months.forEach((m) => {
      if (!onPayrollIn(e, m)) return;
      const p = payFor(e, m, revisions);
      const cur = curOf(ctryOf(e));
      cost += toInr(p.cost, cur, fx); gross += toInr(p.earned, cur, fx); net += toInr(p.net, cur, fx); n += 1;
    });
    return { e, cost, gross, net, months: n };
  });
}

export function sumBy(rows, keyFn, valFn) {
  const m = new Map();
  rows.forEach((r) => { const k = keyFn(r); m.set(k, (m.get(k) || 0) + valFn(r)); });
  return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

// ── Revisions ────────────────────────────────────────
export function revisionBuckets(revisions, today = isoDate()) {
  const in3 = isoDate(new Date(new Date(`${today}T12:00:00`).getTime() + 92 * 86400000));
  return {
    upcoming: revisions.filter((r) => r.status === "approved" && r.effective > today && r.effective <= in3),
    pending: revisions.filter((r) => r.status === "approved" && r.effective <= today),
    proposed: revisions.filter((r) => r.status === "proposed"),
  };
}

// ── Bands, market and competitiveness ────────────────
export function grossInr(e, fx) { return toInr(e.monthly_gross, curOf(ctryOf(e)), fx); }
/** Location-adjusted band: India bands × the city's cost index ÷ 100. */
export function bandFor(e, settings, fx) {
  if (ctryOf(e) !== "IN") return null; // bands are India (INR) bands; other pay groups need their own
  const b = settings.bands?.[e.grade_code];
  if (!b) return null;
  const idx = cityIndex(e.city, settings) / 100;
  return { min: b.min * idx, mid: b.mid * idx, max: b.max * idx, p25: b.p25 * idx, p50: b.p50 * idx, p75: b.p75 * idx, idx };
}
export function cityIndex(city, settings) {
  return settings.cityIndex?.find((c) => c.city === city)?.index ?? 100;
}
export function competitiveness(e, settings, fx) {
  const b = bandFor(e, settings, fx);
  const g = grossInr(e, fx);
  if (!b) return { compa: null, position: "No band", tone: "neutral", band: null, gross: g };
  const compa = g / b.mid;
  const position = g < b.p25 ? "Below market" : g < b.p50 ? "Approaching market" : g <= b.p75 ? "At market" : "Above market";
  const tone = { "Below market": "bad", "Approaching market": "warn", "At market": "good", "Above market": "info" }[position];
  const rangePen = b.max === b.min ? 0 : (g - b.min) / (b.max - b.min);
  return { compa, position, tone, band: b, gross: g, rangePen };
}

// ── Performance-based increment guideline ────────────
export function ratingBand(score) {
  if (score >= 4.3) return "5";
  if (score >= 3.7) return "4";
  if (score >= 3.0) return "3";
  if (score >= 2.4) return "2";
  return "1";
}
export const RATING_LABEL = { 5: "Outstanding", 4: "Exceeds", 3: "Meets", 2: "Partly meets", 1: "Below" };

// ── Loans ────────────────────────────────────────────
/** EMI schedule for a disbursed salary loan, with automatic payroll recovery for processed months. */
export function loanSchedule(loan, ledger = {}, today = isoDate()) {
  const amount = Number(loan.approved_amount ?? loan.amount) || 0;
  const emi = Number(loan.emi) || Math.ceil(amount / (loan.tenure_months || 1));
  const start = loan.start_month || monthOf(loan.disbursed_date || today);
  const curMonth = monthOf(today);
  const extra = (ledger.repayments || []).filter((p) => p.mode !== "payroll");
  const paused = new Set(ledger.paused_months || []);
  let bal = amount, m = start;
  const rows = [];
  let guard = 0;
  while (bal > 0.5 && guard < 120) {
    guard += 1;
    extra.filter((p) => p.month === m).forEach((p) => { bal = Math.max(0, bal - p.amount); rows.push({ month: m, kind: p.mode === "foreclosure" ? "Foreclosure" : "Prepayment", amount: p.amount, balance: bal, status: "Recovered", note: p.note || "" }); });
    if (bal <= 0.5) break;
    if (ledger.closed_at && m > monthOf(ledger.closed_at)) break;
    const isPaused = paused.has(m);
    const amt = isPaused ? 0 : Math.min(emi, bal);
    const done = loan.status === "Disbursed" && m < curMonth;
    if (done) bal -= amt;
    rows.push({ month: m, kind: isPaused ? "Skipped (paused)" : "EMI via payroll", amount: amt, balance: done ? bal : Math.max(0, bal - amt), status: isPaused ? "Paused" : done ? "Recovered" : m === curMonth ? "This month" : "Scheduled" });
    if (!done && !isPaused) bal -= amt; // project forward
    m = addMonths(m, 1);
  }
  const recovered = rows.filter((r) => r.status === "Recovered").reduce((s, r) => s + r.amount, 0);
  const outstanding = Math.max(0, amount - recovered);
  const next = rows.find((r) => r.status === "This month" || r.status === "Scheduled");
  return { amount, emi, start, rows, recovered, outstanding, next, closed: outstanding <= 0.5 || !!ledger.closed_at, paidCount: rows.filter((r) => r.kind === "EMI via payroll" && r.status === "Recovered").length };
}

// ── Perquisites (India) ──────────────────────────────
// Values are company defaults kept in Payroll admin → Perquisite rules; confirm them with your tax adviser.
export const PERK_TYPES = {
  car: "Company car",
  accommodation: "Company-leased accommodation",
  loan: "Interest-free / concessional loan",
  gift: "Gift vouchers",
  club: "Club membership",
  esop: "ESOP allotment",
  other: "Other perquisite",
};
export function perkTaxable(p, e, rules = {}) {
  const d = p.details || {};
  switch (p.type) {
    case "car": {
      const big = d.engine === "above_1600";
      const base = big ? rules.car_large ?? 2400 : rules.car_small ?? 1800;
      return d.usage === "official" ? 0 : base + (d.driver ? rules.driver ?? 900 : 0);
    }
    case "accommodation": {
      const pct = (rules.accommodation_pct ?? 10) / 100;
      return Math.max(0, Math.min(Number(d.rent) || 0, (Number(e?.monthly_gross) || 0) * pct) - (Number(d.recovery) || 0));
    }
    case "loan": {
      const principal = Number(d.outstanding) || 0;
      if (principal <= (rules.loan_exempt_upto ?? 200000)) return 0;
      const gap = Math.max(0, (rules.loan_benchmark_rate ?? 9) - (Number(d.rate) || 0)) / 100;
      return r0((principal * gap) / 12);
    }
    case "gift": {
      const annual = Number(d.annual) || 0;
      return r0(Math.max(0, annual - (rules.gift_exempt ?? 5000)) / 12);
    }
    case "esop": {
      const shares = Number(d.shares) || 0;
      return r0((shares * Math.max(0, (Number(d.fmv) || 0) - (Number(d.exercise) || 0))) / 12);
    }
    default:
      return Number(d.monthly) || 0;
  }
}

// ── Form 16 / Form 130 ───────────────────────────────
export const certName = (fy) => (fyStart(fy) >= 2026 ? "Form 130" : "Form 16");
export const certLaw = (fy) => (fyStart(fy) >= 2026 ? "s. 395(4)(b), Income-tax Act 2025 · rule 215(1), Income-tax Rules 2026" : "s. 203, Income-tax Act 1961 · rule 31, Income-tax Rules 1962");
/** Due date for the salary TDS certificate: 15 June after the year ends. */
export const certDue = (fy) => `${fyStart(fy) + 1}-06-15`;

export function taxCertificate(e, fy, { revisions = [], perks = [], perkRules = {}, today = isoDate() } = {}) {
  const months = fyMonths(fy).filter((m) => onPayrollIn(e, m) && m <= addMonths(monthOf(today), -1));
  const rows = months.map((m) => ({ month: m, ...payFor(e, m, revisions) }));
  const salary = rows.reduce((s, r) => s + r.earned, 0);
  const perkMonthly = perks.filter((p) => p.employee_code === e.employee_code && p.status === "active").reduce((s, p) => s + perkTaxable(p, e, perkRules), 0);
  const perqs = r0(perkMonthly * months.length);
  const tds = rows.reduce((s, r) => s + r.tds, 0);
  const pt = rows.reduce((s, r) => s + r.pt, 0);
  const pf = rows.reduce((s, r) => s + r.pf, 0);
  const tx = incomeTax(salary + perqs);
  const quarters = [["Q1 (Apr–Jun)", 0], ["Q2 (Jul–Sep)", 3], ["Q3 (Oct–Dec)", 6], ["Q4 (Jan–Mar)", 9]].map(([q, off]) => {
    const ms = fyMonths(fy).slice(off, off + 3);
    const inQ = rows.filter((r) => ms.includes(r.month));
    return { q, paid: inQ.reduce((s, r) => s + r.earned, 0), tds: inQ.reduce((s, r) => s + r.tds, 0) };
  });
  const complete = addMonths(monthOf(today), -1) >= fyMonths(fy)[11];
  return { e, fy, months: months.length, rows, salary: r0(salary), perqs, gross: r0(salary + perqs), pt, pf, tx, tds: r0(tds), balance: r0(tx.total - tds), quarters, complete };
}

// ── CSV helpers ──────────────────────────────────────
export const maskTail = (s = "") => (s ? `${"•".repeat(Math.max(0, String(s).length - 4))}${String(s).slice(-4)}` : "");
