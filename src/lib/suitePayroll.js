// Payroll Agent engine (v10): computes the month for every on-payroll employee in every country using the existing
// country engines, adds variable pay (hourly, overtime, bonus, commission), converts to INR for the consolidated
// view, sums statutory deductions and raises review flags the agent shows before one-tap approval.
import { COUNTRIES, computePay, toEngineEmp, filingCalendar } from "./payroll/index.js";
import { payContext } from "../components/pay/PayViews.jsx";
import { isContingent } from "../data/employeeFields.js";
import { isoDate } from "./utils.js";

export const BANK_FORMATS = {
  IN: "Bulk NEFT / RTGS / IMPS (bank CSV)", GB: "Bacs Standard 18", US: "NACHA ACH", AE: "WPS SIF file", SG: "GIRO (APS)", ZA: "ACB / EFT",
  NA: "EFT (NamClear)", KE: "EFT / PesaLink", NG: "NIBSS NEFT", BW: "EFT (BISS)", CA: "CPA 005 EFT", MX: "SPEI layout", BR: "PIX / CNAB 240",
  DE: "SEPA Credit Transfer (pain.001)", FR: "SEPA Credit Transfer (pain.001)", IE: "SEPA Credit Transfer (pain.001)", SA: "WPS / SARIE", MY: "IBG / DuitNow", PH: "InstaPay / PESONet", ID: "SKN / BI-FAST", GH: "GhIPSS ACH", ZM: "ZECHL EFT",
};

// Statutory returns and year-end forms, by country: [form, frequency, what it is].
export const STATUTORY_FORMS = {
  IN: [["PF ECR", "Monthly", "EPF electronic challan-cum-return"], ["ESI challan", "Monthly", "ESIC contribution"], ["PT return", "Monthly", "Professional tax by state"], ["TDS challan 281", "Monthly", "Salary TDS deposit"], ["LWF return", "Half-yearly / yearly", "Labour welfare fund by state"], ["Form 24Q", "Quarterly", "TDS return on salaries"], ["Form 16 / Form 130", "Yearly", "TDS certificate to every employee"], ["Form 12BB / 124", "Yearly", "Employee investment declaration"]],
  GB: [["RTI FPS", "Each pay day", "Full Payment Submission to HMRC"], ["RTI EPS", "Monthly", "Employer Payment Summary"], ["P60", "Yearly", "End-of-year certificate to employees"], ["P11D", "Yearly", "Expenses and benefits"], ["P45", "On leaving", "Leaver certificate"]],
  US: [["Form 941", "Quarterly", "Federal payroll tax return"], ["Form 940", "Yearly", "FUTA return"], ["W-2 / W-3", "Yearly", "Wage and tax statements"], ["1099-NEC", "Yearly", "Contractor payments"], ["State withholding", "Monthly / quarterly", "State income tax"]],
  AE: [["WPS salary file", "Monthly", "Wage Protection System"], ["GPSSA", "Monthly", "Pension for UAE nationals"]],
  SG: [["CPF submission", "Monthly", "Central Provident Fund"], ["IR8A", "Yearly", "Employee income return (AIS)"]],
  ZA: [["EMP201", "Monthly", "PAYE, UIF and SDL"], ["EMP501", "Half-yearly", "Reconciliation"], ["IRP5 / IT3(a)", "Yearly", "Employee tax certificates"]],
  KE: [["PAYE (iTax P10)", "Monthly", "PAYE return"], ["NSSF / SHIF / Housing levy", "Monthly", "Social contributions"], ["P9A", "Yearly", "Tax deduction card"]],
  NG: [["PAYE remittance", "Monthly", "State IRS"], ["Pension (PFA)", "Monthly", "Contributory pension"], ["Form H1", "Yearly", "Annual employer return"]],
  DE: [["Lohnsteuer-Anmeldung", "Monthly", "Wage tax return"], ["SV-Meldung", "Monthly", "Social insurance"], ["Lohnsteuerbescheinigung", "Yearly", "Employee tax certificate"]],
  FR: [["DSN", "Monthly", "Déclaration sociale nominative"]],
  IE: [["Payroll submission (PSR)", "Each pay day", "Revenue PAYE modernisation"], ["Employment Detail Summary", "Yearly", "Employee year-end summary"]],
  CA: [["PD7A remittance", "Monthly", "Source deductions"], ["T4 / T4 Summary", "Yearly", "Statement of remuneration"]],
  default: [["Monthly payroll tax return", "Monthly", "Local PAYE / withholding"], ["Social security return", "Monthly", "Pension and social security"], ["Year-end certificate", "Yearly", "Employee tax certificate"]],
};
export const formsFor = (code) => STATUTORY_FORMS[code] || STATUTORY_FORMS.default;

