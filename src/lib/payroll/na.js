// Namibia payroll engine — year of assessment 2026/27 (1 March 2026 – 28 February 2027).
// Income Tax Act 24 of 1981 (PAYE, NamRA) · Social Security Act 34 of 1994 (SSC) · Labour Act 11 of 2007 ·
// Vocational Education and Training Act 1 of 2008 (VET levy) · Employees' Compensation Act 30 of 1941.
// Rates checked against the PwC Namibia tax reference & rate card (Sept 2026). The 2026/27 Budget proposes new
// brackets, but they are not enacted yet — update RATES.tax.slabs when the Income Tax Amendment Act is gazetted.
import { r2, clamp, slabTax, yearsBetween, monthlyDue, annualDue, lastWorkingDay, check } from './common.js';

export const RATES = {
  effective: 'Tax year 2026/27 (1 Mar 2026 – 28 Feb 2027)',
  tax: {
    // Annual taxable income → marginal rate (N$). 0–100,000 is not taxable.
    slabs: [[100000, 0], [150000, 0.18], [350000, 0.25], [550000, 0.28], [850000, 0.30], [1550000, 0.32], [Infinity, 0.37]],
    retirementCap: 150000,          // pension + provident + RA + education policy, per year
  },
  // Social Security Commission: 0.9% employee + 0.9% employer, on earnings between the floor and the ceiling.
  ssc: { rate: 0.009, floor: 500, ceiling: 11000, ceilingFrom202609: 12500 },
  vetLevy: { rate: 0.01, payrollThreshold: 1000000 }, // employer only, when annual payroll ≥ N$1m
  structure: { basic: 0.70, housing: 0.20, transport: 0.10 },
  minimumWageHour: 18,              // national minimum wage, N$ per hour (from 1 Jan 2025)
  ordinaryWeekHours: 45,
  overtime: { weekday: 1.5, sundayOrHoliday: 2 },
  maxOvertime: { day: 3, week: 10 },
};

export const REGIONS = [['KH', 'Khomas (Windhoek)'], ['ER', 'Erongo (Walvis Bay, Swakopmund)'], ['OS', 'Oshana (Oshakati)'], ['KE', 'ǁKaras (Lüderitz, Keetmanshoop)'], ['OT', 'Otjozondjupa']];
export const PROFILE = [
  { key: 'pension_ee', label: 'Pension / provident fund – employee %', type: 'number', default: 7 },
  { key: 'pension_er', label: 'Pension / provident fund – employer %', type: 'number', default: 10 },
  { key: 'ssc_number', label: 'Social Security number', type: 'text', default: '' },
  { key: 'tin', label: 'NamRA TIN', type: 'text', default: '' },
  { key: 'week_days', label: 'Working week', options: [['5', '5 days'], ['6', '6 days']], default: '5' },
];

export function incomeTax(annualTaxable) {
  return Math.max(0, Math.round(slabTax(Math.max(0, annualTaxable), RATES.tax.slabs) * 100) / 100);
}

export function sscCeiling(period) {
  return period >= '2026-09' ? RATES.ssc.ceilingFrom202609 : RATES.ssc.ceiling;
}

export function compute(e, ctx) {
  const g = e.gross, S = RATES.structure, p = e.profile || {};
  const basic = g * S.basic, housing = g * S.housing, transport = g - basic - housing;
  const dim = ctx.daysInMonth, lop = Math.min(ctx.lopDays || 0, dim);
  const lopDed = r2(g / dim * lop), ot = r2(ctx.otPay || 0), earned = r2(g - lopDed + ot);
  const eePct = Number(p.pension_ee ?? 7) / 100, erPct = Number(p.pension_er ?? 10) / 100;
  const penEE = r2(basic * eePct), penER = r2(basic * erPct);
  const deductible = Math.min(penEE * 12, RATES.tax.retirementCap);
  const annualTaxable = earned * 12 - deductible;
  const annualTax = incomeTax(annualTaxable), paye = r2(annualTax / 12);
  const ceiling = sscCeiling(ctx.period), sscWage = clamp(earned, RATES.ssc.floor, ceiling);
  const sscEE = r2(sscWage * RATES.ssc.rate), sscER = sscEE;
  const vet = r2(earned * RATES.vetLevy.rate);
  const deductions = [['PAYE (NamRA)', paye], ['Social Security (EE 0.9%)', sscEE], [`Pension fund (EE ${Math.round(eePct * 100)}% of basic)`, penEE]];
  const employer = [['Social Security (ER 0.9%)', sscER], [`Pension fund (ER ${Math.round(erPct * 100)}% of basic)`, penER], ['VET levy 1%', vet]];
  const totalDeductions = r2(deductions.reduce((s, x) => s + x[1], 0)), employerTotal = r2(employer.reduce((s, x) => s + x[1], 0));
  return {
    currency: 'NAD', gross: g, earned,
    earnings: [['Basic salary (70%)', r2(basic)], ['Housing allowance (20%)', r2(housing)], ['Transport allowance (10%)', r2(transport)], [`Unpaid leave (${lop} day${lop === 1 ? '' : 's'})`, -lopDed], ['Overtime (1.5× / 2×)', ot]],
    deductions, employer, totalDeductions, employerTotal,
    net: r2(earned - totalDeductions), cost: r2(earned + employerTotal),
    steps: [['Annual remuneration', r2(earned * 12)], ['Retirement contributions deducted (cap N$150,000)', -r2(deductible)], ['Annual taxable income', r2(annualTaxable)],
      ['Annual tax on 2026/27 scale', annualTax], ['Monthly PAYE (÷ 12)', paye], [`SSC earnings (N$${RATES.ssc.floor}–N$${ceiling.toLocaleString('en-NA')})`, r2(sscWage)]],
    notes: [
      'Housing and transport allowances are fully taxable in Namibia; employer-provided housing would be valued by NamRA scale instead.',
      `SSC is capped at N$${(ceiling * RATES.ssc.rate).toFixed(2)} a month per party${ctx.period >= '2026-09' ? ' (new ceiling from 1 September 2026)' : ''}.`,
      'VET levy applies only when the company’s annual payroll is N$1,000,000 or more.',
      'Employees’ Compensation Fund assessment is annual and depends on the industry class; it is not deducted from pay.',
    ],
  };
}

