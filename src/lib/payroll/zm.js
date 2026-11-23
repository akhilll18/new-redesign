// Zambia payroll engine — 2026. PAYE monthly bands (0% to K5,100), NAPSA 5% + 5% (ceiling K37,236 a month from
// January 2026), NHIMA 1% + 1%, Skills Development Levy 0.5% employer.
import { r2, slabTax, monthlyDue, annualDue, check } from './common.js';

export const RATES = {
  effective: '2026 (NAPSA ceiling K37,236 from 1 Jan 2026)',
  bands: [[5100, 0], [7100, 0.20], [9200, 0.30], [Infinity, 0.37]],
  napsa: { rate: 0.05, ceiling: 37236 }, nhima: 0.01, sdl: 0.005,
};

export const REGIONS = [['LSK', 'Lusaka'], ['CB', 'Copperbelt']];
export const PROFILE = [{ key: 'tpin', label: 'ZRA TPIN', type: 'text', default: '' }, { key: 'napsa_no', label: 'NAPSA number', type: 'text', default: '' }];

export function compute(e, ctx) {
  const g = e.gross;
  const dim = ctx.daysInMonth, lop = Math.min(ctx.lopDays || 0, dim);
  const lopDed = r2(g / dim * lop), ot = r2(ctx.otPay || 0), earned = r2(g - lopDed + ot);
  const napsa = r2(Math.min(earned, RATES.napsa.ceiling) * RATES.napsa.rate), nhima = r2(earned * RATES.nhima);
  const paye = r2(slabTax(earned, RATES.bands));
  const deductions = [['PAYE (ZRA)', paye], ['NAPSA 5%', napsa], ['NHIMA 1%', nhima]];
  const employer = [['NAPSA 5%', napsa], ['NHIMA 1%', nhima], ['Skills Development Levy 0.5%', r2(earned * RATES.sdl)]];
  const totalDeductions = r2(deductions.reduce((s, x) => s + x[1], 0)), employerTotal = r2(employer.reduce((s, x) => s + x[1], 0));
  return {
    currency: 'ZMW', gross: g, earned,
    earnings: [['Basic salary', r2(g)], [`Unpaid leave (${lop})`, -lopDed], ['Overtime', ot]],
    deductions, employer, totalDeductions, employerTotal, net: r2(earned - totalDeductions), cost: r2(earned + employerTotal),
    steps: [['Gross (PAYE base)', earned], ['PAYE: 0% to K5,100, 20%, 30%, 37%', paye], ['NAPSA base (ceiling K37,236)', Math.min(earned, RATES.napsa.ceiling)]],
    notes: ['PAYE is computed on gross pay; some payrolls deduct NAPSA first — confirm the company’s ZRA practice.'],
  };
}

export function checks(e) {
  const out = [], p = e.profile || {};
  out.push(check('ZRA TPIN', p.tpin ? 'pass' : 'fail', p.tpin ? 'Recorded.' : 'TPIN needed for PAYE returns.', 'Income Tax Act Cap 323', true));
  out.push(check('NAPSA registration', p.napsa_no ? 'pass' : 'warn', p.napsa_no ? 'Recorded.' : 'Register with NAPSA within 14 days.', 'NAPSA Act 40 of 1996'));
  out.push(check('Minimum wage', 'info', 'Check the sector minimum wage order.', 'Minimum Wages Act'));
  return out;
}

export const policy = {
  'Working time': [['Hours', '48 h a week maximum'], ['Overtime', '1.5× normal days, 2× rest days and holidays'], ['Rest', '24 consecutive hours a week']],
  'Leave': [['Annual leave', '2 days per month (24 a year)'], ['Sick leave', 'Up to 26 weeks (3 months full pay, 3 half pay)'], ['Maternity / paternity', '14 weeks / 5 days']],
  'Pay & tax': [['PAYE', '0% up to K5,100 a month, then 20% – 37%'], ['Due date', 'PAYE by the 10th; NAPSA and NHIMA by the 10th'], ['Annual return', 'By 31 March']],
  'Social security': [['NAPSA', '5% + 5% up to K37,236 a month'], ['NHIMA', '1% + 1% of basic pay'], ['SDL', '0.5% of payroll, employer']],
  'Employment terms': [['Notice', '30 days for monthly-paid staff'], ['Redundancy', '2 months’ pay per year of service'], ['Gratuity', '25% of basic pay for fixed-term contracts']],
};

export function calendar(today) {
  return [
    ['PAYE return & payment', 'Zambia Revenue Authority', 'Monthly', monthlyDue(today, 10)],
    ['NAPSA contributions', 'NAPSA', 'Monthly', monthlyDue(today, 10)],
    ['NHIMA contributions', 'NHIMA', 'Monthly', monthlyDue(today, 10)],
    ['Skills Development Levy', 'ZRA', 'Monthly', monthlyDue(today, 10)],
  ];
}
