// United Kingdom payroll engine — 2026/27 tax year (England, Wales & Northern Ireland rates).
// PAYE on a month-1 (non-cumulative) basis; pension under a net pay arrangement.
import { r2, clamp, ageAt, yearsBetween, monthlyDue, annualDue, lastWorkingDay, check } from './common.js';

export const RATES = {
  effective: '2026/27 tax year (from 6 Apr 2026)',
  incomeTax: { basicBand: 37700, additionalFrom: 125140, basic: 0.20, higher: 0.40, additional: 0.45 },
  nic: { ptMonthly: 1048, uelMonthly: 4189, stMonthly: 417, ee: 0.08, eeAboveUel: 0.02, er: 0.15 },
  pension: { qeLowerMonthly: 520, qeUpperMonthly: 4189.17, trigger: 10000, ee: 0.05, er: 0.03 },
  nationalLivingWage: 12.71,      // age 21+, from 1 Apr 2026
  ssp: 123.25,                    // per week, payable from day one
  contractHours: 37.5,
  maxWeekHours: 48,
};

export const REGIONS = [['ENG', 'England'], ['WLS', 'Wales'], ['NIR', 'Northern Ireland'], ['SCT', 'Scotland']];
export const PROFILE = [
  { key: 'tax_code', label: 'Tax code', type: 'text', default: '1257L' },
  { key: 'pension', label: 'Workplace pension', options: [['enrolled', 'Enrolled'], ['opted_out', 'Opted out']], default: 'enrolled' },
];

/** Annual tax-free allowance from a tax code: 1257L → £12,579; BR / 0T → 0. */
export function allowanceFromCode(code = '1257L') {
  const m = /^(\d+)[LMNT]$/.exec(code.trim().toUpperCase());
  return m ? Number(m[1]) * 10 + 9 : 0;
}

export function compute(e, ctx) {
  const g = e.gross, p = e.profile || {}, code = (p.tax_code || '1257L').toUpperCase();
  const age = ageAt(e.dob, ctx.period + '-01');
  const P = RATES.pension, enrolled = p.pension !== 'opted_out' && g * 12 > P.trigger && age >= 22 && age < 67;
  const qe = enrolled ? clamp(g, P.qeLowerMonthly, P.qeUpperMonthly) - P.qeLowerMonthly : 0;
  const penEE = r2(qe * P.ee), penER = r2(qe * P.er);
  const allowance = allowanceFromCode(code) / 12;
  const T = RATES.incomeTax, taxable = Math.max(0, g - penEE - allowance);
  let tax;
  if (code === 'BR') tax = (g - penEE) * T.basic;
  else {
    const b = T.basicBand / 12, a = T.additionalFrom / 12;
    tax = Math.min(taxable, b) * T.basic + Math.max(0, Math.min(taxable, a) - b) * T.higher + Math.max(0, taxable - a) * T.additional;
  }
  tax = r2(tax);
  const N = RATES.nic;
  const nicEE = r2(Math.max(0, Math.min(g, N.uelMonthly) - N.ptMonthly) * N.ee + Math.max(0, g - N.uelMonthly) * N.eeAboveUel);
  const nicER = r2(Math.max(0, g - N.stMonthly) * N.er);
  const deductions = [['Income tax (PAYE)', tax], ['Employee NIC', nicEE], ['Pension (EE 5%)', penEE]];
  const employer = [['Employer NIC 15%', nicER], ['Pension (ER 3%)', penER]];
  const totalDeductions = r2(tax + nicEE + penEE), employerTotal = r2(nicER + penER);
  return {
    currency: 'GBP', gross: g, earned: g,
    earnings: [['Salary', g]], deductions, employer, totalDeductions, employerTotal,
    net: r2(g - totalDeductions), cost: r2(g + employerTotal),
    steps: [['Tax code', code], ['Monthly tax-free pay', r2(allowance)], ['Pension (net pay arrangement)', -penEE], ['Taxable pay', r2(taxable)],
      ['Tax at 20% / 40% / 45%', tax], ['NIC earnings above £1,048', r2(Math.max(0, g - N.ptMonthly))], ['Qualifying earnings for pension', r2(qe)]],
    notes: ['PAYE uses the month-1 (non-cumulative) basis. Scottish rates are not configured.', enrolled ? 'Auto-enrolled in the workplace pension.' : 'Not contributing to the workplace pension.'],
  };
}