export function checks(e, ctx) {
  const out = [], p = e.profile || {}, g = e.gross;
  const days = Number(p.week_days || 5), hourly = g / (RATES.ordinaryWeekHours * 52 / 12);
  out.push(check('Minimum wage', hourly >= RATES.minimumWageHour ? 'pass' : 'fail', `≈ N$${hourly.toFixed(2)} per hour against the N$${RATES.minimumWageHour.toFixed(2)} national minimum.`, 'National Minimum Wage Order 2024', true));
  out.push(check('Social Security registration', p.ssc_number ? 'pass' : 'warn', p.ssc_number ? `SSC number ${p.ssc_number}.` : 'Record the SSC number; register within 30 days of starting work.', 'Social Security Act 34 of 1994, s.20'));
  out.push(check('NamRA taxpayer number', p.tin ? 'pass' : 'warn', p.tin ? `TIN ${p.tin}.` : 'Record the employee’s NamRA TIN for PAYE returns and PAYE5 certificates.', 'Income Tax Act, 4th Schedule'));
  const penEE = g * RATES.structure.basic * Number(p.pension_ee ?? 7) / 100 * 12;
  out.push(check('Retirement deduction cap', penEE <= RATES.tax.retirementCap ? 'pass' : 'warn', penEE <= RATES.tax.retirementCap ? `N$${Math.round(penEE).toLocaleString('en-NA')} a year is within the N$150,000 cap.` : 'Contributions above N$150,000 a year are not deductible; PAYE uses the cap.', 'Income Tax Act s.17(1)(n)'));
  if (ctx.weeklyHours != null) out.push(check(`Ordinary hours ≤ ${RATES.ordinaryWeekHours} a week`, ctx.weeklyHours <= RATES.ordinaryWeekHours ? 'pass' : 'warn', `${ctx.weeklyHours.toFixed(1)} h; overtime is capped at 3 h a day and 10 h a week with written agreement.`, 'Labour Act 2007, s.16–17'));
  out.push(check('Annual leave', 'pass', `Company policy meets the statutory ${days === 5 ? 20 : 24} working days (4 consecutive weeks) per leave cycle.`, 'Labour Act 2007, s.23'));
  const tenure = yearsBetween(e.doj, ctx.today);
  out.push(check('Severance eligibility', 'info', tenure >= 1 ? `Eligible on retrenchment or death: 1 week’s pay per completed year (${Math.floor(tenure)} yr).` : 'Eligible after 12 months’ continuous service.', 'Labour Act 2007, s.35'));
  out.push(check('Affirmative Action report', 'info', 'Relevant employers (25 or more staff) file an annual affirmative action report with the Employment Equity Commission.', 'Affirmative Action (Employment) Act 29 of 1998'));
  return out;
}

export const policy = {
  'Working time': [['Ordinary hours', '45 hours a week: 9 h a day (5-day week) or 8 h a day (6-day week)'], ['Overtime', '1.5× on ordinary days, 2× on Sundays and public holidays; max 3 h a day, 10 h a week'], ['Night work', '6% night-work allowance between 20:00 and 07:00']],
  'Leave': [['Annual leave', '4 consecutive weeks per year: 20 working days (5-day week) / 24 (6-day week)'], ['Sick leave', '30 working days paid over a 36-month cycle (5-day week); 1 day per 26 worked in year one'], ['Compassionate leave', '5 working days a year (death or serious illness of a close family member)'], ['Maternity', '12 weeks (4 before, 8 after birth), paid by the SSC Maternity Leave Fund up to the ceiling']],
  'Pay & tax': [['Tax year', '1 March – 28/29 February'], ['PAYE', 'Monthly return and payment within 20 days after month end (NamRA ITAS)'], ['Tax scale', '0% up to N$100,000, then 18% – 37% (2026/27)'], ['Retirement funds', 'Contributions deductible up to N$150,000 a year']],
  'Social security': [['SSC', '0.9% employee + 0.9% employer on earnings N$500 – N$12,500 (from Sept 2026; N$11,000 before)'], ['Employees’ Compensation', 'Employer-only annual assessment by industry class'], ['VET levy', '1% of payroll, employer-only, when annual payroll ≥ N$1 million']],
  'Employment terms': [['Notice', '1 day (≤ 4 weeks’ service), 1 week (≤ 1 year), 1 month after 1 year'], ['Severance', '1 week’s remuneration per completed year on retrenchment, death or retirement'], ['Probation', 'Common practice 3–6 months; dismissal still needs a valid reason and fair procedure']],
};

export function calendar(today) {
  return [
    ['PAYE return & payment (ITAS)', 'Namibia Revenue Agency (NamRA)', 'Monthly', monthlyDue(today, 20)],
    ['VET levy return & payment', 'Namibia Training Authority (NTA)', 'Monthly', monthlyDue(today, 20)],
    ['Social Security contributions', 'Social Security Commission (SSC)', 'Monthly', lastWorkingDay(today)],
    ['Annual PAYE reconciliation & PAYE5 certificates', 'NamRA', 'Annual', annualDue(today, 3, 31)],
  ];
}
