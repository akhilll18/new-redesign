// Malaysia payroll engine — 2026. MTD/PCB (annualised, resident scale YA2026), EPF, SOCSO and EIS (ceiling RM6,000).
import { r2, slabTax, ageAt, monthlyDue, annualDue, check } from './common.js';

export const RATES = {
  effective: '2026 (SOCSO/EIS ceiling RM6,000)',
  tax: { slabs: [[5000, 0], [20000, 0.01], [35000, 0.03], [50000, 0.06], [70000, 0.11], [100000, 0.19], [400000, 0.25], [600000, 0.26], [2000000, 0.28], [Infinity, 0.30]], relief: 9000, epfRelief: 4000, rebateUpTo: 35000, rebate: 400 },
  epf: { ee: 0.11, er: 0.13, erAbove5000: 0.12, foreign: 0.02 },
  socso: { ee: 0.005, er: 0.0175, ceiling: 6000 }, eis: { ee: 0.002, er: 0.002, ceiling: 6000 },
  hrdf: 0.01, minimumWage: 1700,
};

export const REGIONS = [['KUL', 'Kuala Lumpur'], ['SGR', 'Selangor'], ['PNG', 'Penang'], ['JHR', 'Johor']];
export const PROFILE = [
  { key: 'citizen', label: 'Status', options: [['citizen', 'Malaysian / PR'], ['foreign', 'Foreign worker']], default: 'citizen' },
  { key: 'tin', label: 'Income tax number', type: 'text', default: '' },
];

export function compute(e, ctx) {
  const g = e.gross, p = e.profile || {}, foreign = p.citizen === 'foreign';
  const dim = ctx.daysInMonth, lop = Math.min(ctx.lopDays || 0, dim);
  const lopDed = r2(g / dim * lop), ot = r2(ctx.otPay || 0), earned = r2(g - lopDed + ot);
  const age = e.dob ? ageAt(e.dob, ctx.period + '-01') : 35;
  const E = RATES.epf, epfEE = r2(Math.ceil(earned * (foreign ? E.foreign : E.ee))), epfER = r2(Math.ceil(earned * (foreign ? E.foreign : earned > 5000 ? E.erAbove5000 : E.er)));
  const sBase = Math.min(earned, RATES.socso.ceiling);
  const socsoEE = foreign || age >= 60 ? 0 : r2(sBase * RATES.socso.ee), socsoER = r2(sBase * (foreign || age >= 60 ? 0.0125 : RATES.socso.er));
  const eisEE = foreign || age >= 60 ? 0 : r2(Math.min(earned, RATES.eis.ceiling) * RATES.eis.ee), eisER = eisEE;
  const T = RATES.tax, chargeable = Math.max(0, earned * 12 - T.relief - Math.min(epfEE * 12, T.epfRelief));
  const tax = Math.max(0, slabTax(chargeable, T.slabs) - (chargeable <= T.rebateUpTo ? T.rebate : 0));
  const pcb = r2(Math.floor(tax / 12 / 0.05) * 0.05);
  const deductions = [['PCB / MTD', pcb], [`EPF (${foreign ? 2 : 11}%)`, epfEE], ['SOCSO', socsoEE], ['EIS', eisEE]];
  const employer = [[`EPF (${foreign ? 2 : earned > 5000 ? 12 : 13}%)`, epfER], ['SOCSO', socsoER], ['EIS', eisER], ['HRD Corp levy 1%', r2(earned * RATES.hrdf)]];
  const totalDeductions = r2(deductions.reduce((s, x) => s + x[1], 0)), employerTotal = r2(employer.reduce((s, x) => s + x[1], 0));
  return {
    currency: 'MYR', gross: g, earned,
    earnings: [['Basic salary', r2(g)], [`Unpaid leave (${lop})`, -lopDed], ['Overtime (1.5× / 2× / 3×)', ot]],
    deductions, employer, totalDeductions, employerTotal, net: r2(earned - totalDeductions), cost: r2(earned + employerTotal),
    steps: [['Annual income', r2(earned * 12)], ['Less personal relief', -T.relief], ['Less EPF relief (max RM4,000)', -Math.min(epfEE * 12, T.epfRelief)], ['Chargeable income', r2(chargeable)], ['Annual tax after rebate', r2(tax)], ['Monthly PCB', pcb]],
    notes: ['Annualised estimate of the LHDN MTD formula; e-PCB gives the exact figure.', 'EPF uses the Third Schedule table (rounded up to the next ringgit).'],
  };
}

export function checks(e) {
  const out = [], p = e.profile || {};
  out.push(check('Income tax number', p.tin ? 'pass' : 'warn', p.tin ? 'Recorded.' : 'Register the employee with LHDN (e-Daftar) for PCB.', 'ITA 1967 s.83'));
  out.push(check('Minimum wage', e.gross >= RATES.minimumWage ? 'pass' : 'fail', `RM${e.gross} vs RM${RATES.minimumWage}.`, 'Minimum Wages Order 2024', true));
  out.push(check('EPF / SOCSO / EIS registration', 'info', 'Register within 7 days (EPF) and 30 days (SOCSO/EIS) of hiring.', 'EPF Act 1991; Act 4; Act 800'));
  return out;
}

export const policy = {
  'Working time': [['Hours', '45 hours a week'], ['Overtime', '1.5× normal days, 2× rest days, 3× public holidays'], ['Flexible work', 'Employees may apply in writing']],
  'Leave': [['Annual leave', '8 days (< 2 yrs), 12 (2–5 yrs), 16 (5+ yrs)'], ['Sick leave', '14 / 18 / 22 days + 60 days hospitalisation'], ['Maternity / paternity', '98 days / 7 days']],
  'Pay & tax': [['PCB', 'Monthly tax deduction by the 15th'], ['Form EA', 'To employees by end of February'], ['Form E', 'Employer return by 31 March']],
  'Social security': [['EPF', '11% employee; 13% / 12% employer'], ['SOCSO', '0.5% + 1.75% up to RM6,000'], ['EIS', '0.2% + 0.2% up to RM6,000']],
  'Employment terms': [['Notice', '4 weeks (< 2 yrs), 6 weeks (2–5), 8 weeks (5+)'], ['Termination benefits', '10 / 15 / 20 days per year'], ['Probation', 'By contract, usually 3 – 6 months']],
};

export function calendar(today) {
  return [
    ['PCB / MTD (e-PCB)', 'LHDN', 'Monthly', monthlyDue(today, 15)],
    ['EPF, SOCSO & EIS contributions', 'KWSP / PERKESO', 'Monthly', monthlyDue(today, 15)],
    ['Form EA to employees', 'LHDN', 'Annual', annualDue(today, 2, 28)],
    ['Form E', 'LHDN', 'Annual', annualDue(today, 3, 31)],
  ];
}
