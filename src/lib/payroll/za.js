// South Africa payroll engine — tax year 2026/27 (1 March 2026 – 28 February 2027).
// Income Tax Act 58 of 1962 (PAYE, SARS) · UIF Act / UIC Act · Skills Development Levies Act · BCEA 75 of 1997 · COIDA.
import { r2, slabTax, ageAt, yearsBetween, monthlyDue, annualDue, check } from './common.js';

export const RATES = {
  effective: 'Tax year 2026/27 (1 Mar 2026 – 28 Feb 2027)',
  tax: {
    slabs: [[245100, 0.18], [383100, 0.26], [530200, 0.31], [695800, 0.36], [887000, 0.39], [1878600, 0.41], [Infinity, 0.45]],
    rebates: { primary: 17820, secondary: 9765, tertiary: 3249 },
    retirementShare: 0.275, retirementCap: 350000,
    medicalCredit: { first: 376, second: 376, extra: 254 },   // per month, from 1 Mar 2026
  },
  uif: { ee: 0.01, er: 0.01, ceiling: 17712 },
  sdl: { rate: 0.01, payrollThreshold: 500000 },
  ordinaryWeekHours: 45,
  overtime: { weekday: 1.5, sunday: 2, publicHoliday: 2, maxWeek: 10 },
};

export const REGIONS = [['GP', 'Gauteng'], ['WC', 'Western Cape'], ['KZN', 'KwaZulu-Natal'], ['EC', 'Eastern Cape']];
export const PROFILE = [
  { key: 'retirement_pct', label: 'Retirement fund – employee % of pay', type: 'number', default: 7.5 },
  { key: 'medical_members', label: 'Medical scheme members (incl. employee)', type: 'number', default: 0 },
  { key: 'tax_number', label: 'SARS income tax number', type: 'text', default: '' },
];

export function incomeTax(annualTaxable, age = 40, medicalMembers = 0) {
  const T = RATES.tax, gross = slabTax(Math.max(0, annualTaxable), T.slabs);
  const rebate = T.rebates.primary + (age >= 65 ? T.rebates.secondary : 0) + (age >= 75 ? T.rebates.tertiary : 0);
  const m = Number(medicalMembers) || 0, C = T.medicalCredit;
  const credits = 12 * (m >= 1 ? C.first : 0) + 12 * (m >= 2 ? C.second : 0) + 12 * Math.max(0, m - 2) * C.extra;
  return { gross: r2(gross), rebate, credits, total: Math.max(0, r2(gross - rebate - credits)) };
}

export function compute(e, ctx) {
  const g = e.gross, p = e.profile || {};
  const dim = ctx.daysInMonth, lop = Math.min(ctx.lopDays || 0, dim);
  const lopDed = r2(g / dim * lop), ot = r2(ctx.otPay || 0), earned = r2(g - lopDed + ot);
  const ra = r2(earned * Number(p.retirement_pct ?? 7.5) / 100);
  const annual = earned * 12, raDeduct = Math.min(ra * 12, annual * RATES.tax.retirementShare, RATES.tax.retirementCap);
  const age = e.dob ? ageAt(e.dob, ctx.period + '-01') : 40;
  const tx = incomeTax(annual - raDeduct, age, p.medical_members), paye = r2(tx.total / 12);
  const uifWage = Math.min(earned, RATES.uif.ceiling), uifEE = r2(uifWage * RATES.uif.ee), uifER = r2(uifWage * RATES.uif.er);
  const sdl = r2(earned * RATES.sdl.rate);
  const deductions = [['PAYE (SARS)', paye], ['UIF (EE 1%)', uifEE], [`Retirement fund (${p.retirement_pct ?? 7.5}%)`, ra]];
  const employer = [['UIF (ER 1%)', uifER], ['Skills Development Levy 1%', sdl]];
  const totalDeductions = r2(deductions.reduce((s, x) => s + x[1], 0)), employerTotal = r2(employer.reduce((s, x) => s + x[1], 0));
  return {
    currency: 'ZAR', gross: g, earned,
    earnings: [['Basic salary', r2(g)], [`Unpaid leave (${lop} day${lop === 1 ? '' : 's'})`, -lopDed], ['Overtime (1.5× / 2×)', ot]],
    deductions, employer, totalDeductions, employerTotal,
    net: r2(earned - totalDeductions), cost: r2(earned + employerTotal),
    steps: [['Annual remuneration', r2(annual)], ['Retirement deduction (27.5%, max R350,000)', -r2(raDeduct)], ['Taxable income', r2(annual - raDeduct)], ['Tax on 2026/27 tables', tx.gross],
      [`Rebates (age ${age})`, -tx.rebate], ['Medical scheme fees tax credit', -tx.credits], ['Annual PAYE', tx.total], ['Monthly PAYE (÷ 12)', paye], ['UIF earnings (ceiling R17,712)', r2(uifWage)]],
    notes: ['Monthly PAYE is annualised; SARS tables give the same result for regular monthly pay.', 'SDL applies when annual payroll exceeds R500,000.', 'COIDA assessment is employer-only and annual (Return of Earnings).'],
  };
}