const isOnPayroll = (e) => e.status === "active" && !isContingent(e);

export function variableFor(data, period, code) {
  return data.suite?.variable?.[period]?.[code] || null;
}

export function computeRun(data, { period = isoDate().slice(0, 7) } = {}) {
  const fx = data.fx || { INR: 1 };
  const exits = data.suite?.exits || [];
  const rows = data.employees.filter(isOnPayroll).map((e) => {
    const code = e.country_code || "IN";
    const cur = COUNTRIES[code]?.currency || "INR";
    const base = payContext(data, e);
    const v = variableFor(data, period, e.employee_code) || {};
    const hourlyPay = (Number(v.hours) || 0) * (Number(v.hourly_rate) || 0);
    const otVar = Math.round((Number(v.ot_hours) || 0) * (e.monthly_gross / (26 * 8)) * 2);
    const bonus = Number(v.bonus) || 0, commission = Number(v.commission) || 0;
    const variable = hourlyPay + otVar + bonus + commission;
    let pay;
    const eng = toEngineEmp(e);
    try {
      pay = code === "IN"
        ? computePay(eng, { ...base, period, otPay: (base.otPay || 0) + otVar, bonus, commission, hourlyPay })
        : computePay({ ...eng, gross: eng.gross + bonus + commission + hourlyPay }, { ...base, period, otPay: (base.otPay || 0) + otVar });
    } catch {
      pay = null;
    }
    const rate = fx[cur] || 1;
    const flags = [];
    if (!pay) flags.push({ level: "error", text: `No payroll rules for ${code}.` });
    if (!e.bank_account) flags.push({ level: "error", text: "No bank account — payout will fail." });
    if (code === "IN" && !e.pan) flags.push({ level: "warn", text: "PAN missing — TDS must be deducted at 20%." });
    if (code === "IN" && !e.uan) flags.push({ level: "warn", text: "UAN missing — PF ECR line will be rejected." });
    if (variable > e.monthly_gross * 0.3) flags.push({ level: "warn", text: `Variable pay ${Math.round((variable / e.monthly_gross) * 100)}% of gross — please confirm.` });
    if (e.date_of_joining?.startsWith(period)) flags.push({ level: "info", text: "Joined this month — pay is pro-rated." });
    const ex = exits.find((x) => x.employee_code === e.employee_code && x.last_day?.startsWith(period));
    if (ex) flags.push({ level: "info", text: "Last working day this month — settle through full & final." });
    if ((base.lopDays || 0) >= 3) flags.push({ level: "info", text: `${base.lopDays} LOP days from approved leave.` });
    if (pay && pay.net < 0) flags.push({ level: "error", text: "Net pay is negative." });
    return {
      e, code, cur, pay, flags, variable, lopDays: base.lopDays || 0, otPay: (base.otPay || 0) + otVar, bonus, commission, hourlyPay,
      inr: pay ? { gross: pay.earned * rate, net: pay.net * rate, cost: pay.cost * rate, ded: pay.totalDeductions * rate, er: pay.employerTotal * rate } : { gross: 0, net: 0, cost: 0, ded: 0, er: 0 },
    };
  });

  const byCountry = {};
  rows.forEach((r) => {
    const b = (byCountry[r.code] ||= { code: r.code, name: COUNTRIES[r.code]?.name || r.code, cur: r.cur, people: 0, gross: 0, net: 0, cost: 0, inrNet: 0, inrCost: 0, bank: BANK_FORMATS[r.code] || "Bank transfer" });
    b.people += 1;
    if (r.pay) { b.gross += r.pay.earned; b.net += r.pay.net; b.cost += r.pay.cost; }
    b.inrNet += r.inr.net; b.inrCost += r.inr.cost;
  });

  // India statutory totals, by line name.
  const stat = {};
  rows.filter((r) => r.code === "IN" && r.pay).forEach((r) => {
    [...r.pay.deductions, ...r.pay.employer].forEach(([k, v]) => {
      const key = /Provident|EPF|EPS|EDLI|PF admin/.test(k) ? "PF" : /ESI/.test(k) ? "ESI" : /Professional/.test(k) ? "PT" : /TDS|Income tax/.test(k) ? "TDS" : /welfare/i.test(k) ? "LWF" : /Gratuity/.test(k) ? "Gratuity" : "Other";
      stat[key] = (stat[key] || 0) + (Number(v) || 0);
    });
  });
  // Other-country statutory totals (tax + social) in INR.
  const intlStat = rows.filter((r) => r.code !== "IN" && r.pay).reduce((s, r) => s + r.inr.ded + r.inr.er, 0);

  const totals = rows.reduce((t, r) => ({ people: t.people + 1, gross: t.gross + r.inr.gross, net: t.net + r.inr.net, cost: t.cost + r.inr.cost, ded: t.ded + r.inr.ded, er: t.er + r.inr.er, variable: t.variable + r.variable * (fx[r.cur] || 1) }), { people: 0, gross: 0, net: 0, cost: 0, ded: 0, er: 0, variable: 0 });
  const flags = rows.flatMap((r) => r.flags.map((f) => ({ ...f, e: r.e })));
  return { period, rows, byCountry: Object.values(byCountry).sort((a, b) => b.inrCost - a.inrCost), stat, intlStat, totals, flags, errors: flags.filter((f) => f.level === "error"), warns: flags.filter((f) => f.level === "warn") };
}

