// Botswana payroll engine — tax year 1 July 2026 – 30 June 2027.
// Income Tax Act (as amended by Act 13 of 2026: new 27.5% band above P400,000) · Employment Act Cap 47:01.
// Botswana has no mandatory social-security deduction; pension is through approved funds.
import { r2, slabTax, yearsBetween, monthlyDue, annualDue, check } from './common.js';

export const RATES = {
  effective: 'Tax year 2026/27 (1 Jul 2026 – 30 Jun 2027)',
  tax: {
    slabs: [[48000, 0], [84000, 0.05], [120000, 0.125], [156000, 0.1875], [400000, 0.25], [Infinity, 0.275]],
    slabsBeforeJul2026: [[48000, 0], [84000, 0.05], [120000, 0.125], [156000, 0.1875], [Infinity, 0.25]],
  },
  severanceDaysPerMonth: 1,          // non-pensionable staff, first 60 months
  maxWeekHours: 48,
  overtime: { weekday: 1.5, restDay: 2 },
};

export const REGIONS = [['GBE', 'Gaborone'], ['FRW', 'Francistown'], ['MAU', 'Maun']];
export const PROFILE = [
  { key: 'pension_pct', label: 'Approved pension fund – employee %', type: 'number', default: 5 },
  { key: 'pension_er', label: 'Approved pension fund – employer %', type: 'number', default: 10 },
  { key: 'omang', label: 'Omang / passport number', type: 'text', default: '' },
];

export function compute(e, ctx) {
  const g = e.gross, p = e.profile || {};
  const dim = ctx.daysInMonth, lop = Math.min(ctx.lopDays || 0, dim);
  const lopDed = r2(g / dim * lop), ot = r2(ctx.otPay || 0), earned = r2(g - lopDed + ot);
  const penEE = r2(earned * Number(p.pension_pct ?? 5) / 100), penER = r2(earned * Number(p.pension_er ?? 10) / 100);
  const member = penEE > 0 || penER > 0;
  const slabs = ctx.period >= '2026-07' ? RATES.tax.slabs : RATES.tax.slabsBeforeJul2026;
  const annualTaxable = Math.max(0, (earned - penEE) * 12);
  const annualTax = r2(slabTax(annualTaxable, slabs)), paye = r2(annualTax / 12);
  const severance = member ? 0 : r2(g / 26 * RATES.severanceDaysPerMonth);
  const deductions = [['PAYE (BURS)', paye], [`Pension fund (EE ${p.pension_pct ?? 5}%)`, penEE]];
  const employer = [[`Pension fund (ER ${p.pension_er ?? 10}%)`, penER], ['Severance benefit accrual', severance]];
  const totalDeductions = r2(deductions.reduce((s, x) => s + x[1], 0)), employerTotal = r2(employer.reduce((s, x) => s + x[1], 0));
  return {
    currency: 'BWP', gross: g, earned,
    earnings: [['Basic salary', r2(g)], [`Unpaid leave (${lop} day${lop === 1 ? '' : 's'})`, -lopDed], ['Overtime (1.5× / 2×)', ot]],
    deductions, employer, totalDeductions, employerTotal,
    net: r2(earned - totalDeductions), cost: r2(earned + employerTotal),
    steps: [['Annual remuneration', r2(earned * 12)], ['Less approved pension contributions', -r2(penEE * 12)], ['Annual taxable income', r2(annualTaxable)],
      [ctx.period >= '2026-07' ? 'Tax (0% – 27.5%, from 1 Jul 2026)' : 'Tax (0% – 25%)', annualTax], ['Monthly PAYE (÷ 12)', paye]],
    notes: ['No statutory social-security deduction in Botswana.', member ? 'Pension member: no severance accrual.' : 'Not in a pension fund: severance benefit accrues (Employment Act s.27).'],
  };
}

export function checks(e, ctx) {
  const out = [], p = e.profile || {};
  out.push(check('Omang / passport recorded', p.omang ? 'pass' : 'warn', p.omang ? 'Identity on file.' : 'Record the Omang (citizens) or passport and work permit (non-citizens).', 'Employment of Non-Citizens Act'));
  if (ctx.weeklyHours != null) out.push(check('Weekly hours ≤ 48', ctx.weeklyHours <= RATES.maxWeekHours ? 'pass' : 'warn', `${ctx.weeklyHours.toFixed(1)} h.`, 'Employment Act s.97'));
  out.push(check('Minimum wage', 'info', 'Check the current statutory minimum wage order for the sector.', 'Minimum Wages Order'));
  out.push(check('Annual leave', 'pass', 'Company policy meets the statutory 15 working days per year.', 'Employment Act s.97'));
  const tenure = yearsBetween(e.doj, ctx.today);
  out.push(check('Severance benefit', 'info', tenure >= 5 ? 'Due at the end of each 60-month period of continuous service (non-pension staff).' : `Accrues for non-pension staff; first payable after 60 months (now ${Math.floor(tenure * 12)} months).`, 'Employment Act s.27'));
  return out;
}

export const policy = {
  'Working time': [['Hours', '48 hours a week'], ['Overtime', '1.5× normal days, 2× rest days and public holidays'], ['Rest', 'At least one rest day a week']],
  'Leave': [['Annual leave', '15 working days after 12 months'], ['Sick leave', '14 working days a year with full pay, with a medical certificate'], ['Maternity', 'Paid maternity leave under the Employment Act (confirm current weeks and pay rate)']],
  'Pay & tax': [['Tax year', '1 July – 30 June'], ['PAYE', 'By the 15th of the next month (ITW7A)'], ['Annual return', 'ITW10 and ITW8 certificates within 31 days after 30 June']],
  'Social security': [['Pension', 'Approved funds, contributions deductible'], ['Severance', 'Non-pension staff accrue severance benefit']],
  'Employment terms': [['Notice', 'By pay interval; 1 month for monthly-paid staff'], ['Probation', 'Up to 12 months'], ['Non-citizens', 'Work and residence permits required']],
};

export function calendar(today) {
  return [
    ['PAYE remittance (ITW7A)', 'Botswana Unified Revenue Service (BURS)', 'Monthly', monthlyDue(today, 15)],
    ['Annual PAYE return (ITW10) & ITW8 certificates', 'BURS', 'Annual', annualDue(today, 7, 31)],
  ];
}