export function checks(e, ctx) {
  const out = [], p = e.profile || {};
  out.push(check('SARS tax number', p.tax_number ? 'pass' : 'warn', p.tax_number ? `Tax number ${p.tax_number}.` : 'Record the tax number; IRP5 certificates and EMP501 need it.', 'Tax Administration Act'));
  out.push(check('UIF registration', 'pass', `Contributing 1% + 1% on earnings up to R${RATES.uif.ceiling.toLocaleString('en-ZA')}.`, 'Unemployment Insurance Contributions Act 4 of 2002'));
  out.push(check('National minimum wage', 'info', 'Confirm the hourly rate meets the current National Minimum Wage notice (reviewed every March).', 'National Minimum Wage Act 9 of 2018'));
  if (ctx.weeklyHours != null) out.push(check('Ordinary hours ≤ 45 a week', ctx.weeklyHours <= RATES.ordinaryWeekHours ? 'pass' : 'warn', `${ctx.weeklyHours.toFixed(1)} h; overtime max 10 h a week by agreement.`, 'BCEA s.9–10'));
  out.push(check('Annual leave', 'pass', '21 consecutive days (15 working days on a 5-day week) per leave cycle.', 'BCEA s.20'));
  const tenure = yearsBetween(e.doj, ctx.today);
  out.push(check('Notice period', 'info', tenure < 0.5 ? '1 week (first 6 months).' : tenure < 1 ? '2 weeks (6–12 months).' : '4 weeks (after 1 year).', 'BCEA s.37'));
  out.push(check('Employment equity', 'info', 'Designated employers report to the Department of Employment and Labour every year (EEA2/EEA4).', 'Employment Equity Act 55 of 1998'));
  return out;
}

export const policy = {
  'Working time': [['Ordinary hours', '45 hours a week; 9 h a day (5-day week) or 8 h (6-day week)'], ['Overtime', '1.5× ordinary days; 2× Sundays and public holidays; max 10 h a week'], ['Meal break', '1 hour after 5 hours of continuous work']],
  'Leave': [['Annual leave', '21 consecutive days a year (15 working days)'], ['Sick leave', '30 days (5-day week) in each 36-month cycle'], ['Family responsibility', '3 days a year'], ['Maternity / parental', '4 consecutive months maternity; 10 days parental (UIF benefits)']],
  'Pay & tax': [['Tax year', '1 March – 28/29 February'], ['PAYE / UIF / SDL', 'EMP201 return and payment by the 7th of the following month'], ['Reconciliation', 'EMP501 interim (Sep – Oct) and annual (Apr – May) with IRP5 certificates']],
  'Social security': [['UIF', '1% employee + 1% employer, ceiling R17,712 a month'], ['SDL', '1% employer when payroll > R500,000 a year'], ['COIDA', 'Employer-only, annual Return of Earnings']],
  'Employment terms': [['Notice', '1 week (< 6 months), 2 weeks (< 1 year), 4 weeks after'], ['Severance', '1 week’s pay per completed year on retrenchment (BCEA s.41)'], ['Probation', 'Reasonable period; fair procedure still applies (Code of Good Practice)']],
};

export function calendar(today) {
  return [
    ['EMP201 – PAYE, UIF & SDL', 'SARS', 'Monthly', monthlyDue(today, 7)],
    ['UIF declaration (uFiling)', 'Department of Employment and Labour', 'Monthly', monthlyDue(today, 7)],
    ['EMP501 annual reconciliation & IRP5s', 'SARS', 'Annual', annualDue(today, 5, 31)],
    ['EMP501 interim reconciliation', 'SARS', 'Annual', annualDue(today, 10, 31)],
    ['COIDA Return of Earnings', 'Compensation Fund', 'Annual', annualDue(today, 5, 31)],
  ];
}