/** Upcoming statutory deadlines across every country that has staff. */
export function allDeadlines(data, today = isoDate()) {
  const codes = [...new Set(data.employees.filter((e) => e.status === "active").map((e) => e.country_code || "IN"))];
  return codes.flatMap((c) => {
    try { return filingCalendar(c, today).map((f) => ({ ...f, country: c, countryName: COUNTRIES[c]?.name || c })); } catch { return []; }
  }).sort((a, b) => a.daysLeft - b.daysLeft);
}

/** Bank file rows for a country batch (CSV the bank portal accepts; columns follow the common bulk-upload layout). */
export function bankFileRows(run, code) {
  return run.rows.filter((r) => r.code === code && r.pay).map((r, i) => [
    i + 1, r.e.full_name, r.e.bank_name || "", r.e.bank_account || "", r.e.bank_ifsc || "", r.cur, Math.round(r.pay.net * 100) / 100, `SALARY ${run.period}`, r.e.email || "",
  ]);
}

/** Double-entry salary journal for accounting software (Tally, QuickBooks, Xero, Zoho Books, SAP). */
export function journalLines(run) {
  const t = run.totals;
  return [
    ["Salaries & wages (expense)", "Dr", Math.round(t.gross)],
    ["Employer contributions (expense)", "Dr", Math.round(t.er)],
    ["Salary payable (bank)", "Cr", Math.round(t.net)],
    ["Statutory deductions payable (PF/ESI/PT/TDS/LWF/PAYE)", "Cr", Math.round(t.ded)],
    ["Employer contributions payable", "Cr", Math.round(t.er)],
  ];
}