export function checks(e, ctx) {
  const out = [], p = e.profile || {}, age = ageAt(e.dob, ctx.today);
  const hourly = e.gross * 12 / (52 * RATES.contractHours);
  out.push(check('National Living Wage', age < 21 ? 'info' : hourly >= RATES.nationalLivingWage ? 'pass' : 'fail',
    `£${hourly.toFixed(2)} an hour on ${RATES.contractHours} h/week vs £${RATES.nationalLivingWage}.`, 'National Minimum Wage Act 1998'));
  out.push(check('Tax code on file', p.tax_code ? 'pass' : 'warn', p.tax_code ? `Using ${p.tax_code}.` : 'No tax code: using 1257L. Check the starter checklist or HMRC notice.', 'PAYE Regulations'));
  out.push(check('Scottish taxpayer', e.region === 'SCT' ? 'fail' : 'pass', e.region === 'SCT' ? 'Scottish rates are not configured; do not run payroll until added.' : 'rUK rates apply.', 'Scotland Act', true));
  const eligible = e.gross * 12 > RATES.pension.trigger && age >= 22 && age < 67;
  out.push(check('Pension auto-enrolment', !eligible ? 'info' : p.pension === 'opted_out' ? 'warn' : 'pass',
    !eligible ? 'Not an eligible jobholder.' : p.pension === 'opted_out' ? 'Opted out: re-enrol every 3 years.' : 'Enrolled at 5% + 3% of qualifying earnings.', 'Pensions Act 2008'));
  out.push(check('Holiday entitlement', 'pass', 'Company 28 days including bank holidays meets 5.6 weeks.', 'Working Time Regulations 1998'));
  if (ctx.weeklyHours != null) out.push(check('Average week ≤ 48 h', ctx.weeklyHours <= RATES.maxWeekHours ? 'pass' : 'warn', `${ctx.weeklyHours.toFixed(1)} h; above 48 needs a signed opt-out.`, 'Working Time Regulations 1998'));
  out.push(check('Right to work', 'info', 'Keep a copy of the right-to-work check on file.', 'Immigration, Asylum and Nationality Act 2006'));
  out.push(check('Statutory Sick Pay', 'info', `SSP £${RATES.ssp}/week is payable from the first day of sickness.`, 'Employment Rights Act 2025'));
  return out;
}

export const policy = {
  'Working time': [['Maximum hours', '48-hour average week unless the employee opts out'], ['Contract hours', '37.5 hours a week'], ['Rest', '11 hours daily, 24 hours weekly']],
  'Leave': [['Annual leave', '28 days including bank holidays (5.6 weeks)'], ['Sick pay', 'SSP £123.25 a week from day one'], ['Family leave', 'Maternity up to 52 weeks; paternity 2 weeks']],
  'Pay & tax': [['Pay cycle', 'Monthly, last working day'], ['Income tax', 'PAYE, 20% / 40% / 45%, personal allowance £12,570'], ['National Insurance', 'Employee 8% / 2%; employer 15% above £5,000 a year']],
  'Social security': [['Workplace pension', 'Auto-enrolment: 5% employee + 3% employer of qualifying earnings £6,240–£50,270'], ['Minimum wage', 'National Living Wage £12.71 an hour (21+)']],
  'Employment terms': [['Probation', '3–6 months (company)'], ['Notice', 'Statutory 1 week per year of service up to 12 weeks; company minimum 1 month'], ['Written terms', 'Written statement on or before day one']],
};

export function calendar(today) {
  return [
    ['Full Payment Submission (RTI)', 'HMRC', 'Each payday', lastWorkingDay(today)],
    ['PAYE & NIC payment', 'HMRC', 'Monthly', monthlyDue(today, 22)],
    ['Pension contributions', 'Pension provider', 'Monthly', monthlyDue(today, 22)],
    ['P60 to employees', 'HMRC', 'Annual', annualDue(today, 5, 31)],
    ['P11D benefits return', 'HMRC', 'Annual', annualDue(today, 7, 6)],
  ];
}
