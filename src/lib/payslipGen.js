// Builds payslip rows from the India payroll engine (used by "Generate from payroll" and the demo seed).
// Earnings are pro-rated by days payable ÷ total working days; PF, ESI, PT and TDS come from the engine.
import { computePay, periodContext, toEngineEmp } from "./payroll/index.js";

const r2 = (n) => Math.round(n * 100) / 100;

export function indiaPayslipRow(e, { period, totalWorkingDays, lopDays = 0, otPay = 0, reimbursement = 0 }) {
  const [y, m] = period.split("-").map(Number);
  const dim = new Date(y, m, 0).getDate();
  const twd = totalWorkingDays || dim;
  const lop = Math.min(lopDays, twd);
  const f = (twd - lop) / twd;
  const g = Number(e.monthly_gross) || 0;
  const basic = r2(g * 0.5 * f);
  const hra = r2(basic * 0.4);
  const special = r2(g * f - basic - hra);
  // The engine pro-rates by calendar days; give it the equivalent LOP so PF and ESI match.
  const pay = computePay(toEngineEmp(e), periodContext(`${period}-15`, { lopDays: Math.round((lop / twd) * dim * 100) / 100, otPay }));
  const ded = Object.fromEntries(pay.deductions.map(([k, v]) => [k.split(" ")[0], v]));
  return {
    employee_code: e.employee_code,
    actual_payable_days: twd,
    total_working_days: twd,
    lop_days: lop,
    days_payable: r2(twd - lop),
    values: { BASIC: basic, HRA: hra, SPECIAL: special, OTHER_ALW: r2(otPay), PF_EE: ded.Provident || 0, ESI_EE: ded.ESI || 0, PT: ded.Professional || 0, TDS: ded.Income || 0, REIMB: r2(reimbursement) },
  };
}

// Contract workers on payroll (v8.7). Monthly-rate contracts and interns get the normal salary structure pro-rated for LOP;
// hourly / daily contracts are paid "Contract pay" from approved timesheets, with PF, PT and TDS from the India engine.
export function contractPayslipRow(e, line, period) {
  const [y, m] = period.split("-").map(Number);
  const dim = new Date(y, m, 0).getDate();
  const unit = line.basis === "daily" ? "days" : line.basis === "monthly" ? "of month" : "hours";
  const rateTxt = `${line.currency} ${Number(line.rate).toLocaleString("en-IN")} / ${line.basis === "monthly" ? "month" : line.basis === "daily" ? "day" : "hour"}`;
  if ((e.country_code || "IN") !== "IN") {
    return { employee_code: e.employee_code, actual_payable_days: dim, total_working_days: dim, lop_days: line.lop_days || 0, days_payable: dim - (line.lop_days || 0), values: { CONTRACT_PAY: r2(line.base + line.milestones), OTHER_ALW: r2(line.ot), CW_HOURS: line.basis === "monthly" ? "" : `${line.units} ${unit}`, CW_RATE: rateTxt } };
  }
  if (line.basis === "monthly") {
    const row = indiaPayslipRow({ ...e, monthly_gross: line.rate }, { period, totalWorkingDays: dim, lopDays: line.lop_days || 0, otPay: line.ot });
    return { ...row, values: { ...row.values, CW_RATE: rateTxt, CW_HOURS: line.ot_hours ? `${line.ot_hours} overtime hours` : "" } };
  }
  const row = indiaPayslipRow({ ...e, monthly_gross: line.base + line.milestones }, { period, totalWorkingDays: dim, lopDays: 0, otPay: line.ot });
  return { ...row, values: { ...row.values, BASIC: 0, HRA: 0, SPECIAL: 0, CONTRACT_PAY: r2(line.base + line.milestones), CW_HOURS: `${line.units} ${unit}${line.ot_hours ? ` + ${line.ot_hours} h overtime` : ""}`, CW_RATE: rateTxt } };
}
