// Ireland payroll engine — 2026. PAYE (20% / 40%, SRCOP €44,000 single), tax credits, USC 2026 bands,
// PRSI Class A (4.2%, 4.3% from 1 October 2026) and employer PRSI.
import { r2, slabTax, monthlyDue, annualDue, check } from './common.js';

export const RATES = {
  effective: '2026 (Budget 2026; PRSI +0.1% from 1 Oct 2026)',
  paye: { srcopSingle: 44000, srcopMarried: 53000, standard: 0.20, higher: 0.40, personal: 2000, employee: 2000 },
  usc: { exemptUpTo: 13000, slabs: [[12012, 0.005], [28700, 0.02], [70044, 0.03], [Infinity, 0.08]] },
  prsi: { ee: 0.042, eeFromOct2026: 0.043, weeklyThreshold: 352, er: 0.1125, erLow: 0.09, erFromOct2026: 0.1135, erLowFromOct2026: 0.091, erLowWeekly: 552 },
  minimumWage: 14.15,
};

export const REGIONS = [['D', 'Dublin'], ['C', 'Cork'], ['G', 'Galway']];
export const PROFILE = [
  { key: 'ppsn', label: 'PPS number', type: 'text', default: '' },
  { key: 'status', label: 'Tax status', options: [['single', 'Single'], ['married1', 'Married, one income']], default: 'single' },
];

export function compute(e, ctx) {
  const g = e.gross, p = e.profile || {};
  const dim = ctx.daysInMonth, lop = Math.min(ctx.lopDays || 0, dim);
  const lopDed = r2(g / dim * lop), ot = r2(ctx.otPay || 0), earned = r2(g - lopDed + ot), A = earned * 12;
  const P = RATES.paye, married = p.status === 'married1';
  const srcop = married ? P.srcopMarried : P.srcopSingle;
  const grossTax = Math.min(A, srcop) * P.standard + Math.max(0, A - srcop) * P.higher;
  const credits = (married ? 2 * P.personal : P.personal) + P.employee;
  const paye = r2(Math.max(0, grossTax - credits) / 12);
  const usc = A <= RATES.usc.exemptUpTo ? 0 : r2(slabTax(A, RATES.usc.slabs) / 12);
  const late = ctx.period >= '2026-10', Q = RATES.prsi, weekly = A / 52;
  const prsi = weekly > Q.weeklyThreshold ? r2(earned * (late ? Q.eeFromOct2026 : Q.ee)) : 0;
  const erRate = weekly <= Q.erLowWeekly ? (late ? Q.erLowFromOct2026 : Q.erLow) : (late ? Q.erFromOct2026 : Q.er);
  const deductions = [['PAYE', paye], ['USC', usc], [`PRSI Class A (${((late ? Q.eeFromOct2026 : Q.ee) * 100).toFixed(1)}%)`, prsi]];
  const employer = [[`Employer PRSI (${(erRate * 100).toFixed(2)}%)`, r2(earned * erRate)]];
  const totalDeductions = r2(deductions.reduce((s, x) => s + x[1], 0)), employerTotal = r2(employer.reduce((s, x) => s + x[1], 0));
  return {
    currency: 'EUR', gross: g, earned,
    earnings: [['Basic pay', r2(g)], [`Unpaid leave (${lop})`, -lopDed], ['Overtime', ot]],
    deductions, employer, totalDeductions, employerTotal, net: r2(earned - totalDeductions), cost: r2(earned + employerTotal),
    steps: [['Annual pay', r2(A)], [`20% up to €${srcop.toLocaleString('en-IE')}, 40% above`, r2(grossTax)], ['Tax credits (personal + employee)', -credits], ['Annual PAYE', r2(Math.max(0, grossTax - credits))], ['USC on annual pay', r2(usc * 12)]],
    notes: ['Revenue issues each employee’s credits and cut-off through RPN; cumulative basis normally applies.', 'PRSI rates rise by 0.1% on 1 October 2026.'],
  };
}

export function checks(e) {
  const out = [], p = e.profile || {};
  out.push(check('PPS number & RPN', p.ppsn ? 'pass' : 'fail', p.ppsn ? 'Retrieve the Revenue Payroll Notification before paying.' : 'Without a PPSN and RPN, emergency tax applies.', 'TCA 1997, PAYE Regs 2018', true));
  out.push(check('National minimum wage', e.gross / (39 * 4.33) >= RATES.minimumWage ? 'pass' : 'fail', `≈ €${(e.gross / (39 * 4.33)).toFixed(2)}/h vs €${RATES.minimumWage}.`, 'National Minimum Wage Act 2000', true));
  out.push(check('Statutory sick pay', 'info', '5 days a year at 70% of pay (max €110 a day).', 'Sick Leave Act 2022'));
  return out;
}

export const policy = {
  'Working time': [['Maximum', '48 hours average a week'], ['Breaks', '15 min after 4.5 h, 30 min after 6 h'], ['Records', 'Working-time records kept for 3 years']],
  'Leave': [['Annual leave', '4 working weeks (20 days)'], ['Public holidays', '10 a year'], ['Sick leave', '5 statutory days at 70% of pay']],
  'Pay & tax': [['PAYE', '20% / 40%; credits €2,000 + €2,000'], ['USC', '0.5% – 8% (exempt up to €13,000)'], ['Real-time reporting', 'Payroll submission on or before each pay date']],
  'Social security': [['PRSI', 'Employee 4.2% (4.3% from Oct 2026)'], ['Employer PRSI', '9.0% / 11.25% (9.1% / 11.35% from Oct 2026)'], ['Pensions', 'Auto-enrolment (My Future Fund) from 2026']],
  'Employment terms': [['Notice', '1 week (13 weeks – 2 years) up to 8 weeks (15+ years)'], ['Redundancy', '2 weeks per year + 1 week (cap €600/week)'], ['Terms', 'Core terms in writing within 5 days']],
};

export function calendar(today) {
  return [
    ['PAYE / USC / PRSI return & payment', 'Revenue', 'Monthly', monthlyDue(today, 14)],
    ['Annual statement review', 'Revenue', 'Annual', annualDue(today, 1, 31)],
  ];
}
